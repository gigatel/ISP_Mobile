jest.mock('../src/services/onuOfflineDiagnostics', () => ({
  createOnuDebugHttpClient: () => ({}),
  logOnuDebug: jest.fn(),
  describeOnuError: (error: Error) => ({
    errorType: error.name,
    errorMessage: error.message,
  }),
}));
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('immer', () =>
  jest.requireActual('../node_modules/immer/dist/cjs/immer.cjs.development.js'),
);
import {AppState} from 'react-native';
import {logOnuDebug} from '../src/services/onuOfflineDiagnostics';
import {
  mountOnuSession,
  retryOnuConnection,
  ONU_EVENT,
} from '../src/services/onuOfflineSignalR';
import {Preferences} from '../src/utils';
import {store} from '../src/store/store';
import {HubConnectionBuilder} from '@microsoft/signalr';

const mockPreferences: Record<string, unknown> = {};
let mockPreferenceListener: () => void;
let mockNetworkListener: (state: {isConnected: boolean}) => void;
const mockConnections: any[] = [];
let mockStartFailures = 0;
jest.mock('../src/utils', () => ({
  Preferences: {
    getData: (key: string) => mockPreferences[key],
    observeSession: (listener: () => void) => {
      mockPreferenceListener = listener;
      return jest.fn();
    },
  },
}));
jest.mock('../src/apis/urls', () => ({API_ENVIRONMENT: 'DEV'}));
jest.mock('../src/store/store', () => ({
  store: {
    dispatch: jest.fn(),
    getState: () => ({dashboard: {}}),
    subscribe: jest.fn(() => jest.fn()),
  },
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (listener: typeof mockNetworkListener) => {
      mockNetworkListener = listener;
      return jest.fn();
    },
  },
}));
jest.mock('@microsoft/signalr', () => ({
  HubConnectionState: {Disconnected: 'Disconnected'},
  LogLevel: {None: 6},
  HubConnectionBuilder: jest.fn().mockImplementation(() => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const connection: any = {
      state: 'Disconnected',
      handlers,
      start: jest.fn(async () => {
        if (mockStartFailures-- > 0) {
          throw new Error('offline');
        }
        connection.state = 'Connected';
      }),
      stop: jest.fn(async () => {
        connection.state = 'Disconnected';
      }),
      on: jest.fn((name, callback) => {
        handlers[name] = callback;
      }),
      off: jest.fn(),
      onclose: jest.fn(callback => {
        handlers.close = callback;
      }),
      onreconnecting: jest.fn(callback => {
        handlers.reconnecting = callback;
      }),
      onreconnected: jest.fn(callback => {
        handlers.reconnected = callback;
      }),
    };
    const builder: any = {
      withUrl: jest.fn(() => builder),
      withAutomaticReconnect: jest.fn(() => builder),
      configureLogging: jest.fn(() => builder),
      build: () => connection,
    };
    mockConnections.push({connection, builder});
    return builder;
  }),
}));
const flush = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
  }
};
let cleanup: () => void;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockConnections.length = 0;
  mockStartFailures = 0;
  Object.keys(mockPreferences).forEach(key => delete mockPreferences[key]);
  Object.assign(mockPreferences, {
    API_AUTH_TOKEN: 'test-session-token',
    LOGIN_RESPONSE: {userId: 123, organizationId: 1, companyId: 11},
    COMPANY_ID: 11,
  });
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({remove: jest.fn()});
});
afterEach(async () => {
  cleanup?.();
  await flush();
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('starts once per session with dynamic scope, registers exact event and clears on logout', async () => {
  cleanup = mountOnuSession();
  await flush();
  const {builder, connection} = mockConnections[0];
  expect(builder.withUrl).toHaveBeenCalledWith(
    expect.stringContaining(
      'switchshub?userId=123&companyId=11&organizationId=1',
    ),
    expect.any(Object),
  );
  expect(connection.on).toHaveBeenCalledWith(
    'OnuOfflineCustomersUpdate',
    expect.any(Function),
  );
  expect(connection.on.mock.invocationCallOrder[0]).toBeLessThan(
    connection.start.mock.invocationCallOrder[0],
  );
  mockPreferenceListener();
  mockPreferenceListener();
  await flush();
  expect(HubConnectionBuilder).toHaveBeenCalledTimes(1);
  connection.handlers[ONU_EVENT]({
    OrganizationId: 1,
    ServerId: 2,
    Customers: [],
  });
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({type: 'onuOffline/onuUpdate'}),
  );
  delete mockPreferences.API_AUTH_TOKEN;
  mockPreferenceListener();
  await flush();
  expect(connection.off).toHaveBeenCalledWith(ONU_EVENT, expect.any(Function));
  expect(connection.stop).toHaveBeenCalledTimes(1);
  expect(store.dispatch).toHaveBeenCalledWith({type: 'onuOffline/resetOnu'});
});
it('retries failed initial starts without rebuilding or adding listeners', async () => {
  mockStartFailures = 1;
  cleanup = mountOnuSession();
  await flush();
  const {connection} = mockConnections[0];
  expect(connection.start).toHaveBeenCalledTimes(1);
  expect(connection.state).toBe('Disconnected');
  jest.advanceTimersByTime(2000);
  await flush();
  expect(connection.start).toHaveBeenCalledTimes(2);
  expect(connection.state).toBe('Connected');
  expect(connection.on).toHaveBeenCalledTimes(1);
  expect(HubConnectionBuilder).toHaveBeenCalledTimes(1);
});
it('suspends on loss of internet and reconnects with existing shared records retained', async () => {
  cleanup = mountOnuSession();
  await flush();
  jest.mocked(store.dispatch).mockClear();
  mockNetworkListener({isConnected: false});
  await flush();
  expect(mockConnections[0].connection.stop).toHaveBeenCalledTimes(1);
  expect(store.dispatch).not.toHaveBeenCalledWith({
    type: 'onuOffline/resetOnu',
  });
  mockNetworkListener({isConnected: true});
  await flush();
  expect(mockConnections).toHaveLength(2);
  retryOnuConnection();
  await flush();
  expect(mockConnections[1].connection.start).toHaveBeenCalledTimes(1);
});
it('does not substitute an employee ID or a default organization when session scope is missing', async () => {
  mockPreferences.LOGIN_RESPONSE = {employeeId: 555};
  cleanup = mountOnuSession();
  await flush();
  expect(HubConnectionBuilder).not.toHaveBeenCalled();
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({status: 'unavailable'}),
    }),
  );
  expect(Preferences.getData('LOGIN_RESPONSE')).toEqual({employeeId: 555});
});

it('does not report intentional cancellation during negotiation as a connection failure', async () => {
  cleanup = mountOnuSession();
  await flush();
  const {connection} = mockConnections[0];
  let cancel: (error: Error) => void = () => {};
  connection.state = 'Disconnected';
  connection.start.mockImplementationOnce(
    () =>
      new Promise<void>((_, reject) => {
        cancel = reject;
      }),
  );
  connection.stop.mockImplementationOnce(async () => {
    connection.state = 'Disconnected';
    cancel(new Error('The connection was stopped during negotiation.'));
  });
  jest.mocked(logOnuDebug).mockClear();
  retryOnuConnection();
  await flush();
  mockNetworkListener({isConnected: false});
  await flush();
  expect(logOnuDebug).toHaveBeenCalledWith(
    'Connection intentionally stopped',
    expect.objectContaining({reason: 'network unavailable'}),
  );
  expect(logOnuDebug).not.toHaveBeenCalledWith(
    'Connection failed',
    expect.anything(),
  );
  jest.advanceTimersByTime(30000);
  await flush();
  expect(connection.start).toHaveBeenCalledTimes(2);
});

it.each([0, 99])(
  'uses the AppLogin company when the stored selection is %s',
  async selectedCompany => {
    mockPreferences.COMPANY_ID = selectedCompany;
    mockPreferences.LOGIN_RESPONSE = {
      userId: 16,
      organizationId: 1,
      companyId: 24,
    };
    cleanup = mountOnuSession();
    await flush();
    expect(mockConnections[0].builder.withUrl).toHaveBeenCalledWith(
      expect.stringContaining('userId=16&companyId=24&organizationId=1'),
      expect.any(Object),
    );
  },
);

it('waits for the AppLogin company even when another selected company exists', async () => {
  mockPreferences.COMPANY_ID = 99;
  mockPreferences.LOGIN_RESPONSE = {userId: 123, organizationId: 1};
  cleanup = mountOnuSession();
  await flush();
  expect(HubConnectionBuilder).not.toHaveBeenCalled();
  expect(store.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({status: 'unavailable'}),
    }),
  );
  mockPreferences.LOGIN_RESPONSE = {
    userId: 123,
    organizationId: 1,
    companyId: 24,
  };
  mockPreferenceListener();
  await flush();
  expect(mockConnections[0].builder.withUrl).toHaveBeenCalledWith(
    expect.stringContaining('userId=123&companyId=24&organizationId=1'),
    expect.any(Object),
  );
});

it('logs event receipt before reporting a malformed payload without logging customer details', async () => {
  cleanup = mountOnuSession();
  await flush();
  jest.mocked(logOnuDebug).mockClear();
  mockConnections[0].connection.handlers[ONU_EVENT]({
    Message: 'Customer data not included',
  });
  expect(logOnuDebug).toHaveBeenNthCalledWith(
    1,
    'Event received',
    expect.objectContaining({event: ONU_EVENT}),
  );
  expect(logOnuDebug).toHaveBeenNthCalledWith(
    2,
    'Invalid event response',
    expect.objectContaining({
      validationError: 'Invalid ONU scope or customers',
    }),
  );
  expect(store.dispatch).not.toHaveBeenCalledWith(
    expect.objectContaining({type: 'onuOffline/onuUpdate'}),
  );
});

it('does not restart or change hub scope when only the selected-company preference changes', async () => {
  cleanup = mountOnuSession();
  await flush();
  mockPreferences.COMPANY_ID = 99;
  mockPreferenceListener();
  await flush();
  expect(HubConnectionBuilder).toHaveBeenCalledTimes(1);
  expect(mockConnections[0].connection.stop).not.toHaveBeenCalled();
  expect(mockConnections[0].builder.withUrl).toHaveBeenCalledWith(
    expect.stringContaining('companyId=11'),
    expect.any(Object),
  );
});
