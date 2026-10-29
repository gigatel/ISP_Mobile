import {APIs, URLs} from '../src/apis';
import {getGigTubeCores} from '../src/services/gigTubeCores';

jest.mock('../src/apis', () => ({
  APIs: {getRequestWithQuery: jest.fn()},
  URLs: {
    getFiberTubeCoreColorForSplitter:
      'http://mob.gigatel.me:7004/api/Splitter/GetFiberTubeCoreColorForSplitter',
  },
}));
const get = APIs.getRequestWithQuery as jest.Mock;
beforeEach(() => get.mockReset());

test('fetches using the GIG mapping ID and selected tube with authentication', async () => {
  const cores = [
    {coreId: 1, coreName: '1. Blue', isUsed: false},
    {coreId: 3, coreName: '3. Green', isUsed: true},
  ];
  get.mockResolvedValue({success: true, status: 200, data: cores});
  await expect(getGigTubeCores(23, 2)).resolves.toEqual(cores);
  expect(get).toHaveBeenCalledWith({
    path: URLs.getFiberTubeCoreColorForSplitter,
    params: '?fiberMappingId=23&tubeNo=2&appType=app',
    isAuth: true,
  });
});

test('accepts empty options and rejects unsuccessful or malformed availability', async () => {
  get.mockResolvedValueOnce({success: true, data: []});
  await expect(getGigTubeCores(23, 2)).resolves.toEqual([]);
  get.mockResolvedValueOnce({success: false, message: 'No access'});
  await expect(getGigTubeCores(23, 2)).rejects.toThrow('No access');
  get.mockResolvedValueOnce({
    success: true,
    data: [{coreId: 1, coreName: 'Blue'}],
  });
  await expect(getGigTubeCores(23, 2)).rejects.toThrow(
    'Invalid core availability',
  );
  get.mockResolvedValueOnce({success: true, data: null});
  await expect(getGigTubeCores(23, 2)).rejects.toThrow(
    'Invalid core availability',
  );
});
