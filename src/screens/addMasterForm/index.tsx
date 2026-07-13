import React, {FC, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  launchCamera,
  CameraOptions,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import {useDispatch} from 'react-redux';
import {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {StoreDispatch} from '@reducers';
import {UpdateMasterAPI} from '@slices/route.slice';
import {Location, Common} from '@utils';
import {parseAddressComponents} from '../../components/molecules/addressParser';

type AddMasterFormProps = NativeStackScreenProps<
  RootStackParamList,
  'Add-Master-Form'
>;

type Coordinate = {
  latitude: number;
  longitude: number;
};

const asCleanText = (value?: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

const parseLatLng = (latLng?: string | null): Coordinate | null => {
  const [latText, lngText] = String(latLng ?? '').split(',');
  const coordinate = {
    latitude: Number(latText?.trim()),
    longitude: Number(lngText?.trim()),
  };

  return Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude)
    ? coordinate
    : null;
};

const getLatLngText = (coordinate?: Coordinate | null) =>
  coordinate ? `${coordinate.latitude}, ${coordinate.longitude}` : '';

const getGeneratedMasterName = (label: string) =>
  `${label}${Date.now().toString().slice(-6)}`;

const AddMasterForm: FC<AddMasterFormProps> = ({navigation, route}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<StoreDispatch>();
  const selectedMasterType = asCleanText(route.params?.selectedMasterType);
  const selectedMasterLabel =
    asCleanText(route.params?.selectedMasterLabel) ||
    selectedMasterType ||
    'Master';
  const initialAddress = asCleanText(route.params?.currentAddress);
  const initialLatLng = getLatLngText(route.params?.currentPosition ?? null);
  const initialAddressParts = useMemo(
    () => parseAddressComponents(initialAddress),
    [initialAddress],
  );

  const [latLngText, setLatLngText] = useState(initialLatLng);
  const [selectedAddress, setSelectedAddress] = useState(initialAddress);
  const [masterAddress, setMasterAddress] = useState(initialAddress);
  const [landmark, setLandmark] = useState('');
  const [remarks, setRemarks] = useState('');
  const [area, setArea] = useState(initialAddressParts.area);
  const [city, setCity] = useState(initialAddressParts.city);
  const [stateName, setStateName] = useState(initialAddressParts.state);
  const [country, setCountry] = useState(initialAddressParts.country);
  const [pincode, setPincode] = useState(initialAddressParts.pincode);
  const [image1, setImage1] = useState('');
  const [image2, setImage2] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>(
    initialAddress
      ? [{id: 0, label: initialAddress, value: initialAddress}]
      : [],
  );
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = `Add ${selectedMasterLabel}`;
  const imageLabel = `${selectedMasterLabel} Images`;
  const showAirPlacementNotice = ['tiffin', 'enclosure'].includes(
    (selectedMasterType || selectedMasterLabel).toLowerCase(),
  );

  const selectedCoordinate = useMemo(
    () => parseLatLng(latLngText),
    [latLngText],
  );

  const applyAddress = (address: string) => {
    setSelectedAddress(address);
    setMasterAddress(address);
    const parsed = parseAddressComponents(address);
    setArea(parsed.area || '');
    setCity(parsed.city || '');
    setStateName(parsed.state || '');
    setCountry(parsed.country || 'India');
    setPincode(parsed.pincode || '');
  };

  const resetForm = () => {
    setLatLngText(initialLatLng);
    setSelectedAddress(initialAddress);
    setMasterAddress(initialAddress);
    setLandmark('');
    setRemarks('');
    setArea(initialAddressParts.area);
    setCity(initialAddressParts.city);
    setStateName(initialAddressParts.state);
    setCountry(initialAddressParts.country);
    setPincode(initialAddressParts.pincode);
    setImage1('');
    setImage2('');
    setPreviewImage(null);
    setAddressSuggestions(
      initialAddress
        ? [{id: 0, label: initialAddress, value: initialAddress}]
        : [],
    );
    setShowAddressDropdown(false);
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'ios') {
      return true;
    }

    try {
      const permission = PERMISSIONS.ANDROID.CAMERA;
      const status = await check(permission);

      if (status === RESULTS.GRANTED) {
        return true;
      }

      if (status === RESULTS.DENIED) {
        const result = await request(permission);
        return result === RESULTS.GRANTED;
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

      Alert.alert('Camera Not Available', 'Camera is not available.');
      return false;
    } catch {
      return false;
    }
  };

  const openCameraForSlot = async (slot: 1 | 2) => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Camera Permission Required', 'Please allow camera access.');
      return;
    }

    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.4,
      maxWidth: 800,
      maxHeight: 800,
      saveToPhotos: false,
    };

    launchCamera(options, (res: ImagePickerResponse) => {
      if (res.didCancel || res.errorCode || !res.assets?.length) {
        return;
      }

      const uri = res.assets[0]?.uri;
      if (!uri) {
        return;
      }

      if (slot === 1) {
        setImage1(uri);
      } else {
        setImage2(uri);
      }
    });
  };

  const fetchLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const permissionStatus = await Location.checkPermission();

      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Required', 'Location permission needed.');
        return;
      }

      const data: any = await Location.getAddressFromLatLong();
      if (!data?.lat || !data?.long) {
        Alert.alert('Location', 'Unable to fetch your current location.');
        return;
      }

      setLatLngText(`${data.lat}, ${data.long}`);

      if (data?.addressList?.length) {
        const suggestions = data.addressList.map(
          (item: string, index: number) => ({
            id: index,
            label: item,
            value: item,
          }),
        );
        setAddressSuggestions(suggestions);
        setShowAddressDropdown(true);
        applyAddress(data.addressList[0]);
      } else if (data?.address) {
        setAddressSuggestions([
          {id: 0, label: data.address, value: data.address},
        ]);
        applyAddress(data.address);
      }
    } catch (error: any) {
      Alert.alert('Location', error?.message || 'Failed to fetch location.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const submitForm = async () => {
    if (!selectedMasterLabel || selectedMasterLabel === 'Master') {
      Alert.alert('Master', 'Please select a master type first.');
      return;
    }

    if (!latLngText.trim() || !selectedCoordinate) {
      Alert.alert('Lat/Lng', 'Please enter a valid Lat/Lng.');
      return;
    }

    if (!selectedAddress.trim()) {
      Alert.alert('Address', 'Please select address.');
      return;
    }

    if (!masterAddress.trim()) {
      Alert.alert('Address', 'Address is required.');
      return;
    }

    if (!image1 && !image2) {
      Alert.alert(imageLabel, `Please add at least one ${imageLabel}.`);
      return;
    }

    if (!remarks.trim()) {
      Alert.alert('Remarks', 'Remarks is required.');
      return;
    }

    const masterName = getGeneratedMasterName(selectedMasterLabel);
    const payload: any = {
      Id: 0,
      Name: masterName,
      MasterType: selectedMasterLabel,
      Address: masterAddress.trim(),
      SelectedAddress: selectedAddress.trim(),
      City: city.trim(),
      State: stateName.trim(),
      Country: country.trim() || 'India',
      Area: area.trim(),
      PinCode: pincode.trim(),
      Landmark: landmark.trim(),
      LatLng: latLngText.trim(),
      Extra1: remarks.trim(),
    };

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

    try {
      setIsSubmitting(true);
      await dispatch(UpdateMasterAPI(payload)).unwrap();
      Common.showToast(`${selectedMasterLabel} added successfully!`);

      const addedMaster = {
        id: 0,
        name: masterName,
        masterType: selectedMasterType || selectedMasterLabel.toLowerCase(),
        MasterType: selectedMasterLabel,
        address: masterAddress.trim(),
        selectedAddress: selectedAddress.trim(),
        landmark: landmark.trim(),
        latLng: latLngText.trim(),
        LatLng: latLngText.trim(),
        status: true,
        isActive: true,
        extra1: remarks.trim(),
      };

      navigation.popTo('All-Masters', {
        selectedMasterType:
          selectedMasterType || selectedMasterLabel.toLowerCase(),
        selectedMasterLabel,
        currentPosition: selectedCoordinate,
        currentAddress: selectedAddress.trim(),
        addedMaster,
        addedMasterKey: `${masterName}-${Date.now()}`,
      });
    } catch (error: any) {
      Alert.alert(
        'Unable To Add Master',
        error?.message || 'Failed to add master. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderImageSlot = (slot: 1 | 2, imageUri: string) => (
    <View style={styles.imageSlotWrap}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openCameraForSlot(slot)}
        style={styles.imageButton}>
        <Image source={IMAGES.camera} style={styles.imageButtonIcon} />
        <Text style={styles.imageButtonText}>Image {slot}</Text>
      </TouchableOpacity>

      <View style={styles.imagePreviewBox}>
        {imageUri ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setPreviewImage(imageUri)}>
              <Image source={{uri: imageUri}} style={styles.imagePreview} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => (slot === 1 ? setImage1('') : setImage2(''))}
              style={styles.removeImageButton}>
              <Text style={styles.removeImageText}>x</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.emptyImageText}>No image</Text>
        )}
      </View>
    </View>
  );

  return (
    <Screen
      preset="fixed"
      isSafeArea={false}
      isNavSafeArea={false}
      statusBgColor="#F4F7FB"
      statusBarStyle="dark">
      <StatusBar barStyle="dark-content" backgroundColor="#F4F7FB" />
      <View style={[styles.screen, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Image source={IMAGES.back} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: insets.bottom + SIZE.MS(96)},
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.formCard}>
            <View style={styles.twoColumnRow}>
              <View style={styles.masterField}>
                <Text style={styles.label}>Master</Text>
                <View style={styles.selectInput}>
                  <Text style={styles.selectText}>{selectedMasterLabel}</Text>
                  <Image source={IMAGES.down} style={styles.downIcon} />
                </View>
              </View>

              <View style={styles.latLngField}>
                <Text style={styles.label}>
                  Lat/Lng<Text style={styles.required}> *</Text>
                </Text>
                <View style={styles.latLngInputWrap}>
                  <TextInput
                    value={latLngText}
                    onChangeText={setLatLngText}
                    placeholder="Enter Lat/Lng"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    style={styles.latLngInput}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={fetchLocation}
                    disabled={isFetchingLocation}
                    style={styles.fetchButton}>
                    {isFetchingLocation ? (
                      <ActivityIndicator color={COLORS.WHITE} size="small" />
                    ) : (
                      <Text style={styles.fetchText}>Fetch</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text style={styles.label}>
              Select Address<Text style={styles.required}> *</Text>
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowAddressDropdown(prev => !prev)}
              style={styles.selectAddressInput}>
              <Text
                style={[
                  styles.selectAddressText,
                  !selectedAddress && styles.placeholderText,
                ]}
                numberOfLines={1}>
                {selectedAddress || 'Select'}
              </Text>
              <Image source={IMAGES.down} style={styles.downIcon} />
            </TouchableOpacity>

            {showAddressDropdown && addressSuggestions.length > 0 ? (
              <View style={styles.addressDropdown}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                  {addressSuggestions.map((item, index) => (
                    <TouchableOpacity
                      key={`${item.value}-${index}`}
                      activeOpacity={0.8}
                      onPress={() => {
                        applyAddress(item.value);
                        setShowAddressDropdown(false);
                      }}
                      style={styles.addressOption}>
                      <Text style={styles.addressOptionText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Text style={styles.label}>
              Address<Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              value={masterAddress}
              onChangeText={setMasterAddress}
              placeholder="Enter Address"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />

            <Text style={styles.label}>Landmark</Text>
            <TextInput
              value={landmark}
              onChangeText={setLandmark}
              placeholder="Enter Landmark"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />

            <Text style={styles.label}>
              {imageLabel}
              <Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.imagesRow}>
              {renderImageSlot(1, image1)}
              {renderImageSlot(2, image2)}
            </View>

            <Text style={styles.label}>
              Remarks<Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter Remarks"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          </View>

          {showAirPlacementNotice ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Text style={styles.infoIconText}>i</Text>
              </View>
              <Text style={styles.infoText}>
                This {selectedMasterLabel} will be placed in the air.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.bottomActions,
            {paddingBottom: Math.max(insets.bottom, SIZE.MS(10))},
          ]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={resetForm}
            disabled={isSubmitting}
            style={styles.resetButton}>
            <Text style={styles.bottomButtonText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={submitForm}
            disabled={isSubmitting}
            style={styles.submitTouchable}>
            <LinearGradient
              colors={['#8858F9', '#6036C4']}
              useAngle
              angle={148.57}
              style={styles.submitButton}>
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.WHITE} size="small" />
              ) : (
                <Text style={styles.bottomButtonText}>Submit</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={!!previewImage}
        transparent
        onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}
          style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            {previewImage ? (
              <Image
                source={{uri: previewImage}}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
};

export default AddMasterForm;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  header: {
    height: SIZE.MS(58),
    paddingHorizontal: SIZE.MS(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: SIZE.MS(34),
    height: SIZE.MS(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: SIZE.MS(18),
    height: SIZE.MS(18),
    tintColor: '#263241',
    resizeMode: 'contain',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.MEDIUM,
    color: '#263241',
  },
  headerSpacer: {
    width: SIZE.MS(34),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SIZE.MS(14),
    paddingTop: SIZE.MS(8),
  },
  formCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(7),
    paddingHorizontal: SIZE.MS(10),
    paddingTop: SIZE.MS(13),
    paddingBottom: SIZE.MS(12),
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: SIZE.MS(10),
  },
  masterField: {
    flex: 0.47,
  },
  latLngField: {
    flex: 0.53,
  },
  label: {
    marginTop: SIZE.MS(8),
    marginBottom: SIZE.MS(6),
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: '#263241',
  },
  required: {
    color: '#E03A3A',
  },
  selectInput: {
    height: SIZE.MS(36),
    borderRadius: SIZE.MS(18),
    backgroundColor: '#F3F5F8',
    borderWidth: 1,
    borderColor: '#E5E8EE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZE.MS(12),
  },
  selectText: {
    flex: 1,
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#5B6170',
  },
  downIcon: {
    width: SIZE.MS(12),
    height: SIZE.MS(12),
    resizeMode: 'contain',
    tintColor: '#5B6170',
  },
  latLngInputWrap: {
    height: SIZE.MS(36),
    borderRadius: SIZE.MS(18),
    borderWidth: 1,
    borderColor: '#E5E8EE',
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  latLngInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: SIZE.MS(11),
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#263241',
  },
  fetchButton: {
    minWidth: SIZE.MS(62),
    height: SIZE.MS(30),
    borderRadius: SIZE.MS(15),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZE.MS(3),
    backgroundColor: '#8858F9',
  },
  fetchText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.WHITE,
  },
  selectAddressInput: {
    height: SIZE.MS(36),
    borderRadius: SIZE.MS(18),
    borderWidth: 1,
    borderColor: '#E5E8EE',
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZE.MS(12),
  },
  selectAddressText: {
    flex: 1,
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#263241',
    marginRight: SIZE.MS(8),
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  addressDropdown: {
    maxHeight: SIZE.MS(135),
    borderWidth: 1,
    borderColor: '#E5E8EE',
    borderRadius: SIZE.MS(10),
    marginTop: SIZE.MS(4),
    overflow: 'hidden',
    backgroundColor: COLORS.WHITE,
  },
  addressOption: {
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MS(9),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  addressOptionText: {
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#263241',
  },
  input: {
    height: SIZE.MS(36),
    borderRadius: SIZE.MS(18),
    borderWidth: 1,
    borderColor: '#E5E8EE',
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SIZE.MS(12),
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#263241',
  },
  imagesRow: {
    flexDirection: 'row',
    gap: SIZE.MS(8),
  },
  imageSlotWrap: {
    flex: 1,
  },
  imageButton: {
    height: SIZE.MS(33),
    borderRadius: SIZE.MS(17),
    borderWidth: 1,
    borderColor: '#E5E8EE',
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageButtonIcon: {
    width: SIZE.MS(14),
    height: SIZE.MS(14),
    resizeMode: 'contain',
    tintColor: '#4A4F5D',
    marginRight: SIZE.MS(5),
  },
  imageButtonText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: '#4A4F5D',
  },
  imagePreviewBox: {
    height: SIZE.MS(82),
    borderRadius: SIZE.MS(6),
    borderWidth: 1,
    borderColor: '#EEF0F4',
    backgroundColor: '#FAFBFD',
    marginTop: SIZE.MS(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: SIZE.MS(112),
    height: SIZE.MS(76),
    resizeMode: 'cover',
    borderRadius: SIZE.MS(4),
  },
  removeImageButton: {
    position: 'absolute',
    top: -SIZE.MS(6),
    right: -SIZE.MS(5),
    width: SIZE.MS(14),
    height: SIZE.MS(14),
    borderRadius: SIZE.MS(7),
    backgroundColor: '#F5002E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: COLORS.WHITE,
    fontSize: SIZE.MS(9),
    lineHeight: SIZE.MS(11),
    fontFamily: FONTS.BOLD,
  },
  emptyImageText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: '#A0A6B2',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZE.MS(10),
    borderWidth: 1,
    borderColor: '#8EB8FF',
    borderRadius: SIZE.MS(7),
    backgroundColor: '#EAF2FF',
    paddingHorizontal: SIZE.MS(10),
    paddingVertical: SIZE.MS(9),
  },
  infoIcon: {
    width: SIZE.MS(12),
    height: SIZE.MS(12),
    borderRadius: SIZE.MS(6),
    backgroundColor: '#1577FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZE.MS(5),
  },
  infoIconText: {
    fontSize: SIZE.MS(8),
    lineHeight: SIZE.MS(10),
    fontFamily: FONTS.BOLD,
    color: COLORS.WHITE,
  },
  infoText: {
    flex: 1,
    fontSize: SIZE.MS(10),
    lineHeight: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1577FF',
  },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: SIZE.MS(8),
    paddingTop: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(14),
    backgroundColor: '#F4F7FB',
  },
  resetButton: {
    flex: 1,
    height: SIZE.MS(44),
    borderRadius: SIZE.MS(5),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B5F66',
  },
  submitTouchable: {
    flex: 1,
  },
  submitButton: {
    height: SIZE.MS(44),
    borderRadius: SIZE.MS(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonText: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.WHITE,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCard: {
    width: '90%',
    height: '70%',
    borderRadius: SIZE.MS(10),
    backgroundColor: COLORS.WHITE,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});
