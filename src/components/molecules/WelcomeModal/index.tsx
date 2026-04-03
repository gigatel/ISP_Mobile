import React, {useEffect, useRef, useState} from 'react';
import {View, Text, Modal, StyleSheet, Animated, Easing} from 'react-native';
import Tts from 'react-native-tts';
import {Preferences, Common} from '@utils';
import {COLORS} from '@res';
import {SIZE} from '@res';
import {FONTS} from '@res';
type WelcomeModalProps = {
  name: string;
  duration?: number;
};
const STORAGE_KEY = 'WELCOME_SHOWN';
const WelcomeModal: React.FC<WelcomeModalProps> = ({name, duration = 3000}) => {
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    checkFirstTime();
  }, []);
  const checkFirstTime = async () => {
    const shown = await Preferences.getData(Preferences.KEY.STORAGE_KEY);
    if (!shown) {
      setVisible(true);
      playVoice();
      startAnimation();
      await Preferences.setData(Preferences.KEY.STORAGE_KEY, true);
    }
  };
  const playVoice = () => {
    Tts.stop();
    Tts.setDefaultLanguage('hi-IN');
    Tts.setDefaultRate(0.5);
    Tts.speak(`Welcome!, ${name}, You’re now part of the Giga ISP ecosystem`);
  };
  const startAnimation = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setVisible(false));
    }, duration);
  };

  if (!visible) return null;

  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  return (
    <Modal transparent animationType="none" visible={visible}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.box,
            {
              transform: [{scale}, {scale: glowScale}],
              opacity,
            },
          ]}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Welcome to Gigatel TechnoSoft</Text>
          <Text style={styles.msg}>
            You’re now part of the Gigatel Techno Soft ecosystem
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default WelcomeModal;
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    backgroundColor: '#ffffff',
    paddingVertical: SIZE.MS(28),
    paddingHorizontal: 22,
    borderRadius: 22,
    width: '82%',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#00AEEF',
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  emoji: {
    fontSize: 42,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    color: '#222',
    letterSpacing: 0.5,
    alignSelf: 'center',
    fontFamily: FONTS.SEMI_BOLD,
  },
  name: {
    fontSize: 18,
    marginTop: 6,
    fontWeight: '600',
    color: '#333',
    fontFamily: FONTS.SEMI_BOLD,
  },
  msg: {
    fontSize: 14,
    marginTop: 6,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: FONTS.SEMI_BOLD,
  },
});
