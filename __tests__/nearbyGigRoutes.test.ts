import {APIs, URLs} from '../src/apis';
import {
  FIBER_CORE_COLORS,
  filterGigRoutes,
  getNearbyGigRoutes,
  isGigCoreUnavailable,
} from '../src/services/nearbyGigRoutes';

jest.mock('../src/apis', () => ({
  APIs: {postRequestWithJson: jest.fn()},
  URLs: {
    getNearbyConnectedRoutesByLatLng:
      'http://10.100.2.38:6101/api/Circuit/GetNearbyConnectedRoutesByLatLng?appType=app',
  },
}));
const post = APIs.postRequestWithJson as jest.Mock;
const record = {
  id: 90,
  fiberCode: 'OGIG-318888A',
  routeName: 'yes bank to nehru enclave',
  routeIdStr: 'Route92',
  routeId: 121,
  sldCode: 'SLD-95',
  totalDistance: 480.3,
  tubeNo: 1,
  coreNo: 4,
  drumNo: '4',
  drumLength: 534,
  otdr: 4534,
  fiberTypeName: '4F',
  createdOn: '2026-10-22T12:23:02.71',
  fiberMasterId: 178,
  startArea: null,
  endArea: 'Chittaranjan Park',
  distanceMeters: 0,
};
beforeEach(() => post.mockReset());

test('isUsed flags from the core endpoint are authoritative and local reservations also block reuse', async () => {
  post.mockResolvedValue({success: true, data: [record]});
  const [route] = await getNearbyGigRoutes(
    {latitude: 28.6, longitude: 77.2},
    200,
  );
  // Nearby route tube/core counts alone do not indicate used cores.
  expect(isGigCoreUnavailable(route, 1, 4)).toBe(false);
  const availableRoute = {
    ...route,
    tubeCoreOptions: {
      tubeNo: 1,
      cores: [
        {coreId: 3, coreName: '3. Green', isUsed: false},
        {coreId: 4, coreName: '4. Brown', isUsed: true},
      ],
    },
  };
  const own = {
    fiberMappingId: 90,
    fiberCode: route.fiberCode,
    tube: 1,
    core: 4,
  };
  expect(isGigCoreUnavailable(availableRoute, 1, 4, [], own)).toBe(true);
  expect(isGigCoreUnavailable(availableRoute, 1, 3)).toBe(false);
  expect(isGigCoreUnavailable(availableRoute, 1, 5)).toBe(true);
  expect(isGigCoreUnavailable(availableRoute, 1, 3, [{...own, core: 3}])).toBe(
    true,
  );
});

test('combines duplicate route cards preserving the largest returned tube/core counts', async () => {
  post.mockResolvedValue({
    success: true,
    data: [record, {...record, tubeNo: 2, coreNo: 7}],
  });
  const routes = await getNearbyGigRoutes(
    {latitude: 28.6, longitude: 77.2},
    200,
  );
  expect(routes).toHaveLength(1);
  expect(routes[0]).toMatchObject({tubeNo: 2, coreNo: 7});
});

test('posts the exact device coordinates and requested initial zero radius with authentication', async () => {
  post.mockResolvedValue({success: true, status: 200, data: [record]});
  const coordinate = {
    latitude: 28.544219862526788,
    longitude: 77.25110829683024,
  };
  const rows = await getNearbyGigRoutes(coordinate, 0);
  expect(post).toHaveBeenCalledWith({
    path: URLs.getNearbyConnectedRoutesByLatLng,
    params: {
      latLng: `${coordinate.latitude},${coordinate.longitude}`,
      radiusMeters: 0,
    },
    isAuth: true,
  });
  expect(rows[0]).toMatchObject({
    id: 90,
    fiberCode: record.fiberCode,
    routeId: 121,
    totalDistance: 480.3,
    tubeNo: 1,
    coreNo: 4,
    distanceMeters: 0,
    startArea: '',
    endArea: 'Chittaranjan Park',
  });
});

test('searches actual route fields and sorts nearest first with unknown distance last', async () => {
  post.mockResolvedValue({
    success: true,
    data: [
      {...record, id: 91, distanceMeters: null},
      {...record, id: 92, distanceMeters: 100},
      record,
    ],
  });
  const rows = await getNearbyGigRoutes({latitude: 28.6, longitude: 77.2}, 200);
  expect(rows.map(row => row.id)).toEqual([90, 92, 91]);
  expect(filterGigRoutes(rows, 'NEHRU')).toHaveLength(3);
  expect(filterGigRoutes(rows, 'SLD-95')).toHaveLength(3);
  expect(filterGigRoutes(rows, 'not found')).toEqual([]);
});

test('handles empty results and reports failed or malformed responses', async () => {
  post.mockResolvedValueOnce({success: true, data: []});
  await expect(
    getNearbyGigRoutes({latitude: 28.6, longitude: 77.2}, 0),
  ).resolves.toEqual([]);
  post.mockResolvedValueOnce({
    success: false,
    status: 200,
    message: 'No access',
  });
  await expect(
    getNearbyGigRoutes({latitude: 28.6, longitude: 77.2}, 0),
  ).rejects.toThrow('No access');
  post.mockResolvedValueOnce({success: true, data: null});
  await expect(
    getNearbyGigRoutes({latitude: 28.6, longitude: 77.2}, 0),
  ).rejects.toThrow('Invalid GIG route response');
});

test('core picker uses all twelve fiber colors in the reference order', () => {
  expect(FIBER_CORE_COLORS.map(item => item.name)).toEqual([
    'Blue',
    'Orange',
    'Green',
    'Brown',
    'Gray',
    'White',
    'Red',
    'Black',
    'Yellow',
    'Violet',
    'Pink',
    'Aqua',
  ]);
});
