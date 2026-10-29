import {
  buildSplitterCustomerLinks,
  getDistinctCustomerMapLines,
  loadSplitterCustomerLinks,
} from '../src/services/splitterCustomerMap';
import {getSplitterCustomers} from '../src/services/lastMileSplitterCustomers';
import type {
  Splitter,
  SplitterCustomer,
} from '../src/screens/LastMileConnectivityScreen/types';

jest.mock('../src/apis', () => ({APIs: {}, URLs: {}}));
jest.mock('../src/services/lastMileSplitterCustomers', () => ({
  getSplitterCustomers: jest.fn(),
}));
const get = jest.mocked(getSplitterCustomers);
const splitter: Splitter = {
  id: 'record-50',
  splitterId: 8,
  name: 'SPL-8',
  code: 'A/B-32-1',
  latitude: 28.54,
  longitude: 77.25,
  free: 31,
  distance: 10,
  source: 'api',
};
const customer: SplitterCustomer = {
  id: 173,
  customerDetailId: 173,
  tube: '1',
  core: '2',
  mobile: '9000000000',
  mac: '',
  name: 'Customer',
  address: 'Customer address',
  latLng: '28.54123456789, 77.25678901234',
  online: null,
  connectivity: 'Physical GIG',
  gig: 'OGIG-4U',
  landmark: '',
};
beforeEach(() => get.mockReset());

test('links the actual customer position to its splitter and retains sparse leg assignments', () => {
  const result = buildSplitterCustomerLinks(splitter, [null, customer], 3);
  expect(result.missingCoordinates).toBe(0);
  expect(result.links).toEqual([
    expect.objectContaining({
      key: 'record-50:2',
      splitterNumber: 3,
      splitter,
      leg: 2,
      customer,
      coordinates: [
        {latitude: 28.54, longitude: 77.25},
        {latitude: 28.54123456789, longitude: 77.25678901234},
      ],
    }),
  ]);
});

test('skips empty legs and reports invalid customer or splitter coordinates instead of guessing', () => {
  const result = buildSplitterCustomerLinks(
    splitter,
    [
      null,
      {...customer, latLng: ''},
      {...customer, latLng: '91,77'},
      {...customer, latLng: '28.5,NaN'},
      customer,
    ],
    1,
  );
  expect(result.links).toHaveLength(1);
  expect(result.links[0].leg).toBe(5);
  expect(result.missingCoordinates).toBe(3);
  expect(
    buildSplitterCustomerLinks({...splitter, latitude: null}, [customer], 1),
  ).toEqual({links: [], missingCoordinates: 1});
});

test('loads each splitter independently and never connects a customer to another splitter', async () => {
  const other = {...splitter, id: 'record-61', splitterId: 9, latitude: 28.6};
  get.mockImplementation(async item =>
    item.id === splitter.id ? [customer] : [null, {...customer, id: 200}],
  );
  const result = await loadSplitterCustomerLinks([splitter, other]);
  expect(get).toHaveBeenCalledWith(splitter);
  expect(get).toHaveBeenCalledWith(other);
  expect(
    result.links.map(link => [
      link.splitter.id,
      link.leg,
      link.coordinates[0].latitude,
    ]),
  ).toEqual([
    ['record-50', 1, 28.54],
    ['record-61', 2, 28.6],
  ]);
});

test('one failed splitter still leaves the other customer links available', async () => {
  get.mockResolvedValueOnce([customer]);
  get.mockRejectedValueOnce(new Error('Server unavailable'));
  const result = await loadSplitterCustomerLinks([
    splitter,
    {...splitter, id: 'failed'},
  ]);
  expect(result.links).toHaveLength(1);
  expect(result.failedSplitterIds).toEqual(['failed']);
});

test('limits concurrent requests and stops scheduling when the map request becomes stale', async () => {
  let complete!: (value: (SplitterCustomer | null)[]) => void;
  const pending = new Promise<(SplitterCustomer | null)[]>(resolve => {
    complete = resolve;
  });
  get.mockReturnValue(pending);
  let current = true;
  const request = loadSplitterCustomerLinks(
    Array.from({length: 8}, (_, index) => ({...splitter, id: String(index)})),
    () => current,
  );
  expect(get).toHaveBeenCalledTimes(3);
  current = false;
  complete([customer]);
  expect((await request).links).toEqual([]);
  expect(get).toHaveBeenCalledTimes(3);
});

test('draws only independent splitter-to-customer segments and avoids duplicate overlapping strokes', () => {
  const first = buildSplitterCustomerLinks(
    splitter,
    [customer, {...customer, id: 200}],
    1,
  ).links;
  const other = {...splitter, id: 'other', latitude: 28.56};
  const second = buildSplitterCustomerLinks(other, [customer], 2).links;
  const lines = getDistinctCustomerMapLines([...first, ...second]);
  expect(lines).toHaveLength(2);
  expect(lines[0].coordinates).toEqual([
    first[0].coordinates[0],
    first[0].coordinates[1],
  ]);
  expect(lines[1].coordinates).toEqual([
    second[0].coordinates[0],
    second[0].coordinates[1],
  ]);
  for (const line of lines) {
    expect(line.coordinates).toHaveLength(2);
    expect(line.coordinates[1]).toEqual({
      latitude: 28.54123456789,
      longitude: 77.25678901234,
    });
  }
});

test('a customer at the splitter location does not create a zero-length line', () => {
  const links = buildSplitterCustomerLinks(
    splitter,
    [{...customer, latLng: '28.54,77.25'}],
    1,
  ).links;
  expect(links).toHaveLength(1);
  expect(getDistinctCustomerMapLines(links)).toEqual([]);
});

test('counts every connected customer and the correct legs even if GPS coordinates are missing', async () => {
  get.mockResolvedValue([customer, null, {...customer, id: 205, latLng: ''}]);
  const result = await loadSplitterCustomerLinks([splitter]);
  expect(result.links).toHaveLength(1);
  expect(result.connectionsBySplitter[splitter.id]).toEqual({
    totalCustomers: 2,
    connectedLegs: [1, 3],
  });
});

test('distinguishes a confirmed empty splitter from an unavailable customer count', async () => {
  get.mockResolvedValueOnce([null, null]);
  get.mockRejectedValueOnce(new Error('Unavailable'));
  const result = await loadSplitterCustomerLinks([
    splitter,
    {...splitter, id: 'failed'},
  ]);
  expect(result.connectionsBySplitter[splitter.id]).toEqual({
    totalCustomers: 0,
    connectedLegs: [],
  });
  expect(result.connectionsBySplitter.failed).toBeUndefined();
});
