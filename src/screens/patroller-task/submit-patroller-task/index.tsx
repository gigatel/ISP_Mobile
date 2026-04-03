import {Buttons, InputField, RadioButton} from '@atoms';
import {BackHeader, CaptureChamberPicture} from '@molecules';
import {Screen} from '@organisms';
import Geolocation from '@react-native-community/geolocation';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE, STYLES} from '@res';
import {ChamberIssueListActionSheet} from '@sheets';
import {checkCameraPermission} from '@slices/permission.slice';
import LinearGradient from 'react-native-linear-gradient';
import {
  submitPatrollerTaskApi,
  updateChamberTaskListDistance,
  updateSubmitPatrollerTask,
} from '@slices/task.slice';
import {DataType, ScreenProps} from '@types';
import {Common, Location, Permissions, Preferences, Times} from '@utils';
import React, {FC, useEffect, useState, useCallback} from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  ScrollView,
  TextInput,
} from 'react-native';
import {connect, useDispatch} from 'react-redux';
import {
  Height,
  Gap,
  LetterSpacing,
  FontFamily,
  Padding,
  Border,
  FontSize,
  BoxShadow,
  LineHeight,
  Width,
} from '../../../res/globalStyle';

const RadioButtonRow = ({value, setValue, type}: any) => {
  return (
    <TouchableOpacity
      onPress={() => {
        setValue(type);
      }}
      style={styles.submitRadioButtonRow}>
      <RadioButton
        active={value === type}
        viewStyle={{}}
        onPress={() => {
          setValue(type);
        }}
      />
      <Text style={styles.submitRatioTitle}>
        {type === 'yes' ? 'Yes' : 'No'}
      </Text>
    </TouchableOpacity>
  );
};

const ImageTitleRowView = ({
  tint,
  icon,
  title,
  desc,
}: {
  tint: string;
  icon: number;
  title: string;
  desc?: string;
}) => {
  return (
    <View style={styles.imageTitleRowView}>
      <Image
        source={icon}
        style={[styles.imageTitleRowIcon, {tintColor: tint}]}
      />
      <Text style={styles.imageTitleRowTitle}>{title}</Text>
      {desc && <Text style={styles.imageTitleRowDesc}>{desc}</Text>}
    </View>
  );
};

//! ***************** Submit Patroller Task ***************

const PatrollerTask: FC<ScreenProps.SubmitPatrollerTask> = ({
  loading,
  navigation,
  route,
  taskData,
}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const [isLoading, setIsLoading] = useState(false);
  const [empID] = useState(route.params.empID);
  const [selectedChamber] = useState(route.params.selectedChamber);
  const [currentPosition, setCurrentPosition] = useState(
    route.params?.currentPosition,
  );
  const [distance, setDistance] = useState(
    route.params.selectedChamber?.distance,
  );
  console.log(
    'Submit Task Prev Distance::',
    route.params.selectedChamber?.distance,
  );
  const [isIssueFound, setIsIssueFound] = useState<'yes' | 'no' | ''>('');
  const [pic1, setPic1] = useState<DataType.ImagePickerResponse | null>(null);
  const [pic2, setPic2] = useState<DataType.ImagePickerResponse | null>(null);
  const [chamberIssue, setChamberIssue] = useState<null | DataType.IdName>(
    null,
  );
  const [remark, setRemark] = useState('');

  useEffect(() => {
    dispatch(checkCameraPermission());
    Permissions.requestPermission();
  }, [dispatch]);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Watch Position
  useEffect(() => {
    let watchId;

    if (watchId) {
      Geolocation.clearWatch(watchId);
    }
    watchId = Geolocation.watchPosition(
      res => {
        const coords = res.coords;
        Common.success('Watch Position Start in Submit', coords);
        setCurrentPosition(coords as DataType.Coords);
        const lat = coords?.latitude;
        const lng = coords?.longitude;
        const lastAdd = Preferences.getData(
          'LAST_GEO_ADDRESS',
        ) as DataType.GeoAddress;
        // Always update latest lat/lng
        const updatedAddress = {
          address: lastAdd?.address ?? '',
          lat,
          long: lng,
        };
        Preferences.setData('LAST_GEO_ADDRESS', updatedAddress);
        if (selectedChamber) {
          const dis = Location.calculateDistance(
            parseFloat(selectedChamber.chamberLat),
            parseFloat(selectedChamber.chamberLong),
            lat,
            lng,
            'm',
          );
          setDistance(dis);
        }
      },
      err => {
        Common.error('❌ Error in Watch Position::', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        distanceFilter: 20,
        interval: 10000,
        fastestInterval: 10000,
      },
    );

    // Cleanup on screen blur
    return () => {
      if (watchId) {
        Common.error('Watch Position Cleared in Submit');
        Geolocation.clearWatch(watchId);
      }
    };
  }, [selectedChamber]);

  const saveOfflineTask = (params: any) => {
    Common.alert({
      title: 'Offline Task',
      msg: 'Task saved as offline, data will be sync to server when internet available.',
      onPress: () => navigation.goBack(),
    });
    const prevData = Preferences.getData('SUBMIT_TASK_DATA');
    console.log('prevData', prevData);
    if (prevData && prevData?.length > 0) {
      Preferences.setData('SUBMIT_TASK_DATA', [...prevData, ...params]);
    } else {
      Preferences.setData('SUBMIT_TASK_DATA', params);
    }
  };

  const callApi = async (id: string) => {
    dispatch(updateSubmitPatrollerTask({chamberId: id}));
    dispatch(
      updateChamberTaskListDistance({
        lat: currentPosition?.latitude,
        lng: currentPosition?.longitude,
      }),
    );
  };

  const checkValidation = async () => {
    if (isLoading) return;
    if (!pic1) {
      Common.alert({title: 'Alert', msg: 'Please add first image of Chamber!'});
      return;
    }
    if (!pic2) {
      Common.alert({
        title: 'Alert',
        msg: 'Please add second image of Chamber!',
      });
      return;
    }
    if (isIssueFound === '') {
      Common.alert({title: 'Alert', msg: 'Please select issue found or not!'});
      return;
    }
    if (isIssueFound === 'yes' && !chamberIssue) {
      Common.alert({
        title: 'Alert',
        msg: 'You have selected yes on chamber issue found but not selected any issue from the given list.',
      });
      return;
    }
    if (!selectedChamber) {
      Common.showToast('No Chamber Data Found!');
      return;
    }
    // ---------- STRICT GEOFENCE CHECK ----------
    let dist = Number(distance);
    if (!Number.isFinite(dist)) {
      const lat = currentPosition?.latitude ?? 0;
      const lng = currentPosition?.longitude ?? 0;
      const cLat = parseFloat(String(selectedChamber?.chamberLat ?? '0'));
      const cLng = parseFloat(String(selectedChamber?.chamberLong ?? '0'));
      dist = Location.calculateDistance(cLat, cLng, lat, lng, 'm');
      setDistance(dist);
    }
    if (Number.isFinite(dist) && dist > 2000) {
      console.log('Distance out of range:', dist);
      Common.alert({
        title: 'Not in Range',
        msg:
          `You are not within 100 metre radius. (${dist.toFixed(1)} m)\n\n` +
          'चेंबर का लेट/लॉन्ग अपडेट करवाएं। \nआप 100 मीटर के दायरे में नहीं हैं।',
      });
      return;
    }
    try {
      setIsLoading(true);
      let currentAddress = await Location.getAddressWithLatLong(
        currentPosition?.latitude ?? 0,
        currentPosition?.longitude ?? 0,
      );
      if (!currentAddress?.address) {
        currentAddress = Preferences.getData('LAST_GEO_ADDRESS');
      }
      Preferences.setData('LAST_GEO_ADDRESS', currentAddress);
      let chamberAddress = selectedChamber.chamberAddress;
      const markdate = Common.getFormatedDate('YYYY-MM-DD');
      const markTime = Times.getFormatedTime('HH:mm:ss');
      const params = [
        {
          reportingImage: [
            {
              imageUrl: pic1?.data ?? '',
              imageExtention: pic1?.filename?.split('.').pop() ?? 'png',
            },
            {
              imageUrl: pic2?.data ?? '',
              imageExtention: pic2?.filename?.split('.').pop() ?? 'png',
            },
          ],
          remarks: remark,
          alerts: [{alert_id: 0, group_id: 0, is_alert: false}],
          gigatelOldNearestChamberID: selectedChamber.chamberId,
          isSubmitWithAlert: false,
          isChamberComplaint: false,
          lat: `${currentPosition?.latitude}`,
          lon: `${currentPosition?.longitude}`,
          chamberLat: selectedChamber?.chamberLat,
          chamberLon: selectedChamber?.chamberLong,
          gpsAddress: currentAddress?.address ?? '',
          chamberGPSAddress: chamberAddress,
          priority: '2',
          taskType: '',
          taskId: taskData?.taskId ?? 0,
          isOffline: true,
          companyCode: 'gtpl',
          createdOn: `${markdate}T${markTime}`,
          employeeId: empID,
          status: '1',
          updateStatusAlso: true,
          isIssueExist: isIssueFound === 'yes',
          issueTypId: chamberIssue?.id ?? 0,
          issueRemark: remark,
        },
      ];
      console.log('📤 [SUBMIT] Calling API...');
      const res = await dispatch(submitPatrollerTaskApi(params));
      if (res.payload.status === 200 && res.payload.success) {
        console.log('✅ [SUBMIT] Success - updating Redux');
        dispatch(
          updateSubmitPatrollerTask({chamberId: selectedChamber.chamberId}),
        );
        dispatch(
          updateChamberTaskListDistance({
            lat: currentPosition?.latitude,
            lng: currentPosition?.longitude,
          }),
        );
        Common.alert({
          title: 'Success',
          msg: 'Task Submitted Successfully!',
          onPress: () => {
            console.log('🔙 [NAV] Going back to PatrollerTask');
            navigation.goBack();
          },
        });
      } else if (res.payload.status === 202 && !res.payload.success) {
        console.log('📴 [SUBMIT] Offline mode - saving locally');
        saveOfflineTask(params);
        dispatch(
          updateSubmitPatrollerTask({chamberId: selectedChamber.chamberId}),
        );
        dispatch(
          updateChamberTaskListDistance({
            lat: currentPosition?.latitude,
            lng: currentPosition?.longitude,
          }),
        );
      } else if (res?.payload?.status !== 200 && !res.payload?.success) {
        console.log('⚠️ [SUBMIT] Failed - saving offline');
        saveOfflineTask(params);
        dispatch(
          updateSubmitPatrollerTask({chamberId: selectedChamber.chamberId}),
        );
        dispatch(
          updateChamberTaskListDistance({
            lat: currentPosition?.latitude,
            lng: currentPosition?.longitude,
          }),
        );
      }
    } catch (error) {
      Common.error('❌ [SUBMIT] Task submission failed', error);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Screen
      statusBgColor={COLORS.PRIMARY}
      preset={'fixed'}
      statusBarStyle={'light'}
      loading={loading || isLoading}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />

      {/* Header */}
      <View style={styles.headerWrapper}>
        <BackHeader headerTitle="Submit Task" onBackPress={handleBackPress} />
      </View>

      {/* Floating Card with ScrollView */}
      <View style={styles.floatingCard}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.cardContent}>
            {/* Chamber Info Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Chamber</Text>
              <View style={styles.chamberBox}>
                <Text style={styles.chamberText}>
                  {`${selectedChamber?.chamberIdStr ?? ''} - ${
                    selectedChamber?.chamberName ?? ''
                  }`}
                </Text>
              </View>
            </View>

            {/* Chamber Pictures Section */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>Chamber Pictures</Text>
                <Text style={styles.required}> *</Text>
              </View>
              <Text style={styles.helperText}>
                Take clear photos showing both chambers.
              </Text>

              <View style={styles.submitTaskPicRow}>
                <CaptureChamberPicture
                  title="PIC 1"
                  pic={pic1}
                  setPic={(e: any) => setPic1(e)}
                  lat={currentPosition?.latitude ?? 0}
                  long={currentPosition?.longitude ?? 0}
                />
                <CaptureChamberPicture
                  title="PIC 2"
                  pic={pic2}
                  setPic={(e: any) => setPic2(e)}
                  lat={currentPosition?.latitude ?? 0}
                  long={currentPosition?.longitude ?? 0}
                />
              </View>
            </View>
            {distance && distance > 100 && (
              <View style={styles.warningBox}>
                <View style={styles.warningRow}>
                  <Image
                    source={IMAGES.location}
                    style={styles.warningIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.warningText}>
                    अभी चैम्बर से आपकी दूरी है:{' '}
                    <Text style={styles.distanceText}>{` ${(
                      distance ?? 0
                    ).toFixed(1)}m`}</Text>
                  </Text>
                </View>
                <View style={styles.warningRow}>
                  <Image
                    source={IMAGES.warning}
                    style={styles.warningIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.warningText}>
                    चेंबर का स्थान अपडेट करवाएं। | आप{' '}
                    <Text style={styles.distanceText}>100</Text> मीटर के दायरे
                    में नहीं है।|
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.section}>
              <View style={styles.issueRow}>
                <View style={styles.issueCol}>
                  <View style={styles.labelRow}>
                    <Text style={styles.sectionLabel}>Chamber Issue Found</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <View style={styles.submitRadioViewContainer}>
                    <RadioButtonRow
                      value={isIssueFound}
                      setValue={setIsIssueFound}
                      type={'yes'}
                    />
                    <RadioButtonRow
                      value={isIssueFound}
                      setValue={setIsIssueFound}
                      type={'no'}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Chamber Issue Selection */}
            {isIssueFound === 'yes' && (
              <View style={styles.section}>
                <ChamberIssueListActionSheet
                  value={chamberIssue}
                  setValue={setChamberIssue}
                />
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Remarks</Text>
              {/* <InputField
                value={remark}
                onChangeText={setRemark}
                placeholder="Enter remarks here..."
                multiline
                numberOfLines={4}
                viewStyle={styles.remarksBox}
                // textInputStyle={styles.remarksInput}
              /> */}
              <TextInput
                value={remark}
                onChangeText={setRemark}
                placeholder="Enter remarks here..."
                multiline
                numberOfLines={4}
                style={styles.remarksBox}
              />
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.discardButton}
                onPress={handleBackPress}>
                <Text style={styles.buttonText}>DISCARD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={checkValidation}>
                <Text style={styles.buttonText}>SUBMIT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading: state.task.submitTaskLoading === 'pending',
  taskData: state.task.taskListData,
});

export default connect(MapStateToProps)(PatrollerTask);

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
    paddingBottom: SIZE.MVS(28),
  },
  floatingCard: {
    position: 'absolute',
    top: SIZE.MVS(60),
    left: 0,
    right: 0,
    bottom: 0,
    marginHorizontal: SIZE.MS(12),
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: SIZE.MS(12),
    borderTopRightRadius: SIZE.MS(12),
    ...STYLES.SHADOW_BLACK_6,
    elevation: 8,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  cardContent: {
    padding: SIZE.MS(16),
    paddingBottom: SIZE.MVS(30),
  },
  section: {
    marginBottom: SIZE.MVS(16),
    backgroundColor: COLORS.WHITE,
  },
  sectionLabel: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    marginBottom: SIZE.MVS(8),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZE.MVS(4),
  },
  remarkView: {marginHorizontal: 0},
  required: {
    color: COLORS.colorRed,
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
  },
  helperText: {
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray200,
    marginBottom: SIZE.MVS(8),
  },
  submitTaskPicRow: {
    flexDirection: 'row',
    gap: SIZE.MS(8),
  },
  chamberBox: {
    backgroundColor: COLORS.colorWhitesmoke,
    borderRadius: SIZE.MS(6),
    padding: SIZE.MS(12),
  },
  chamberText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDimgray,
    lineHeight: SIZE.MS(22),
  },
  warningBox: {
    backgroundColor: COLORS.colorGoldenrod200,
    borderWidth: 0.5,
    borderColor: COLORS.colorGoldenrod100,
    borderRadius: SIZE.MS(6),
    padding: SIZE.MS(12),
    marginBottom: SIZE.MVS(16),
    gap: SIZE.MS(8),
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(6),
  },
  submitRadioViewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    width: SIZE.MS(13),
    height: SIZE.MS(17),
  },
  warningText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray200,
    flex: 1,
    lineHeight: SIZE.MS(22),
  },
  distanceText: {
    fontWeight: '600',
    color: COLORS.colorGoldenrod100,
  },
  issueRow: {
    flexDirection: 'row',
    gap: SIZE.MS(10),
  },
  issueCol: {
    flex: 1,
  },
  remarksBox: {
    alignSelf: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: SIZE.MS(6),
    minHeight: SIZE.MS(100),
  },
  remarksInput: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray200,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SIZE.MS(10),
    marginTop: SIZE.MVS(8),
  },
  discardButton: {
    flex: 1,
    backgroundColor: COLORS.colorDarkslategray,
    borderRadius: SIZE.MS(8),
    paddingVertical: SIZE.MS(13),
    alignItems: 'center',
    justifyContent: 'center',
    ...STYLES.SHADOW_BLACK_6,
  },
  submitButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: SIZE.MS(8),
    paddingVertical: SIZE.MS(13),
    alignItems: 'center',
    justifyContent: 'center',
    ...STYLES.SHADOW_BLACK_6,
  },
  buttonText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
    color: COLORS.WHITE,
    textTransform: 'uppercase',
  },
  submitRadioButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZE.MS(20),
  },
  submitRatioTitle: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_DARKER,
    marginLeft: SIZE.MS(10),
  },
  imageTitleRowView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZE.MS(15),
  },
  imageTitleRowIcon: {
    height: SIZE.MS(20),
    width: SIZE.MS(20),
  },
  imageTitleRowTitle: {
    marginLeft: SIZE.MS(5),
    marginRight: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.TEXT_DARK,
    fontSize: SIZE.MS(14),
  },
  imageTitleRowDesc: {
    marginLeft: SIZE.MS(5),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.ACCENT_ORANGE,
    fontSize: SIZE.MS(14),
  },
});
