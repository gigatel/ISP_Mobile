import {getOlaMapApiKey, setOlaMapApiKey} from '../src/utils/olaMapKey';
import {olaReverseGeocode} from '../src/services/olaMapsService';
import {setData} from '../src/utils/preferences';

jest.mock('../src/utils/preferences', () => {
  const values: Record<string, unknown> = {};
  return {
    getData: jest.fn((key: string) => values[key]),
    setData: jest.fn((key: string, value: unknown) => {
      values[key] = value;
      return true;
    }),
  };
});

const fetchMock = jest.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  setData('LOGIN_RESPONSE', null);
  setOlaMapApiKey(undefined);
  global.fetch = fetchMock;
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({results: [{formatted_address: 'Test address'}]}),
  });
});

test('existing sessions read olaKey from the persisted loginUserInfo', async () => {
  setData('LOGIN_RESPONSE', {olaKey: ' nested-key '});
  expect(getOlaMapApiKey()).toBe('nested-key');
  await olaReverseGeocode(28.6, 77.2);
  expect(fetchMock.mock.calls[0][0]).toContain('api_key=nested-key');
});

afterAll(() => {
  global.fetch = originalFetch;
});

test('already-loaded geocoder uses the latest login key on each request', async () => {
  setOlaMapApiKey(' first-key ');
  expect(getOlaMapApiKey()).toBe('first-key');
  await olaReverseGeocode(28.6, 77.2);
  expect(fetchMock.mock.calls[0][0]).toContain('api_key=first-key');

  setOlaMapApiKey('second+key');
  await olaReverseGeocode(28.6, 77.2);
  expect(fetchMock.mock.calls[1][0]).toContain('api_key=second%2Bkey');
});

test('missing login key clears the previous key and skips Ola requests', async () => {
  setOlaMapApiKey('old-key');
  setOlaMapApiKey(undefined);
  expect(getOlaMapApiKey()).toBe('');
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(olaReverseGeocode(28.6, 77.2)).resolves.toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  warning.mockRestore();
});
