import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import SplitterMapDetails from '../src/screens/LastMileConnectivityScreen/SplitterMapDetails';
import type {Splitter} from '../src/screens/LastMileConnectivityScreen/types';

jest.mock('../src/apis', () => ({APIs: {}, URLs: {}}));
jest.mock('../src/res', () => ({FONTS: {}}));
jest.mock('react-native-linear-gradient', () => require('react-native').View);

const first: Splitter = {
  id: 'first',
  source: 'api',
  name: 'First splitter',
  code: 'ABC/32',
  free: 31,
  splitterType: '1:32',
  distance: 36.05,
  latitude: 28.6,
  longitude: 77.2,
  address: '429, Kalkaji Main Rd, New Delhi',
  landmark: 'Yes bank',
  connectedCustomers: 160,
  opticalPowerIn: null,
  opticalPowerOut: -14,
};
const second = {
  ...first,
  id: 'second',
  name: 'Second splitter',
  address: 'Second splitter address',
};
let screen: renderer.ReactTestRenderer;
afterEach(() => {
  if (screen) {
    act(() => screen.unmount());
  }
});
const content = () =>
  screen.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .join(' ');
const button = (label: string) =>
  screen.root
    .findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label)!;

test('shows all API details including unavailable readings without sample data', () => {
  act(() => {
    screen = renderer.create(
      <SplitterMapDetails
        items={[{splitter: first, number: 1}]}
        maxHeight={600}
        bottomInset={0}
        onClose={jest.fn()}
        onOpen={jest.fn()}
      />,
    );
  });
  for (const value of [
    'First splitter',
    'ABC/32',
    '160',
    '1:32',
    '31',
    '36.05m',
    '429, Kalkaji Main Rd, New Delhi',
    'Yes bank',
    '28.6, 77.2',
    '—',
    '-14 dBm',
  ]) {
    expect(content()).toContain(value);
  }
});

test('shared-location tabs show and open the chosen splitter', () => {
  const open = jest.fn();
  act(() => {
    screen = renderer.create(
      <SplitterMapDetails
        items={[
          {splitter: first, number: 1},
          {splitter: second, number: 3},
        ]}
        maxHeight={600}
        bottomInset={0}
        onClose={jest.fn()}
        onOpen={open}
      />,
    );
  });
  act(() => button('Select splitter 3: Second splitter').props.onPress());
  expect(content()).toContain('Second splitter address');
  expect(content()).not.toContain(first.address);
  act(() => button('View customer connections').props.onPress());
  expect(open).toHaveBeenCalledWith(second);
});

test('close button dismisses the details', () => {
  const close = jest.fn();
  act(() => {
    screen = renderer.create(
      <SplitterMapDetails
        items={[{splitter: first, number: 1}]}
        maxHeight={600}
        bottomInset={0}
        onClose={close}
        onOpen={jest.fn()}
      />,
    );
  });
  act(() => button('Close details').props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
});

test('shows the actual connected-customer total and leg numbers for each selected splitter', () => {
  act(() => {
    screen = renderer.create(
      <SplitterMapDetails
        items={[
          {splitter: first, number: 1},
          {splitter: second, number: 2},
        ]}
        connectionStats={{
          first: {totalCustomers: 3, connectedLegs: [1, 2, 5]},
          second: {totalCustomers: 0, connectedLegs: []},
        }}
        maxHeight={600}
        bottomInset={0}
        onClose={jest.fn()}
        onOpen={jest.fn()}
      />,
    );
  });
  expect(content()).toContain('Connected Customers');
  expect(content()).toContain('Connected Legs');
  expect(content()).toContain('1, 2, 5');
  expect(content()).not.toContain('160');
  act(() => button('Select splitter 2: Second splitter').props.onPress());
  expect(content()).toContain('None');
  expect(content()).not.toContain('1, 2, 5');
});
