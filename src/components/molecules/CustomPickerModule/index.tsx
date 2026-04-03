import React, {FC, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS, SIZE, FONTS, IMAGES} from '@res';
interface PickerItem {
  label: string;
  value: string;
  icon?: any;
}
interface CustomPickerModuleProps {
  data: PickerItem[];
  value?: PickerItem | null;
  placeholder?: string;
  onSelect: (item: PickerItem) => void;
  onAddPress?: () => void;
  addButtonLabel?: string;
  disabled?: boolean;
}
const CustomPickerModule: FC<CustomPickerModuleProps> = ({
  data,
  value,
  placeholder = 'Select',
  onSelect,
  onAddPress,
  addButtonLabel,
  disabled = false,
}) => {
  const [visible, setVisible] = useState(false);
  const handleOpenPicker = () => {
    if (!disabled) {
      setVisible(true);
    }
  };
  const handleSelectItem = (item: PickerItem) => {
    setVisible(false);
    onSelect(item);
  };
  const handleAddPress = () => {
    if (!disabled && value) {
      onAddPress?.();
    }
  };
  return (
    <>
      <View style={[styles.container, disabled && styles.disabledContainer]}>
        <TouchableOpacity
          style={styles.left}
          onPress={handleOpenPicker}
          activeOpacity={0.7}
          disabled={disabled}>
          {value?.icon && <Image source={value.icon} style={styles.icon} />}
          <Text style={[styles.valueText, !value && styles.placeholderText]}>
            {value?.label || placeholder}
          </Text>
          <Text style={styles.addText}>{addButtonLabel ?? 'Add'}</Text>
          <Image source={IMAGES.down} style={styles.arrow} />
        </TouchableOpacity>
        {/* ADD BUTTON */}
        <TouchableOpacity
          onPress={handleAddPress}
          activeOpacity={0.8}
          disabled={disabled || !value}>
          <LinearGradient
            colors={disabled ? ['#CCCCCC', '#999999'] : ['#8858F9', '#6036C4']}
            style={[styles.addBtn, (disabled || !value) && styles.disabledBtn]}>
            <Text style={styles.addText}>{addButtonLabel ?? 'Add'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      {/* MODAL LIST - Only show when not disabled */}
      {!disabled && (
        <Modal visible={visible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={() => setVisible(false)}>
            <View style={styles.modal}>
              <FlatList
                data={data}
                keyExtractor={item => item.value}
                showsVerticalScrollIndicator={false}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.item}
                    onPress={() => handleSelectItem(item)}
                    activeOpacity={0.7}>
                    {item.icon && (
                      <Image source={item.icon} style={styles.itemIcon} />
                    )}
                    <Text style={styles.itemText}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
};

export default CustomPickerModule;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(30),
    borderWidth: 1,
    borderColor: COLORS.colorGray100,
    paddingHorizontal: SIZE.MS(12),
    height: SIZE.MVS(48),
  },
  disabledContainer: {
    opacity: 0.5,
    backgroundColor: '#F5F5F5',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(8),
  },
  icon: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    resizeMode: 'contain',
  },
  valueText: {
    flex: 1,
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(13),
    color: COLORS.TEXT_DARK,
  },
  placeholderText: {
    color: COLORS.TEXT_MEDIUM,
  },
  arrow: {
    width: SIZE.MS(12),
    height: SIZE.MS(12),
    tintColor: COLORS.TEXT_MEDIUM,
  },
  addBtn: {
    height: SIZE.MVS(30),
    width: SIZE.MVS(80),
    borderRadius: SIZE.MS(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  addText: {
    color: COLORS.WHITE,
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(12),
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    padding: SIZE.MS(20),
  },
  modal: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(12),
    paddingVertical: SIZE.MVS(8),
    maxHeight: SIZE.MVS(300),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZE.MVS(12),
    paddingHorizontal: SIZE.MS(16),
    gap: SIZE.MS(10),
  },
  itemIcon: {
    width: SIZE.MS(18),
    height: SIZE.MS(18),
    resizeMode: 'contain',
  },
  itemText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(13),
    color: COLORS.TEXT_DARK,
  },
});
