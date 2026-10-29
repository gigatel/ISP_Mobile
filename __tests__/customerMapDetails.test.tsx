import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import CustomerMapDetails from '../src/screens/LastMileConnectivityScreen/CustomerMapDetails';
import type {SplitterCustomerLink} from '../src/services/splitterCustomerMap';

jest.mock('../src/apis', () => ({APIs: {}, URLs: {}}));
jest.mock('../src/res', () => ({FONTS: {}, IMAGES: {telephone: 1}}));
jest.mock('react-native-linear-gradient', () => require('react-native').View);
const link: SplitterCustomerLink = {
  key: 'splitter-50:2',
  splitterNumber: 1,
  leg: 2,
  splitter: {
    id: 'splitter-50',
    name: 'SPL-8',
    code: 'CODE/32',
    source: 'api',
    free: 31,
    latitude: 28.54,
    longitude: 77.25,
    distance: 10,
  },
  customer: {
    id: 173,
    mobile: '9000000000',
    mac: '20:e1:5d:0d:e1:da',
    name: 'Test Customer',
    address: 'Customer installation address',
    landmark: 'Customer landmark',
    latLng: '28.55,77.26',
    connectivity: 'Physical GIG',
    gig: 'OGIG-4U',
    tube: '2',
    core: '4',
    online: true,
  },
  coordinates: [
    {latitude: 28.54, longitude: 77.25},
    {latitude: 28.55, longitude: 77.26},
  ],
};
let screen: renderer.ReactTestRenderer;
afterEach(() => {
  if (screen) {
    act(() => screen.unmount());
  }
});
const button = (label: string) =>
  screen.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label)!;
const content = () =>
  screen.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .join(' ');

test('shows customer and connection details in a dismissible sheet and opens the correct splitter', () => {
  const close = jest.fn();
  const open = jest.fn();
  act(() => {
    screen = renderer.create(
      <CustomerMapDetails
        items={[link]}
        maxHeight={500}
        bottomInset={0}
        onClose={close}
        onOpen={open}
      />,
    );
  });
  for (const value of [
    'Customer Details',
    'Test Customer',
    '9000000000',
    '20:e1:5d:0d:e1:da',
    'Customer installation address',
    'Customer landmark',
    '28.55,77.26',
    'SPL-8',
    'CODE/32',
    'Physical GIG',
    'OGIG-4U',
    'Splitter #',
    'Leg ',
    'Online',
  ]) {
    expect(content()).toContain(value);
  }
  act(() => button('View customer splitter connections').props.onPress());
  expect(open).toHaveBeenCalledWith(link);
  act(() => button('Close customer details').props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
});

test('customers at the same coordinates can be selected independently without mixing their data', () => {
  const other = {
    ...link,
    key: 'splitter-61:5',
    splitterNumber: 2,
    leg: 5,
    customer: {
      ...link.customer,
      name: 'Second Customer',
      address: 'Second address',
      online: false,
    },
  };
  const open = jest.fn();
  act(() => {
    screen = renderer.create(
      <CustomerMapDetails
        items={[link, other]}
        maxHeight={500}
        bottomInset={0}
        onClose={jest.fn()}
        onOpen={open}
      />,
    );
  });
  act(() =>
    button(
      'Select customer Second Customer on splitter 2 leg 5',
    ).props.onPress(),
  );
  expect(content()).toContain('Second address');
  expect(content()).not.toContain('Customer installation address');
  expect(content()).toContain('Offline');
  act(() => button('View customer splitter connections').props.onPress());
  expect(open).toHaveBeenCalledWith(other);
});

test('virtual connections hide physical GIG fields and do not invent a status or missing MAC', () => {
  const virtual = {
    ...link,
    customer: {
      ...link.customer,
      connectivity: 'Virtual GIG',
      mac: '',
      landmark: '',
      online: null,
    },
  };
  act(() => {
    screen = renderer.create(
      <CustomerMapDetails
        items={[virtual]}
        maxHeight={400}
        bottomInset={24}
        onClose={jest.fn()}
        onOpen={jest.fn()}
      />,
    );
  });
  expect(content()).toContain('Virtual GIG');
  expect(content()).toContain('Status unavailable');
  expect(content()).toContain('—');
  expect(content()).not.toContain('OGIG-4U');
});
