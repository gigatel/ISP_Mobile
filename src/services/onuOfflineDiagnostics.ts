import {DefaultHttpClient, HttpRequest, HttpResponse} from '@microsoft/signalr';

export const logOnuDebug = (
  event: string,
  details: Record<string, unknown>,
) => {
  if (__DEV__) {
    console.log(`[ONU SignalR] ${event}`, JSON.stringify(details, null, 2));
  }
};

// Keep session scope visible, but never expose authorization/connection tokens.
export function onuLogUrl(value?: string) {
  try {
    const url = new URL(value ?? '');
    const params = new URLSearchParams();
    url.searchParams.forEach((entry, key) => {
      params.append(
        key,
        ['userId', 'organizationId', 'companyId', 'negotiateVersion'].includes(
          key,
        )
          ? entry
          : '[REDACTED]',
      );
    });
    return `${url.origin}${url.pathname}${
      params.toString() ? `?${params}` : ''
    }`;
  } catch {
    return '[Invalid URL]';
  }
}

// Error messages often embed transport URLs and bearer credentials.
export function describeOnuError(error: unknown, secrets: string[] = []) {
  const redact = (value: string) => {
    let message = value;
    for (const secret of secrets) {
      if (secret) {
        message = message.split(secret).join('[REDACTED]');
      }
    }
    return message
      .replace(/https?:\/\/[^\s'"<>]+|wss?:\/\/[^\s'"<>]+/gi, url =>
        onuLogUrl(url),
      )
      .replace(/Bearer\s+[^\s'",;]+/gi, 'Bearer [REDACTED]')
      .replace(
        /([?&](?:access_token|connectionToken|token|id)=)[^&\s'"<>]+/gi,
        '$1[REDACTED]',
      )
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        '[REDACTED]',
      )
      .slice(0, 1500);
  };
  const value =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : null;
  return {
    errorType: error instanceof Error ? redact(error.name) : 'UnknownError',
    errorMessage: redact(
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Unknown connection error',
    ),
    ...(typeof value?.statusCode === 'number'
      ? {statusCode: value.statusCode}
      : {}),
  };
}

function responseSummary(response: HttpResponse) {
  const summary: Record<string, unknown> = {statusCode: response.statusCode};
  // Only negotiation metadata is logged; response bodies can contain customer PII.
  if (typeof response.content === 'string') {
    summary.contentLength = response.content.length;
    try {
      const data = JSON.parse(response.content);
      if (data && typeof data === 'object') {
        if (typeof data.negotiateVersion === 'number') {
          summary.negotiateVersion = data.negotiateVersion;
        }
        if (Array.isArray(data.availableTransports)) {
          summary.availableTransports = data.availableTransports.flatMap(
            (item: any) =>
              ['WebSockets', 'ServerSentEvents', 'LongPolling'].includes(
                item?.transport,
              )
                ? [item.transport]
                : [],
          );
        }
        if (data.connectionToken || data.connectionId) {
          summary.connectionCredentials = '[REDACTED]';
        }
        if (data.error) {
          summary.hasServerError = true;
        }
      }
    } catch {
      /* Plain-text and transport responses are not logged. */
    }
  }
  return summary;
}

export function createOnuDebugHttpClient(
  getSecrets: () => string[] = () => [],
) {
  // Preserve SignalR's default transport, cookies, cancellation and timeout behavior.
  const client = new DefaultHttpClient({log: () => {}});
  const send = client.send.bind(client);
  client.send = async (request: HttpRequest) => {
    const started = Date.now();
    const requestInfo = {method: request.method, url: onuLogUrl(request.url)};
    logOnuDebug('HTTP request', requestInfo);
    try {
      const response = await send(request);
      logOnuDebug('HTTP response', {
        ...requestInfo,
        ...responseSummary(response),
        durationMs: Date.now() - started,
      });
      return response;
    } catch (error) {
      logOnuDebug('HTTP failed', {
        ...requestInfo,
        durationMs: Date.now() - started,
        ...describeOnuError(error, getSecrets()),
      });
      throw error;
    }
  };
  return client;
}
