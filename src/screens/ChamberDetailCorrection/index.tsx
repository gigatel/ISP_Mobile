import React, {FC, useState, useEffect, useRef} from 'react';
import {
  StyleSheet,
  TextInput,
  Text,
  View,
  Image,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import RNFS from 'react-native-fs';
import {check, request, RESULTS, PERMISSIONS} from 'react-native-permissions';
import {Location} from '../../utils';
import {BackHeader} from '@molecules';
import {useTranslation} from 'react-i18next';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import Geolocation from '@react-native-community/geolocation';
import {olaReverseGeocode} from '../../services/olaMapsService';
import {checkCameraPermission} from '@slices/permission.slice';
import {Common} from '../../utils';
import {RootState, StoreDispatch} from '@reducers';
import {useDispatch, useSelector} from 'react-redux';
import AddWatermark from '../../components/molecules/addWateramark';
import {DataType} from '@types';
import {submitChamberCorrectionApi} from '../../store/slices/chamber-correction.slice';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const ChamberDetailCorrection: FC<ScreenProps.ChamberCorrectionDetail> = ({
  navigation,
  route,
}) => {
  const {chamberData} = route.params;
  const dispatch = useDispatch<StoreDispatch>();
  const {t} = useTranslation();
  const [currentLatLng, setCurrentLatLng] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [selectedImages, setSelectedImages] = useState<
    {
      base64: string;
      fileUri: string;
    }[]
  >([]);

  /*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Smooths out the latitude and longitude coordinates
   * of a given point by taking into account the previous
   * coordinates. This is useful when drawing a path on a map
   * and you want the path to be smooth.
   * @param {Object} prev - The previous coordinates
   * @param {Object} next - The next coordinates
   * @returns {Object} The smoothed coordinates
   */
  /*******  5f249799-4e09-4bf8-99df-4ee9292a7d0c  *******/
  const smoothCoord = (
    prev: {latitude: number; longitude: number} | null,
    next: {latitude: number; longitude: number},
  ) => {
    if (!prev) return next;

    const ALPHA = 0.2;
    return {
      latitude: prev.latitude + ALPHA * (next.latitude - prev.latitude),
      longitude: prev.longitude + ALPHA * (next.longitude - prev.longitude),
    };
  };

  const [isLoading, setisLoading] = useState(false);
  const [newLandmark, setNewLandmark] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [accuracy, setAccuracy] = useState<number>(0);
  const lastFixTsRef = useRef<number>(0);
  const smoothRef = useRef<{latitude: number; longitude: number} | null>(null);

  const [isEnclosureAvailable, setIsEnclosureAvailable] = useState<
    'Yes' | 'No' | ''
  >('');
  const [isDuctStandAvailable, setIsDuctStandAvailable] = useState<
    'Yes' | 'No' | ''
  >('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  // Picker Modal States
  const [showEnclosurePicker, setShowEnclosurePicker] = useState(false);
  const [showDuctStandPicker, setShowDuctStandPicker] = useState(false);

  // Image states
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string>('');
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0);

  // Current position for watermark
  const [currentPosition, setCurrentPosition] =
    useState<DataType.Coords | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const hasInitialPositionRef = useRef<boolean>(false);
  const ensureLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const fine = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        if (fine === RESULTS.GRANTED) return true;

        const req = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        return req === RESULTS.GRANTED;
      } else {
        const ios = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        if (ios === RESULTS.GRANTED) return true;

        const req = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        return req === RESULTS.GRANTED;
      }
    } catch {
      return false;
    }
  };
  const startLiveLocation = async () => {
    const ok = await ensureLocationPermission();
    if (!ok) {
      Alert.alert('Permission Required', 'Please allow location access');
      return;
    }

    // 1️⃣ Quick cached location
    Geolocation.getCurrentPosition(
      pos => {
        const {latitude, longitude, accuracy} = pos.coords;
        lastFixTsRef.current = pos.timestamp || Date.now();

        const smooth = smoothCoord(smoothRef.current, {latitude, longitude});
        smoothRef.current = smooth;

        setAccuracy(accuracy || 0);
        setCurrentLatLng(smooth);
        setCurrentPosition({...smooth, accuracy});

        fetchAddressFromCoordinates(latitude, longitude);
      },
      () => {},
      {
        enableHighAccuracy: false,
        timeout: 1500,
        maximumAge: 10 * 60 * 1000,
      },
    );

    // 2️⃣ High accuracy live updates
    // watchIdRef.current = Geolocation.watchPosition(
    //   pos => {
    //     const {latitude, longitude, accuracy} = pos.coords;
    //     const ts = pos.timestamp || Date.now();

    //     if (ts <= lastFixTsRef.current) return;
    //     lastFixTsRef.current = ts;

    //     const smooth = smoothCoord(smoothRef.current, {latitude, longitude});
    //     smoothRef.current = smooth;

    //     setAccuracy(accuracy || 0);
    //     setCurrentLatLng(smooth);
    //     setCurrentPosition({...smooth, accuracy});

    //     fetchAddressFromCoordinates(latitude, longitude);
    //   },
    //   error => {
    //     console.log('GPS ERROR:', error);
    //     setLocationError('Unable to fetch location');
    //   },
    //   {
    //     enableHighAccuracy: true,
    //     distanceFilter: 0,
    //     interval: 1000,
    //     fastestInterval: 800,
    //     maximumAge: 0,
    //   },
    // );
  };

  const cameraPermission = useSelector(
    (state: RootState) => state.permission.camera,
  );
  const getAddressLocation = async (forceRefresh: boolean = false) => {
    try {
      setisLoading(true);
      setLocationError('');

      console.log('🔄 Starting address fetch...');

      // Check permissions first
      const permissionStatus = await Location.checkPermission();
      console.log('📱 Permission status:', permissionStatus);

      if (permissionStatus === 'blocked') {
        setLocationError('Location permission blocked');
        Alert.alert(
          t('permission_required') || 'Permission Required',
          t('location_permission_blocked') ||
            'Location permission is blocked. Please enable it in app settings.',
          [
            {text: t('cancel') || 'Cancel', style: 'cancel'},
            {
              text: t('open_settings') || 'Open Settings',
              onPress: () => Location.openLocationSetting(),
            },
          ],
        );
        setisLoading(false);
        return;
      }

      if (permissionStatus === 'denied') {
        setLocationError('Location permission denied');
        Alert.alert(
          t('permission_required') || 'Permission Required',
          t('location_permission_needed') ||
            'This app needs location permission to fetch your address.',
          [
            {text: t('cancel') || 'Cancel', style: 'cancel'},
            {
              text: t('grant_permission') || 'Grant Permission',
              onPress: async () => {
                const newStatus = await Location.requestPermission();
                if (newStatus === 'granted') {
                  getAddressLocation(forceRefresh);
                }
              },
            },
          ],
        );
        setisLoading(false);
        return;
      }
      // Get address with location
      const data = (await Location.getAddressFromLatLong(
        forceRefresh,
      )) as DataType.GeoAddress;
      console.log('📍 Address data received:', data);
      if (data && data.address && data.address !== 'Location unavailable') {
        setAddress(data.address);
        setLocationError('');
        Common.showToast('Address updated successfully!');
      } else {
        setLocationError('Unable to fetch address');
        setAddress(data?.address || 'Unable to fetch current location');
        // Show error with retry option
        Alert.alert(
          t('location_error') || 'Location Error',
          t('unable_to_fetch_location') ||
            'Unable to fetch location. This might be due to:\n\n• Poor GPS signal\n• Location services disabled\n• Indoor location\n\nWould you like to try again?',
          [
            {text: t('cancel') || 'Cancel', style: 'cancel'},
            {
              text: t('retry') || 'Retry',
              onPress: () => getAddressLocation(true), // Force refresh
            },
            {
              text: t('check_settings') || 'Check Settings',
              onPress: () => Location.openLocationSetting(),
            },
          ],
        );
      }
    } catch (error: any) {
      console.error('❌ Error in getAddressLocation:', error);
      setLocationError(error?.message || 'Unknown error');
      setAddress('Error: ' + (error?.message || 'Unable to fetch location'));

      Alert.alert(
        t('error') || 'Error',
        t('location_fetch_failed') ||
          `Failed to fetch location: ${error?.message || 'Unknown error'}`,
        [{text: t('ok') || 'OK'}],
      );
    } finally {
      setisLoading(false);
    }
  };

  // Initialize GPS tracking
  useEffect(() => {
    dispatch(checkCameraPermission());
    // Get cached position first
    Geolocation.getCurrentPosition(
      pos => {
        console.log('📍 GPS LOADED (cached):', pos.coords);
        setCurrentPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        hasInitialPositionRef.current = true;
      },
      error => {
        console.log('⚠️ No cached position, getting fresh...');
      },
      {
        enableHighAccuracy: false,
        timeout: 1000,
        maximumAge: 300000,
      },
    );
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        console.log('🛑 GPS Watch stopped');
      }
    };
  }, [dispatch]);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };
  const fetchAddressFromCoordinates = async (
    latitude: number,
    longitude: number,
  ) => {
    setIsLoadingAddress(true);

    try {
      console.log('📍 Fetching address for:', latitude, longitude);

      const result = await olaReverseGeocode(latitude, longitude);

      console.log('📍 Ola Result:', result);

      if (result?.formattedAddress) {
        setAddress(result.formattedAddress);
      } else {
        setAddress('Address not available');
      }
    } catch (e) {
      console.log('❌ Address fetch error:', e);
      setAddress('Address not available');
    } finally {
      setIsLoadingAddress(false); // 🔴 IMPORTANT
    }
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      setIsLoadingLocation(false);
      Alert.alert('Permission Required', 'Please allow location access');
      return;
    }

    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;

        console.log('✅ GPS Success:', latitude, longitude);

        setCurrentLatLng({latitude, longitude});

        await fetchAddressFromCoordinates(latitude, longitude);

        setIsLoadingLocation(false); // 🔴 IMPORTANT
      },
      error => {
        console.log('❌ GPS Error:', error);

        setIsLoadingLocation(false); // 🔴 IMPORTANT
        setLocationError('Unable to fetch location. Please turn on GPS.');
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );
  };

  const handleCorrectAddress = async () => {
    setShowNewAddress(true);
    startLiveLocation(); // 🔥 LIVE GPS START
  };

  const base64ToFile = async (base64: string) => {
    const path = `${RNFS.CachesDirectoryPath}/img_${Date.now()}.jpg`;
    await RNFS.writeFile(path, base64, 'base64');
    return 'file://' + path;
  };

  const handleImageCaptured = async (base64: string) => {
    if (selectedImages.length >= 2) {
      Alert.alert('Limit Reached', 'Max 2 images allowed');
      return;
    }

    const fileUri = await base64ToFile(base64);

    setSelectedImages(prev => [...prev, {base64, fileUri}]);
  };
  // Open image preview
  const openImagePreview = (imageUri: string, index: number) => {
    setPreviewImageUri(imageUri);
    setPreviewImageIndex(index);
    setImagePreviewVisible(true);
  };

  // Close image preview
  const closeImagePreview = () => {
    setImagePreviewVisible(false);
    setPreviewImageUri('');
  };

  // Remove image from preview modal
  const removeImageFromPreview = () => {
    Alert.alert(
      'Delete Image',
      `Are you sure you want to delete Image ${previewImageIndex + 1}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSelectedImages(
              selectedImages.filter((_, i) => i !== previewImageIndex),
            );
            closeImagePreview();
          },
        },
      ],
    );
  };

  // Remove image
  const removeImage = (index: number) => {
    Alert.alert(
      'Delete Image',
      `Are you sure you want to delete Image ${index + 1}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSelectedImages(selectedImages.filter((_, i) => i !== index));
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (!showNewAddress) {
      Alert.alert('Error', 'Please click "Correct Address" to proceed');
      return;
    }

    if (selectedImages.length === 0) {
      Alert.alert('Error', 'Please add at least one chamber picture');
      return;
    }

    if (!isEnclosureAvailable) {
      Alert.alert('Error', 'Please select if enclosure is available');
      return;
    }

    if (!isDuctStandAvailable) {
      Alert.alert('Error', 'Please select if duct stand is available');
      return;
    }

    if (!currentLatLng) {
      Alert.alert('Error', 'Location not available');
      return;
    }
    const payload = {
      Id: 0,
      ChamberId: chamberData?.chamberId,
      RouteId: chamberData?.routeId, // ✅ Already correct
      ChamberAddress: address,
      ChamberLatLong: `${currentLatLng.latitude},${currentLatLng.longitude}`,
      Landmark: newLandmark,
      IsEnclosureAvailable: isEnclosureAvailable === 'Yes',
      IsDuctStandAvailable: isDuctStandAvailable === 'Yes',
      Remark: remarks,

      ImageFile1: selectedImages[0]?.fileUri || null,
      ImageFile2: selectedImages[1]?.fileUri || null,
    };

    console.log('📦 SUBMIT PAYLOAD:', payload);

    try {
      setisLoading(true);

      const res = await dispatch(submitChamberCorrectionApi(payload)).unwrap();

      Alert.alert('Success', res?.message || 'Submitted successfully', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (error: any) {
      console.log('❌ Submit error:', error);
      Alert.alert('Error', error?.message || 'Submission failed');
    } finally {
      setisLoading(false);
    }
  };

  // Picker Selection Handlers
  const handleEnclosureSelection = (value: 'Yes' | 'No') => {
    setIsEnclosureAvailable(value);
    setShowEnclosurePicker(false);
  };

  const handleDuctStandSelection = (value: 'Yes' | 'No') => {
    setIsDuctStandAvailable(value);
    setShowDuctStandPicker(false);
  };

  return (
    <Screen>
      <BackHeader
        headerTitle="Chamber Correction"
        onBackPress={navigation.goBack}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.title}>
            <Text style={styles.chamberId}>{chamberData?.chamberIdStr}</Text>
            <Text style={styles.chamberName}>{chamberData?.chamberName}</Text>
          </View>
          {/* Old Address */}
          <View style={styles.section}>
            <Text style={styles.label}>Old Address</Text>
            <Text style={styles.value}>
              {chamberData?.routeName || '- - -'}
            </Text>
          </View>
          <View style={styles.row2}>
            <View style={styles.flex}>
              <Text style={styles.label}>Old Latitude</Text>
              <Text style={styles.value}>
                {chamberData?.chamberLatLng
                  ? Number(chamberData.chamberLatLng.split(',')[0]).toFixed(6)
                  : '- - -'}
              </Text>
            </View>

            <View style={styles.flex}>
              <Text style={styles.label}>Old Longitude</Text>
              <Text style={styles.value}>
                {chamberData?.chamberLatLng
                  ? Number(chamberData.chamberLatLng.split(',')[1]).toFixed(6)
                  : '- - -'}
              </Text>
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Old Landmark</Text>
            <Text style={styles.value}>{chamberData?.landmark || '- - -'}</Text>
          </View>
          {/* Correct Button */}
          <Pressable style={styles.correctBtn} onPress={handleCorrectAddress}>
            <Text style={styles.correctText}>Correct Address</Text>
            <Image source={IMAGES.editPencilImg} style={styles.icon} />
          </Pressable>
          {showNewAddress && (
            <>
              {/* New Address Section */}
              <View style={styles.newBox}>
                <Text style={styles.label}>New Address</Text>
                <View style={styles.loaderRow}>
                  {/* <ActivityIndicator color={COLORS.PRIMARY} /> */}
                  <Text style={styles.loaderText}>{address}</Text>
                </View>

                <View style={styles.row2}>
                  <View style={styles.flex}>
                    <Text style={styles.label}>Latest Latitude</Text>
                    {isLoadingLocation ? (
                      <ActivityIndicator />
                    ) : (
                      <Text style={styles.value}>
                        {currentLatLng?.latitude?.toFixed(6) || '---'}
                      </Text>
                    )}
                  </View>

                  <View style={styles.flex}>
                    <Text style={styles.label}>Latest Longitude</Text>
                    {isLoadingLocation ? (
                      <ActivityIndicator />
                    ) : (
                      <Text style={styles.value}>
                        {currentLatLng?.longitude?.toFixed(6) || '---'}
                      </Text>
                    )}
                  </View>
                </View>
                {locationError && (
                  <Text style={styles.error}>{locationError}</Text>
                )}
                <Text style={styles.label}>New Landmark</Text>
                <TextInput
                  style={styles.inputSmall}
                  placeholder="Enter landmark"
                  value={newLandmark}
                  onChangeText={setNewLandmark}
                />
              </View>

              {/* Chamber Pictures Section */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>
                  Chamber Images ({selectedImages.length}){' '}
                  <Text style={styles.mandatory}>*</Text>
                </Text>
                <Text
                  style={[styles.takeClearPhotos, {marginBottom: SIZE.MS(10)}]}>
                  Take clear photos showing both chambers.
                </Text>
                <AddWatermark
                  currentPosition={currentPosition}
                  onImageCaptured={handleImageCaptured}
                  buttonText="+ Add Image"
                  // showPreview={true} // ✅
                />
                {errors.selectedImages && (
                  <Text style={styles.errorText}>{errors.selectedImages}</Text>
                )}
                {selectedImages.length > 0 && (
                  <View style={styles.imagesContainer}>
                    {selectedImages.map((image, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.imageItem}
                        activeOpacity={0.7}
                        onPress={() => openImagePreview(image.base64, index)}>
                        <Image
                          source={{
                            uri: `data:image/jpeg;base64,${image.base64}`,
                          }}
                          style={styles.imageThumbnail}
                        />
                        <View style={styles.imageInfo}>
                          <Text style={styles.imageText}>
                            Image {index + 1}
                          </Text>
                          <Text style={styles.imageSubText}>Tap to view</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={e => {
                            e.stopPropagation();
                            removeImage(index);
                          }}>
                          <Text style={styles.removeText}>×</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Enclosure and Duct Stand */}
              <View style={styles.inner}>
                <View style={styles.row4}>
                  <View style={styles.col}>
                    <View style={styles.span}>
                      <Text style={[styles.oldAddress, styles.oldAddressTypo]}>
                        Is Enclosure Available?
                      </Text>
                      <Text style={[styles.text3, styles.text3Typo]}> *</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.add3, styles.add3Border]}
                      onPress={() => setShowEnclosurePicker(true)}>
                      <Text style={[styles.no, styles.noLayout]}>
                        {isEnclosureAvailable || 'Select'}
                      </Text>
                      <Image
                        source={IMAGES.down}
                        style={styles.vectorIcon2}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.col}>
                    <View style={styles.span}>
                      <Text style={[styles.oldAddress, styles.oldAddressTypo]}>
                        Is Duct Stand Available?
                      </Text>
                      <Text style={[styles.text3, styles.text3Typo]}> *</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.add3, styles.add3Border]}
                      onPress={() => setShowDuctStandPicker(true)}>
                      <Text style={[styles.no, styles.noLayout]}>
                        {isDuctStandAvailable || 'Select'}
                      </Text>
                      <Image
                        source={IMAGES.down}
                        style={styles.vectorIcon2}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Remarks */}
              <View style={styles.li5}>
                <Text style={[styles.oldAddress, styles.oldAddressTypo]}>
                  Remarks
                </Text>
                <TextInput
                  style={styles.txtInputStyle}
                  placeholder="Enter remarks here..."
                  placeholderTextColor="#999"
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={remarks}
                  onChangeText={setRemarks}
                />
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Pressable
                  style={styles.discardBtn}
                  onPress={() => navigation.goBack()}>
                  <Text style={styles.footerText}>DISCARD</Text>
                </Pressable>
                <Pressable
                  style={styles.saveBtn}
                  onPress={handleSave}
                  disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.footerText}>SAVE</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal
        visible={imagePreviewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImagePreview}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeImagePreview}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {/* Image Title */}
            <Text style={styles.previewTitle}>
              Image {previewImageIndex + 1} of {selectedImages.length}
            </Text>

            {/* Full Image Preview */}
            <ScrollView
              style={styles.previewImageContainer}
              contentContainerStyle={styles.previewImageContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}>
              <Image
                source={{uri: `data:image/jpeg;base64,${previewImageUri}`}}
                style={styles.previewImage}
              />
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={removeImageFromPreview}>
                <Text style={styles.deleteButtonText}>Delete Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeActionButton}
                onPress={closeImagePreview}>
                <Text style={styles.closeActionButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enclosure Picker Modal */}
      <Modal
        visible={showEnclosurePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEnclosurePicker(false)}>
        <View style={styles.pickerModalContainer}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Is Enclosure Available?</Text>
              <TouchableOpacity
                onPress={() => setShowEnclosurePicker(false)}
                style={styles.pickerCloseButton}>
                <Text style={styles.pickerCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerOptions}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  isEnclosureAvailable === 'Yes' && styles.pickerOptionSelected,
                ]}
                onPress={() => handleEnclosureSelection('Yes')}>
                <Text
                  style={[
                    styles.pickerOptionText,
                    isEnclosureAvailable === 'Yes' &&
                      styles.pickerOptionTextSelected,
                  ]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  isEnclosureAvailable === 'No' && styles.pickerOptionSelected,
                ]}
                onPress={() => handleEnclosureSelection('No')}>
                <Text
                  style={[
                    styles.pickerOptionText,
                    isEnclosureAvailable === 'No' &&
                      styles.pickerOptionTextSelected,
                  ]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Duct Stand Picker Modal */}
      <Modal
        visible={showDuctStandPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDuctStandPicker(false)}>
        <View style={styles.pickerModalContainer}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Is Duct Stand Available?</Text>
              <TouchableOpacity
                onPress={() => setShowDuctStandPicker(false)}
                style={styles.pickerCloseButton}>
                <Text style={styles.pickerCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerOptions}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  isDuctStandAvailable === 'Yes' && styles.pickerOptionSelected,
                ]}
                onPress={() => handleDuctStandSelection('Yes')}>
                <Text
                  style={[
                    styles.pickerOptionText,
                    isDuctStandAvailable === 'Yes' &&
                      styles.pickerOptionTextSelected,
                  ]}>
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  isDuctStandAvailable === 'No' && styles.pickerOptionSelected,
                ]}
                onPress={() => handleDuctStandSelection('No')}>
                <Text
                  style={[
                    styles.pickerOptionText,
                    isDuctStandAvailable === 'No' &&
                      styles.pickerOptionTextSelected,
                  ]}>
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

export default ChamberDetailCorrection;

const styles = StyleSheet.create({
  scrollContainer: {
    padding: SIZE.MS(12),
    paddingBottom: SIZE.MS(30),
  },
  errorText: {fontSize: 14, color: '#FF4444', marginTop: SIZE.MS(4)},
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 8,
    padding: SIZE.MS(12),
    elevation: 3,
  },

  btn2Layout: {
    overflow: 'hidden',
    borderRadius: 6,
    alignSelf: 'stretch',
  },
  image1Typo: {
    lineHeight: 20,
    fontSize: 13,
    textAlign: 'left',
    color: '#393d45',
    fontFamily: FONTS.MEDIUM,
  },
  mandatory: {color: '#FF4444', fontSize: 16},
  fieldContainer: {width: '100%', marginBottom: SIZE.MS(10)},
  text3: {
    color: 'red',
    textAlign: 'left',
    fontSize: 14,
  },
  imagesContainer: {gap: SIZE.MS(8), marginTop: SIZE.MS(10)},
  removeText: {color: 'white', fontSize: 16, fontWeight: 'bold'},
  imageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SIZE.MS(12),
    backgroundColor: '#F5F5F5',
    borderRadius: SIZE.MS(6),
  },
  imageThumbnail: {
    width: SIZE.MS(50),
    height: SIZE.MS(50),
    borderRadius: SIZE.MS(6),
    marginRight: SIZE.MS(12),
  },
  imageInfo: {flex: 1},
  imageText: {fontSize: 14, color: COLORS.TEXT_DARK, fontWeight: '600'},
  imageSubText: {
    fontSize: 12,
    color: COLORS.TEXT_DARK,
    opacity: 0.6,
    marginTop: 2,
  },
  removeButton: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    borderRadius: SIZE.MS(12),
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text3Typo: {
    fontFamily: FONTS.MEDIUM,
    textAlign: 'left',
  },
  li4: {
    gap: 10,
    alignSelf: 'stretch',
    marginBottom: SIZE.MS(10),
  },
  takeClearPhotos: {
    fontSize: 9,
  },
  col3: {
    gap: 10,
    flex: 1,
    position: 'relative',
  },
  btn2: {
    paddingHorizontal: 17,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    flexDirection: 'row',
    gap: 10,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
    borderRadius: 6,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  vectorIcon4: {
    width: 17,
    height: 15,
  },
  imgcardIcon: {
    height: 120,
    maxWidth: '100%',
    width: '100%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  closeIcon: {
    width: 24,
    height: 24,
    top: 5,
    right: 5,
    borderRadius: 12,
    position: 'absolute',
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  closeIconText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  add3: {
    paddingVertical: 6,
    backgroundColor: COLORS.WHITE,
    borderRadius: 6,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  titleFlexBox: {
    gap: 4,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  no: {
    fontSize: 13,
    textAlign: 'left',
    color: '#393d45',
    flex: 1,
  },
  vectorIcon2: {
    height: 6,
    width: 10,
    opacity: 0.8,
  },
  noLayout: {
    lineHeight: 22,
    fontFamily: FONTS.MEDIUM,
  },
  add3Border: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    flexDirection: 'row',
  },
  title: {
    alignItems: 'center',
    marginBottom: SIZE.MS(12),
  },

  chamberId: {
    fontSize: 14,
    fontFamily: FONTS.MEDIUM,
    color: '#393d45',
  },
  row4: {
    gap: 10,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  col: {
    gap: 10,
    justifyContent: 'center',
    flex: 1,
  },
  span: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  chamberName: {
    fontSize: 12,
    color: '#666',
  },
  inner: {
    alignSelf: 'stretch',
    marginBottom: SIZE.MS(10),
  },
  section: {
    marginBottom: SIZE.MS(10),
  },

  label: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: '#393d45',
    marginBottom: 4,
  },

  value: {
    fontSize: 13,
    color: '#4c545b',
  },

  row2: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SIZE.MS(10),
  },

  flex: {
    flex: 1,
  },

  correctBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cfd4da',
    marginBottom: SIZE.MS(12),
  },

  correctText: {
    color: '#0ca2dd',
    fontFamily: FONTS.MEDIUM,
  },

  icon: {
    width: 12,
    height: 12,
  },
  txtInputStyle: {
    height: 100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    borderRadius: 6,
    backgroundColor: COLORS.WHITE,
    fontSize: 13,
    width: '100%',
    fontFamily: FONTS.MEDIUM,
    color: '#393d45',
    textAlignVertical: 'top',
  },
  newBox: {
    borderWidth: 1,
    borderColor: '#0CA2DD',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: SIZE.MS(10),
    marginBottom: SIZE.MS(12),
  },

  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    minHeight: 70,
    marginBottom: SIZE.MS(10),
  },

  inputSmall: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    height: 40,
  },
  oldAddress: {
    fontSize: 13,
  },
  oldAddressTypo: {
    letterSpacing: 0.2,
    textAlign: 'left',
    color: '#393d45',
    fontFamily: FONTS.MEDIUM,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },

  loaderText: {
    fontSize: 13,
    color: '#555',
  },
  li5: {
    gap: 10,
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginBottom: SIZE.MS(10),
  },
  error: {
    color: 'red',
    fontSize: 12,
    marginBottom: 10,
  },

  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SIZE.MS(10),
  },

  discardBtn: {
    flex: 1,
    backgroundColor: '#535455',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },

  saveBtn: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },

  footerText: {
    color: COLORS.WHITE,
    fontFamily: FONTS.MEDIUM,
    fontSize: 14,
  },

  // Image Preview Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: SIZE.MS(50),
    right: SIZE.MS(20),
    width: SIZE.MS(40),
    height: SIZE.MS(40),
    borderRadius: SIZE.MS(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: 'bold',
  },
  previewTitle: {
    position: 'absolute',
    top: SIZE.MS(60),
    left: SIZE.MS(20),
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    zIndex: 10,
  },
  previewImageContainer: {
    flex: 1,
    width: '100%',
    marginTop: SIZE.MS(100),
    marginBottom: SIZE.MS(100),
  },
  previewImageContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - SIZE.MS(200),
  },
  previewActions: {
    position: 'absolute',
    bottom: SIZE.MS(40),
    left: SIZE.MS(20),
    right: SIZE.MS(20),
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SIZE.MS(10),
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF4444',
    paddingVertical: SIZE.MS(15),
    borderRadius: SIZE.MS(8),
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeActionButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: SIZE.MS(15),
    borderRadius: SIZE.MS(8),
    alignItems: 'center',
  },
  closeActionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Picker Modal Styles
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerModalContent: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: SIZE.MS(20),
    borderTopRightRadius: SIZE.MS(20),
    paddingBottom: SIZE.MS(30),
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZE.MS(20),
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: FONTS.MEDIUM,
    color: '#393d45',
  },
  pickerCloseButton: {
    width: SIZE.MS(30),
    height: SIZE.MS(30),
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCloseText: {
    fontSize: 30,
    color: '#666',
    lineHeight: 30,
  },
  pickerOptions: {
    paddingVertical: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(20),
    gap: 10,
    backgroundColor: COLORS.WHITE,
  },
  pickerOption: {
    paddingVertical: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(20),
    borderRadius: SIZE.MS(8),
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: COLORS.WHITE,
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
    paddingVertical: SIZE.MS(10),
  },
  pickerOptionText: {
    fontSize: 16,
    fontFamily: FONTS.MEDIUM,
    color: '#393d45',
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: COLORS.WHITE,
  },
});
