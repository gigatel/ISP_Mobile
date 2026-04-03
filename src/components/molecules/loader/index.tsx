import {COLORS, FONTS, SIZE} from '@res';
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
interface LoaderProps {
  message?: string;
}
const Loader: React.FC<LoaderProps> = ({message}) => {
  const opacity1 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const animateDot = (opacity: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]);
    };
    Animated.loop(
      Animated.stagger(200, [
        animateDot(opacity1, 0),
        animateDot(opacity2, 0),
        animateDot(opacity3, 0),
      ]),
    ).start();
  }, []);
  return (
    <View style={styles.modal}>
      <View style={styles.container}>
        <View style={styles.inner}>
          {/* Sequential Dots Loader */}
          <View style={styles.loaderContainer}>
            <Animated.View style={[styles.dot, {opacity: opacity1}]} />
            <Animated.View style={[styles.dot, {opacity: opacity2}]} />
            <Animated.View style={[styles.dot, {opacity: opacity3}]} />
          </View>

          <Text style={styles.loadingText}>{'Please Wait...'}</Text>
          {message && <Text style={styles.messageText}>{message}</Text>}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: COLORS.BLACK_RGBA_65,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {},
  inner: {
    backgroundColor: COLORS.WHITE,
    padding: SIZE.MS(40),
    borderRadius: SIZE.MS(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZE.MS(25),
    height: SIZE.MS(40),
  },
  dot: {
    width: SIZE.MS(12),
    height: SIZE.MS(12),
    borderRadius: SIZE.MS(6),
    backgroundColor: COLORS.PRIMARY,
    marginHorizontal: SIZE.MS(6),
  },
  messageText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_MEDIUM,
    textAlign: 'center',
    marginTop: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(20),
    lineHeight: SIZE.MS(20),
  },
  loadingText: {
    fontSize: SIZE.MS(16),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.PRIMARY,
    marginTop: SIZE.MS(10),
  },
});

export default Loader;
