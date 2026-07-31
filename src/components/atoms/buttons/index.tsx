// Button.tsx
import {COLORS, CONSTANT, FONTS, SIZE, STYLES} from '@res';
import React from 'react';
import {
  Image,
  ImageStyle,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {BoxShadow} from '../../../res/globalStyle';
interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  type?:
    | 'primary'
    | 'close'
    | 'delete'
    | 'icon'
    | 'leftIconText'
    | 'rightIconText'
    | 'primaryRightIconText';
  title?: string;
  disabled?: boolean;
  icon?: number;
  viewStyle?: ViewStyle;
  titleStyle?: TextStyle;
  iconStyle?: ImageStyle;
  onPress?: () => void;
}
interface ViewStyles {
  primary: ViewStyle;
  close: ViewStyle;
  delete: ViewStyle;
  leftIconText: ViewStyle;
  rightIconText: ViewStyle;
  primaryRightIconText: ViewStyle;
  icon: ViewStyle;
}
const Button: React.FC<ButtonProps> = ({
  type = 'primary',
  title,
  icon,
  disabled = false,
  viewStyle,
  titleStyle,
  iconStyle,
  onPress,
  ...props
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={CONSTANT.BUTTON_OPACITY}
      accessibilityRole="button"
      accessibilityLabel={title || 'Button'}
      {...props}>
      <LinearGradient
        locations={[0, 1]}
        colors={['#8858f9', '#6036c4']}
        useAngle={true}
        angle={148.57}
        style={[viewStyles[type], viewStyle]}>
        {(type === 'leftIconText' || type === 'icon') && (
          <Image source={icon} style={[iconStyles[type], iconStyle]} />
        )}
        {title && type !== 'icon' && (
          <Text style={[titleStyles[type], titleStyle]}>
            {title || 'Button'}
          </Text>
        )}
        {(type === 'rightIconText' || type === 'primaryRightIconText') && (
          <Image source={icon} style={[iconStyles[type], iconStyle]} />
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};
const BASE_STYLE: ViewStyle = {
  // height: SIZE.MVS(45),
  maxHeight: SIZE.MVS(50),
  paddingVertical: SIZE.MVS(10),
  borderRadius: SIZE.MVS(20),
  justifyContent: 'center',
  alignItems: 'center',
};
const BASE_TEXT_STYLE: TextStyle = {
  fontSize: SIZE.MVS(16),
  fontFamily: FONTS.BOLD,
  fontWeight: FONTS.FONT_WEIGHT.BOLD,
};

const viewStyles: ViewStyles = {
  icon: {
    ...BASE_STYLE,
    backgroundColor: COLORS.TRANSPARENT,
  },
  leftIconText: {
    ...BASE_STYLE,
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
  },
  rightIconText: {
    ...BASE_STYLE,
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
  },
  primaryRightIconText: {
    ...BASE_STYLE,
    backgroundColor: COLORS.PRIMARY,
    flexDirection: 'row',
  },
  primary: {
    ...BASE_STYLE,
    width: '80%',
    alignSelf: 'center',
    borderRadius: 45,
    // elevation: 15,
    boxShadow: BoxShadow.shadow_drop,
    height: 46,
    paddingVertical: 0,
    backgroundColor: COLORS.colorWhite,
    // borderColor: 'transparent',
    // borderStyle: 'solid',
    justifyContent: 'center',
    overflow: 'hidden',
    // borderWidth: 1,
  },
  close: {
    ...BASE_STYLE,
    backgroundColor: COLORS.WHITE,
    borderWidth: SIZE.MS(1),
    borderColor: COLORS.PRIMARY,
    ...STYLES.SHADOW_PRIMARY_3,
  },
  delete: {
    ...BASE_STYLE,
    backgroundColor: COLORS.WHITE,
    borderWidth: SIZE.MS(1),
    borderColor: COLORS.ERROR,
    ...STYLES.SHADOW_DELETE,
  },
};
const titleStyles = {
  leftIconText: {
    ...BASE_TEXT_STYLE,
    color: COLORS.TEXT_LINK,
    fontFamily: FONTS.REGULAR,
    fontWeight: FONTS.FONT_WEIGHT.REGULAR,
  },
  rightIconText: {
    ...BASE_TEXT_STYLE,
    color: COLORS.TEXT_LINK,
    fontFamily: FONTS.REGULAR,
    fontWeight: FONTS.FONT_WEIGHT.REGULAR,
  },
  primaryRightIconText: {
    ...BASE_TEXT_STYLE,
    color: COLORS.WHITE,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  primary: {
    ...BASE_TEXT_STYLE,
    color: COLORS.WHITE,
  },
  close: {
    ...BASE_TEXT_STYLE,
    color: COLORS.WHITE,
  },
  delete: {
    ...BASE_TEXT_STYLE,
    color: COLORS.ERROR,
  },
};

const iconStyles = StyleSheet.create({
  leftIconText: {
    marginRight: SIZE.MS(8),
    width: SIZE.MS(25),
    height: SIZE.MS(25),
    resizeMode: 'contain',
    tintColor: COLORS.TEXT_LINK,
  },
  rightIconText: {
    marginLeft: SIZE.MS(8),
    width: SIZE.MS(25),
    height: SIZE.MS(25),
    resizeMode: 'contain',
    tintColor: COLORS.TEXT_LINK,
  },
  primaryRightIconText: {
    marginLeft: SIZE.MS(8),
    width: SIZE.MS(25),
    height: SIZE.MS(25),
    resizeMode: 'contain',
    tintColor: COLORS.WHITE,
  },
  icon: {
    width: SIZE.MS(25),
    height: SIZE.MS(25),
    resizeMode: 'contain',
    tintColor: COLORS.WHITE,
  },
});
export default Button;
