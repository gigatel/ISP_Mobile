import {
  coordinateOf,
  circuitModeOf,
  distanceToItem,
  pathOf,
  previousSplitterOf,
  withEndpointNodes,
} from '../src/screens/InfraConnectivityScreen/connectivity';

test('missing and invalid coordinates never become a map point', () => {
  expect(coordinateOf({})).toBeNull();
  expect(coordinateOf({latitude: '', longitude: ''})).toBeNull();
  expect(coordinateOf({latitude: 120, longitude: 80})).toBeNull();
  expect(coordinateOf({latitude: 0, longitude: 78})).toEqual({
    latitude: 0,
    longitude: 78,
  });
});
test('uses longitude first for GeoJSON and WKT route geometry', () => {
  const expected = [
    {latitude: 28, longitude: 77},
    {latitude: 28.01, longitude: 77.01},
  ];
  expect(
    pathOf({
      geometry: {
        type: 'LineString',
        coordinates: [
          [77, 28],
          [77.01, 28.01],
        ],
      },
    }),
  ).toEqual(expected);
  expect(pathOf({geometry: 'LINESTRING (77 28, 77.01 28.01)'})).toEqual(
    expected,
  );
});
test('nearby routes include a segment crossing the radius with distant endpoints', () => {
  const origin = {latitude: 28, longitude: 77};
  expect(
    distanceToItem(origin, {startLatLng: '27.99,77', endLatLng: '28.01,77'}),
  ).toBeLessThan(1);
  expect(
    distanceToItem(origin, {latitude: 28.01, longitude: 77}),
  ).toBeGreaterThan(1000);
  expect(distanceToItem(origin, {})).toBe(Infinity);
});
test('traverses connected masters to the previous splitter, independent of list order', () => {
  const customer = {masterId: 3, infraType: 'Customer'};
  const splitter = {masterId: 1, infraType: 'Splitter'};
  const records = [
    customer,
    {fromMasterId: 1, toMasterId: 2},
    splitter,
    {fromMasterId: 2, toMasterId: 3},
  ];
  expect(previousSplitterOf(records, customer)).toBe(splitter);
  expect(previousSplitterOf(records, splitter)).toBeNull();
});
test('a cyclic connection safely stops without inventing a splitter', () => {
  expect(
    previousSplitterOf(
      [
        {fromMasterId: 2, toMasterId: 1},
        {fromMasterId: 1, toMasterId: 2},
      ],
      {masterId: 1},
    ),
  ).toBeNull();
});
test('route endpoint metadata supports splitter navigation without a device card', () => {
  const customer = {masterId: 2, infraType: 'Customer'};
  const records = withEndpointNodes([
    customer,
    {
      fromMasterId: 1,
      fromMasterType: 'Splitter',
      fromMasterName: 'S1',
      toMasterId: 2,
    },
  ]);
  expect(previousSplitterOf(records, customer)?.masterName).toBe('S1');
});

test('distinguishes infra and customer circuits from API type or circuit code', () => {
  expect(circuitModeOf({circuitCode: 'CIR/Infra/26-27/8'})).toBe('infra');
  expect(circuitModeOf({connectivityType: 'Customer End Connectivity'})).toBe(
    'customer',
  );
  expect(circuitModeOf({circuitCode: 'CIR/Customer/26-27/9'})).toBe('customer');
  expect(circuitModeOf({circuitName: 'Company circuit'})).toBeNull();
});
