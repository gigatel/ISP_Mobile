import {APIs, URLs} from '../src/apis';
import {
  getSplitterCustomers,
  getSplitterCustomerDetails,
  normalizeSplitterCustomers,
} from '../src/services/lastMileSplitterCustomers';
import {
  mergeApiCustomerConnections,
  savePreviewConnection,
  invalidateCustomerConnections,
} from '../src/screens/LastMileConnectivityScreen/customerPreview';
import type {Splitter} from '../src/screens/LastMileConnectivityScreen/types';

jest.mock('../src/apis', () => ({
  APIs: {getRequestWithQuery: jest.fn()},
  URLs: {
    getSplitterCustomerDetailsBySplitterId:
      'https://example.test/api/Splitter/GetSplitterCustomerDetailsBySplitterId',
  },
}));
const getRequest = APIs.getRequestWithQuery as jest.Mock;
const splitter: Splitter = {
  id: 'record-50',
  source: 'api',
  splitterId: 9,
  code: '086/2960/A-128/B-32-1',
  name: 'SPL-9',
  free: 31,
  distance: 36.05,
  latitude: 28.6,
  longitude: 77.2,
};
const connection = {
  splitterDetailId: 61,
  splitterId: 9,
  parentId: 61,
  splitterCode: '086/2960/A-128/B-32-1/1',
  tubeNo: 1,
  coreNo: 2,
  connectedTubeNo: 1,
  connectedCoreNo: 2,
  isActive: true,
  isCustomer: false,
  customerName: 'API Customer',
  customerMobileNo: '9000000000',
  customerLatLng: '28.54,77.25',
  customerAddress: 'API customer address',
  fiberMappingId: 12,
  routeFiberMappingId: 12,
  fiberCode: 'OGIG-3U',
  macAddress: 'A1:B2:C3:D4:E5:F6',
};
beforeEach(() => getRequest.mockReset());

test('uses selected splitterId rather than its nearby record id and encodes its full code', async () => {
  getRequest.mockResolvedValue({
    success: true,
    status: 200,
    data: {
      splitterRouteDetailsDto: [connection],
      routeChamberMappingDto: [{masterId: 1}],
    },
  });
  const rows = await getSplitterCustomers(splitter);
  expect(getRequest).toHaveBeenCalledWith({
    path: URLs.getSplitterCustomerDetailsBySplitterId,
    params:
      '?splitterId=9&splitterCode=086%2F2960%2FA-128%2FB-32-1&customerdetails=true&appType=app',
    isAuth: true,
  });
  expect(rows).toHaveLength(32);
  expect(rows[0]).toMatchObject({
    tube: '1',
    core: '2',
    mobile: '9000000000',
    name: 'API Customer',
    address: 'API customer address',
    latLng: '28.54,77.25',
    online: true,
    mac: 'A1:B2:C3:D4:E5:F6',
    gig: 'OGIG-3U',
  });
  expect(rows.filter(item => !item)).toHaveLength(31);
});

test('preserves sparse legs and normalizes inactive and unknown statuses', () => {
  const rows = normalizeSplitterCustomers(
    {
      splitterRouteDetailsDto: [
        {...connection, splitterCode: `${splitter.code}/5`, isActive: false},
        {...connection, splitterCode: `${splitter.code}/2`, isActive: null},
      ],
    },
    {...splitter, free: 6, totalPorts: 8},
  );
  expect(rows).toHaveLength(8);
  expect(rows[0]).toBeNull();
  expect(rows[4]?.online).toBe(false);
  expect(rows[1]?.online).toBeNull();
});

test('excludes another splitter and never treats chamber records as customers', () => {
  const rows = normalizeSplitterCustomers(
    {
      splitterRouteDetailsDto: [{...connection, splitterId: 99}],
      routeChamberMappingDto: [connection],
    },
    {...splitter, free: 0},
  );
  expect(rows).toEqual([]);
});

test('successful empty customer data retains only the server-reported free legs', async () => {
  getRequest.mockResolvedValue({
    success: true,
    data: {splitterRouteDetailsDto: []},
  });
  const rows = await getSplitterCustomers({...splitter, free: 4});
  expect(rows).toEqual([null, null, null, null]);
});

test('failed and malformed responses are errors rather than sample rows', async () => {
  getRequest.mockResolvedValueOnce({
    success: false,
    status: 200,
    message: 'No access',
  });
  await expect(getSplitterCustomers(splitter)).rejects.toThrow('No access');
  getRequest.mockResolvedValueOnce({
    success: true,
    data: {routeChamberMappingDto: [connection]},
  });
  await expect(getSplitterCustomers(splitter)).rejects.toThrow(
    'Invalid customer details response',
  );
  await expect(
    getSplitterCustomers({...splitter, splitterId: undefined}),
  ).rejects.toThrow('missing its ID or code');
});

test('an edit prefilled from the API survives focus refresh without changing other legs', () => {
  const selected = {...splitter, id: 'edit-test'};
  const rows = normalizeSplitterCustomers(
    {splitterRouteDetailsDto: [connection]},
    selected,
  );
  mergeApiCustomerConnections(selected, rows);
  savePreviewConnection(selected, 1, {...rows[0]!, name: 'Edited customer'});
  const refreshed = mergeApiCustomerConnections(selected, rows);
  expect(refreshed[0]?.name).toBe('Edited customer');
  expect(refreshed[1]).toBeNull();
  expect(rows[0]?.name).toBe('API Customer');
});

test('ambiguous duplicate leg assignments produce an error instead of hiding a customer', () => {
  expect(() =>
    normalizeSplitterCustomers(
      {splitterRouteDetailsDto: [connection, connection]},
      splitter,
    ),
  ).toThrow('leg assignments overlap');
});

test('free leg rows retain save metadata without becoming empty customer records or inflating capacity', async () => {
  const empty = {splitterId: 9, splitterDetailId: 61};
  const records = [
    connection,
    ...Array.from({length: 31}, (_, index) => ({
      ...empty,
      splitterCode: `${splitter.code}/${index + 2}`,
      customerName: null,
      customerMobileNo: null,
    })),
  ];
  getRequest.mockResolvedValue({
    success: true,
    data: {splitterRouteDetailsDto: records},
  });
  const result = await getSplitterCustomerDetails(splitter);
  expect(result.customers).toHaveLength(32);
  expect(result.customers.filter(Boolean)).toHaveLength(1);
  expect(result.customers[4]).toBeNull();
  expect(result.legs.find(row => row.leg === 5)).toEqual({
    leg: 5,
    splitterDetailId: 61,
    splitterCode: `${splitter.code}/5`,
  });
});

test('preserves explicit physical/virtual connectivity and remarks when reopening an edited customer', () => {
  const [customer] = normalizeSplitterCustomers(
    {
      splitterRouteDetailsDto: [
        {
          ...connection,
          id: 112,
          virtualConnection: false,
          remarks: 'Customer landmark',
          connectedFiberMappingId: 25,
        },
      ],
    },
    splitter,
  );
  expect(customer).toMatchObject({
    id: 112,
    connectivity: 'Physical GIG',
    landmark: 'Customer landmark',
    splitterDetailId: 61,
    splitterCode: `${splitter.code}/1`,
    fiberMappingId: 25,
  });
});

test('after a successful API save refreshed server rows replace old local previews', () => {
  const selected = {...splitter, id: 'saved-api-refresh-test'};
  const fixture = {
    ...connection,
    fiberCode: 'UNIQUE-SAVED-GIG',
    fiberMappingId: 987,
    routeFiberMappingId: 987,
  };
  const original = normalizeSplitterCustomers(
    {splitterRouteDetailsDto: [fixture]},
    selected,
  );
  mergeApiCustomerConnections(selected, original);
  savePreviewConnection(selected, 1, {
    ...original[0]!,
    name: 'Old local draft',
  });
  invalidateCustomerConnections(selected);
  const server = normalizeSplitterCustomers(
    {
      splitterRouteDetailsDto: [{...fixture, customerName: 'Saved on server'}],
    },
    selected,
  );
  expect(mergeApiCustomerConnections(selected, server)[0]?.name).toBe(
    'Saved on server',
  );
});

test.each([
  [
    {
      connectBy: null,
      connectedFiberMappingId: 23,
      connectedTubeNo: 2,
      connectedCoreNo: 4,
    },
    'Physical GIG',
  ],
  [{virtualConnection: true}, 'Virtual GIG'],
  [{virtualConnection: 'true'}, 'Virtual GIG'],
  [{virtualConnection: false}, 'Physical GIG'],
  [{virtualConnection: 'false'}, 'Physical GIG'],
  [{connectivity: 'Virtual / GIG'}, 'Virtual GIG'],
  [{connectivity: '', connectBy: 'Physical / GIG'}, 'Physical GIG'],
  [
    {connectedFiberMappingId: 0, connectedTubeNo: 0, connectedCoreNo: 0},
    'Virtual GIG',
  ],
])('restores the saved connectivity from API fields %j', (fields, expected) => {
  const [customer] = normalizeSplitterCustomers(
    {splitterRouteDetailsDto: [{...connection, ...fields}]},
    splitter,
  );
  expect(customer?.connectivity).toBe(expected);
});

test('maps customerDetailId to the existing connectivity ID independently of splitterDetailId', () => {
  const [customer] = normalizeSplitterCustomers(
    {
      splitterRouteDetailsDto: [
        {
          ...connection,
          id: 999,
          customerDetailId: 173,
          splitterDetailId: 50,
        },
      ],
    },
    splitter,
  );
  expect(customer).toMatchObject({
    id: 173,
    customerDetailId: 173,
    splitterDetailId: 50,
  });
});
