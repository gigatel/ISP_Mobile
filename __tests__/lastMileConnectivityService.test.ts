import {APIs, URLs} from '../src/apis';
import {
  distanceLabel,
  getNearbyCustomerSplitters,
  hasSplitterCoordinate,
  normalizeNearbySplitter,
  parseSplitterCoordinate,
  powerLabel,
  splitterRatio,
  sortSplittersByDistance,
} from '../src/services/lastMileConnectivityService';
import {getPreviewConnections} from '../src/screens/LastMileConnectivityScreen/customerPreview';

jest.mock('../src/apis', () => ({
  APIs: {getRequestWithQuery: jest.fn()},
  URLs: {
    getNearbyCustomerSplitters:
      'http://example.test/api/Splitter/GetNearbyCustomerSplitters',
  },
}));
const getRequest = APIs.getRequestWithQuery as jest.Mock;
const row = {
  id: 50,
  splitterId: 8,
  splitterCode: '086/2960/A-128/B-32-1',
  laymenCode: 'SPL-8- L2 - N1',
  parentSplitterCode: 'SPL-8',
  deviceId: 10,
  portId: 327,
  splitterType: '',
  splitParentLeg: 32,
  masterSiteId: 102,
  masterAdd:
    '429, Kalkaji Main Rd, Block E, Kalkaji, New Delhi, Delhi, 110019, India',
  masterLandmark: 'Yes bank',
  masterLatLng: '28.5416742, 77.2546849',
  distanceMeters: 36.05,
  totalConnectedCustomers: 160,
  freePorts: 31,
  opticalPowerIn: null,
  opticalPowerOut: null,
  rxPower: null,
  txPower: null,
};
beforeEach(() => getRequest.mockReset());

test('orders all splitters by distance while preserving ties and keeping unknown distances last', () => {
  const splitter = normalizeNearbySplitter(row)!;
  const records = [
    {...splitter, id: 'far', distance: 100},
    {...splitter, id: 'unknown', distance: null},
    {...splitter, id: 'near', distance: 10},
    {...splitter, id: 'tie', distance: 10},
  ];
  expect(sortSplittersByDistance(records).map(item => item.id)).toEqual([
    'near',
    'tie',
    'far',
    'unknown',
  ]);
  expect(records[0].id).toBe('far');
});

test('displays API ratio before the free-port count with the requested free-port fallback', () => {
  const splitter = normalizeNearbySplitter(row)!;
  expect(splitterRatio(splitter)).toBe('1:31');
  expect(splitterRatio({...splitter, splitterType: '1:32', free: 12})).toBe(
    '1:32',
  );
  expect(splitterRatio({...splitter, splitterType: '32', free: 12})).toBe(
    '1:32',
  );
  expect(splitterRatio({...splitter, splitterType: '1 / 16'})).toBe('1:16');
  expect(splitter.totalPorts).toBeUndefined();
});

test('sends the selected range and exact device coordinates as an authenticated GET', async () => {
  getRequest.mockResolvedValue({success: true, status: 200, data: [row]});
  const coordinate = {
    latitude: 28.541846770705632,
    longitude: 77.25437267274481,
  };
  const splitters = await getNearbyCustomerSplitters(200, coordinate);
  expect(getRequest).toHaveBeenCalledWith({
    path: URLs.getNearbyCustomerSplitters,
    params: `?Range=200&LatLng=${encodeURIComponent(
      `${coordinate.latitude},${coordinate.longitude}`,
    )}`,
    isAuth: true,
  });
  expect(splitters[0]).toMatchObject({
    id: '50',
    splitterId: 8,
    name: row.laymenCode,
    code: row.splitterCode,
    displayCode: 'SPL-8',
    free: 31,
    distance: 36.05,
    latitude: 28.5416742,
    longitude: 77.2546849,
    address: row.masterAdd,
    landmark: 'Yes bank',
    connectedCustomers: 160,
  });
  expect(splitters[0].totalPorts).toBeUndefined();
});

test('null readings and missing splitter type stay unknown rather than displaying sample values', () => {
  const splitter = normalizeNearbySplitter(row)!;
  expect(splitter.splitterType).toBe('');
  expect(splitter.opticalPowerIn).toBeNull();
  expect(powerLabel(splitter.opticalPowerIn)).toBe('—');
  expect(powerLabel(0)).toBe('0 dBm');
  expect(distanceLabel(splitter.distance)).toBe('36.05m');
  expect(distanceLabel(null)).toBe('—');
});

test('invalid master coordinates do not hide the card or put a marker at 0,0', () => {
  const splitter = normalizeNearbySplitter({...row, masterLatLng: 'invalid'})!;
  expect(splitter.name).toBe(row.laymenCode);
  expect(splitter.latitude).toBeNull();
  expect(hasSplitterCoordinate(splitter)).toBe(false);
  expect(parseSplitterCoordinate(',')).toBeNull();
  expect(parseSplitterCoordinate('91, 77')).toBeNull();
  expect(parseSplitterCoordinate('0, 0')).toEqual({latitude: 0, longitude: 0});
});

test('range updates send the new value', async () => {
  getRequest.mockResolvedValue({success: true, status: 200, data: []});
  await getNearbyCustomerSplitters(500, {latitude: 28.6, longitude: 77.2});
  expect(getRequest.mock.calls[0][0].params).toBe(
    '?Range=500&LatLng=28.6%2C77.2',
  );
});

test('successful empty data is an empty list; an unsuccessful response is an error', async () => {
  getRequest.mockResolvedValueOnce({success: true, status: 200, data: []});
  await expect(
    getNearbyCustomerSplitters(200, {latitude: 28.6, longitude: 77.2}),
  ).resolves.toEqual([]);
  getRequest.mockResolvedValueOnce({
    success: false,
    status: 200,
    message: 'Permission denied',
    data: [],
  });
  await expect(
    getNearbyCustomerSplitters(200, {latitude: 28.6, longitude: 77.2}),
  ).rejects.toThrow('Permission denied');
});

test('rejects malformed envelopes and skips invalid rows', async () => {
  getRequest.mockResolvedValueOnce({success: true, data: null});
  await expect(
    getNearbyCustomerSplitters(200, {latitude: 28.6, longitude: 77.2}),
  ).rejects.toThrow('Invalid splitter list response');
  getRequest.mockResolvedValueOnce({success: true, data: [null, {}, row]});
  await expect(
    getNearbyCustomerSplitters(200, {latitude: 28.6, longitude: 77.2}),
  ).resolves.toHaveLength(1);
});

test('live splitters do not acquire fake sample customers or assume eight-port capacity', () => {
  const splitter = normalizeNearbySplitter(row)!;
  const customers = getPreviewConnections(splitter);
  expect(customers).toHaveLength(31);
  expect(customers.every(customer => customer === null)).toBe(true);
  expect(
    normalizeNearbySplitter({...row, splitterType: '1:32'})!.totalPorts,
  ).toBe(32);
});
