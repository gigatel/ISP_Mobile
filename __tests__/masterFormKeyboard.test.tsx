import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Keyboard, TextInput} from 'react-native';
import {useMasterFormKeyboard} from '../src/hooks/useMasterFormKeyboard';

let keyboard: ReturnType<typeof useMasterFormKeyboard>;
let screen: renderer.ReactTestRenderer;
let viewportBottom: number;
let inputBottom: number;
const scrollTo = jest.fn();
const listeners: Record<string, (event?: any) => void> = {};
const removeListener = jest.fn();
const focusedInput = {
  measureInWindow: (callback: Function) =>
    callback(0, inputBottom - 40, 200, 40),
};

function Harness() {
  keyboard = useMasterFormKeyboard(12);
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  scrollTo.mockClear();
  removeListener.mockClear();
  viewportBottom = 700;
  inputBottom = 650;
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
    listeners[name] = listener;
    return {remove: removeListener};
  });
  jest
    .spyOn(TextInput.State, 'currentlyFocusedInput')
    .mockReturnValue(focusedInput as any);
  act(() => {
    screen = renderer.create(<Harness />);
  });
  (keyboard.scrollRef as any).current = {
    measureInWindow: (callback: Function) =>
      callback(0, 70, 300, viewportBottom - 70),
    scrollTo,
  };
});

afterEach(() => {
  act(() => screen.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const showKeyboard = () => {
  act(() => {
    listeners.keyboardDidShow({endCoordinates: {screenY: 400}});
    jest.runOnlyPendingTimers();
  });
};

test('adds only the obscured scroll area when Android does not resize', () => {
  showKeyboard();
  expect(keyboard.keyboardOverlap).toBe(300);
  expect(scrollTo).toHaveBeenLastCalledWith({y: 262, animated: true});
});

test('does not add keyboard padding after the screen resizes', () => {
  viewportBottom = 340; // Buttons occupy the remaining space above the keyboard.
  inputBottom = 380;
  showKeyboard();
  expect(keyboard.keyboardOverlap).toBe(0);
  expect(scrollTo).toHaveBeenLastCalledWith({y: 52, animated: true});
});

test('leaves an already visible input in place', () => {
  inputBottom = 300;
  showKeyboard();
  expect(scrollTo).not.toHaveBeenCalled();
});

test('reveals a newly focused field using the current scroll position', () => {
  inputBottom = 300;
  showKeyboard();
  act(() => {
    keyboard.onScroll({nativeEvent: {contentOffset: {y: 100}}} as any);
    inputBottom = 450;
    keyboard.revealFocusedInput();
    jest.runOnlyPendingTimers();
  });
  expect(scrollTo).toHaveBeenLastCalledWith({y: 162, animated: true});
});

test('clears the overlap and stops moving fields after the keyboard closes', () => {
  showKeyboard();
  scrollTo.mockClear();
  act(() => {
    listeners.keyboardDidHide();
    keyboard.revealFocusedInput();
    jest.runOnlyPendingTimers();
  });
  expect(keyboard.keyboardOverlap).toBe(0);
  expect(scrollTo).not.toHaveBeenCalled();
});
