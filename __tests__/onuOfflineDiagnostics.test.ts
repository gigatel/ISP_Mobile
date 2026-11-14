import {
  createOnuDebugHttpClient,
  describeOnuError,
  onuLogUrl,
} from '../src/services/onuOfflineDiagnostics';
const mockSend = jest.fn();
jest.mock('@microsoft/signalr', () => ({
  DefaultHttpClient: jest.fn().mockImplementation(() => ({
    send: (request: unknown) => mockSend(request),
  })),
}));
const request = {
  method: 'POST',
  url: 'http://mob.gigatel.me:7006/isp_signalR_dev/switchshub/negotiate?userId=123&organizationId=1&access_token=secret-token&id=secret-connection',
  headers: {Authorization: 'Bearer secret-token'},
};
let spy: jest.SpyInstance;
beforeEach(() => {
  mockSend.mockReset();
  spy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => spy.mockRestore());
it('logs actual HTTP request/response metadata while redacting credentials and customer fields', async () => {
  const response = {
    statusCode: 200,
    content: JSON.stringify({
      negotiateVersion: 1,
      connectionToken: 'secret-connection',
      connectionId: 'secret-id',
      availableTransports: [{transport: 'WebSockets'}],
      Customers: [{CustomerName: 'Private Name', MobNo: 'private-phone'}],
    }),
  };
  mockSend.mockResolvedValue(response);
  const client = createOnuDebugHttpClient();
  await expect(client.send(request)).resolves.toBe(response);
  expect(mockSend).toHaveBeenCalledWith(request);
  const output = JSON.stringify(spy.mock.calls);
  expect(output).toContain('HTTP request');
  expect(output).toContain('HTTP response');
  expect(output).toContain('WebSockets');
  for (const secret of [
    'secret-token',
    'secret-connection',
    'secret-id',
    'Private Name',
    'private-phone',
    'Authorization',
  ]) {
    expect(output).not.toContain(secret);
  }
  expect(onuLogUrl(request.url)).toContain('userId=123');
});
it('reports a failed request without logging its sensitive error message and rethrows it', async () => {
  const failure = new Error('Failure involving secret-token');
  mockSend.mockRejectedValue(failure);
  await expect(
    createOnuDebugHttpClient(() => ['secret-token']).send(request),
  ).rejects.toBe(failure);
  const output = JSON.stringify(spy.mock.calls);
  expect(output).toContain('HTTP failed');
  expect(output).not.toContain('secret-token');
});
it('does not emit any diagnostic logs in production', async () => {
  const oldDev = __DEV__;
  (global as any).__DEV__ = false;
  try {
    mockSend.mockResolvedValue({statusCode: 200});
    await createOnuDebugHttpClient().send(request);
    expect(spy).not.toHaveBeenCalled();
  } finally {
    (global as any).__DEV__ = oldDev;
  }
});

it('preserves useful connection errors and status while stripping tokens and transport credentials', () => {
  const error = Object.assign(
    new Error(
      'Failed to complete negotiation: HTTP 401 https://example.com/hub?id=connection-secret&access_token=token-secret Bearer bearer-secret session-secret',
    ),
    {statusCode: 401},
  );
  const result = describeOnuError(error, ['session-secret']);
  expect(result.statusCode).toBe(401);
  expect(result.errorMessage).toContain(
    'Failed to complete negotiation: HTTP 401',
  );
  for (const secret of [
    'connection-secret',
    'token-secret',
    'bearer-secret',
    'session-secret',
  ]) {
    expect(JSON.stringify(result)).not.toContain(secret);
  }
});
