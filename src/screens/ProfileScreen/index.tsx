import {useNavigation} from '@react-navigation/native';
import {reset} from '@navigation/services';
import {Screen} from '@organisms';
import {resetStore, RootState, StoreDispatch} from '@reducers';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {COLORS, FONTS, IMAGES, SIZE, STYLES} from '@res';
import {DataType, ScreenProps} from '@types';
import {Common, Location, Preferences} from '@utils';
import LinearGradient from 'react-native-linear-gradient';
import React, {FC, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, StyleSheet, Text, View, Alert, Pressable} from 'react-native';
import {connect, useDispatch} from 'react-redux';
import {RootStackParamList} from '@navigation/navigator';
import {
  FontFamily,
  Height,
  Width,
  MinWidth,
  LineHeight,
  FontSize,
  Padding,
  Gap,
} from '../../res/globalStyle';
type NavigationProps = NativeStackNavigationProp<
  RootStackParamList,
  'ProfileScreen'
>;
const ProfileScreen: FC<ScreenProps.ProfileScreen> = ({
  employeeDetails,
  loading,
}) => {
  const {t} = useTranslation();
  const navigation = useNavigation<NavigationProps>();
  const loginData = Preferences.getData('LOGIN_RESPONSE');
  const user = loginData;
  const dispatch = useDispatch<StoreDispatch>();
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const loadLastAddress = async () => {
    const lastAddress = await Preferences.getData('LAST_FULL_ADDRESS');
    if (lastAddress?.address) setAddress(lastAddress.address);
  };
  const getAddressLocation = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setLocationError('');

      const permissionStatus = await Location.checkPermission();

      if (permissionStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to fetch address.',
          [{text: 'OK'}],
        );
        return;
      }

      const data = await Location.getAddressFromLatLong(forceRefresh);

      // ✅ FIX: addressList handle करो
      let finalAddress = '';

      if (data?.addressList && data.addressList.length > 0) {
        finalAddress = data.addressList[0];
      } else if (data?.address) {
        finalAddress = data.address;
      }

      if (finalAddress) {
        setAddress(finalAddress);
        Common.showToast('Address updated successfully!');
      } else {
        setLocationError('Unable to fetch address');
      }
    } catch (e: any) {
      setLocationError(e?.message || 'Location error');
    } finally {
      setIsLoading(false);
    }
  };
  const logout = async () => {
    Common.yesNoAlert('Logout', 'Are you sure?', async () => {
      await Preferences.logout();
      reset('Login');
      dispatch(resetStore());
    });
  };

  return (
    <Screen
      statusBgColor={COLORS.WHITE}
      loading={isLoading || loading}
      preset={'fixed'}
      statusBarStyle={'dark'}>
      <View style={styles.view}>
        <View style={styles.frameParent}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.arrowBack24dp434343Fill0WParent}>
            <Image
              source={IMAGES.arrowBack}
              style={styles.arrowBack24dp434343Fill0WIcon}
              resizeMode="cover"
            />
            <Text style={[styles.profile, styles.profileTypo]}>Profile</Text>
          </Pressable>
          <Text style={[styles.basicDetailsLinked, styles.profileTypo]}>
            Basic details linked to your account
          </Text>
          <View style={styles.frameGroup}>
            <View style={styles.frameWrapper}>
              <View style={styles.frameContainer}>
                <Image
                  source={IMAGES.profileImage}
                  style={[styles.edit38dp1f1f1fFill1Wght200Icon]}
                  resizeMode="cover"
                />
              </View>
            </View>
            <View style={styles.frameView}>
              <View
                style={[styles.userRegularFull1Parent, styles.parentLayout]}>
                <Image
                  source={IMAGES.accountNew}
                  style={[styles.userRegularFull1Icon, styles.iconLayout]}
                  resizeMode="contain"
                />
                <Text style={[styles.name, styles.nameTypo]}>Name</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                  {user?.userFullName || '-'}
                </Text>
              </View>
            </View>
            <View style={styles.frameChild} />
            <View style={styles.frameView}>
              <View
                style={[
                  styles.mobile24dp1f1f1fFill0Wght3Parent,
                  styles.parentLayout,
                ]}>
                <Image
                  source={IMAGES.mobile}
                  style={styles.mobile24dp1f1f1fFill0Wght3Icon}
                  resizeMode="contain"
                />
                <Text style={[styles.name, styles.nameTypo]}>Phone no.</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                  {user?.phoneNumber || '-'}
                </Text>
              </View>
            </View>
            <View style={styles.frameChild} />
            <View style={styles.frameView}>
              <View
                style={[
                  styles.mobile24dp1f1f1fFill0Wght3Parent,
                  styles.parentLayout,
                ]}>
                <Image
                  source={IMAGES.mailImage}
                  style={styles.mail24dp1f1f1fFill0Wght300Icon}
                  resizeMode="cover"
                />
                <Text style={[styles.name, styles.nameTypo]}>Email</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                  {user?.userEmailId}
                </Text>
              </View>
            </View>

            <View style={styles.frameChild} />
            <View style={styles.frameView}>
              <View
                style={[
                  styles.homePin24dp1f1f1fFill0WghParent,
                  styles.parentLayout,
                ]}>
                <Image
                  source={IMAGES.HomePin}
                  style={styles.homePin24dp1f1f1fFill0WghIcon}
                  resizeMode="cover"
                />
                <Text style={[styles.name, styles.nameTypo]}>Address</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                  {address}
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => getAddressLocation(false)}
            style={styles.buttonWrapper}>
            <View
              style={[styles.button, styles.buttonBorder]}
              // locations={[0, 1]}
              // colors={['rgba(255, 255, 255, 0.12))']}
              // useAngle={true}
              // angle={180}
            >
              <Text style={[styles.updateAddress]}>Update Address</Text>
            </View>
          </Pressable>
          <Text style={[styles.allChangesTake, styles.updateAddressTypo]}>
            All changes take effect immediately
          </Text>{' '}
        </View>
      </View>
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading: state.account.loading === 'pending',
  employeeDetails: state.dashboard.dashboardList?.employeeDetails,
});

export default connect(MapStateToProps)(ProfileScreen);

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SIZE.MS(15),
    backgroundColor: COLORS.WHITE,
    ...STYLES.SHADOW_PRIMARY_3,
  },
  parent: {
    flex: 1,
  },

  profileTypo: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  buttonBorder: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderStyle: 'solid',
    alignItems: 'center',
    flexDirection: 'row',
  },
  iconLayout: {
    height: 18,
    width: 18,
  },
  parentLayout: {
    minWidth: MinWidth.min_w_96,
    flexDirection: 'row',
  },
  nameTypo: {
    lineHeight: LineHeight.lh_24,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  updateAddressTypo: {
    textAlign: 'center',
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.MEDIUM,
  },
  view: {
    width: '100%',
    paddingHorizontal: Padding.padding_20,
    paddingTop: 38,
    paddingBottom: Padding.padding_20,
    gap: 24,
    flex: 1,
  },
  frameParent: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
  },
  arrowBack24dp434343Fill0WParent: {
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  arrowBack24dp434343Fill0WIcon: {
    width: Width.width_24,
    height: Height.height_24,
    resizeMode: 'contain',
  },
  profile: {
    fontSize: 18,
    letterSpacing: -0.4,
    lineHeight: 23,
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  basicDetailsLinked: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.colorDimgray,
  },
  frameGroup: {
    gap: 14,
    alignSelf: 'stretch',
  },
  frameWrapper: {
    paddingBottom: 8,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  frameContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  image5Parent: {
    borderRadius: 500,
    padding: 3,
    gap: Gap.gap_10,
  },
  image5Icon: {
    height: 100,
    width: 100,
    borderRadius: 50,
    zIndex: 0,
  },
  edit38dp1f1f1fFill1Wght200Icon: {
    height: 100,
    width: 100,
    marginVertical: 8,
    borderRadius: 6,
    zIndex: 1,
  },
  frameView: {
    gap: Gap.gap_6,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  userRegularFull1Parent: {
    gap: Gap.gap_2,
    minWidth: MinWidth.min_w_96,
    alignItems: 'center',
  },
  userRegularFull1Icon: {
    width: Width.width_20,
  },
  name: {
    fontSize: FontSize.fs_14,
    lineHeight: LineHeight.lh_24,
    color: COLORS.colorDimgray,
    flex: 1,
  },
  text: {
    fontSize: FontSize.fs_16,
    color: COLORS.colorDimgray,
  },
  shubhamDobriyal: {
    fontSize: FontSize.fs_15,
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  frameChild: {
    height: Height.height_1,
    backgroundColor: COLORS.colorGainsboro,
    alignSelf: 'stretch',
  },
  mobile24dp1f1f1fFill0Wght3Parent: {
    gap: Gap.gap_6,
  },
  mobile24dp1f1f1fFill0Wght3Icon: {
    width: 15,
    height: Height.height_24,
  },
  mail24dp1f1f1fFill0Wght300Icon: {
    width: Width.width_20,
    height: Height.height_24,
  },
  distance24dp1f1f1fFill0WghIcon: {
    width: 17,
    height: Height.height_24,
  },
  homePin24dp1f1f1fFill0WghParent: {
    gap: Gap.gap_2,
    minWidth: MinWidth.min_w_96,
  },
  homePin24dp1f1f1fFill0WghIcon: {
    width: 18,
    height: Height.height_24,
  },
  buttonWrapper: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 10,
    alignSelf: 'stretch',
  },
  button: {
    height: 48,
    borderRadius: 10,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 10,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  updateAddress: {
    fontSize: SIZE.MS(14),
    letterSpacing: -0.1,
    lineHeight: SIZE.MS(20),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorWhite,
    textAlign: 'center',
  },
  allChangesTake: {
    width: '100%',
    fontSize: SIZE.MS(10),
    lineHeight: SIZE.MS(12),
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkgray,
    textAlign: 'center',
  },
});
