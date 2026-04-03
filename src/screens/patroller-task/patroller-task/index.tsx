import {Buttons} from '@atoms';
import {
  AlertView,
  ModalSheet,
  OptionPickerSheet,
  ChamberListModal,
} from '@molecules';
import {Screen} from '@organisms';
import Geolocation from '@react-native-community/geolocation';
import {useFocusEffect} from '@react-navigation/native';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE, STYLES} from '@res';
import {checkCameraPermission} from '@slices/permission.slice';
import {BoxShadow, FontFamily} from '../../../res/globalStyle';
import {
  getChamberIssueListApi,
  getPatrollerTaskAssinmentApi,
  updateChamberTaskListDistance,
  updateCompletedChamberStatus,
} from '@slices/task.slice';
import {DataType, ScreenProps} from '@types';
import {Common, Location, Permissions, Preferences} from '@utils';
import React, {FC, memo, useCallback, useEffect, useRef, useState} from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
} from 'react-native';
import MapView, {Marker} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {connect, useDispatch} from 'react-redux';
import {
  FontSize,
  Padding,
  Gap,
  Border,
  Width,
  Height,
  LineHeight,
} from '../../../res/globalStyle';
import LinearGradient from 'react-native-linear-gradient';

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
      <View style={styles.imageTitleRowTextContainer}>
        <Text
          style={styles.imageTitleRowTitle}
          numberOfLines={1}
          ellipsizeMode="tail">
          {title}
        </Text>
        {desc && <Text style={styles.imageTitleRowDesc}>{desc}</Text>}
      </View>
    </View>
  );
};

const TopOverlayView = memo(
  ({
    taskName,
    chamberCount,
    successCount,
    taskCount,
    distance,
    name,
    onBack,
    offlineCount,
    showDetails,
    onDown,
    top,
    behalfName,
  }: any) => {
    return (
      <>
        <View
          style={[
            styles.topDetailsContainer,
            {top: Platform.OS === 'android' ? top + 15 : top},
          ]}>
          <View style={styles.backViewRow}>
            <Buttons
              type={'icon'}
              icon={IMAGES.back}
              iconStyle={styles.backIcon}
              viewStyle={styles.backButton}
              onPress={onBack}
            />
            <View style={styles.taskNameContainer}>
              <Text
                style={styles.taskHeadingText}
                numberOfLines={2}
                ellipsizeMode="tail">
                {'Details: ' + taskName}
                {behalfName && '\nBehalf on: ' + behalfName}
              </Text>
            </View>
            <Buttons
              type={'icon'}
              icon={showDetails ? IMAGES.up : IMAGES.down}
              iconStyle={styles.backIcon}
              viewStyle={styles.downButton}
              onPress={onDown}
            />
          </View>
          <View style={styles.searchDetail}>
            <View style={styles.view}>
              <View style={styles.top}>
                <View style={styles.tc}>
                  <Text style={[styles.totalChambers, styles.mAwayTypo]}>
                    Total Chambers:
                  </Text>
                  <View style={styles.span}>
                    <Text style={[styles.totalChambers, styles.mAwayTypo]}>
                      {chamberCount}
                    </Text>
                  </View>
                </View>
                <View style={styles.status}>
                  <View style={styles.checked}>
                    <Text style={styles.text2Typo}>Checked</Text>
                    <View style={[styles.value, styles.valueBorder]}>
                      <LinearGradient
                        style={[styles.valueChild, styles.valueLayout]}
                        locations={[0, 1]}
                        colors={[
                          'rgba(255, 255, 255, 0.12)',
                          'rgba(255, 255, 255, 0)',
                        ]}
                        useAngle={true}
                        angle={180}
                      />
                      <View style={styles.vl}>
                        <Text
                          style={[
                            styles.text2,
                            styles.text2Typo,
                          ]}>{` ${successCount}`}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.dv}>
                    <View style={[styles.dvChild, styles.dvChildBg]} />
                  </View>
                  <View style={styles.checked}>
                    <Text style={styles.text2Typo}>Pending</Text>
                    <View style={styles.valueBorder}>
                      <View style={[styles.valueItem, styles.valueLayout2]} />
                      <View style={styles.vl}>
                        <Text
                          style={[
                            styles.text2,
                            styles.text2Typo,
                          ]}>{` ${taskCount}`}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.dv}>
                    <View style={[styles.dvChild, styles.dvChildBg]} />
                  </View>
                  <View style={styles.checked}>
                    <Text style={styles.text2Typo}>Offline</Text>
                    <View style={styles.valueBorder}>
                      <View style={[styles.valueInner, styles.valueLayout3]} />
                      <View style={styles.vl}>
                        <Text style={[styles.text2, styles.text2Typo]}>
                          {offlineCount}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              <View style={[styles.devider, styles.dvChildBg]} />
              {showDetails && (
                <>
                  <View style={styles.detailsSection}>
                    <View style={styles.tc}>
                      <ImageTitleRowView
                        tint={COLORS.PRIMARY}
                        title={'Starting Point'}
                        icon={IMAGES.mapLocation}
                      />
                    </View>
                    <View style={styles.tc}>
                      <ImageTitleRowView
                        tint={COLORS.PRIMARY}
                        title={'You are now'}
                        icon={IMAGES.mapMyPostion}
                        desc={`${distance} m away`}
                      />
                    </View>
                    <View style={styles.tc}>
                      <ImageTitleRowView
                        tint={COLORS.SUCCESS}
                        title={name}
                        icon={IMAGES.mapChamber}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </>
    );
  },
);

const FloatingButtonView = memo(
  ({
    onDirection,
    onCamera,
    onInfo,
    onTaskList,
    onRefresh,
    onMyPosition,
  }: any) => {
    return (
      <>
        <View style={styles.bottomButtonContainer}>
          <View style={styles.buttonViewRow}>
            <Buttons
              type={'icon'}
              icon={IMAGES.refresh}
              iconStyle={styles.buttonIcons}
              viewStyle={styles.directionButon}
              onPress={onRefresh}
            />
            <Buttons
              type={'icon'}
              icon={IMAGES.mapMyPostion}
              iconStyle={styles.buttonIcons}
              viewStyle={styles.directionButon}
              onPress={onMyPosition}
            />
          </View>
          <View style={styles.buttonViewRow}>
            <Buttons
              type={'icon'}
              icon={IMAGES.mapDirection}
              iconStyle={styles.buttonIcons}
              viewStyle={styles.directionButon}
              onPress={onDirection}
            />
            <Buttons
              type={'icon'}
              icon={IMAGES.camera}
              iconStyle={styles.buttonIcons}
              viewStyle={styles.directionButon}
              onPress={onCamera}
            />
          </View>
          <View style={styles.buttonViewRow}>
            <Buttons
              type={'icon'}
              icon={IMAGES.info}
              iconStyle={styles.buttonIcons}
              viewStyle={styles.directionButon}
              onPress={onInfo}
            />
            <Buttons
              type={'icon'}
              icon={IMAGES.taskList}
              iconStyle={styles.buttonIcons}
              viewStyle={styles.directionButon}
              onPress={onTaskList}
            />
          </View>
        </View>
      </>
    );
  },
);

const InfoModalSheet = memo(
  ({data, distance, show, position, onClose}: any) => {
    return (
      <ModalSheet
        title={'Distance Calculated'}
        show={show}
        onClose={onClose}
        onClosePress={onClose}>
        <View style={[styles.ul, styles.ulFlexBox]}>
          <View style={[styles.li, styles.liShadowBox]}>
            <View style={styles.span}>
              <View style={styles.content}>
                <View style={styles.gig}>
                  <Text
                    style={[
                      styles.gigsify17180003SifyBstnContainer,
                      styles.textTypo,
                    ]}>
                    {`${data?.chamberIdStr ?? ''} - ${data?.chamberName ?? ''}`}
                  </Text>
                  <View style={styles.row2}>
                    <View style={styles.control}>
                      <Text style={[styles.currentLatitude, styles.textTypo]}>
                        Current Latitude:
                      </Text>
                      <Text style={[styles.text, styles.textTypo]}>
                        {`${position?.latitude?.toFixed(6)}`}
                      </Text>
                    </View>
                    <View style={styles.control}>
                      <Text
                        style={[
                          styles.currentLatitude,
                          styles.textTypo,
                        ]}>{`Current Longitude: `}</Text>
                      <Text style={[styles.text, styles.textTypo]}>
                        {`${position?.longitude?.toFixed(6)}`}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.devider} />
                <View style={styles.row2}>
                  <Text
                    style={[styles.distance1052MContainer, styles.textLayout]}>
                    <Text
                      style={[
                        styles.distance,
                        styles.textTypo2,
                      ]}>{`Distance: `}</Text>
                    <Text
                      style={[styles.m, styles.mTypo]}>{` ${distance?.toFixed(
                      2,
                    )}m`}</Text>
                    <Text style={[styles.distance, styles.textTypo2]}>
                      {' '}
                      away
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <Text style={[styles.text3, styles.textLayout]}>
            कुछ मामलों में सामान्यत: लगभग 10 से 20 मीटर की दूरी का अंतर देखा जा
            सकता है। यदि दूरी में अधिक अंतर होने पर कृपया 10 सेकंड प्रति करें
            ताकि नवीनतम स्थान प्राप्त किया जा सके |
          </Text>
          <Text style={[styles.text4, styles.textLayout]}>
            कृपया स्कैनर भेजें यदि दूरी 100 मीटर से ज्यादा दिख रही है और आप ठीक
            चेयर पर खड़े हैं। |
          </Text>
        </View>
      </ModalSheet>
    );
  },
);

const TaskModalSheet = memo(({value, data, show, onClose, onDone}: any) => {
  return (
    <ChamberListModal
      rowType={'chamber'}
      show={show}
      value={value != null ? [value] : value}
      type={'single'}
      title={`Chambers (${data?.length ?? 0})`}
      data={data}
      rowUniqueKey={'chamberIdStr'}
      enableSearch={false}
      onClose={onClose}
      onDone={onDone}
    />
  );
});

const PositionMarker = memo(({pos}: any) => {
  return (
    <Marker
      title={'Starting Point'}
      description={''}
      coordinate={{
        latitude: pos?.latitude ?? 0,
        longitude: pos?.longitude ?? 0,
      }}>
      <Image
        source={IMAGES.mapLocation}
        resizeMode={'contain'}
        tintColor={COLORS.PRIMARY}
        style={{
          height: SIZE.MS(35),
          width: SIZE.MS(35),
        }}
      />
    </Marker>
  );
});

const ChamberMarker = memo(
  ({
    chamberIdStr,
    distance,
    chamberName,
    lat,
    long,
    tintColor,
    onSelect,
  }: any) => {
    return (
      <Marker
        title={`${chamberIdStr} (${distance}m)`}
        description={`${chamberName}`}
        coordinate={{
          latitude: parseFloat(lat),
          longitude: parseFloat(long),
        }}
        onPress={onSelect}
        onSelect={onSelect}
        anchor={{x: 0.5, y: 1}}>
        <Image
          source={IMAGES.mapChamber}
          resizeMode={'contain'}
          tintColor={tintColor ?? COLORS.SUCCESS}
          style={{
            height: SIZE.MS(35),
            width: SIZE.MS(35),
          }}
        />
      </Marker>
    );
  },
);

let top = 0;
let isFocused = false;

//! ***************** Patroller Task ***************
const PatrollerTask: FC<ScreenProps.PatrollerTask> = ({
  loading,
  navigation,
  taskData,
  empData,
  isAllTaskSubmitted,
  tdd,
}) => {
  top = useSafeAreaInsets().top;
  const dispatch = useDispatch<StoreDispatch>();
  const [isLoading, setIsLoading] = useState(false);
  const [isPositionFailed, setIsPositionFailed] = useState(false);
  const [empID, setEmpId] = useState(0);
  const [distance, setDistance] = useState(0);
  const [selectedChamber, setSelectedChamber] =
    useState<DataType.Chamber | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showTaskListSheet, setShowTaskListSheet] = useState(false);
  const [currentPosition, setCurrentPosition] =
    useState<DataType.Coords | null>(null);
  const [initPosition, setInitPosition] = useState<DataType.Coords | null>(
    null,
  );
  const [googleMapKey, setGoogleMapKey] = useState<string | null>(null);

  const selectedChamberRef = useRef<DataType.Chamber | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const callDataApi = useCallback(
    ({lat, lng, id, isRefresh}: any) => {
      dispatch(
        getPatrollerTaskAssinmentApi({
          param: {
            lat: `${lat}`,
            lng: `${lng}`,
            employeeId: id,
            companyCode: 'gtpl',
          },
          isRefresh: taskData?.chamberCount === 0 ? true : isRefresh,
        }),
      );
    },
    [dispatch, taskData?.chamberCount],
  );

  const getTaskList = useCallback(
    async ({id, isRefresh}: any) => {
      try {
        setIsLoading(true);
        Geolocation.getCurrentPosition(
          info => {
            setCurrentPosition(info?.coords as DataType.Coords);
            setInitPosition(info?.coords as DataType.Coords);
            setIsLoading(false);
            Location.getAddressWithLatLong(
              info.coords.latitude,
              info.coords.longitude,
            ).then(data => {
              Common.success('Current Address::', data);
              Preferences.setData('LAST_GEO_ADDRESS', data);
            });
            callDataApi({
              lat: info?.coords?.latitude,
              lng: info?.coords?.longitude,
              id,
              isRefresh,
            });
          },
          err => {
            Common.error('❌ Error fetching location: ', err);
            const lastLoc = Preferences.getData(
              'LAST_GEO_ADDRESS',
            ) as DataType.GeoAddress;
            if (lastLoc === null) {
              Common.alert({
                title: 'Location Not Found',
                msg: 'Unable to fetch your location. Please try again later.',
              });
            } else {
              callDataApi({
                lat: lastLoc?.lat,
                lng: lastLoc?.long,
                id,
                isRefresh,
              });
            }
            setIsLoading(false);
            setIsPositionFailed(true);
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 0,
          },
        );
      } catch (error) {
        Common.error('❌ Error In Get Task Data');
        setIsLoading(false);
      }
    },
    [callDataApi],
  );
  // Load Google Maps key from Preferences
  useEffect(() => {
    const key = Preferences.getData('GOOGLE_MAPS_API_KEY');
    if (typeof key === 'string' && key.trim().length > 0) {
      setGoogleMapKey(key.trim());
    } else {
      setGoogleMapKey(null);
      Common.warn('No GOOGLE_MAPS_API_KEY found in Preferences');
    }
  }, []);

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 [STATE] Current selected chamber:', {
      chamberId: selectedChamber?.chamberId,
      chamberIdStr: selectedChamber?.chamberIdStr,
    });
    console.log('📊 [STATE] Task list lengths:', {
      pending: taskData?.taskChamberList?.length ?? 0,
      success: taskData?.successTaskChamberList?.length ?? 0,
    });
  }, [
    selectedChamber,
    taskData?.taskChamberList,
    taskData?.successTaskChamberList,
  ]);

  // Call Today Attendance API
  useEffect(() => {
    const fetchAttendance = async () => {
      const prevAttData = Preferences.getData('OFFLINE_ATTENDANCE') ?? [];
      const offlineIn =
        prevAttData?.find(
          (item: any) => item.direction === 'in' && item.shiftType === 'single',
        ) ?? null;
      const offlineInDD =
        prevAttData?.find(
          (item: any) => item.direction === 'in' && item.shiftType === 'double',
        ) ?? null;

      const res = Preferences.getData('MARK_ATTENDANCE_STATUS') ?? {};
      console.log(res);

      const isSelfInOnline = Common.isEqualIgnoreCase(res?.status ?? '', 'pi');
      const isSelfInOffline = !!offlineIn;

      const isDdInOnline =
        Common.isEqualIgnoreCase(res?.ddStatus ?? '', 'pi') || !!res?.isDD;
      const isDdInOffline = !!offlineInDD;

      if (
        !isSelfInOnline &&
        !isSelfInOffline &&
        !isDdInOnline &&
        !isDdInOffline
      ) {
        Common.alert({
          title: 'Not Marked In Attendance',
          msg: 'You have not marked your attendance today. Please mark your attendance first.\n\nआपने आज की उपस्थिति दर्ज नहीं की है। कृपया पहले उपस्थिति दर्ज करें।',
          onPress: () => {
            navigation.goBack();
          },
        });
        return;
      }

      let effectiveEmpId: number = 0;
      if (isSelfInOnline || isSelfInOffline) {
        effectiveEmpId = empData?.id ?? 0;
      } else {
        effectiveEmpId = offlineInDD?.behalfOf ?? res?.ddEmpId ?? 0;
      }

      setEmpId(effectiveEmpId);
      getTaskList({
        id: effectiveEmpId,
        isRefresh: true,
      });
    };

    fetchAttendance();
  }, [dispatch, empData?.companyId, empData?.id, getTaskList, navigation]);

  // CRITICAL: Selection logic on screen focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [FOCUS] Screen focused — always selecting first chamber');

      const list = taskData?.taskChamberList;

      if (!list || list.length === 0) {
        console.log('📋 No pending tasks');
        selectedChamberRef.current = null;
        setSelectedChamber(null);
        setDistance(0);
        return;
      }

      // 🎯 ALWAYS SELECT FIRST ITEM (fresh)
      const first = list[0];
      console.log('🎯 Selected FIRST chamber:', first.chamberIdStr);

      selectedChamberRef.current = first;
      setSelectedChamber(first);
      setDistance(first.distance ?? 0);
    }, [taskData?.taskChamberList]),
  );

  useEffect(() => {
    dispatch(getChamberIssueListApi({params: '?id=1', isRefresh: false}));
    dispatch(checkCameraPermission());
    Permissions.requestPermission();
  }, [dispatch]);

  // Update distance from stored location
  useEffect(() => {
    let intervalId: any;
    const updateDistance = () => {
      const lastAdd = Preferences.getData(
        'LAST_GEO_ADDRESS',
      ) as DataType.GeoAddress;
      if (lastAdd?.lat && lastAdd?.long) {
        dispatch(
          updateChamberTaskListDistance({
            lat: lastAdd.lat,
            lng: lastAdd.long,
          }),
        );
        Common.warn('Task List Distance Updated from GeoAddress');
      } else {
        Common.warn('GeoAddress not available');
      }
    };

    updateDistance();

    if (intervalId) {
      Common.warn('Task List Refresh Interval Already Started');
    } else {
      Common.success('Task List Refresh Interval Started');
      intervalId = setInterval(updateDistance, 30000);
    }

    return () => {
      clearInterval(intervalId);
      Common.error('Task List Refresh Interval Stopped');
    };
  }, [dispatch]);

  const onTaskListClose = useCallback(() => {
    setShowTaskListSheet(false);
  }, []);

  const onTaskListDone = useCallback((task: DataType.Chamber[]) => {
    console.log('✅ [ACTION] Task list done callback');
    const newSelection = task?.[0];

    if (!newSelection) {
      console.warn('⚠️ [ACTION] No chamber in selection');
      return;
    }

    console.log(
      '🎯 [ACTION] Setting new selection:',
      newSelection.chamberIdStr,
    );
    setShowTaskListSheet(false);
    setSelectedChamber(newSelection);
    selectedChamberRef.current = newSelection;
    setDistance(newSelection?.distance ?? 0);
  }, []);

  return (
    <Screen
      statusBgColor={COLORS.WHITE}
      preset={'fixed'}
      statusBarStyle={'dark'}
      isSafeArea={false}
      isNavSafeArea={false}
      loading={loading || isLoading || currentPosition === null}
      loaderMessage={
        'Fetching Current Location\n\n कृपया प्रतीक्षा करें ... आपके वर्तमान स्थान का विवरण प्राप्त हो रहा है।'
      }>
      <View style={styles.container}>
        {currentPosition && initPosition && (
          <MapView
            ref={mapRef}
            style={styles.mapView}
            showsUserLocation={true}
            userLocationPriority={'high'}
            userLocationUpdateInterval={10000}
            userLocationFastestInterval={10000}
            userLocationAnnotationTitle={'My Location'}
            userInterfaceStyle={'light'}
            showsCompass={false}
            toolbarEnabled={false}
            showsMyLocationButton={false}
            loadingEnabled={true}
            loadingIndicatorColor={COLORS.PRIMARY_DARK}
            initialRegion={{
              latitude: initPosition?.latitude,
              longitude: initPosition?.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.0121,
            }}>
            <PositionMarker pos={initPosition} />
            {/* SUCCESS Chambers (Green) */}
            {taskData?.successTaskChamberList?.map(item => {
              console.log('🟢 [RENDER] Success chamber:', item.chamberIdStr);
              return (
                <ChamberMarker
                  key={`success-${item.chamberId}`}
                  chamberIdStr={item.chamberIdStr}
                  chamberName={item.chamberName}
                  lat={item.chamberLat}
                  long={item.chamberLong}
                  tintColor={COLORS.SUCCESS}
                />
              );
            })}

            {/* PENDING Chambers (Orange) - EXCLUDE selected */}
            {taskData?.taskChamberList?.map(item => {
              const isThisSelected =
                selectedChamber?.chamberId === item.chamberId;

              if (isThisSelected) {
                console.log(
                  '⏭️ [RENDER] Skipping (will render as selected):',
                  item.chamberIdStr,
                );
                return null;
              }

              console.log('🟠 [RENDER] Pending chamber:', item.chamberIdStr);
              return (
                <ChamberMarker
                  key={`pending-${item.chamberId}`}
                  chamberIdStr={item.chamberIdStr}
                  chamberName={item.chamberName}
                  lat={item.chamberLat}
                  long={item.chamberLong}
                  distance={item.distance}
                  tintColor={COLORS.ACCENT_ORANGE}
                  onSelect={() => onTaskListDone([item])}
                />
              );
            })}

            {/* SELECTED Chamber (Red) - ONLY ONE */}
            {selectedChamber && (
              <ChamberMarker
                key={`selected-${selectedChamber.chamberId}`}
                chamberIdStr={selectedChamber.chamberIdStr}
                chamberName={selectedChamber.chamberName}
                lat={selectedChamber.chamberLat}
                long={selectedChamber.chamberLong}
                distance={selectedChamber.distance}
                tintColor={COLORS.ERROR}
              />
            )}

            {selectedChamber && currentPosition && googleMapKey && (
              <MapViewDirections
                precision={'low'}
                timePrecision={'now'}
                mode={'DRIVING'}
                resetOnChange={false}
                strokeWidth={5}
                strokeColor={COLORS.BLACK}
                optimizeWaypoints={false}
                origin={{
                  latitude: currentPosition?.latitude,
                  longitude: currentPosition?.longitude,
                }}
                destination={{
                  latitude: parseFloat(selectedChamber?.chamberLat),
                  longitude: parseFloat(selectedChamber?.chamberLong),
                }}
                apikey={googleMapKey}
              />
            )}
          </MapView>
        )}
      </View>
      {selectedChamber && (
        <TopOverlayView
          top={top}
          taskName={`${selectedChamber?.taskName ?? '-'}`}
          chamberCount={`${taskData?.chamberCount ?? 0}`}
          successCount={`${taskData?.successTaskChamberList?.length ?? 0}`}
          taskCount={`${taskData?.taskChamberList?.length ?? 0}`}
          distance={`${(distance ?? 0).toFixed(0)}`}
          name={`${selectedChamber?.chamberIdStr ?? ''} - ${
            selectedChamber?.chamberName ?? ''
          }`}
          offlineCount={
            ' ' + (Preferences.getData('SUBMIT_TASK_DATA')?.length ?? '0')
          }
          onBack={() => navigation.goBack()}
          showDetails={showDetails}
          onDown={() => setShowDetails(!showDetails)}
          behalfName={
            empID !== (empData?.id ?? 0) ? tdd?.empName || undefined : undefined
          }
        />
      )}
      <FloatingButtonView
        onMyPosition={() => {
          if (currentPosition) {
            mapRef.current?.animateToRegion({
              latitude: currentPosition?.latitude ?? 0,
              longitude: currentPosition?.longitude ?? 0,
              latitudeDelta: 0.015,
              longitudeDelta: 0.0121,
            });
          }
        }}
        onRefresh={() => {
          dispatch(getChamberIssueListApi({params: '?id=1', isRefresh: true}));
          getTaskList({id: empID, isRefresh: true});
        }}
        onDirection={() => {
          if (selectedChamber) {
            Common.openMaps(
              parseFloat(selectedChamber?.chamberLat ?? '0'),
              parseFloat(selectedChamber?.chamberLong ?? '0'),
            );
          } else {
            Common.showToast('No Task Selected!');
          }
        }}
        onCamera={() => {
          if (selectedChamber) {
            navigation.navigate('SubmitPatrollerTask', {
              empID,
              selectedChamber: {...selectedChamber, distance},
              currentPosition,
            });
          } else {
            Common.showToast('No Task Selected!');
          }
        }}
        onInfo={() => {
          setShowInfoSheet(true);
        }}
        onTaskList={() => {
          setShowTaskListSheet(true);
        }}
      />

      <InfoModalSheet
        data={selectedChamber}
        distance={distance}
        show={showInfoSheet}
        position={currentPosition}
        onClose={() => setShowInfoSheet(false)}
      />
      <TaskModalSheet
        value={selectedChamber}
        data={taskData?.taskChamberList ?? []}
        show={showTaskListSheet}
        onClose={onTaskListClose}
        onDone={onTaskListDone}
      />
      <AlertView
        show={isAllTaskSubmitted && isFocused}
        onDonePress={() => {
          dispatch(updateCompletedChamberStatus());
        }}
        title={'Task Completed'}
        message={
          'You have successfully submitted all chambers task.\nआपने सभी चैम्बर कार्य सफलतापूर्वक जमा कर दिए हैं।'
        }
        icon={IMAGES.complete}
        iconTintColor={COLORS.SUCCESS}
      />
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading:
    state.task.taskListLoading === 'pending' ||
    state.attendance.todayAttendanceLoading === 'pending',
  taskData: state.task.taskListData,
  empData: state.dashboard.dashboardList?.employeeDetails ?? null,
  isAllTaskSubmitted: state.task.isAllTaskSubmitted,
  tdd: state.attendance.todayDoubleDuty,
});

export default connect(MapStateToProps)(PatrollerTask);

const styles = StyleSheet.create({
  mapMarkerImage: {
    tintColor: COLORS.SUCCESS,
    resizeMode: 'contain',
    height: SIZE.MS(50),
    width: SIZE.MS(50),
  },
  notFoundView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: SIZE.MS(20),
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_DARK,
  },
  remarkView: {marginHorizontal: 0},
  topOverlayCheckedRowView: {flexDirection: 'row'},
  imageTitleRowIcon: {
    height: SIZE.MS(25),
    width: SIZE.MS(25),
    flexShrink: 0,
  },
  imageTitleRowTextContainer: {
    flex: 1,
    marginLeft: SIZE.MS(5),
  },
  imageTitleRowTitle: {
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_DARK,
    fontSize: SIZE.MS(14),
  },
  imageTitleRowDesc: {
    marginTop: SIZE.MS(2),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.ACCENT_ORANGE,
    fontSize: SIZE.MS(14),
  },
  imageTitleRowView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZE.MS(8),
  },
  cameraPicButton: {
    borderWidth: SIZE.MS(1),
    borderColor: COLORS.PRIMARY,
  },
  noteTextGreen: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.SUCCESS,
    marginTop: SIZE.MVS(15),
  },
  noteTextRed: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.ERROR,
    marginTop: SIZE.MVS(15),
  },
  awayText: {
    fontSize: SIZE.MS(20),
    fontFamily: FONTS.BLACK,
    color: COLORS.ERROR,
  },
  distanceText: {
    fontSize: SIZE.MS(20),
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_DARKER,
    marginTop: SIZE.MVS(15),
  },
  latLongTextTitle: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.PRIMARY,
    marginBottom: SIZE.MS(8),
  },
  latLongTextValue: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.TEXT_DARK,
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
    padding: SIZE.MS(5),
    paddingVertical: SIZE.MS(10),
    borderRadius: SIZE.MS(5),
  },
  latlongView: {
    flex: 1,
    marginRight: SIZE.MS(5),
    ...STYLES.SHADOW_BLACK_3,
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(6),
    padding: SIZE.MS(8),
  },
  latLongViewRow: {
    flexDirection: 'row',
    marginTop: SIZE.MVS(10),
  },
  chamberNameText: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.PRIMARY_DARK,
    marginVertical: SIZE.MS(2),
  },
  buttonIcons: {
    height: SIZE.MS(30),
    width: SIZE.MS(30),
    tintColor: COLORS.PRIMARY,
  },
  directionButon: {
    height: SIZE.MS(55),
    width: SIZE.MS(55),
    borderRadius: SIZE.MS(45),
    backgroundColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    ...STYLES.SHADOW_BLACK_6,
  },
  checkedText: {
    color: COLORS.SUCCESS,
  },
  pendingText: {
    color: COLORS.ACCENT_ORANGE,
  },
  offlineText: {
    color: COLORS.TEXT_DARK,
  },
  mapView: {flex: 1},
  taskText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.TEXT_DARK,
    marginVertical: SIZE.MS(2),
    flex: 1,
  },
  taskNameContainer: {
    flex: 1,
    marginHorizontal: SIZE.MS(8),
  },
  taskHeadingText: {
    fontSize: SIZE.MS(16),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.TEXT_DARK,
    marginVertical: SIZE.MS(2),
  },
  totalChamberTitle: {
    fontSize: SIZE.MS(17),
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_DARK,
    marginVertical: SIZE.MS(2),
    marginBottom: SIZE.MS(5),
    flex: 1,
  },
  buttonViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZE.MS(15),
  },
  backViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    height: SIZE.MS(35),
    width: SIZE.MS(35),
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  downButton: {
    height: SIZE.MS(35),
    width: SIZE.MS(35),
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  backIcon: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    tintColor: COLORS.TEXT_DARK,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 15,
    right: 15,
    paddingBottom: SIZE.MS(15),
    paddingTop: SIZE.MS(5),
  },
  topDetailsContainer: {
    opacity: 0.9,
    position: 'absolute',
    left: 15,
    right: 15,
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(12),
    paddingHorizontal: SIZE.MS(15),
    paddingBottom: SIZE.MS(15),
    paddingTop: SIZE.MS(5),
    ...STYLES.SHADOW_BLACK_6,
  },
  container: {flex: 1},
  searchDetail: {
    flex: 1,
  },
  mAwayTypo: {
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
    fontSize: FontSize.fs_14,
  },
  valueBorder: {
    gap: Gap.gap_5,
    paddingVertical: Padding.padding_5,
    borderLeftWidth: 0.5,
    borderColor: COLORS.colorGainsboro100,
    paddingHorizontal: Padding.padding_6,
    backgroundColor: COLORS.colorWhitesmoke,
    alignItems: 'center',
    flexDirection: 'row',
    borderStyle: 'solid',
  },
  valueLayout: {
    backgroundColor: '#3ec21e',
    borderRadius: 50,
    elevation: 10,
    width: Width.width_14,
    height: Height.height_14,
  },
  valueLayout2: {
    backgroundColor: '#ffc107',
    borderRadius: 50,
    elevation: 10,
    width: Width.width_14,
    height: Height.height_14,
  },
  valueLayout3: {
    backgroundColor: '#f6333f',
    borderRadius: 50,
    elevation: 10,
    width: Width.width_14,
    height: Height.height_14,
  },
  text2Typo: {
    lineHeight: LineHeight.lh_14,
    fontSize: FontSize.fs_12,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.SEMI_BOLD,
  },
  dvChildBg: {
    backgroundColor: COLORS.colorGainsboro200,
    borderRadius: Border.br_5,
    alignSelf: 'stretch',
  },
  top: {
    alignSelf: 'stretch',
  },
  tc: {
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  totalChambers: {
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: FontSize.fs_14,
  },
  span: {
    paddingVertical: 2,
    paddingHorizontal: Padding.padding_6,
    borderWidth: 0.5,
    backgroundColor: COLORS.colorWhitesmoke,
    borderRadius: Border.br_6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderColor: COLORS.colorGainsboro200,
    borderStyle: 'solid',
  },
  status: {
    marginTop: 10,
    marginLeft: -10,
    gap: 5,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  checked: {
    overflow: 'hidden',
    paddingLeft: 5,
    fontFamily: FONTS.MEDIUM,
    borderColor: COLORS.colorGainsboro100,
    borderWidth: 0.5,
    borderRadius: Border.br_6,
    gap: 0,
    alignItems: 'center',
    flexDirection: 'row',
    borderStyle: 'solid',
    backgroundColor: 'transparent',
  },
  value: {
    alignSelf: 'stretch',
  },
  valueChild: {
    boxShadow: '0px 4px 10px rgba(62, 194, 30, 0.25)',
  },
  vl: {
    paddingBottom: Padding.padding_1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text2: {
    alignSelf: 'stretch',
  },
  dv: {
    paddingHorizontal: 0,
    paddingVertical: Padding.padding_3,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  dvChild: {
    width: Width.width_1,
    opacity: 0.8,
  },
  valueItem: {
    boxShadow: '0px 4px 10px rgba(255, 145, 18, 0.25)',
  },
  valueInner: {
    boxShadow: '0px 4px 10px rgba(246, 51, 63, 0.25)',
  },
  startingPointIcon: {
    height: Height.height_24,
    width: Width.width_24,
  },
  label: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  mAway: {
    color: COLORS.colorGoldenrod,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: FontSize.fs_14,
  },
  alertbodyframe: {
    flex: 1,
  },
  ulFlexBox: {
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  liShadowBox: {
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
  },
  textTypo: {
    textAlign: 'left',
    fontSize: FontSize.fs_14,
  },
  textLayout: {
    lineHeight: LineHeight.lh_18,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
  },
  textTypo2: {
    fontFamily: FONTS.MEDIUM,
  },
  mTypo: {
    fontFamily: FONTS.MEDIUM,
  },
  view: {
    width: '100%',
    padding: Padding.padding_16,
    paddingTop: Padding.padding_8,
    gap: 16,
    flex: 1,
  },
  body: {
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  row: {
    gap: 15,
    alignSelf: 'stretch',
  },
  action: {
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    fontSize: FontSize.fs_16,
  },
  ul: {
    gap: 24,
  },
  li: {
    backgroundColor: COLORS.colorWhite,
    paddingHorizontal: Padding.padding_16,
    paddingTop: Padding.padding_16,
    paddingBottom: Padding.padding_20,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  content: {
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  gig: {
    gap: 8,
    alignSelf: 'stretch',
  },
  gigsify17180003SifyBstnContainer: {
    lineHeight: 22,
    color: COLORS.colorDarkslategray,
    alignSelf: 'stretch',
  },
  sifyBstnB458safdarjung: {
    fontFamily: FONTS.MEDIUM,
  },
  row2: {
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  control: {
    gap: Gap.gap_5,
    justifyContent: 'center',
    flex: 1,
  },
  currentLatitude: {
    letterSpacing: 0.2,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  text: {
    color: COLORS.colorDimgray,
    fontFamily: FONTS.MEDIUM,
    alignSelf: 'stretch',
  },
  devider: {
    height: 1,
    borderRadius: 5,
    backgroundColor: COLORS.colorGainsboro,
    opacity: 0.7,
    alignSelf: 'stretch',
  },
  distance1052MContainer: {
    fontSize: FontSize.fs_16,
    flex: 1,
  },
  distance: {
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  m: {
    color: COLORS.colorRed,
  },
  text3: {
    color: COLORS.colorForestgreen,
    fontSize: FontSize.fs_14,
    lineHeight: LineHeight.lh_18,
    fontFamily: FONTS.MEDIUM,
    alignSelf: 'stretch',
  },
  text4: {
    color: COLORS.colorCrimson,
    fontSize: FontSize.fs_14,
    lineHeight: LineHeight.lh_18,
    fontFamily: FONTS.MEDIUM,
    alignSelf: 'stretch',
  },
  footer: {
    alignSelf: 'stretch',
  },
  span3: {
    backgroundColor: 'transparent',
    paddingHorizontal: Padding.padding_20,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  close: {
    textTransform: 'uppercase',
    color: COLORS.colorWhite,
    fontFamily: FONTS.MEDIUM,
  },
  detailsSection: {
    gap: Gap.gap_8,
    alignSelf: 'stretch',
  },
});
