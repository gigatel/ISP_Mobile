import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, TextInput, TouchableOpacity} from 'react-native';
import {request} from 'react-native-permissions';
import GigSelectionSheet from '../src/screens/LastMileConnectivityScreen/GigSelectionSheet';
import {getGeoLocation} from '../src/utils/location';
import {getGigTubeCores} from '../src/services/gigTubeCores';
import {getNearbyGigRoutes} from '../src/services/nearbyGigRoutes';
import type {GigRoute} from '../src/services/nearbyGigRoutes';

jest.mock('../src/res', () => ({FONTS: {}, IMAGES: {}}));
jest.mock('../src/res/images/pointer.svg', () => require('react-native').View);
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0}),
}));
jest.mock('react-native-permissions', () => ({
  request: jest.fn().mockResolvedValue('granted'),
  RESULTS: {GRANTED: 'granted', LIMITED: 'limited'},
  PERMISSIONS: {
    IOS: {LOCATION_WHEN_IN_USE: 'ios-location'},
    ANDROID: {ACCESS_FINE_LOCATION: 'android-location'},
  },
}));
jest.mock('../src/utils/location', () => ({getGeoLocation: jest.fn()}));
jest.mock('../src/services/nearbyGigRoutes', () => ({
  ...jest.requireActual('../src/services/nearbyGigRoutes'),
  getNearbyGigRoutes: jest.fn(),
}));
jest.mock('../src/services/gigTubeCores', () => ({getGigTubeCores: jest.fn()}));
jest.mock('../src/apis', () => ({APIs: {}, URLs: {}}));

const route: GigRoute = {
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
  createdOn: '',
  fiberMasterId: 178,
  startArea: '',
  endArea: 'Chittaranjan Park',
  distanceMeters: 0,
};
const location = jest.mocked(getGeoLocation);
const api = jest.mocked(getNearbyGigRoutes);
const coreApi = jest.mocked(getGigTubeCores);
const cores = [
  {coreId: 1, coreName: '1. Blue', isUsed: false},
  {coreId: 2, coreName: '2. Orange', isUsed: false},
  {coreId: 3, coreName: '3. Green', isUsed: false},
  {coreId: 4, coreName: '4. Brown', isUsed: false},
];
let screen: renderer.ReactTestRenderer;
const button = (label: string) =>
  screen.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label)!;
const press = async (label: string) => {
  await act(async () => {
    button(label).props.onPress();
  });
};
const mount = async (
  onSelect = jest.fn(),
  props: Partial<React.ComponentProps<typeof GigSelectionSheet>> = {},
) => {
  act(() => {
    screen = renderer.create(
      <GigSelectionSheet onClose={jest.fn()} onSelect={onSelect} {...props} />,
    );
  });
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  location.mockResolvedValue({
    coords: {latitude: 28.544219862526788, longitude: 77.25110829683024},
  } as any);
  api.mockResolvedValue([route]);
  coreApi.mockResolvedValue(cores);
});
afterEach(() => {
  if (screen) {
    act(() => screen.unmount());
  }
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('API-used cores are disabled with a guard against selecting them', async () => {
  const selected = jest.fn();
  coreApi.mockResolvedValue(
    cores.map(item => ({...item, isUsed: item.coreId === 4})),
  );
  await mount(selected);
  await press('Select tube');
  await press('Tube 1');
  await press('Select core');
  expect(button('Core 4 Brown').props.disabled).toBe(true);
  await press('Core 4 Brown');
  expect(button('Core 4 Brown')).toBeDefined();
  expect(selected).not.toHaveBeenCalled();
  expect(button('Core 3 Green').props.disabled).toBe(false);
});

test('local customer reservations are scoped to their tube and free API cores remain available while editing', async () => {
  const assignment = {
    fiberMappingId: route.id,
    fiberCode: route.fiberCode,
    tube: 1,
    core: 4,
  };
  await mount(jest.fn(), {
    selectedFiberMappingId: route.id,
    selectedTube: '1',
    selectedCore: '4',
    editingAssignment: assignment,
  });
  await press('Select core');
  expect(button('Core 4 Brown').props.disabled).toBe(false);
  act(() => screen.unmount());
  api.mockResolvedValue([{...route, tubeNo: 2}]);
  await mount(jest.fn(), {occupiedAssignments: [{...assignment, core: 2}]});
  await press('Select tube');
  await press('Tube 1');
  await press('Select core');
  expect(button('Core 2 Orange').props.disabled).toBe(true);
  await press('Core 3 Green');
  await press('Select tube');
  await press('Tube 2');
  await press('Select core');
  expect(button('Core 2 Orange').props.disabled).toBe(false);
});

test('loads current GPS and selects the route with the chosen tube and colored core', async () => {
  const selected = jest.fn();
  await mount(selected);
  expect(location).toHaveBeenCalledWith(true);
  expect(api).toHaveBeenCalledWith(
    {latitude: 28.544219862526788, longitude: 77.25110829683024},
    200,
  );
  await press('Select tube');
  await press('Tube 1');
  await press('Select core');
  await press('Core 3 Green');
  await press(`Select GIG ${route.fiberCode}`);
  expect(coreApi).toHaveBeenCalledWith(route.id, 1);
  expect(selected).toHaveBeenCalledWith(
    {...route, tubeCoreOptions: {tubeNo: 1, cores}},
    '1',
    '3',
  );
});

test('requires tube and core and clears them when switching routes', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const selected = jest.fn();
  api.mockResolvedValue([route, {...route, id: 91, fiberCode: 'OTHER-GIG'}]);
  await mount(selected);
  await press(`Select GIG ${route.fiberCode}`);
  expect(alert).toHaveBeenCalled();
  expect(selected).not.toHaveBeenCalled();
  await press('Select tube');
  await press('Tube 1');
  await press('Select core');
  await press('Core 2 Orange');
  await press('Choose OTHER-GIG, yes bank to nehru enclave');
  await press('Select GIG OTHER-GIG');
  expect(selected).not.toHaveBeenCalled();
});

test('range reloads use the existing location and search stays local', async () => {
  await mount();
  await press('Increase GIG range');
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  expect(api).toHaveBeenLastCalledWith(expect.anything(), 300);
  expect(location).toHaveBeenCalledTimes(1);
  const input = screen.root.findByType(TextInput);
  act(() => input.props.onChangeText('No matching route'));
  expect(api).toHaveBeenCalledTimes(2);
});

test('permission denial shows retry without calling the route API', async () => {
  jest.mocked(request).mockResolvedValueOnce('denied' as any);
  await mount();
  expect(api).not.toHaveBeenCalled();
  expect(
    screen.root
      .findAllByType(TouchableOpacity)
      .some(item =>
        item
          .findAllByType(require('react-native').Text)
          .some(text => text.props.children === 'Retry'),
      ),
  ).toBe(true);
});

test('tube options follow tubeNo and core options follow the core endpoint', async () => {
  await mount();
  await press('Select tube');
  expect(button('Tube 1')).toBeDefined();
  expect(button('Tube 2')).toBeUndefined();
  await press('Tube 1');
  await press('Select core');
  expect(button('Core 4 Brown')).toBeDefined();
  expect(button('Core 5 Gray')).toBeUndefined();
});

test('larger API counts render options beyond twelve with repeating fiber colors', async () => {
  api.mockResolvedValue([{...route, tubeNo: 2, coreNo: 4}]);
  coreApi.mockResolvedValue([
    {coreId: 14, coreName: '14. Orange', isUsed: false},
  ]);
  await mount();
  await press('Select tube');
  expect(button('Tube 2')).toBeDefined();
  expect(button('Tube 3')).toBeUndefined();
  await press('Tube 1');
  await press('Select core');
  expect(button('Core 14 Orange')).toBeDefined();
  expect(button('Core 15 Green')).toBeUndefined();
});

test('missing tube or core counts do not invent selectable options', async () => {
  api.mockResolvedValue([{...route, tubeNo: null, coreNo: null}]);
  await mount();
  await press('Select tube');
  expect(button('Tube 1')).toBeUndefined();
});

test('refresh clears selections outside updated API counts', async () => {
  const selected = jest.fn();
  await mount(selected, {
    selectedFiberMappingId: route.id,
    selectedTube: '1',
    selectedCore: '3',
  });
  coreApi.mockResolvedValue(cores.slice(0, 2));
  api.mockResolvedValue([{...route, coreNo: 2}]);
  await press('Increase GIG range');
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await press(`Select GIG ${route.fiberCode}`);
  expect(selected).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith(
    'Select tube and core',
    expect.any(String),
  );
});

test('API isUsed wins even for a previously assigned core while editing', async () => {
  coreApi.mockResolvedValue(
    cores.map(item => ({...item, isUsed: item.coreId === 4})),
  );
  await mount(jest.fn(), {
    selectedFiberMappingId: route.id,
    selectedTube: '1',
    selectedCore: '4',
    editingAssignment: {
      fiberMappingId: route.id,
      fiberCode: route.fiberCode,
      tube: 1,
      core: 4,
    },
  });
  await press('Select core');
  expect(button('Core 4 Brown').props.disabled).toBe(true);
});

test('failed core lookup blocks selection and offers retry without fabricated cores', async () => {
  coreApi.mockRejectedValueOnce(new Error('Core lookup failed'));
  await mount();
  await press('Select tube');
  await press('Tube 1');
  await press('Select core');
  expect(button('Core 1 Blue')).toBeUndefined();
  expect(button(`Select GIG ${route.fiberCode}`).props.disabled).toBe(true);
  await press('Retry core availability');
  expect(button('Core 1 Blue')).toBeDefined();
});

test('late core responses from a previous tube cannot replace current options', async () => {
  let resolveFirst!: (value: typeof cores) => void;
  coreApi.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveFirst = resolve;
      }),
  );
  coreApi.mockResolvedValueOnce([
    {coreId: 9, coreName: '9. Yellow', isUsed: false},
  ]);
  api.mockResolvedValue([{...route, tubeNo: 2}]);
  await mount();
  await press('Select tube');
  await press('Tube 1');
  await press('Select tube');
  await press('Tube 2');
  expect(coreApi).toHaveBeenLastCalledWith(route.id, 2);
  await act(async () => {
    resolveFirst(cores);
  });
  await press('Select core');
  expect(button('Core 9 Yellow')).toBeDefined();
  expect(button('Core 1 Blue')).toBeUndefined();
});
