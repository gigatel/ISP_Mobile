import React, {FC, useEffect} from 'react';
import {View, Text, StyleSheet, Image, Pressable} from 'react-native';
import {connect, useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import {reset} from '@navigation/services';
import {resetStore, RootState, StoreDispatch} from '@reducers';
import {getAppModulesApi} from '@slices/account.slice';
import {Common, Preferences} from '@utils';
import {COLORS, FONTS, IMAGES, SIZE, STYLES} from '@res';
import {RootStackParamList} from '@navigation/navigator';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  FontFamily,
  Height,
  Width,
  LineHeight,
  FontSize,
  Padding,
  Gap,
} from '../../res/globalStyle';
import {ScreenProps} from '@types';
/* -------------------- TYPES -------------------- */
type AppModuleNavigationProp = NativeStackScreenProps<
  RootStackParamList,
  'AppModuleScreen'
> & {
  employeeDetails: any;
  appModules: any;
  loading: boolean;
};
const AppModuleScreen: FC<ScreenProps.AppModuleScreen> = ({
  employeeDetails,
  appModules,
  loading,
}) => {
  const {t} = useTranslation();
  const navigation = useNavigation<AppModuleNavigationProp>();
  const dispatch = useDispatch<StoreDispatch>();
  useEffect(() => {
    if (employeeDetails?.id) {
      dispatch(getAppModulesApi(`empId=${employeeDetails.id}`));
    }
  }, [dispatch, employeeDetails?.id]);
  const logout = async () => {
    Common.yesNoAlert('Logout', 'Are you sure?', async () => {
      await Preferences.logout();
      reset('Login');
      dispatch(resetStore());
    });
  };
  const renderModuleRow = (item: any, index: number, total: number) => {
    return (
      <View style={styles.frameContainer} key={item?.id ?? index}>
        <View style={[styles.attendanceParent, styles.parentFlexBox]}>
          <Text style={styles.attendance}>
            {Common.toTitleCase(item?.name ?? 'N/A')}
          </Text>
          <Image
            source={IMAGES.checkImage}
            style={styles.checkIcon}
            resizeMode="contain"
          />
        </View>
        {index !== total - 1 && <View style={styles.frameChild} />}
      </View>
    );
  };
  const moduleList = appModules?.allowedModuleList ?? [];
  return (
    <View style={styles.view}>
      <View style={styles.frameParent}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.arrowBack24dp434343Fill0WParent}>
          <Image
            source={IMAGES.arrowBack}
            style={styles.arrowBack24dp434343Fill0WIcon}
          />
          <Text style={[styles.profile, styles.profileTypo]}>App Modules</Text>
        </Pressable>

        <Text style={[styles.basicDetailsLinked, styles.profileTypo]}>
          Enabled features available to you
        </Text>
      </View>

      {/* ---------- MODULE LIST ---------- */}
      <View style={styles.frameGroup}>
        {moduleList.length > 0 ? (
          moduleList.map((item: any, index: number) =>
            renderModuleRow(item, index, moduleList.length),
          )
        ) : (
          <Text style={styles.emptyText}>No modules assigned to you</Text>
        )}
      </View>
    </View>
  );
};

/* -------------------- REDUX -------------------- */
const mapStateToProps = (state: RootState) => ({
  loading: state.account.loading === 'pending',
  appModules: state.account.appModules,
  employeeDetails: state.dashboard.dashboardList?.employeeDetails,
});

export default connect(mapStateToProps)(AppModuleScreen);

/* -------------------- STYLES -------------------- */
const styles = StyleSheet.create({
  view: {
    flex: 1,
    paddingHorizontal: Padding.padding_20,
    paddingTop: SIZE.MVS(38),
    paddingBottom: Padding.padding_20,
    gap: SIZE.MVS(24),
  },
  frameParent: {
    gap: Gap.gap_10,
  },
  arrowBack24dp434343Fill0WParent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_8,
  },
  arrowBack24dp434343Fill0WIcon: {
    width: Width.width_24,
    height: Height.height_24,
    resizeMode: 'contain',
  },
  profile: {
    fontSize: SIZE.MS(18),
    lineHeight: SIZE.MVS(23),
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  basicDetailsLinked: {
    fontSize: SIZE.MS(12),
    lineHeight: SIZE.MVS(16),
    color: COLORS.colorDimgray,
  },
  frameGroup: {
    gap: 14,
  },
  attendanceParent: {
    justifyContent: 'space-between',
    gap: Gap.gap_20,
  },
  attendance: {
    fontSize: FontSize.fs_15,
    lineHeight: LineHeight.lh_24,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  parentFlexBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frameChild: {
    height: Height.height_1,
    backgroundColor: COLORS.colorGainsboro,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: SIZE.MVS(20),
    fontSize: SIZE.MS(14),
    color: COLORS.colorDimgray,
    fontFamily: FONTS.MEDIUM,
  },
  checkIcon: {
    width: SIZE.MVS(18),
    height: SIZE.MVS(18),
    tintColor: COLORS.SUCCESS,
  },
  profileTypo: {
    fontFamily: FONTS.MEDIUM,
    textAlign: 'left',
  },
  frameContainer: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
  },
});
