import {ListView, Button2} from '@atoms';
import {COLORS, CONTENT, FONTS, IMAGES, SIZE} from '@res';
import {Preferences} from '@utils';
import React, {memo} from 'react';
import {
  BackHandler,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ModalSheet from '../modal-sheet';

interface LocationPermissionProps {
  show: boolean;
  onPrivacyPress?: () => void;
  onAllowPress?: () => void;
}

const PrivacyItem = memo(({item}: {item: any}) => {
  return (
    <View style={styles.outerView}>
      <Text style={styles.titleText}>{item.title}</Text>
      <Text style={styles.descText}>{item.description}</Text>
    </View>
  );
});

export const PrivacyList = () => {
  return (
    <ListView
      data={CONTENT.privacyContent}
      renderItem={({item}) => <PrivacyItem item={item} />}
    />
  );
};
const LocationPermission: React.FC<LocationPermissionProps> = ({
  show,
  onPrivacyPress,
  onAllowPress,
}) => {
  return (
    <ModalSheet
      show={show}
      title={'Permission Required'}
      closeTitle={'Exit'}
      onClosePress={
        Platform.OS === 'android' ? () => BackHandler.exitApp() : undefined
      }>
      <Image
        source={IMAGES.LocationAccess}
        resizeMode="contain"
        style={styles.iconStyle}
      />

      <Text style={styles.infoTitleText}>Location Permission Information</Text>

      <Text style={styles.infoDescText}>
        {
          'GTPL needs your location to monitor your work tasks effectively. With your permission, we’ll collect location data when you’re using the app or when it’s in the background to support your daily operations.'
        }
      </Text>

      {/* ✅ BUTTON ROW */}
      <View style={styles.buttonRow}>
        <Button2
          type="leftIconText"
          title="Privacy Policy"
          icon={IMAGES.Privacy}
          viewStyle={styles.leftBtn}
          onPress={onPrivacyPress}
        />
        <Button2
          type="primary"
          title="Allow Access"
          viewStyle={styles.rightBtn}
          onPress={() => {
            Preferences.setData('FIRST_OPEN', 'no');
            Preferences.setData(
              'ALLOWED_ACCESS_FOR_LOCATION_BACKGROUND',
              'yes',
            );
            onAllowPress?.();
          }}
        />
      </View>
    </ModalSheet>
  );
};

export default LocationPermission;

const styles = StyleSheet.create({
  privacyButton: {
    alignSelf: 'flex-start',
    marginVertical: SIZE.MVS(15),
    borderRadius: 0,
  },
  blockedDesctext: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(13),
    color: COLORS.ERROR,
    marginTop: SIZE.MVS(10),
  },
  infoDescText: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(13),
    color: COLORS.TEXT_LIGHT,
    marginTop: SIZE.MVS(10),
  },
  infoTitleText: {
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(18),
    color: COLORS.TEXT_DARK,
  },
  iconStyle: {
    width: SIZE.MS(180),
    height: SIZE.MS(180),
    alignSelf: 'center',
  },
  titleText: {
    fontSize: SIZE.MS(16),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.TEXT_DARKER,
    marginBottom: SIZE.MVS(10),
  },
  descText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_MEDIUM,
    marginBottom: SIZE.MVS(10),
  },
  outerView: {
    marginVertical: SIZE.MVS(10),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },

  leftBtn: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },

  rightBtn: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
  },
});
