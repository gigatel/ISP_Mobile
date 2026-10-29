import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, TextInput, TouchableOpacity} from 'react-native';
import CustomerFormScreen from '../src/screens/LastMileConnectivityScreen/CustomerFormScreen';
import {lookupCustomerMaster} from '../src/services/customerMasterLookup';
import type {CustomerMasterDetails} from '../src/services/customerMasterLookup';

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

const lookup = jest.mocked(lookupCustomerMaster);
const details: CustomerMasterDetails = {
  customerMasterId: 2,
  mobile: '9129121700',
  mac: '',
  name: 'API Customer',
  address: 'Installation address',
  landmark: '',
  latLng: '28.541786874749757, 77.25466560998636',
};
let screen: renderer.ReactTestRenderer;
const field = (label: string) =>
  screen.root
    .findAllByType(TextInput)
    .find(item => item.props.accessibilityLabel === label)!;
const fetchButton = () =>
  screen.root
    .findAllByType(TouchableOpacity)
    .find(item => item.props.accessibilityLabel === 'Fetch Customer')!;
const mount = () =>
  act(() => {
    screen = renderer.create(
      <CustomerFormScreen
        navigation={{goBack: jest.fn()} as any}
        route={
          {
            params: {
              splitter: {
                id: 'lookup-test',
                name: 'Test splitter',
                free: 4,
                latitude: 28.6,
                longitude: 77.2,
                distance: 10,
              },
              leg: 5,
            },
          } as any
        }
      />,
    );
  });
beforeEach(() => {
  lookup.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  if (screen) {
    act(() => screen.unmount());
  }
  jest.restoreAllMocks();
});

test('Fetch Customer populates the returned fields and leaves a null MAC blank', async () => {
  lookup.mockResolvedValue(details);
  mount();
  act(() =>
    field('Customer mobile number or MAC search').props.onChangeText(
      '9129121700',
    ),
  );
  await act(async () => {
    await fetchButton().props.onPress();
  });
  expect(lookup).toHaveBeenCalledWith('9129121700');
  expect(field('Customer Name').props.value).toBe('API Customer');
  expect(field('Customer Mobile No.').props.value).toBe('9129121700');
  expect(field('Customer MAC Address').props.value).toBe('');
  expect(field('Customer Address').props.value).toBe('Installation address');
  expect(field('Customer latitude and longitude').props.value).toBe(
    details.latLng,
  );
});

test('ignores an outdated response after the search text changes', async () => {
  let resolve!: (value: CustomerMasterDetails) => void;
  lookup.mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  mount();
  act(() =>
    field('Customer mobile number or MAC search').props.onChangeText(
      '9129121700',
    ),
  );
  act(() => {
    fetchButton().props.onPress();
  });
  expect(fetchButton().props.disabled).toBe(true);
  act(() =>
    field('Customer mobile number or MAC search').props.onChangeText(
      '9000000000',
    ),
  );
  await act(async () => {
    resolve(details);
  });
  expect(field('Customer Name').props.value).toBe('');
});

test('lookup failure leaves the current form untouched and displays the failure', async () => {
  lookup.mockRejectedValue(new Error('Network unavailable'));
  mount();
  act(() => {
    field('Customer Name').props.onChangeText('Existing draft');
    field('Customer mobile number or MAC search').props.onChangeText(
      '9129121700',
    );
  });
  await act(async () => {
    await fetchButton().props.onPress();
  });
  expect(field('Customer Name').props.value).toBe('Existing draft');
  expect(Alert.alert).toHaveBeenCalledWith(
    'Customer lookup',
    'Network unavailable',
  );
  expect(fetchButton().props.disabled).toBe(false);
});

test.each(['9129121700', '32:5e:87:50:3f:39'])(
  'searching by %s automatically fills both the returned mobile number and MAC address',
  async search => {
    lookup.mockResolvedValue({...details, mac: '32:5e:87:50:3f:39'});
    mount();
    act(() =>
      field('Customer mobile number or MAC search').props.onChangeText(search),
    );
    await act(async () => {
      await fetchButton().props.onPress();
    });
    expect(lookup).toHaveBeenCalledWith(search);
    expect(field('Customer MAC Address').props.value).toBe('32:5e:87:50:3f:39');
    expect(field('Customer Mobile No.').props.value).toBe('9129121700');
    expect(field('Customer Name').props.value).toBe('API Customer');
  },
);

test('customer identity fields are read-only and Fetch Customer still populates them', async () => {
  lookup.mockResolvedValue({...details, mac: '32:5e:87:50:3f:39'});
  mount();
  for (const label of [
    'Customer Mobile No.',
    'Customer MAC Address',
    'Customer Name',
  ]) {
    expect(field(label).props.editable).toBe(false);
  }
  expect(field('Customer Address').props.editable).toBe(true);
  expect(field('Landmark').props.editable).toBe(true);
  act(() =>
    field('Customer mobile number or MAC search').props.onChangeText(
      '9129121700',
    ),
  );
  await act(async () => {
    await fetchButton().props.onPress();
  });
  expect(field('Customer Mobile No.').props.value).toBe('9129121700');
  expect(field('Customer MAC Address').props.value).toBe('32:5e:87:50:3f:39');
  expect(field('Customer Name').props.value).toBe('API Customer');
});

test('validates mobile length while typing and limits numeric input to ten digits', () => {
  mount();
  const search = field('Customer mobile number or MAC search');
  act(() => search.props.onChangeText('91291'));
  expect(field('Customer mobile number or MAC search').props.value).toBe(
    '91291',
  );
  expect(fetchButton().props.disabled).toBe(true);
  act(() => search.props.onChangeText('912912170012'));
  expect(field('Customer mobile number or MAC search').props.value).toBe(
    '9129121700',
  );
  expect(fetchButton().props.disabled).toBe(false);
  act(() => search.props.onChangeText('912912170'));
  expect(fetchButton().props.disabled).toBe(true);
  expect(lookup).not.toHaveBeenCalled();
});

test('MAC input remains available alongside ten-digit mobile validation', () => {
  mount();
  act(() =>
    field('Customer mobile number or MAC search').props.onChangeText(
      '32:5e:87:50:3f:39',
    ),
  );
  expect(field('Customer mobile number or MAC search').props.value).toBe(
    '32:5e:87:50:3f:39',
  );
  expect(fetchButton().props.disabled).toBe(false);
});
