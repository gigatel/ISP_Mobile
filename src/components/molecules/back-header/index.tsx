/*
 @ Author: Pankaj Kumar Prajapati
 */
import {RootState} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import React, {FC, memo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  ImageBackground,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import {useSelector} from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface HeaderProps {
  title: string;
  onBackPress?: () => void;
  showGps?: boolean;
}

/** Actual visible header content height */
const HEADER_CONTENT_HEIGHT =
  Platform.OS === 'ios' ? SIZE.MVS(20) : SIZE.MVS(80);

const BackHeader: FC<HeaderProps> = ({title, onBackPress, showGps = true}) => {
  const device = useSelector((state: RootState) => state.device);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, {height: HEADER_CONTENT_HEIGHT + insets.top}]}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <ImageBackground
        source={IMAGES.HeaderBkg}
        resizeMode="stretch"
        style={[styles.background, {paddingTop: insets.top}]}>
        <View style={styles.contentRow}>
          {/* LEFT */}
          <View style={styles.leftSection}>
            {onBackPress && (
              <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
                <Image source={IMAGES.arrowBack} style={styles.backIcon} />
              </TouchableOpacity>
            )}
            <Text numberOfLines={1} style={styles.headerTitle}>
              {title}
            </Text>
          </View>

          {/* RIGHT */}
          <View style={styles.rightSection}>
            <LinearGradient
              colors={['#8858F9', '#6036C4']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.statusGradientBox}>
              <Image
                source={device.isNet ? IMAGES.wifiOn : IMAGES.wifiOff}
                style={styles.statusIcon}
                tintColor={device.isNet ? COLORS.WHITE : COLORS.ERROR}
              />
            </LinearGradient>

            {/* ✅ iOS pe bhi GPS icon dikhaega ab */}
            {showGps && (
              <LinearGradient
                colors={['#8858F9', '#6036C4']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.statusGradientBox}>
                <Image
                  source={device.isGpsEnabled ? IMAGES.gpsOn : IMAGES.gpsOff}
                  style={styles.statusIcon}
                  tintColor={device.isGpsEnabled ? COLORS.WHITE : COLORS.ERROR}
                />
              </LinearGradient>
            )}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

export default memo(BackHeader);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  background: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZE.MS(16),
    paddingBottom: SIZE.MS(18),
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SIZE.MS(10),
  },
  backButton: {
    padding: SIZE.MS(6),
  },
  backIcon: {
    width: SIZE.MS(24),
    height: SIZE.MS(26),
    tintColor: COLORS.WHITE,
  },
  headerTitle: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: SIZE.MVS(18),
    color: COLORS.WHITE,
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(10),
  },
  statusGradientBox: {
    width: SIZE.MS(40),
    height: SIZE.MS(40),
    borderRadius: SIZE.MS(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIcon: {
    width: SIZE.MS(22),
    height: SIZE.MS(22),
    resizeMode: 'contain',
  },
});
