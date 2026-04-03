// import {Buttons, ListView} from '@atoms';
// import {COLORS, CONTENT, FONTS, IMAGES, SIZE} from '@res';
// import {Preferences} from '@utils';
// import React, {memo} from 'react';
// import {
//   BackHandler,
//   Image,
//   Platform,
//   StyleSheet,
//   Text,
//   View,
// } from 'react-native';
// import ModalSheet from '../modal-sheet';

// interface LocationPermissionProps {
//   show: boolean;
//   onPrivacyPress?: () => void;
//   onAllowPress?: () => void;
// }

// const PrivacyItem = memo(({item}: {item: any}) => {
//   return (
//     <View style={styles.outerView}>
//       <Text style={styles.titleText}>{item.title}</Text>
//       <Text style={styles.descText}>{item.description}</Text>
//     </View>
//   );
// });

// export const PrivacyList = () => {
//   return (
//     <ListView
//       data={CONTENT.privacyContent}
//       renderItem={({item}) => <PrivacyItem item={item} />}
//     />
//   );
// };

// const LocationPermission: React.FC<LocationPermissionProps> = ({
//   show,
//   onPrivacyPress,
//   onAllowPress,
// }) => {
//   return (
//     <ModalSheet
//       show={show}
//       title={'Permission Required'}
//       onPrimaryPress={() => {
//         Preferences.setData('FIRST_OPEN', 'no');
//         Preferences.setData('ALLOWED_ACCESS_FOR_LOCATION_BACKGROUND', 'yes');
//         onAllowPress?.();
//       }}
//       primaryTitle={'Allow Access'}
//       closeTitle={'Exit'}
//       onClosePress={
//         Platform.OS === 'android'
//           ? () => {
//               BackHandler.exitApp();
//             }
//           : undefined
//       }>
//       <Image
//         source={IMAGES.LocationAccess}
//         resizeMode={'contain'}
//         style={styles.iconStyle}
//       />
//       <Text style={styles.infoTitleText}>
//         {'Location Permission Information'}
//       </Text>
//       <Text style={styles.infoDescText}>
//         {
//           'GTPL needs your location to monitor your work tasks effectively. With your permission, we’ll collect location data when you’re using the app or when it’s in the background to support your daily operations.'
//         }
//       </Text>
//       <Buttons
//         type={'leftIconText'}
//         title={'Check GTPL Privacy Policy'}
//         icon={IMAGES.Privacy}
//         viewStyle={styles.privacyButton}
//         onPress={onPrivacyPress}
//       />
//       {/* {isBlocked && (
//         <Text style={styles.blockedDesctext}>
//           {
//             'You have denied location access multiple times, so we can no longer request it automatically. Please enable location permissions manually in your device settings.'
//           }
//         </Text>
//       )} */}
//     </ModalSheet>
//   );
// };

// export default LocationPermission;

// const styles = StyleSheet.create({
//   privacyButton: {
//     alignSelf: 'flex-start',
//     marginVertical: SIZE.MVS(15),
//     borderRadius: 0,
//   },
//   blockedDesctext: {
//     fontFamily: FONTS.REGULAR,
//     fontSize: SIZE.MS(13),
//     color: COLORS.ERROR,
//     marginTop: SIZE.MVS(10),
//   },
//   infoDescText: {
//     fontFamily: FONTS.REGULAR,
//     fontSize: SIZE.MS(13),
//     color: COLORS.TEXT_LIGHT,
//     marginTop: SIZE.MVS(10),
//   },
//   infoTitleText: {
//     fontFamily: FONTS.BOLD,
//     fontSize: SIZE.MS(18),
//     color: COLORS.TEXT_DARK,
//   },
//   iconStyle: {
//     width: SIZE.MS(180),
//     height: SIZE.MS(180),
//     alignSelf: 'center',
//   },
//   titleText: {
//     fontSize: SIZE.MS(16),
//     fontFamily: FONTS.MEDIUM,
//     color: COLORS.TEXT_DARKER,
//     marginBottom: SIZE.MVS(10),
//   },
//   descText: {
//     fontSize: SIZE.MS(14),
//     fontFamily: FONTS.REGULAR,
//     color: COLORS.TEXT_MEDIUM,
//     marginBottom: SIZE.MVS(10),
//   },
//   outerView: {
//     marginVertical: SIZE.MVS(10),
//   },
// });
import React, {FC, useState, useEffect} from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import {Screen} from '@organisms';
import {BackHeader} from '@molecules';
import {MasterFormModal} from '../../components/molecules/MasterFormModal';
import {ScreenProps, DataType} from '@types';
import {COLORS, IMAGES, FONTS, SIZE} from '@res';
import LinearGradient from 'react-native-linear-gradient';
import {Location, Common} from '@utils';
import {parseAddressComponents} from '../../components/molecules/addressParser';
import {StoreDispatch} from '@reducers';
import {UpdateMasterAPI, GetMasterByNameAPI} from '@slices/route.slice';
import {
  launchCamera,
  CameraOptions,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {useDispatch} from 'react-redux';
import {
  PERMISSIONS,
  request,
  check,
  RESULTS,
  openSettings,
} from 'react-native-permissions';

type PickerItem = {
  label: string;
  value: string;
  icon: any;
};
// ─── Constants ────────────────────────────────────────────────────────────────
const PICKER_DATA: PickerItem[] = [
  {label: 'Pole', value: 'Pole', icon: IMAGES.PoleImage},
  {label: 'Enclosure', value: 'Enclosure', icon: IMAGES.jointEnclosure},
  {label: 'Tiffin', value: 'Tiffin', icon: IMAGES.TiffinIcon},
  {label: 'Tree', value: 'Tree', icon: IMAGES.treeIcon},
  {label: 'Building', value: 'Building', icon: IMAGES.TiffinIcon},
];
// ─── Screen ───────────────────────────────────────────────────────────────────
const AddMaster: FC<ScreenProps.addMaster> = ({navigation}) => {
  const dispatch = useDispatch<StoreDispatch>();
  // ── Location state ─────────────────────────────────────────────────────────
  const [address, setAddress] = useState('');
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  // ── Master type selection ──────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<PickerItem | null>(null);
  // ── Master lists ───────────────────────────────────────────────────────────
  const [masterList, setMasterList] = useState<any[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  // ── Modals ─────────────────────────────────────────────────────────────────
  const [existingVisible, setExistingVisible] = useState(false);
  const [masterFormVisible, setMasterFormVisible] = useState(false);
  // ── MasterFormModal fields ─────────────────────────────────────────────────
  const [masterName, setMasterName] = useState('');
  const [latLngText, setLatLngText] = useState('');
  const [masterAddress, setMasterAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [extra1, setExtra1] = useState('');
  const [extra2, setExtra2] = useState('');
  const [image1, setImage1] = useState('');
  const [image2, setImage2] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ── ✅ Page load pe getAddressLocation call ────────────────────────────────
  useEffect(() => {
    getAddressLocation();
  }, []);

  // ── Get current address (page load — no param needed) ─────────────────────
  // FIX: Location.getAddressFromLatLong() accepts NO arguments as per Location.ts
  //      definition: export const getAddressFromLatLong = (): Promise<DataType.GeoAddress>
  //      Removed the `forceRefresh` boolean param that was incorrectly being passed.
  const getAddressLocation = async () => {
    try {
      setIsLocationLoading(true);
      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        return;
      }
      // ✅ No argument — matches actual Location.ts signature
      const data =
        (await Location.getAddressFromLatLong()) as DataType.GeoAddress;
      if (data?.address) {
        setAddress(data.address);
      }
    } catch (e: any) {
      console.warn('[AddMaster] getAddressLocation error:', e?.message);
    } finally {
      setIsLocationLoading(false);
    }
  };

  // ── Reset form ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setMasterName('');
    setLatLngText('');
    setMasterAddress('');
    setSelectedAddress('');
    setLandmark('');
    setArea('');
    setCity('');
    setStateName('');
    setCountry('');
    setPincode('');
    setExtra1('');
    setExtra2('');
    setImage1('');
    setImage2('');
    setAddressSuggestions([]);
    setShowAddressDropdown(false);
  };

  // ── Fetch master list ──────────────────────────────────────────────────────
  const fetchMasterList = async (masterType: string) => {
    try {
      setIsLoadingMasters(true);
      setMasterList([]);
      const response = await dispatch(
        GetMasterByNameAPI({name: masterType}),
      ).unwrap();
      if (response?.data && Array.isArray(response.data)) {
        setMasterList(response.data);
      } else if (Array.isArray(response)) {
        setMasterList(response);
      } else {
        setMasterList([]);
      }
    } catch (error) {
      console.error('❌ Error fetching masters:', error);
      setMasterList([]);
    } finally {
      setIsLoadingMasters(false);
    }
  };

  // ── Select master type ─────────────────────────────────────────────────────
  const handleCheckboxSelect = (item: PickerItem) => {
    setSelectedType(item);
    fetchMasterList(item.value);
  };

  // ── Open "Existing" modal ──────────────────────────────────────────────────
  const handleExistingClick = async () => {
    if (!selectedType) {
      Alert.alert('No Selection', 'Please select a master type first');
      return;
    }
    try {
      setIsLoadingMasters(true);
      const response = await dispatch(
        GetMasterByNameAPI({name: selectedType.value}),
      ).unwrap();
      const data =
        response?.data && Array.isArray(response.data)
          ? response.data
          : Array.isArray(response)
          ? response
          : [];
      if (data.length === 0) {
        Alert.alert('No Data', `No ${selectedType.label} found`);
        return;
      }
      setMasterList(data);
      setExistingVisible(true);
    } catch {
      Alert.alert('Error', 'Failed to fetch data');
    } finally {
      setIsLoadingMasters(false);
    }
  };

  // ── Open "Add New" form modal ──────────────────────────────────────────────
  const handleOpenMasterForm = () => {
    resetForm();
    setMasterFormVisible(true);
  };

  // ── FIX: Location inside modal (GPS button) ────────────────────────────────
  // Location.getAddressFromLatLong() has NO params per Location.ts definition.
  // It always uses allowCache:false internally. We just call it directly.
  // After fetch → populate lat/lng + open dropdown with suggestions so user
  // can pick one of the 4 formatted addresses returned by the API.
  const handleFetchLocation = async () => {
    try {
      setIsFetchingLocation(true);

      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Required', 'Location permission needed.');
        return;
      }

      // ✅ No argument — matches actual Location.ts signature
      const data =
        (await Location.getAddressFromLatLong()) as DataType.GeoAddress;

      console.log('[handleFetchLocation] data:', JSON.stringify(data, null, 2));

      if (data?.lat && data?.long) {
        // ── Set lat/lng text ──────────────────────────────────────────────
        setLatLngText(`${data.lat}, ${data.long}`);

        // ── Clear previously selected address fields ──────────────────────
        setSelectedAddress('');
        setMasterAddress('');
        setArea('');
        setCity('');
        setStateName('');
        setCountry('');
        setPincode('');

        // ── Populate suggestions & open dropdown ──────────────────────────
        // `data.suggestions` is the array of 4 formatted address strings
        // returned by getCurrentGeoAddress. If present, show dropdown.
        if (data?.suggestions && data.suggestions.length > 0) {
          setAddressSuggestions(data.suggestions);
          setShowAddressDropdown(true); // ✅ Auto-open dropdown after fetch
          Common.showToast('Location fetched! Please select an address below.');
        } else if (data?.address) {
          // Fallback: if no suggestions array but a single address string
          // exists, treat it as the only suggestion so the dropdown still
          // shows and the user can confirm / pick it.
          setAddressSuggestions([data.address]);
          setShowAddressDropdown(true);
          Common.showToast('Location fetched! Please select an address below.');
        } else {
          Common.showToast('Location fetched but no address found.');
        }
      } else {
        Alert.alert('Error', 'Unable to fetch coordinates');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to fetch location');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // ── Toggle address dropdown (manual open/close) ────────────────────────────
  const handleAddressDropdownToggle = () => {
    if (addressSuggestions.length > 0) {
      setShowAddressDropdown(prev => !prev);
    } else {
      Alert.alert('No Data', 'Please fetch location first');
    }
  };

  // ── FIX: User selects one of the 4 formatted addresses from dropdown ───────
  // After selection: fill masterAddress + parse into individual fields
  // (area, city, state, country, pincode) using parseAddressComponents.
  const handleAddressSelect = (addr: string) => {
    // ✅ Set the selected full address string
    setSelectedAddress(addr);
    setMasterAddress(addr);

    // ✅ Parse the formatted address into components and fill individual fields
    const parsed = parseAddressComponents(addr);

    console.log('[handleAddressSelect] addr:', addr);
    console.log(
      '[handleAddressSelect] parsed:',
      JSON.stringify(parsed, null, 2),
    );

    // Only overwrite if parser returned a value; preserves any manually typed
    // content in case parseAddressComponents returns empty for a field.
    if (parsed.area) setArea(parsed.area);
    if (parsed.city) setCity(parsed.city);
    if (parsed.state) setStateName(parsed.state);
    if (parsed.country) setCountry(parsed.country);
    if (parsed.pincode) setPincode(parsed.pincode);

    // ✅ Close dropdown after selection
    setShowAddressDropdown(false);

    Common.showToast('Address selected ✅');
  };

  // ── ✅ Camera permission helper (Android only, iOS handled by launchCamera) ─
  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') return true;

    const permission = PERMISSIONS.ANDROID.CAMERA;
    try {
      const status = await check(permission);

      if (status === RESULTS.GRANTED) return true;

      if (status === RESULTS.DENIED) {
        const result = await request(permission);
        if (result === RESULTS.GRANTED) return true;
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to capture images.',
          [{text: 'OK'}],
        );
        return false;
      }

      if (status === RESULTS.BLOCKED) {
        Alert.alert(
          'Camera Permission Blocked',
          'Camera access is blocked. Please enable it from App Settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => openSettings().catch(() => Linking.openSettings()),
            },
          ],
        );
        return false;
      }

      Alert.alert(
        'Camera Not Available',
        'Camera is not available on this device.',
      );
      return false;
    } catch (err) {
      console.warn('[Camera] Permission check error:', err);
      return false;
    }
  };

  // ── Camera ─────────────────────────────────────────────────────────────────
  const openCameraForSlot = async (slot: 1 | 2) => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.4,
      maxWidth: 800,
      maxHeight: 800,
      saveToPhotos: false,
    };
    launchCamera(options, (res: ImagePickerResponse) => {
      if (res.didCancel || res.errorCode || !res.assets?.length) return;
      const uri = res.assets[0]?.uri;
      if (!uri) return;
      if (slot === 1) setImage1(uri);
      else setImage2(uri);
    });
  };

  const handleOpenCameraForModal = (slot: 1 | 2) => {
    const hasImage = slot === 1 ? !!image1 : !!image2;
    if (hasImage) {
      Alert.alert('Replace Image', `Replace Image ${slot}?`, [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Replace', onPress: () => openCameraForSlot(slot)},
      ]);
      return;
    }
    openCameraForSlot(slot);
  };

  // ── Submit new master ──────────────────────────────────────────────────────
  const handleAddAndSelect = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a master type');
      return;
    }
    if (!masterName.trim()) {
      Alert.alert('Error', 'Master Name is required');
      return;
    }
    if (!latLngText.trim()) {
      Alert.alert('Error', 'Lat/Lng is required. Tap the GPS icon first.');
      return;
    }
    if (!masterAddress.trim()) {
      Alert.alert('Error', 'Address is required');
      return;
    }
    if (!landmark.trim()) {
      Alert.alert('Error', 'Landmark is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        Id: 0,
        Name: masterName.trim(),
        MasterType: selectedType.value,
        Address: masterAddress.trim(),
        SelectedAddress: selectedAddress.trim() || masterAddress.trim(),
        City: city.trim(),
        State: stateName.trim(),
        Country: country.trim(),
        Area: area.trim(),
        PinCode: pincode.trim(),
        Landmark: landmark.trim(),
        LatLng: latLngText.trim(),
      };
      if (extra1.trim()) payload.Extra1 = extra1.trim();
      if (extra2.trim()) payload.Extra2 = extra2.trim();
      if (image1) {
        payload.ImageFile1 = {
          uri: image1,
          type: 'image/jpeg',
          fileName: 'master_image_1.jpg',
        };
      }
      if (image2) {
        payload.ImageFile2 = {
          uri: image2,
          type: 'image/jpeg',
          fileName: 'master_image_2.jpg',
        };
      }

      console.log(
        '📤 [AddMaster] → UpdateMasterAPI payload:',
        JSON.stringify(payload, null, 2),
      );
      await dispatch(UpdateMasterAPI(payload)).unwrap();
      console.log('✅ Master added');

      Common.showToast(`${selectedType.label} added successfully! ✅`);
      resetForm();
      setMasterFormVisible(false);

      fetchMasterList(selectedType.value);
      // ✅ Refresh top location bar after submit — no param needed
      getAddressLocation();
    } catch (error: any) {
      console.log('❌ Error:', JSON.stringify(error, null, 2));
      const msg =
        error?.message ??
        error?.messege ??
        error?.data?.message ??
        error?.data?.messege ??
        error?.response?.data?.message ??
        error?.error ??
        'Failed to add master. Please try again.';
      Alert.alert('Error', String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Screen
      statusBgColor={COLORS.PRIMARY}
      statusBarStyle="light"
      loading={isLocationLoading}>
      <BackHeader title="Add Master" onBackPress={() => navigation.goBack()} />

      {/* ── Current Location Bar ── */}
      {address ? (
        <View style={localStyles.locationBar}>
          <Image
            source={IMAGES.mapLocation}
            style={localStyles.locationIcon}
            resizeMode="contain"
          />
          <Text style={localStyles.locationText} numberOfLines={2}>
            {address}
          </Text>
        </View>
      ) : isLocationLoading ? (
        <View style={localStyles.locationBar}>
          <ActivityIndicator
            size="small"
            color={COLORS.colorMediumslateblue}
            style={{marginRight: SIZE.MS(8)}}
          />
          <Text style={localStyles.locationFetching}>Fetching location...</Text>
        </View>
      ) : null}

      <ScrollView
        style={localStyles.container}
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* ── Section title ── */}
        <Text style={localStyles.sectionTitle}>Select Master Type</Text>

        {/* ── Master Type Selection ── */}
        <View style={localStyles.typeList}>
          {PICKER_DATA.map((item, index) => {
            const isSelected = selectedType?.value === item.value;
            const isLast = index === PICKER_DATA.length - 1;
            return (
              <TouchableOpacity
                key={item.value}
                style={[
                  localStyles.typeItem,
                  !isLast && localStyles.typeItemBorder,
                ]}
                activeOpacity={0.7}
                onPress={() => handleCheckboxSelect(item)}>
                <View
                  style={[
                    localStyles.radio,
                    isSelected && localStyles.radioSelected,
                  ]}>
                  {isSelected && <View style={localStyles.radioInner} />}
                </View>
                <Image
                  source={item.icon}
                  style={localStyles.typeIcon}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    localStyles.typeLabel,
                    isSelected && localStyles.typeLabelSelected,
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Loading masters ── */}
        {isLoadingMasters && (
          <View style={localStyles.loadingRow}>
            <ActivityIndicator
              size="small"
              color={COLORS.colorMediumslateblue}
            />
            <Text style={localStyles.loadingText}>Loading...</Text>
          </View>
        )}

        {/* ── Found count ── */}
        {!isLoadingMasters && selectedType && masterList.length > 0 && (
          <Text style={localStyles.countText}>
            ✅ Found {masterList.length} {selectedType.label}(s)
          </Text>
        )}

        {/* ── Action Buttons ── */}
        {selectedType && !isLoadingMasters && (
          <View style={localStyles.actionRow}>
            {/* Add New */}
            <TouchableOpacity
              style={localStyles.actionBtn}
              activeOpacity={0.85}
              onPress={handleOpenMasterForm}>
              <LinearGradient
                colors={[COLORS.colorMediumslateblue, '#6036c4']}
                style={localStyles.gradient}
                start={{x: 0.5, y: 0}}
                end={{x: 0.5, y: 1}}>
                <Text style={localStyles.actionBtnText}>
                  + Add New {selectedType.label}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ══ Existing Masters Modal ══════════════════════════════════════════ */}
      <Modal visible={existingVisible} transparent animationType="slide">
        <View style={modalStyles.overlay}>
          <View style={modalStyles.sheet}>
            <View style={modalStyles.header}>
              <Text style={modalStyles.headerText}>
                Choose {selectedType?.label || 'Master'}
              </Text>
              <TouchableOpacity onPress={() => setExistingVisible(false)}>
                <Text style={modalStyles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            {isLoadingMasters ? (
              <View style={modalStyles.loadingBox}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.colorMediumslateblue}
                />
                <Text style={modalStyles.loadingText}>Loading...</Text>
              </View>
            ) : masterList.length > 0 ? (
              <ScrollView
                style={modalStyles.listScroll}
                showsVerticalScrollIndicator={false}>
                {masterList.map((master, index) => {
                  const fullAddress = [
                    master.address,
                    master.area,
                    master.city,
                    master.state,
                    master.pincode,
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.7}
                      onPress={() => {
                        setExistingVisible(false);
                        Common.showToast(`${master.name} selected`);
                      }}
                      style={modalStyles.masterRow}>
                      <View style={{flex: 1}}>
                        <Text style={modalStyles.masterName}>
                          {master.name}
                          {master.landmark ? ` (${master.landmark})` : ''}
                        </Text>
                        <Text
                          style={modalStyles.masterAddress}
                          numberOfLines={2}>
                          {fullAddress}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={modalStyles.emptyBox}>
                <Text style={modalStyles.emptyText}>
                  No {selectedType?.label || 'data'} available
                </Text>
                <TouchableOpacity
                  onPress={() => setExistingVisible(false)}
                  style={modalStyles.closeBtn}>
                  <Text style={modalStyles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ══ Add New Master Form Modal ═══════════════════════════════════════ */}
      <MasterFormModal
        visible={masterFormVisible}
        selectedType={selectedType}
        masterName={masterName}
        latLngText={latLngText}
        selectedAddress={selectedAddress}
        masterAddress={masterAddress}
        landmark={landmark}
        onLandmarkChange={setLandmark}
        area={area}
        city={city}
        stateName={stateName}
        country={country}
        pincode={pincode}
        extra1={extra1}
        extra2={extra2}
        image1={image1}
        image2={image2}
        addressSuggestions={addressSuggestions}
        showAddressDropdown={showAddressDropdown}
        isFetchingLocation={isFetchingLocation}
        isSubmitting={isSubmitting}
        onClose={() => {
          if (!isSubmitting) setMasterFormVisible(false);
        }}
        onMasterNameChange={setMasterName}
        onLatLngChange={setLatLngText}
        onSelectedAddressChange={setSelectedAddress}
        onMasterAddressChange={setMasterAddress}
        onAreaChange={setArea}
        onCityChange={setCity}
        onStateChange={setStateName}
        onCountryChange={setCountry}
        onPincodeChange={setPincode}
        onExtra1Change={setExtra1}
        onExtra2Change={setExtra2}
        onFetchLocation={handleFetchLocation}
        onAddressDropdownToggle={handleAddressDropdownToggle}
        onAddressSelect={handleAddressSelect}
        onOpenCamera={handleOpenCameraForModal}
        onImagePreview={setPreviewImage}
        onSubmit={handleAddAndSelect}
      />

      {/* ══ Image Preview Modal ══════════════════════════════════════════════ */}
      <Modal
        visible={!!previewImage}
        transparent
        onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity
          style={previewStyles.overlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}>
          <View style={previewStyles.content}>
            <Image
              source={{uri: previewImage!}}
              style={previewStyles.image}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={previewStyles.closeBtn}
              onPress={() => setPreviewImage(null)}>
              <Text style={previewStyles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
};

export default AddMaster;

// ─── Styles ───────────────────────────────────────────────────────────────────
const localStyles = StyleSheet.create({
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SIZE.MS(14),
    paddingVertical: SIZE.MS(10),
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  locationIcon: {
    width: SIZE.MS(16),
    height: SIZE.MS(16),
    marginRight: SIZE.MS(8),
    tintColor: COLORS.colorMediumslateblue,
  },
  locationText: {
    flex: 1,
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    lineHeight: SIZE.MS(17),
  },
  locationFetching: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: '#999',
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
  },
  scrollContent: {
    paddingHorizontal: SIZE.MS(16),
    paddingTop: SIZE.MS(20),
    paddingBottom: SIZE.MS(40),
  },
  sectionTitle: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    marginBottom: SIZE.MS(12),
    letterSpacing: 0.3,
  },
  typeList: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(14),
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZE.MS(13),
    paddingHorizontal: SIZE.MS(16),
  },
  typeItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  radio: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    borderRadius: SIZE.MS(10),
    borderWidth: 2,
    borderColor: '#CCC',
    marginRight: SIZE.MS(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.colorMediumslateblue,
  },
  radioInner: {
    width: SIZE.MS(10),
    height: SIZE.MS(10),
    borderRadius: SIZE.MS(5),
    backgroundColor: COLORS.colorMediumslateblue,
  },
  typeIcon: {
    width: SIZE.MS(22),
    height: SIZE.MS(22),
    marginRight: SIZE.MS(10),
  },
  typeLabel: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: '#333',
  },
  typeLabelSelected: {
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.SEMI_BOLD,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZE.MS(14),
    gap: SIZE.MS(8),
  },
  loadingText: {
    fontSize: SIZE.MS(12),
    color: '#666',
    fontFamily: FONTS.MEDIUM,
  },
  countText: {
    fontSize: SIZE.MS(12),
    color: '#4CAF50',
    fontFamily: FONTS.MEDIUM,
    marginTop: SIZE.MS(12),
  },
  actionRow: {
    flexDirection: 'row',
    gap: SIZE.MS(12),
    marginTop: SIZE.MS(20),
  },
  actionBtn: {
    flex: 1,
    borderRadius: SIZE.MS(25),
    overflow: 'hidden',
    elevation: 3,
  },
  gradient: {
    paddingVertical: SIZE.MS(13),
    alignItems: 'center',
    borderRadius: SIZE.MS(25),
  },
  actionBtnText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.WHITE,
    letterSpacing: 0.3,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: SIZE.MS(20),
    borderTopRightRadius: SIZE.MS(20),
    maxHeight: '80%',
    paddingBottom: SIZE.MS(24),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZE.MS(20),
    paddingVertical: SIZE.MS(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerText: {
    fontSize: SIZE.MS(16),
    fontFamily: FONTS.BOLD,
    color: COLORS.colorDarkslategray,
  },
  closeX: {
    fontSize: SIZE.MS(18),
    color: '#666',
    paddingHorizontal: SIZE.MS(4),
  },
  loadingBox: {
    paddingVertical: SIZE.MS(40),
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SIZE.MS(10),
    fontSize: SIZE.MS(13),
    color: '#666',
    fontFamily: FONTS.MEDIUM,
  },
  listScroll: {
    paddingHorizontal: SIZE.MS(16),
  },
  masterRow: {
    paddingVertical: SIZE.MS(14),
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  masterName: {
    fontSize: SIZE.MS(14),
    fontWeight: '600',
    color: '#6C4DFF',
    fontFamily: FONTS.SEMI_BOLD,
  },
  masterAddress: {
    fontSize: SIZE.MS(12),
    color: '#555',
    marginTop: SIZE.MS(4),
    fontFamily: FONTS.MEDIUM,
    lineHeight: SIZE.MS(17),
  },
  emptyBox: {
    paddingVertical: SIZE.MS(40),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZE.MS(14),
    color: '#888',
    fontFamily: FONTS.MEDIUM,
  },
  closeBtn: {
    marginTop: SIZE.MS(16),
    backgroundColor: '#E5E5E5',
    paddingVertical: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(30),
    borderRadius: SIZE.MS(20),
  },
  closeBtnText: {
    fontSize: SIZE.MS(13),
    color: '#333',
    fontFamily: FONTS.MEDIUM,
  },
});

const previewStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    height: '70%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: SIZE.MS(12),
  },
  closeBtn: {
    position: 'absolute',
    top: -SIZE.MS(40),
    right: 0,
    width: SIZE.MS(36),
    height: SIZE.MS(36),
    borderRadius: SIZE.MS(18),
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(20),
    fontFamily: FONTS.BOLD,
  },
});
