import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Linking, TouchableOpacity} from 'react-native';
import CallCustomerButton from '../src/screens/LastMileConnectivityScreen/CallCustomerButton';

jest.mock('../src/res', () => ({IMAGES: {telephone: 1}}));
let screen: renderer.ReactTestRenderer;
const button = () => screen.root.findByType(TouchableOpacity);
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(() => {
  if (screen) {
    act(() => screen.unmount());
  }
  jest.restoreAllMocks();
});

test('opens the dialer with the current customer number, including after selecting another customer', async () => {
  act(() => {
    screen = renderer.create(<CallCustomerButton mobile="+91 90000-00000" />);
  });
  await act(async () => {
    await button().props.onPress();
  });
  expect(Linking.openURL).toHaveBeenCalledWith('tel:+919000000000');
  act(() => {
    screen.update(<CallCustomerButton mobile="9129121700" />);
  });
  await act(async () => {
    await button().props.onPress();
  });
  expect(Linking.openURL).toHaveBeenLastCalledWith('tel:9129121700');
});

test.each(['', '—', 'invalid', '123'])(
  'does not open the dialer when the number is unavailable: %s',
  async mobile => {
    act(() => {
      screen = renderer.create(<CallCustomerButton mobile={mobile} />);
    });
    expect(button().props.disabled).toBe(true);
    await act(async () => {
      await button().props.onPress();
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
  },
);

test('handles devices without an available dialer', async () => {
  jest.mocked(Linking.openURL).mockRejectedValueOnce(new Error('No dialer'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  act(() => {
    screen = renderer.create(<CallCustomerButton mobile="9129121700" />);
  });
  await act(async () => {
    await button().props.onPress();
  });
  expect(alert).toHaveBeenCalledWith(
    'Unable to open dialer',
    expect.any(String),
  );
});
