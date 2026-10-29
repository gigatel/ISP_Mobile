import React from 'react';
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {IMAGES} from '@res';

type Props = {mobile: string; disabled?: boolean};

export default function CallCustomerButton({mobile, disabled = false}: Props) {
  const number = mobile.trim().replace(/[\s()-]/g, '');
  const unavailable = disabled || !/^\+?\d{7,15}$/.test(number);
  const openDialer = async () => {
    if (unavailable) {
      return;
    }
    try {
      await Linking.openURL(`tel:${number}`);
    } catch {
      Alert.alert(
        'Unable to open dialer',
        'Please dial the customer mobile number manually.',
      );
    }
  };
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Call customer"
      accessibilityHint="Opens the phone dialer with the customer mobile number"
      accessibilityState={{disabled: unavailable}}
      disabled={unavailable}
      onPress={openDialer}
      style={[styles.button, unavailable && styles.disabled]}>
      <Image source={IMAGES.telephone} style={styles.icon} />
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1EAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {width: 20, height: 20, resizeMode: 'contain', tintColor: '#7546D7'},
  disabled: {opacity: 0.4},
});
