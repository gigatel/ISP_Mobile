import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Modal, TextInput, TouchableOpacity} from 'react-native';
import CustomerFormScreen from '../src/screens/LastMileConnectivityScreen/CustomerFormScreen';
import {saveSplitterCustomerConnectivity} from '../src/services/splitterCustomerConnectivity';
import {getGigTubeCores} from '../src/services/gigTubeCores';
import {
  normalizeSplitterCustomers,
  getSplitterCustomers,
} from '../src/services/lastMileSplitterCustomers';
import {lookupCustomerMaster} from '../src/services/customerMasterLookup';
import GigSelectionSheet from '../src/screens/LastMileConnectivityScreen/GigSelectionSheet';

jest.mock('../src/apis', () => ({APIs: {}, URLs: {}}));
jest.mock('../src/res', () => ({FONTS: {}, IMAGES: {}}));
jest.mock('../src/components/organisms', () => ({
  Screen: require('react-native').View,
}));
jest.mock(
  '../src/screens/LastMileConnectivityScreen/SplitterIcon',
  () => require('react-native').View,
);
jest.mock(
  '../src/screens/LastMileConnectivityScreen/GigSelectionSheet',
  () => () => null,
);
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, bottom: 0}),
}));
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
}));
jest.mock('react-native-permissions', () => ({}));
jest.mock(
  '../src/screens/LastMileConnectivityScreen/customerGpsAddress',
  () => ({}),
);
jest.mock('../src/services/customerMasterLookup', () => ({
  ...jest.requireActual('../src/services/customerMasterLookup'),
  lookupCustomerMaster: jest.fn(),
}));

jest.mock('../src/services/splitterCustomerConnectivity', () => ({
  ...jest.requireActual('../src/services/splitterCustomerConnectivity'),
  saveSplitterCustomerConnectivity: jest.fn(),
}));
jest.mock('../src/services/lastMileSplitterCustomers', () => ({
  ...jest.requireActual('../src/services/lastMileSplitterCustomers'),
  getSplitterCustomers: jest.fn(),
}));
jest.mock('../src/services/gigTubeCores', () => ({getGigTubeCores: jest.fn()}));
const saveApi = jest.mocked(saveSplitterCustomerConnectivity);
const coreApi = jest.mocked(getGigTubeCores);
const splitter = {
  id: '260',
  source: 'api',
  splitterId: 27,
  splitterDetailId: 260,
  code: '02/12/A-128/B-64-1/C-32-1',
  name: 'SPL-27',
  free: 4,
  totalPorts: 8,
  latitude: null,
  longitude: null,
  distance: null,
};
const customer = {
  id: 14,
  tube: '2',
  core: '3',
  mobile: '9000000000',
  name: 'Saved customer',
  mac: '20:e1:5d:0d:e1:da',
  address: 'Customer address',
  latLng: '28.5, 77.4',
  landmark: 'Landmark',
  online: null,
  connectivity: 'Physical GIG',
  gig: 'API GIG',
  fiberMappingId: 90,
  splitterDetailId: 260,
  splitterCode: `${splitter.code}/5`,
};
let screen: renderer.ReactTestRenderer;
const navigation = {goBack: jest.fn(), popTo: jest.fn()};
const button = (label: string) =>
  screen.root
    .findAllByType(TouchableOpacity)
    .find(item => item.props.accessibilityLabel === label)!;
const field = (label: string) =>
  screen.root
    .findAllByType(TextInput)
    .find(item => item.props.accessibilityLabel === label)!;
const mount = (editing = true, editedCustomer: typeof customer = customer) =>
  act(() => {
    screen = renderer.create(
      <CustomerFormScreen
        navigation={navigation as any}
        route={
          {
            params: {
              splitter,
              leg: 5,
              customer: editing ? editedCustomer : undefined,
              connectionLeg: {
                leg: 5,
                splitterDetailId: 260,
                splitterCode: `${splitter.code}/5`,
              },
            },
          } as any
        }
      />,
    );
  });
beforeEach(() => {
  jest.clearAllMocks();
  saveApi.mockResolvedValue(undefined);
  coreApi.mockResolvedValue([{coreId: 3, coreName: '3. Green', isUsed: false}]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  act(() => screen.unmount());
  jest.restoreAllMocks();
});

test('edit saves filled values and shows success only after the API succeeds', async () => {
  let complete!: () => void;
  saveApi.mockReturnValue(
    new Promise(resolve => {
      complete = resolve;
    }),
  );
  mount();
  act(() => {
    field('Customer Name').props.onChangeText('Edited customer');
  });
  act(() => {
    button('Save customer connection').props.onPress();
  });
  expect(saveApi).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 14,
      splitterId: 27,
      splitterDetailId: 260,
      splitterCode: `${splitter.code}/5`,
      fiberMappingId: 90,
      tubeNo: 2,
      coreNo: 3,
      customerName: 'Edited customer',
      remarks: 'Landmark',
      virtualConnection: false,
    }),
  );
  expect(button('Save customer connection').props.disabled).toBe(true);
  expect(button('Back to splitter list')).toBeUndefined();
  act(() => {
    button('Save customer connection').props.onPress();
  });
  expect(saveApi).toHaveBeenCalledTimes(1);
  await act(async () => {
    complete();
  });
  expect(button('Back to splitter list')).toBeDefined();
  expect(field('Customer Name').props.value).toBe('Edited customer');
  const popup = screen.root
    .findAllByType(Modal)
    .find(node => node.props.visible && node.props.animationType === 'fade')!;
  expect(popup.props.transparent).toBe(true);
  expect(popup.findAllByType(TouchableOpacity)).toHaveLength(1);
  expect(popup.findByType(TouchableOpacity).props.accessibilityLabel).toBe(
    'Back to splitter list',
  );
  expect(navigation.goBack).not.toHaveBeenCalled();
  act(() => {
    button('Back to splitter list').props.onPress();
  });
  expect(navigation.popTo).toHaveBeenCalledWith('LastMileConnectivity');
});

test('API rejection preserves edits and allows retry without showing success', async () => {
  saveApi.mockRejectedValueOnce(new Error('Connection rejected'));
  mount();
  act(() => {
    field('Customer Address').props.onChangeText('Edited address');
  });
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(field('Customer Address').props.value).toBe('Edited address');
  expect(Alert.alert).toHaveBeenCalledWith(
    'Unable to connect customer',
    'Connection rejected',
  );
  expect(button('Back to splitter list')).toBeUndefined();
  expect(button('Save customer connection').props.disabled).toBe(false);
});

test('new virtual customer posts the selected free leg and entered fields', async () => {
  mount(false);
  act(() => {
    field('Customer Name').props.onChangeText('New customer');
    field('Customer Mobile No.').props.onChangeText('9000000000');
    field('Customer MAC Address').props.onChangeText('20:e1:5d:0d:e1:da');
    field('Customer Address').props.onChangeText('New address');
    field('Customer latitude and longitude').props.onChangeText(
      '28.500012345, 77.400054321',
    );
    field('Landmark').props.onChangeText('Nearby landmark');
  });
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(saveApi).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 0,
      splitterDetailId: 260,
      splitterCode: `${splitter.code}/5`,
      virtualConnection: true,
      customerName: 'New customer',
      customerAddress: 'New address',
      remarks: 'Nearby landmark',
      customerLatLng: '28.500012345, 77.400054321',
    }),
  );
  expect(coreApi).not.toHaveBeenCalled();
  expect(button('Back to splitter list')).toBeDefined();
});

test('a newly selected physical core is checked again before saving and cannot be reused', async () => {
  coreApi.mockResolvedValue([{coreId: 6, coreName: '6. White', isUsed: true}]);
  mount();
  act(() => {
    button('Select GIG: API GIG').props.onPress();
  });
  act(() => {
    screen.root.findByType(GigSelectionSheet).props.onSelect(
      {
        id: 99,
        fiberCode: 'OTHER GIG',
        routeId: 3,
        fiberMasterId: 4,
      },
      '1',
      '6',
    );
  });
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(coreApi).toHaveBeenCalledWith(99, 1);
  expect(saveApi).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Unable to connect customer',
    expect.stringContaining('already in use'),
  );
});

test('a fetched customer without MAC can save because MAC is optional', async () => {
  jest.mocked(lookupCustomerMaster).mockResolvedValue({
    customerMasterId: 2,
    mobile: '9000000000',
    mac: '',
    name: 'Fetched customer',
    address: 'Fetched address',
    latLng: '28.541786874749757, 77.25466560998636',
    landmark: '',
  });
  mount();
  await act(async () => {
    await button('Fetch Customer').props.onPress();
  });
  expect(field('Customer MAC Address').props.value).toBe('');
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(saveApi).toHaveBeenCalledWith(
    expect.objectContaining({macAddress: ''}),
  );
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('landmark is optional and can be saved blank', async () => {
  mount();
  act(() => {
    field('Landmark').props.onChangeText('');
  });
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(saveApi).toHaveBeenCalledWith(expect.objectContaining({remarks: ''}));
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('required-field validation names the actual missing field instead of listing completed fields', async () => {
  mount();
  act(() => {
    field('Customer Name').props.onChangeText('');
  });
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(saveApi).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Complete customer details',
    'Please fill: Customer name.',
  );
});

test('an entered malformed MAC is still rejected', async () => {
  mount();
  act(() => {
    field('Customer MAC Address').props.onChangeText('invalid-mac');
  });
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(saveApi).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Invalid MAC address',
    expect.any(String),
  );
});

test('editing a saved physical leg with null API connectivity opens Physical GIG and its GIG selection', () => {
  const selected = {...splitter, source: 'api' as const};
  const rows = normalizeSplitterCustomers(
    {
      splitterRouteDetailsDto: [
        {
          splitterId: 27,
          splitterDetailId: 260,
          splitterCode: `${splitter.code}/5`,
          connectBy: null,
          outConnectBy: null,
          connectedFiberMappingId: 90,
          connectedTubeNo: 2,
          connectedCoreNo: 3,
          customerMobileNo: customer.mobile,
          customerName: customer.name,
          customerAddress: customer.address,
          customerLatLng: customer.latLng,
          fiberCode: 'API GIG',
          macAddress: customer.mac,
        },
      ],
    },
    selected,
  );
  mount(true, rows[4] as typeof customer);
  expect(button('Connectivity: Physical GIG')).toBeDefined();
  expect(button('Connectivity: Virtual GIG')).toBeUndefined();
  expect(button('Select GIG: API GIG')).toBeDefined();
});

test('editing address, GPS, landmark and connectivity sends the current form values', async () => {
  mount();
  act(() => {
    field('Customer Address').props.onChangeText(
      'Updated installation address',
    );
    field('Customer latitude and longitude').props.onChangeText(
      '28.512345, 77.456789',
    );
    field('Landmark').props.onChangeText('Updated landmark');
    button('Connectivity: Physical GIG').props.onPress();
  });
  const option = screen.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(require('react-native').Text)
        .some(text => text.props.children === 'Virtual GIG'),
    )!;
  act(() => option.props.onPress());
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(saveApi).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 14,
      customerAddress: 'Updated installation address',
      customerLatLng: '28.512345, 77.456789',
      remarks: 'Updated landmark',
      virtualConnection: true,
      fiberMappingId: 0,
      tubeNo: 0,
      coreNo: 0,
    }),
  );
});

test('an older edit form refreshes customerDetailId and saves changed data with that update ID', async () => {
  const stale = {...customer, id: undefined};
  const refreshed = Array.from({length: 8}, () => null as any);
  refreshed[4] = {...customer, id: 173, customerDetailId: 173};
  jest.mocked(getSplitterCustomers).mockResolvedValue(refreshed);
  mount(true, stale as unknown as typeof customer);
  act(() =>
    field('Customer Address').props.onChangeText(
      'Changed address from older form',
    ),
  );
  await act(async () => {
    await button('Save customer connection').props.onPress();
  });
  expect(getSplitterCustomers).toHaveBeenCalledWith(splitter);
  expect(saveApi).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 173,
      splitterDetailId: 260,
      customerAddress: 'Changed address from older form',
    }),
  );
  expect(button('Back to splitter list')).toBeDefined();
});
