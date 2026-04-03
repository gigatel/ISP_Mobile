import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
type Props = {
  visible: boolean;
  icon: any;
  iconTint?: string;
  title: string;
  subTitle: string;
  leftBtnText: string;
  leftBtnTextColor?: string;
  leftBtnBg?: string;
  onLeftPress: () => void;
  rightBtnText: string;
  rightBtnTextColor?: string;
  rightBtnBg?: string;
  onRightPress: () => void;
};
const CustomAlert = ({
  visible,
  icon,
  iconTint = '#FF4D4F',
  title,
  subTitle,
  leftBtnText,
  leftBtnTextColor = '#333',
  leftBtnBg = '#EAEAEA',
  onLeftPress,
  rightBtnText,
  rightBtnTextColor = '#FFF',
  rightBtnBg = '#FF4D4F',
  onRightPress,
}: Props) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.iconBox, {backgroundColor: iconTint + '20'}]}>
            <Image source={icon} style={[styles.icon, {tintColor: iconTint}]} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subTitle}>{subTitle}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, {backgroundColor: leftBtnBg}]}
              onPress={onLeftPress}>
              <Text style={{color: leftBtnTextColor, fontWeight: '600'}}>
                {leftBtnText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, {backgroundColor: rightBtnBg}]}
              onPress={onRightPress}>
              <Text style={{color: rightBtnTextColor, fontWeight: '600'}}>
                {rightBtnText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
export default CustomAlert;
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    width: '85%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },

  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  icon: {
    width: 24,
    height: 24,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },

  subTitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },

  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },

  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});
