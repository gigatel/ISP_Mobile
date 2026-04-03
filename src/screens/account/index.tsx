import {reset} from '@navigation/services';
import {Screen} from '@organisms';
import {resetStore, RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE, STYLES} from '@res';
import {DataType, ScreenProps} from '@types';
import {Common, Preferences} from '@utils';
import React, {FC, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {RootStackParamList} from '@navigation/navigator';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import CustomAlert from '../../components/molecules/CustomAlert';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import {connect, useDispatch} from 'react-redux';
import {
  FontFamily,
  Gap,
  FontSize,
  Padding,
  BoxShadow,
  Border,
  Height,
  Width,
  LineHeight,
} from '../../res/globalStyle';

type AccountNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BottomTab'
>;
const Account: FC<ScreenProps.Account> = ({
  employeeDetails,
  appModules,
  loading,
}) => {
  const {t} = useTranslation();
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const [isLoading, setisLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const navigation = useNavigation<AccountNavigationProp>();
  const loginData = Preferences.getData('LOGIN_RESPONSE');
  const dispatch = useDispatch<StoreDispatch>();
  const user = loginData;

  // const logout = async () => {
  //   Common.yesNoAlert(t('logout'), t('are_you_sure_logout'), async () => {
  //     await Preferences.logout();
  //     reset('Login');
  //     dispatch(resetStore());
  //   });
  // };
  const handleLogout = async () => {
    try {
      setisLoading(true);
      await Preferences.logout();
      reset('Login');
      dispatch(resetStore());
    } catch (e) {
      console.log(e);
    } finally {
      setisLoading(false);
      setShowLogoutAlert(false);
    }
  };
  return (
    <Screen
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      loading={isLoading || loading}
      preset={'fixed'}
      statusBarStyle={'dark'}>
      <View style={styles.view}>
        <View style={styles.accountWrapper}>
          <Text style={[styles.account, styles.accountTypo]}>Account</Text>
        </View>
        <View style={styles.frameParent}>
          <View style={[styles.frameGroup, styles.frameFlexBox]}>
            <View style={[styles.frameContainer, styles.frameFlexBox]}>
              <View style={styles.avatarContainer}>
                {user ? (
                  <View style={styles.initialContainer}>
                    <Text style={styles.initialText}>
                      {user?.userFullName?.[0]}
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={IMAGES.profileImage}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    onError={() => setImageError(true)}
                  />
                )}
              </View>
              <View style={styles.shubhamDobriyalParent}>
                <Text style={[styles.shubhamDobriyal, styles.accountTypo]}>
                  {user?.userFullName}
                </Text>
                <Text style={[styles.developer, styles.developerClr]}>
                  {user?.designaionName || 'N/A'}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => setShowLogoutAlert(true)}>
              <Image
                source={IMAGES.logout}
                style={styles.iconstackioLogout}
                resizeMode="cover"
              />
            </Pressable>
          </View>
          <View style={styles.frameView}>
            <View style={styles.frameWrapper}>
              <Pressable
                onPress={() => navigation.navigate('ProfileScreen')}
                style={styles.frameWrapper2}>
                <View style={[styles.frameParent2, styles.frameParentFlexBox]}>
                  <View style={styles.frameParent3}>
                    <Image
                      source={IMAGES.Frame}
                      style={styles.frameItem}
                      resizeMode="cover"
                    />
                    <View style={styles.profileParent}>
                      <Text style={[styles.profile, styles.profilePosition]}>
                        Profile
                      </Text>
                      <Text
                        style={[
                          styles.basicDetailsLinked,
                          styles.profilePosition,
                        ]}>
                        Basic details linked to your account
                      </Text>
                    </View>
                  </View>
                  <Image
                    source={IMAGES.rightarrow}
                    style={styles.iconLightMonthChevron}
                    resizeMode="cover"
                  />
                </View>
              </Pressable>
            </View>
            <View style={styles.frameWrapper}>
              <Pressable
                onPress={() => {
                  navigation.navigate('AppModulesScreen');
                }}
                style={styles.frameWrapper2}>
                <View style={[styles.frameParent4, styles.frameParentFlexBox]}>
                  <View style={styles.frameParent3}>
                    <Image
                      source={IMAGES.starfull}
                      style={styles.frameItem}
                      resizeMode="cover"
                    />
                    <View style={styles.appModulesParent}>
                      <Text style={[styles.profile, styles.profilePosition]}>
                        App Modules
                      </Text>
                      <Text
                        style={[
                          styles.basicDetailsLinked,
                          styles.profilePosition,
                        ]}>
                        Enabled features available to you
                      </Text>
                    </View>
                  </View>
                  <Image
                    source={IMAGES.rightarrow}
                    style={styles.iconLightMonthChevron}
                    resizeMode="cover"
                  />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
      <CustomAlert
        visible={showLogoutAlert}
        icon={IMAGES.logout} // ✅ Your image here
        iconTint={COLORS.ERROR || '#FF4D4F'}
        title="Logout"
        subTitle="Are you sure you want to logout?"
        leftBtnText="Cancel"
        leftBtnBg="#F0F0F0"
        leftBtnTextColor="#333"
        onLeftPress={() => setShowLogoutAlert(false)}
        rightBtnText="Logout"
        rightBtnBg="#FF4D4F"
        rightBtnTextColor="#FFF"
        onRightPress={handleLogout}
      />
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading: state.account.loading === 'pending',
  appModules: state.account.appModules,
  employeeDetails: state.dashboard.dashboardList?.employeeDetails,
});

export default connect(MapStateToProps)(Account);

const styles = StyleSheet.create({
  appModuletext: {
    color: COLORS.PRIMARY_DARK,
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MVS(14),
  },
  avatarContainer: {
    width: SIZE.MS(50),
    height: SIZE.MS(50),
    borderRadius: SIZE.MS(25),
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  accountTypo: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  frameFlexBox: {
    gap: Gap.gap_10,
    alignItems: 'center',
    flexDirection: 'row',
  },
  developerClr: {
    color: COLORS.colorDimgray,
    fontSize: FontSize.fs_11,
  },
  frameParentFlexBox: {
    gap: 0,
    paddingHorizontal: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  profilePosition: {
    left: 0,
    position: 'absolute',
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  view: {
    width: '100%',
    paddingHorizontal: Padding.padding_20,
    paddingTop: SIZE.MVS(38),
    paddingBottom: Padding.padding_20,
    gap: Gap.gap_24,
    flex: 1,
  },
  accountWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  account: {
    fontSize: SIZE.MVS(18),
    letterSpacing: -0.4,
    lineHeight: 23,
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  frameParent: {
    alignSelf: 'stretch',
    gap: Gap.gap_24,
  },
  frameGroup: {
    borderRadius: SIZE.MS(6),
    alignSelf: 'stretch',
  },
  frameContainer: {
    flex: 1,
  },
  shubhamDobriyalParent: {
    gap: 6,
    justifyContent: 'center',
  },
  shubhamDobriyal: {
    fontSize: SIZE.MVS(15),
    lineHeight: 19,
    color: COLORS.colorDarkslategray,
  },
  developer: {
    lineHeight: SIZE.MS(12),
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  iconstackioLogout: {
    height: SIZE.MVS(24),
    width: SIZE.MVS(24),
    opacity: 0.8,
  },
  frameView: {
    gap: SIZE.MVS(16),
    alignSelf: 'stretch',
  },
  frameWrapper: {
    borderRadius: Border.br_10,
    backgroundColor: COLORS.WHITE,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',

    paddingLeft: Padding.padding_16,
    paddingTop: Padding.padding_8,
    paddingRight: Padding.padding_22,
    paddingBottom: Padding.padding_8,
    alignSelf: 'stretch',

    // ✅ ANDROID SHADOW
    elevation: 3,

    // ✅ iOS SHADOW
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  frameWrapper2: {
    alignSelf: 'stretch',
  },
  frameParent2: {
    paddingVertical: 12,
  },
  frameParent3: {
    gap: Gap.gap_12,
    flexDirection: 'row',
    flex: 1,
  },
  frameItem: {
    height: Height.height_40,
    width: Width.width_40,
    borderRadius: 50,
  },
  profileParent: {
    width: 174,
    height: 39,
  },
  profile: {
    top: 0,
    fontSize: FontSize.fs_14,
    lineHeight: 20,
    color: COLORS.colorDarkslategray,
    left: 0,
    position: 'absolute',
  },
  basicDetailsLinked: {
    top: 23,
    color: COLORS.colorDimgray,
    fontSize: FontSize.fs_10,
  },
  iconLightMonthChevron: {
    height: 12,
    width: 7,
  },
  frameParent4: {
    paddingVertical: Padding.padding_16,
  },
  appModulesParent: {
    width: 163,
    height: 39,
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
});
