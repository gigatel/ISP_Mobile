import {useCallback, useEffect, useRef, useState} from 'react';
import {Keyboard, ScrollView, TextInput} from 'react-native';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';

// Measure the actual visible area: some Android devices resize the window,
// while others leave part of the ScrollView behind the keyboard.
export function useMasterFormKeyboard(gap = 12) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);

  const revealFocusedInput = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = TextInput.State.currentlyFocusedInput();
      if (!input || keyboardTop.current === null) {
        return;
      }
      scrollRef.current?.measureInWindow((_x, top, _width, height) => {
        if (keyboardTop.current === null) {
          return;
        }
        const bottom = top + height;
        const visibleBottom = Math.min(bottom, keyboardTop.current);
        setKeyboardOverlap(Math.max(0, bottom - keyboardTop.current));
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (
            keyboardTop.current === null ||
            TextInput.State.currentlyFocusedInput() !== input
          ) {
            return;
          }
          const overflow = inputTop + inputHeight + gap - visibleBottom;
          if (overflow > 0) {
            scrollRef.current?.scrollTo({
              y: scrollOffset.current + overflow,
              animated: true,
            });
          }
        });
      });
    });
  }, [gap]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      keyboardTop.current = event.endCoordinates.screenY;
      revealFocusedInput();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [revealFocusedInput]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffset.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  return {scrollRef, keyboardOverlap, revealFocusedInput, onScroll};
}
