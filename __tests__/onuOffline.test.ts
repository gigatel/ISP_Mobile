import {
  groupOnuMarkers,
  onuMapLocations,
} from '../src/features/onuOffline/mapMarkers';
jest.mock('immer', () =>
  jest.requireActual('../node_modules/immer/dist/cjs/immer.cjs.development.js'),
);
import {
  parseLatLng,
  parseOnuUpdate,
  selectOffline,
} from '../src/features/onuOffline/model';
import {
  onuOfflineReducer,
  onuUpdate,
} from '../src/store/slices/onuOffline.slice';
const event = (Customers: unknown[], OrganizationId = 1, ServerId = 2) => ({
  OrganizationId,
  ServerId,
  Customers,
});
const customer = {
  CustomerId: 101,
  CustomerName: 'Example',
  MobNo: '9000',
  MACAddress: 'AA:BB',
  LastInformUtc: '2026-10-29T08:30:00Z',
  IsOnline: false,
};
const apply = (
  state: ReturnType<typeof onuOfflineReducer> | undefined,
  raw: unknown,
) =>
  onuOfflineReducer(
    state,
    onuUpdate({
      update: parseOnuUpdate(raw, '1'),
      receivedAt: '2026-10-29T09:00:00Z',
    }),
  );
it('parses string/object events and rejects malformed or cross-organization data', () => {
  expect(
    parseOnuUpdate(JSON.stringify(event([customer])), '1').Customers,
  ).toHaveLength(1);
  for (const raw of [
    '{',
    null,
    [],
    event([], 9),
    {...event([]), Customers: null},
    {...event([]), ServerId: null},
  ]) {
    expect(() => parseOnuUpdate(raw, '1')).toThrow();
  }
  expect(
    parseOnuUpdate(
      event([
        null,
        {},
        {...customer, IsOnline: undefined},
        {...customer, Status: 'Online'},
      ]),
      '1',
    ).Customers,
  ).toHaveLength(0);
});
it('validates coordinate syntax, finite values and geographic bounds', () => {
  expect(parseLatLng('28.6139, 77.2090')).toEqual({
    latitude: 28.6139,
    longitude: 77.209,
  });
  expect(parseLatLng('0,0')).toEqual({latitude: 0, longitude: 0});
  for (const value of [
    '',
    ' , ',
    '91,77',
    '28,-181',
    'NaN,77',
    '28,Infinity',
    '28,77,3',
    '28,',
  ]) {
    expect(parseLatLng(value)).toBeNull();
  }
});
it('deduplicates replayed events, retains omitted and partial records, and scopes by server', () => {
  let state = apply(undefined, event([customer]));
  state = apply(state, event([customer]));
  state = apply(state, event([]));
  expect(selectOffline(state.records)).toHaveLength(1);
  state = apply(
    state,
    event([{CustomerId: 101, IsOnline: false, Address: 'Updated'}]),
  );
  expect(state.records['1:2:101'].CustomerName).toBe('Example');
  state = apply(state, event([customer], 1, 3));
  expect(selectOffline(state.records)).toHaveLength(2);
  state = apply(state, event([{CustomerId: 101, IsOnline: true}]));
  expect(selectOffline(state.records)).toHaveLength(1);
  expect(state.records['1:2:101'].IsOnline).toBe(true);
});
it('searches name, ID, phone and MAC and sorts valid inform timestamps first', () => {
  const state = apply(
    undefined,
    event([
      customer,
      {
        ...customer,
        CustomerId: 102,
        CustomerName: 'Second',
        MobNo: '',
        MACAddress: '',
        LastInformUtc: 'invalid',
      },
    ]),
  );
  for (const query of ['example', '101', '9000', 'aa:bb']) {
    expect(
      selectOffline(state.records, query).map(item => item.CustomerId),
    ).toEqual(['101']);
  }
  expect(selectOffline(state.records).map(item => item.CustomerId)).toEqual([
    '101',
    '102',
  ]);
  expect(selectOffline(state.records, 'missing')).toEqual([]);
});

it('clusters large maps without losing or duplicating customers', () => {
  const update = parseOnuUpdate(
    event(
      Array.from({length: 250}, (_, index) => ({
        ...customer,
        CustomerId: index + 1,
        LatLng: `28.${index},77.2`,
      })),
    ),
    '1',
  );
  const locations = onuMapLocations(update.Customers);
  const groups = groupOnuMarkers(locations, 30, 30);
  expect(groups.length).toBeLessThan(locations.length);
  expect(
    new Set(groups.flatMap(group => group.items.map(item => item.customer.key)))
      .size,
  ).toBe(250);
  expect(groups.reduce((sum, group) => sum + group.items.length, 0)).toBe(250);
  expect(groupOnuMarkers(locations.slice(0, 2), 30, 30)).toHaveLength(2);
});
