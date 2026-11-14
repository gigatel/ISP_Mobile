import 'react-native-url-polyfill/auto';
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import {AppState} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {Preferences} from '@utils';
import {store} from '../store/store';
import {
  onuConnection,
  onuInvalidUpdate,
  onuUpdate,
  resetOnu,
} from '../store/slices/onuOffline.slice';
import {parseOnuUpdate, scopeId} from '../features/onuOffline/model';
import {API_ENVIRONMENT} from '../apis/urls';
import {
  createOnuDebugHttpClient,
  describeOnuError,
  logOnuDebug,
} from './onuOfflineDiagnostics';

// Configure an HTTPS hub here before enabling this development module in production.
export const ONU_HUB_URL =
  API_ENVIRONMENT === 'DEV'
    ? 'http://mob.gigatel.me:7006/isp_signalR_dev/switchshub'
    : '';
export const ONU_EVENT = 'OnuOfflineCustomersUpdate';
let retryCurrent = () => {};
export const retryOnuConnection = () => retryCurrent();
let mounted = false;
let sessionShutdown: Promise<void> = Promise.resolve();

export function mountOnuSession() {
  if (mounted) {
    return () => {};
  }
  mounted = true;
  let disposed = false;
  let signature = '';
  let stopCurrent: ((reason: string) => Promise<void>) | undefined;
  let queue = sessionShutdown;
  let online = true;
  let active =
    AppState.currentState !== 'background' &&
    AppState.currentState !== 'inactive';
  const sync = () => {
    queue = queue
      .then(async () => {
        if (disposed) {
          return;
        }
        const token = Preferences.getData('API_AUTH_TOKEN');
        const user = Preferences.getData('LOGIN_RESPONSE');
        const employee =
          store.getState().dashboard.dashboardList?.employeeDetails;
        const userId = scopeId(user?.userId ?? user?.UserId);
        const organizationId = scopeId(
          user?.organizationId ??
            user?.OrganizationId ??
            (String(employee?.userId) === userId
              ? employee?.organizationId
              : undefined),
        );
        // The hub company is the company returned by AppLogin, independently
        // of the company selection preference used by other app modules.
        const companyId = scopeId(user?.companyId ?? user?.CompanyId);
        const next = JSON.stringify([
          token,
          userId,
          organizationId,
          companyId,
          active,
          online,
        ]);
        if (signature === next) {
          return;
        }
        const previousScope = signature
          ? JSON.parse(signature).slice(0, 4).join('|')
          : '';
        signature = next;
        await stopCurrent?.(
          !token
            ? 'logout'
            : !active
            ? 'app backgrounded'
            : !online
            ? 'network unavailable'
            : 'session changed',
        );
        stopCurrent = undefined;
        retryCurrent = () => {};
        if (
          previousScope !== [token, userId, organizationId, companyId].join('|')
        ) {
          store.dispatch(resetOnu());
        }
        if (!token) {
          store.dispatch(resetOnu());
          return;
        }
        if (!userId || !companyId || !organizationId || !ONU_HUB_URL) {
          logOnuDebug('Connection scope unavailable', {
            userId,
            companyId,
            organizationId,
            hubUrl: ONU_HUB_URL,
          });
          store.dispatch(
            onuConnection({
              status: 'unavailable',
              error: !ONU_HUB_URL
                ? 'A production HTTPS SignalR endpoint must be configured.'
                : 'The signed-in session is missing a user ID, company ID or organization ID.',
            }),
          );
          return;
        }
        if (!active || !online) {
          store.dispatch(
            onuConnection({status: !active ? 'paused' : 'disconnected'}),
          );
          return;
        }
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let starting: Promise<void> | undefined;
        let attempts = 0;
        const url = `${ONU_HUB_URL}?userId=${encodeURIComponent(
          userId,
        )}&companyId=${encodeURIComponent(
          companyId,
        )}&organizationId=${encodeURIComponent(organizationId)}`;
        const connection = new HubConnectionBuilder()
          .withUrl(url, {
            httpClient: __DEV__
              ? createOnuDebugHttpClient(() => [
                  token,
                  Preferences.getData('API_AUTH_TOKEN') ?? '',
                ])
              : undefined,
            accessTokenFactory: () =>
              Preferences.getData('API_AUTH_TOKEN') ?? '',
          })
          .withAutomaticReconnect([0, 2000, 10000, 30000])
          .configureLogging(LogLevel.None)
          .build();
        const status = (
          value: 'connecting' | 'connected' | 'reconnecting' | 'disconnected',
          error?: string,
        ) => {
          if (!stopped) {
            store.dispatch(onuConnection({status: value, error}));
          }
        };
        const receive = (raw: unknown) => {
          if (stopped || Preferences.getData('API_AUTH_TOKEN') !== token) {
            return;
          }
          logOnuDebug('Event received', {
            event: ONU_EVENT,
            payloadType: typeof raw === 'string' ? 'JSON string' : typeof raw,
          });
          try {
            const update = parseOnuUpdate(raw, organizationId);
            logOnuDebug('Event response', {
              event: ONU_EVENT,
              payloadType: typeof raw === 'string' ? 'JSON string' : 'object',
              OrganizationId: update.OrganizationId,
              ServerId: update.ServerId,
              receivedCustomers: update.Customers.length,
              offlineCustomers: update.Customers.filter(
                customer => !customer.IsOnline,
              ).length,
              onlineCustomers: update.Customers.filter(
                customer => customer.IsOnline,
              ).length,
              customerDetails: '[REDACTED]',
            });
            store.dispatch(
              onuUpdate({update, receivedAt: new Date().toISOString()}),
            );
          } catch (error) {
            logOnuDebug('Invalid event response', {
              event: ONU_EVENT,
              payloadType: typeof raw,
              validationError:
                error instanceof SyntaxError
                  ? 'Invalid JSON string'
                  : error instanceof Error
                  ? error.message
                  : 'Invalid customer payload',
            });
            store.dispatch(onuInvalidUpdate());
          }
        };
        const schedule = () => {
          if (stopped || timer) {
            return;
          }
          timer = setTimeout(() => {
            timer = undefined;
            start();
          }, Math.min(30000, 2000 * 2 ** Math.min(attempts++, 4)));
        };
        const start = () => {
          if (
            stopped ||
            starting ||
            connection.state !== HubConnectionState.Disconnected
          ) {
            return;
          }
          if (timer) {
            clearTimeout(timer);
            timer = undefined;
          }
          logOnuDebug('Connection request', {
            url,
            userId,
            organizationId,
            companyId,
            event: ONU_EVENT,
          });
          status('connecting');
          starting = connection
            .start()
            .then(() => {
              if (stopped) {
                return;
              }
              attempts = 0;
              logOnuDebug('Connected', {url, state: connection.state});
              status('connected');
            })
            .catch(error => {
              // Background/logout/network cleanup deliberately cancels pending starts.
              if (stopped) {
                return;
              }
              logOnuDebug('Connection failed', {
                url,
                ...describeOnuError(error, [token]),
                retrying: true,
              });
              status(
                'disconnected',
                'Live connection unavailable. Retrying automatically.',
              );
              schedule();
            })
            .finally(() => {
              starting = undefined;
            });
        };
        connection.on(ONU_EVENT, receive);
        logOnuDebug('Listener registered', {event: ONU_EVENT, url});
        connection.onreconnecting(error => {
          logOnuDebug('Reconnecting', {
            url,
            ...(error ? describeOnuError(error, [token]) : {}),
          });
          status('reconnecting');
        });
        connection.onreconnected(() => {
          logOnuDebug('Reconnected', {url});
          attempts = 0;
          status('connected');
        });
        connection.onclose(error => {
          if (!stopped) {
            logOnuDebug('Disconnected', {
              url,
              retrying: true,
              ...(error ? describeOnuError(error, [token]) : {}),
            });
          }
          status('disconnected');
          schedule();
        });
        stopCurrent = async reason => {
          stopped = true;
          logOnuDebug('Connection intentionally stopped', {url, reason});
          if (timer) {
            clearTimeout(timer);
          }
          connection.off(ONU_EVENT, receive);
          await connection.stop().catch(() => {});
          await starting;
        };
        retryCurrent = start;
        start();
      })
      .catch(() => {
        signature = '';
        if (!disposed) {
          store.dispatch(
            onuConnection({
              status: 'disconnected',
              error: 'Unable to initialize live updates.',
            }),
          );
        }
      });
  };
  const preferences = Preferences.observeSession(sync);
  const redux = store.subscribe(sync);
  const app = AppState.addEventListener('change', state => {
    active = state === 'active';
    sync();
  });
  const net = NetInfo.addEventListener(state => {
    online = state.isConnected !== false && state.isInternetReachable !== false;
    sync();
  });
  sync();
  return () => {
    disposed = true;
    mounted = false;
    preferences();
    redux();
    app.remove();
    net();
    retryCurrent = () => {};
    sessionShutdown = queue
      .then(() => stopCurrent?.('session observer unmounted'))
      .then(() => {})
      .catch(() => {});
  };
}
