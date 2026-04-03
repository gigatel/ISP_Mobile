/*
 @ Author: Pankaj Kumar Prajapati
 */

import {Buttons} from '@atoms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import React, {FC, memo, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  ViewStyle,
  Image,
  ImageBackground,
} from 'react-native';

interface UserNameDesigRowProps {
  name: string;
  designation: string;
  avatarUri?: string;
  onBellPress?: () => void;
  onLogoutPress?: () => void;
  style?: ViewStyle;
}

const HEADER_HEIGHT = SIZE.MVS(100);

const UserNameDesigRow: FC<UserNameDesigRowProps> = ({
  name,
  designation,
  avatarUri,
  onBellPress,
  style,
}) => {
  const [imageError, setImageError] = useState(false);
  const showInitial = !avatarUri || imageError;

  return (
    <View style={[styles.container, style]}>
      <ImageBackground
        source={IMAGES.HeaderBkg}
        resizeMode="stretch"
        style={styles.background}
        imageStyle={styles.imageStyle}>
        {/* DARK OVERLAY FOR READABILITY */}
        <View style={styles.overlay} />

        <View style={styles.contentRow}>
          {/* LEFT SECTION */}
          <View style={styles.leftSection}>
            <View style={styles.avatarContainer}>
              {showInitial ? (
                <View style={styles.initialContainer}>
                  <Text style={styles.initialText}>{name?.[0] ?? ''}</Text>
                </View>
              ) : (
                <Image
                  source={{uri: avatarUri}}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              )}
            </View>

            <View style={styles.nameTextView}>
              <Text numberOfLines={1} style={styles.userNameText}>
                {name}
              </Text>
              <Text numberOfLines={1} style={styles.userDesignText}>
                {designation}
              </Text>
            </View>
          </View>
          {/* NOTIFICATION */}
          {onBellPress && (
            <View style={styles.iconButtonWrapper}>
              <View style={styles.iconButton}>
                <Buttons
                  type="icon"
                  icon={IMAGES.notification}
                  onPress={onBellPress}
                  viewStyle={styles.bellButtonInner}
                />
              </View>
              <View style={styles.notificationBadge} />
            </View>
          )}
        </View>
      </ImageBackground>
    </View>
  );
};

export default memo(UserNameDesigRow);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: HEADER_HEIGHT,
  },

  background: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  imageStyle: {
    borderBottomLeftRadius: SIZE.MS(16),
    borderBottomRightRadius: SIZE.MS(16),
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
  },

  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZE.MS(20),
    paddingBottom: SIZE.MS(20),
  },

  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(12),
    flex: 1,
  },

  avatarContainer: {
    width: SIZE.MS(50),
    height: SIZE.MS(50),
    borderRadius: SIZE.MS(25),
    overflow: 'hidden',
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
  },

  initialContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.PRIMARY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  initialText: {
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MVS(22),
    color: COLORS.PRIMARY_DARK,
    textTransform: 'uppercase',
  },

  nameTextView: {
    justifyContent: 'center',
    gap: SIZE.MS(2),
    flex: 1,
  },

  userNameText: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MVS(16),
    color: '#FFFFFF',
  },

  userDesignText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(12),
    color: '#FFFFFF',
    opacity: 0.9,
  },

  iconButtonWrapper: {
    position: 'relative',
  },

  iconButton: {
    width: SIZE.MS(42),
    height: SIZE.MS(42),
    borderRadius: SIZE.MS(12),
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bellButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  notificationBadge: {
    position: 'absolute',
    top: SIZE.MS(8),
    right: SIZE.MS(8),
    width: SIZE.MS(8),
    height: SIZE.MS(8),
    borderRadius: SIZE.MS(4),
    backgroundColor: '#FF4757',
    zIndex: 1,
  },
});
