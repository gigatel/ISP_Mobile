import React, {FC, useEffect, useMemo, useState} from 'react';
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
  CameraOptions,
  ImagePickerResponse,
  launchCamera,
} from 'react-native-image-picker';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import {useDispatch} from 'react-redux';
import type {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {StoreDispatch} from '@reducers';
import {
  GetMasterByNameAPI,
  GetNearestPoleTreeDDAPI,
  UpdateMasterAPI,
} from '@slices/route.slice';
import {Common} from '@utils';
import {URLs} from '@apis';
import {parseAddressComponents} from '../../components/molecules/addressParser';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'Add-Air-Master-On-Support'
>;

type Coordinate = {
  latitude: number;
  longitude: number;
};

const LOCATION_MATCH_METERS = 8;

const cleanText = (value?: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const valueByKeys = (source: any, keys: string[]) => {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const normalizedKeys = keys.map(normalizeKey);
  return Object.entries(source).find(([key]) =>
    normalizedKeys.includes(normalizeKey(key)),
  )?.[1];
};

const getList = (response: any): any[] => {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }

  const list =
    response?.data?.data ??
    response?.data?.result ??
    response?.data?.items ??
    response?.result ??
    response?.items ??
    response?.records ??
    response?.values;
  return Array.isArray(list) ? list : [];
};

const parseCoordinate = (value?: unknown): Coordinate | null => {
  const [latitudeText, longitudeText] = cleanText(value).split(',');
  const coordinate = {
    latitude: Number(latitudeText?.trim()),
    longitude: Number(longitudeText?.trim()),
  };

  return Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    Math.abs(coordinate.latitude) <= 90 &&
    Math.abs(coordinate.longitude) <= 180
    ? coordinate
    : null;
};

const getCoordinate = (master: any): Coordinate | null => {
  const parsed = parseCoordinate(
    master?.latLng ??
      master?.LatLng ??
      master?.latlng ??
      valueByKeys(master, ['latLng', 'latLong', 'masterLatLng']),
  );
  if (parsed) {
    return parsed;
  }

  const coordinate = {
    latitude: Number(
      master?.latitude ??
        master?.Latitude ??
        master?.lat ??
        valueByKeys(master, ['latitude', 'lat', 'masterLatitude']),
    ),
    longitude: Number(
      master?.longitude ??
        master?.Longitude ??
        master?.lng ??
        master?.lon ??
        valueByKeys(master, ['longitude', 'lng', 'lon', 'masterLongitude']),
    ),
  };

  return Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude)
    ? coordinate
    : null;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (first: Coordinate, second: Coordinate) => {
  const radius = 6371000;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getName = (master: any, fallback = 'Master') =>
  cleanText(
    master?.name ??
      master?.Name ??
      master?.masterName ??
      master?.MasterName ??
      valueByKeys(master, ['name', 'masterName']),
  ) || fallback;

const getId = (master: any) =>
  cleanText(
    master?.id ??
      master?.Id ??
      master?.masterId ??
      master?.MasterId ??
      valueByKeys(master, ['id', 'masterId']),
  );

const getCode = (master: any) =>
  cleanText(
    master?.code ??
      master?.Code ??
      master?.masterCode ??
      master?.MasterCode ??
      valueByKeys(master, ['code', 'masterCode']),
  );

const getType = (master: any) =>
  cleanText(
    master?.__masterTypeLabel ??
      master?.masterType ??
      master?.MasterType ??
      master?.type ??
      master?.Type,
  ) || 'Master';

const getAddress = (master: any) =>
  cleanText(
    master?.selectedAddress ??
      master?.SelectedAddress ??
      master?.address ??
      master?.Address ??
      valueByKeys(master, ['selectedAddress', 'address']),
  ) || 'Address not available';

const getLatLngText = (master: any) => {
  const coordinate = getCoordinate(master);
  return coordinate
    ? `${coordinate.latitude}, ${coordinate.longitude}`
    : 'Not available';
};

const isActive = (master: any) => {
  const value = cleanText(
    master?.status ?? master?.Status ?? master?.isActive ?? master?.IsActive,
  ).toLowerCase();
  return !['false', 'inactive', 'in active', '0'].includes(value);
};

const getImageValue = (value: any): string => {
  if (!value) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(getImageValue).find(Boolean) || '';
  }
  if (typeof value === 'object') {
    return getImageValue(
      value.uri ?? value.url ?? value.imageUrl ?? value.path ?? value.filePath,
    );
  }

  const rawImage = cleanText(value);
  if (rawImage.startsWith('[') || rawImage.startsWith('{')) {
    try {
      return getImageValue(JSON.parse(rawImage));
    } catch {
      // Continue as a regular image path when the value is not valid JSON.
    }
  }

  const image = rawImage.replace(/^['"]|['"]$/g, '');
  if (!image || ['null', 'undefined'].includes(image.toLowerCase())) {
    return '';
  }
  if (/^(https?:\/\/|file:\/\/|content:\/\/|data:image\/)/i.test(image)) {
    return image;
  }

  const compact = image.replace(/\s/g, '');
  if (compact.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${compact}`;
  }
  if (compact.startsWith('iVBOR')) {
    return `data:image/png;base64,${compact}`;
  }

  const baseUrl = URLs.BASE_URL_2.replace(/\/api\/?$/i, '/');
  return `${baseUrl}${image.replace(/\\/g, '/').replace(/^~?\//, '')}`;
};

const getImages = (master: any) => {
  const first = getImageValue(
    master?.imageUrl1 ??
      master?.ImageUrl1 ??
      master?.image1 ??
      master?.Image1 ??
      master?.imageFile1 ??
      master?.ImageFile1 ??
      master?.uploadImage1 ??
      master?.UploadImage1 ??
      master?.imagePath1 ??
      master?.ImagePath1,
  );
  const second = getImageValue(
    master?.imageUrl2 ??
      master?.ImageUrl2 ??
      master?.image2 ??
      master?.Image2 ??
      master?.imageFile2 ??
      master?.ImageFile2 ??
      master?.uploadImage2 ??
      master?.UploadImage2 ??
      master?.imagePath2 ??
      master?.ImagePath2,
  );
  const generalSource =
    master?.images ?? master?.Images ?? master?.imageUrl ?? master?.ImageUrl;
  const generalImages = Array.isArray(generalSource)
    ? generalSource.map(getImageValue)
    : [getImageValue(generalSource)];
  const genericImages = Object.entries(master ?? {})
    .filter(([key, value]) => {
      const normalizedKey = normalizeKey(key);
      return (
        normalizedKey.includes('image') &&
        !normalizedKey.includes('count') &&
        ['string', 'object'].includes(typeof value)
      );
    })
    .flatMap(([, value]) =>
      Array.isArray(value) ? value.map(getImageValue) : [getImageValue(value)],
    );

  return Array.from(
    new Set(
      [first, second, ...generalImages, ...genericImages].filter(Boolean),
    ),
  ).slice(0, 2);
};

const getKnownCount = (master: any, masterType: string) => {
  const count = Number(
    master?.__airMasterCount ??
      valueByKeys(master, [
        `${masterType}Count`,
        `total${masterType}`,
        `total${masterType}Count`,
      ]),
  );
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
};

const AddAirMasterOnSupport: FC<Props> = ({navigation, route}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<StoreDispatch>();
  const {
    selectedMasterType,
    selectedMasterLabel,
    supportMaster,
    supportKey,
    localAttachedMasters = [],
  } = route.params;
  const initialSupportType = getType(supportMaster);
  const [supportDetails, setSupportDetails] = useState(supportMaster);
  const supportCoordinate = useMemo(
    () => getCoordinate(supportDetails),
    [supportDetails],
  );
  const supportType = getType(supportDetails);
  const supportAddress = getAddress(supportDetails);
  const supportImages = useMemo(
    () => getImages(supportDetails),
    [supportDetails],
  );
  const parsedAddress = useMemo(
    () => parseAddressComponents(supportAddress),
    [supportAddress],
  );
  const [existingMasters, setExistingMasters] =
    useState<any[]>(localAttachedMasters);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [image1, setImage1] = useState('');
  const [image2, setImage2] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    const loadSupportDetails = async () => {
      try {
        const response = await dispatch(
          GetMasterByNameAPI({name: initialSupportType}),
        ).unwrap();
        const supportId = getId(supportMaster);
        const supportName = getName(supportMaster, '');
        const initialCoordinate = getCoordinate(supportMaster);
        const matchedSupport = getList(response).find(master => {
          if (supportId && getId(master) === supportId) {
            return true;
          }
          const coordinate = getCoordinate(master);
          return (
            !!initialCoordinate &&
            !!coordinate &&
            getName(master, '') === supportName &&
            distanceMeters(initialCoordinate, coordinate) <=
              LOCATION_MATCH_METERS
          );
        });

        if (matchedSupport) {
          setSupportDetails((previous: any) => ({
            ...previous,
            ...matchedSupport,
          }));
        }
      } catch (error) {
        console.warn('[AddAirMaster] Support details fetch failed:', error);
      }
    };

    loadSupportDetails();
  }, [dispatch, initialSupportType, supportMaster]);

  useEffect(() => {
    const loadExistingMasters = async () => {
      if (!supportCoordinate) {
        return;
      }

      try {
        setIsLoadingExisting(true);
        const response = await dispatch(
          GetNearestPoleTreeDDAPI({
            latLng: `${supportCoordinate.latitude}, ${supportCoordinate.longitude}`,
            labelType: selectedMasterType,
            range: 200,
            type: 'master',
            status: true,
          }),
        ).unwrap();
        const exactMatches = getList(response).filter(master => {
          const coordinate = getCoordinate(master);
          return (
            !!coordinate &&
            distanceMeters(supportCoordinate, coordinate) <=
              LOCATION_MATCH_METERS
          );
        });
        setExistingMasters(previous => {
          // Keep locally captured records first so their file:// image URIs are
          // available immediately even if the refreshed API row omits images.
          const combined = [...previous, ...exactMatches];
          return combined.filter(
            (master, index, list) =>
              list.findIndex(item => {
                const masterId = getId(master);
                const itemId = getId(item);
                return masterId && itemId && masterId !== '0' && itemId !== '0'
                  ? masterId === itemId
                  : getName(master) === getName(item) &&
                      getLatLngText(master) === getLatLngText(item);
              }) === index,
          );
        });
      } catch (error) {
        console.warn('[AddAirMaster] Existing masters fetch failed:', error);
        setExistingMasters([]);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    loadExistingMasters();
  }, [dispatch, selectedMasterType, supportCoordinate]);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'ios') {
      return true;
    }

    const permission = PERMISSIONS.ANDROID.CAMERA;
    const status = await check(permission);
    if (status === RESULTS.GRANTED) {
      return true;
    }
    if (status === RESULTS.DENIED) {
      return (await request(permission)) === RESULTS.GRANTED;
    }
    if (status === RESULTS.BLOCKED) {
      Alert.alert(
        'Camera Permission Blocked',
        'Please enable camera access from App Settings.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Open Settings',
            onPress: () => openSettings().catch(() => Linking.openSettings()),
          },
        ],
      );
    }
    return false;
  };

  const captureImage = async (slot: 1 | 2) => {
    if (!(await requestCameraPermission())) {
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
    launchCamera(options, (response: ImagePickerResponse) => {
      const uri = response.assets?.[0]?.uri;
      if (!response.didCancel && !response.errorCode && uri) {
        if (slot === 1) {
          setImage1(uri);
        } else {
          setImage2(uri);
        }
      }
    });
  };

  const showImages = (images: string[], index = 0) => {
    if (images.length === 0) {
      Alert.alert('View Images', 'No images are available for this master.');
      return;
    }
    setPreviewImages(images);
    setPreviewIndex(index);
  };

  const resetForm = () => {
    setImage1('');
    setImage2('');
    setRemarks('');
  };

  const openMaps = () => {
    if (!supportCoordinate) {
      return;
    }
    Linking.openURL(
      `https://maps.google.com/?q=${supportCoordinate.latitude},${supportCoordinate.longitude}`,
    ).catch(() => Alert.alert('Google Maps', 'Unable to open map.'));
  };

  const submit = async () => {
    if (!supportCoordinate) {
      Alert.alert('Lat/Lng', `${supportType} Lat/Lng is not available.`);
      return;
    }
    if (!image1 && !image2) {
      Alert.alert(
        `${selectedMasterLabel} Images`,
        'Please capture at least one image.',
      );
      return;
    }
    if (!remarks.trim()) {
      Alert.alert('Remarks', 'Remarks is required.');
      return;
    }

    const masterName = `${selectedMasterLabel}${Date.now()
      .toString()
      .slice(-6)}`;
    const payload: any = {
      Id: 0,
      Name: masterName,
      MasterType: selectedMasterLabel,
      Address: supportAddress,
      SelectedAddress: supportAddress,
      City:
        cleanText(supportDetails?.city ?? supportDetails?.City) ||
        parsedAddress.city,
      State:
        cleanText(supportDetails?.state ?? supportDetails?.State) ||
        parsedAddress.state,
      Country:
        cleanText(supportDetails?.country ?? supportDetails?.Country) ||
        parsedAddress.country ||
        'India',
      Area:
        cleanText(supportDetails?.area ?? supportDetails?.Area) ||
        parsedAddress.area,
      PinCode:
        cleanText(
          supportDetails?.pincode ??
            supportDetails?.PinCode ??
            supportDetails?.pinCode,
        ) || parsedAddress.pincode,
      Landmark: cleanText(supportDetails?.landmark ?? supportDetails?.Landmark),
      LatLng: `${supportCoordinate.latitude}, ${supportCoordinate.longitude}`,
      Extra1: remarks.trim(),
      Extra2: `On ${supportType}`,
    };
    if (image1) {
      payload.ImageFile1 = {
        uri: image1,
        type: 'image/jpeg',
        fileName: `${selectedMasterType}_image_1.jpg`,
      };
    }
    if (image2) {
      payload.ImageFile2 = {
        uri: image2,
        type: 'image/jpeg',
        fileName: `${selectedMasterType}_image_2.jpg`,
      };
    }

    try {
      setIsSubmitting(true);
      const savedMaster = await dispatch(UpdateMasterAPI(payload)).unwrap();
      const addedMaster = {
        ...(savedMaster && typeof savedMaster === 'object' ? savedMaster : {}),
        id: savedMaster?.id ?? savedMaster?.Id ?? 0,
        name: masterName,
        masterType: selectedMasterType,
        MasterType: selectedMasterLabel,
        address: supportAddress,
        selectedAddress: supportAddress,
        latLng: payload.LatLng,
        LatLng: payload.LatLng,
        status: true,
        isActive: true,
        extra1: remarks.trim(),
        extra2: `On ${supportType}`,
        image1,
        image2,
        Image1: image1,
        Image2: image2,
      };
      const knownCount = getKnownCount(supportDetails, selectedMasterType);
      const updatedCount = Math.max(knownCount, existingMasters.length) + 1;
      Common.showToast(`${selectedMasterLabel} added on ${supportType}!`);
      navigation.popTo('All-Masters', {
        selectedMasterType,
        selectedMasterLabel,
        currentPosition: route.params.currentPosition,
        currentAddress: route.params.currentAddress,
        updatedSupportKey: supportKey,
        updatedSupportCount: updatedCount,
        updatedSupportVersion: `${supportKey}-${Date.now()}`,
        updatedSupportAddedMaster: addedMaster,
      });
    } catch (error: any) {
      Alert.alert(
        `Unable To Add ${selectedMasterLabel}`,
        error?.message || 'Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatus = (master: any) => (
    <View
      style={[
        styles.statusBadge,
        !isActive(master) && styles.inactiveStatusBadge,
      ]}>
      <Text style={styles.statusText}>
        {isActive(master) ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );

  const renderImageSlot = (slot: 1 | 2, image: string) => (
    <View style={styles.formImageColumn}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => captureImage(slot)}
        style={styles.captureButton}>
        <Image source={IMAGES.camera} style={styles.cameraIcon} />
        <Text style={styles.captureText}>Image {slot}</Text>
      </TouchableOpacity>
      <View style={styles.formImagePreview}>
        {image ? (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => showImages([image])}>
              <Image source={{uri: image}} style={styles.formImage} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => (slot === 1 ? setImage1('') : setImage2(''))}
              style={styles.removeImageButton}>
              <Text style={styles.removeImageText}>×</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.noImageText}>Tap Image {slot}</Text>
        )}
      </View>
    </View>
  );

  return (
    <Screen
      preset="fixed"
      isSafeArea={false}
      isNavSafeArea={false}
      statusBgColor="#F3F6FA"
      statusBarStyle="dark">
      <StatusBar barStyle="dark-content" backgroundColor="#F3F6FA" />
      <View style={[styles.screen, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Image source={IMAGES.back} style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add {selectedMasterLabel}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {paddingBottom: insets.bottom + SIZE.MS(96)},
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.supportCard}>
            <View style={styles.titleRow}>
              <Text style={styles.masterName}>{getName(supportDetails)}</Text>
              <Text style={styles.masterTypeText}>
                {supportType}#{getCode(supportDetails) || getId(supportDetails)}
              </Text>
              {renderStatus(supportDetails)}
            </View>
            <Text style={styles.detailText}>
              <Text style={styles.detailLabel}>Address: </Text>
              {supportAddress}
            </Text>
            <Text style={styles.detailText}>
              <Text style={styles.detailLabel}>Lat/Lng: </Text>
              {getLatLngText(supportDetails)}
            </Text>

            {supportImages.length > 0 ? (
              <>
                <Text style={styles.imagesLabel}>Images:</Text>
                <View style={styles.supportImagesRow}>
                  {supportImages.map((image, index) => (
                    <TouchableOpacity
                      key={`${image}-${index}`}
                      activeOpacity={0.85}
                      onPress={() => showImages(supportImages, index)}>
                      <Image
                        source={{uri: image}}
                        style={styles.supportImage}
                      />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={openMaps}
                    style={styles.mapButton}>
                    <Image
                      source={IMAGES.GoogleMapsIcon}
                      style={styles.mapIcon}
                    />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={openMaps}
                style={styles.mapOnlyButton}>
                <Text style={styles.mapOnlyText}>Open in Maps</Text>
                <Image source={IMAGES.GoogleMapsIcon} style={styles.mapIcon} />
              </TouchableOpacity>
            )}
          </View>

          {isLoadingExisting ? (
            <View style={styles.existingLoading}>
              <ActivityIndicator
                size="small"
                color={COLORS.colorMediumslateblue}
              />
              <Text style={styles.existingLoadingText}>
                Loading existing {selectedMasterLabel}...
              </Text>
            </View>
          ) : null}

          {!isLoadingExisting
            ? existingMasters.map((master, index) => {
                const images = getImages(master);
                return (
                  <View
                    key={`${getId(master) || getName(master)}-${index}`}
                    style={styles.existingCard}>
                    <View style={styles.titleRow}>
                      <Text style={styles.masterName}>{getName(master)}</Text>
                      <Text style={styles.masterTypeText}>
                        {selectedMasterLabel}#{getCode(master) || getId(master)}
                      </Text>
                      {renderStatus(master)}
                    </View>
                    <Text style={styles.detailText}>
                      <Text style={styles.detailLabel}>Placed At: </Text>On{' '}
                      {supportType}
                    </Text>
                    <View style={styles.existingFooter}>
                      <Text style={styles.detailText}>
                        <Text style={styles.detailLabel}>Lat/Lng: </Text>
                        {getLatLngText(master)}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => showImages(images)}
                        style={styles.viewImagesButton}>
                        <Text style={styles.viewImagesText}>View Images</Text>
                        <Image
                          source={IMAGES.camera}
                          style={styles.viewImagesIcon}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            : null}

          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>
              {selectedMasterLabel} Images
              <Text style={styles.required}> *</Text>
            </Text>
            <View style={styles.formImagesRow}>
              {renderImageSlot(1, image1)}
              {renderImageSlot(2, image2)}
            </View>
            <Text style={styles.sectionLabel}>
              Remarks<Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter Remarks"
              placeholderTextColor="#9CA3AF"
              style={styles.remarksInput}
            />
          </View>
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
            <Text style={styles.actionText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={submit}
            disabled={isSubmitting}
            style={styles.submitTouchable}>
            <LinearGradient
              colors={['#8858F9', '#6036C4']}
              useAngle
              angle={148.57}
              style={styles.submitButton}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.actionText}>Submit</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={previewImages.length > 0}
        transparent
        onRequestClose={() => setPreviewImages([])}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setPreviewImages([])}
            style={styles.previewCloseButton}>
            <Text style={styles.previewCloseText}>×</Text>
          </TouchableOpacity>
          {previewImages[previewIndex] ? (
            <Image
              source={{uri: previewImages[previewIndex]}}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
          {previewImages.length > 1 ? (
            <View style={styles.previewPager}>
              {previewImages.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setPreviewIndex(index)}
                  style={[
                    styles.previewDot,
                    index === previewIndex && styles.previewDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
};

export default AddAirMasterOnSupport;

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F3F6FA'},
  header: {
    height: SIZE.MS(52),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(12),
  },
  backButton: {
    width: SIZE.MS(34),
    height: SIZE.MS(34),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: SIZE.MS(17),
    height: SIZE.MS(17),
    resizeMode: 'contain',
    tintColor: '#313640',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.MEDIUM,
    color: '#313640',
  },
  headerSpacer: {width: SIZE.MS(34)},
  scroll: {flex: 1},
  scrollContent: {
    paddingHorizontal: SIZE.MS(12),
    paddingBottom: SIZE.MS(100),
  },
  supportCard: {
    borderRadius: SIZE.MS(7),
    backgroundColor: COLORS.WHITE,
    padding: SIZE.MS(8),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  titleRow: {flexDirection: 'row', alignItems: 'center'},
  masterName: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#7754F7',
    marginRight: SIZE.MS(5),
  },
  masterTypeText: {
    flex: 1,
    fontSize: SIZE.MS(8),
    fontFamily: FONTS.MEDIUM,
    color: '#343943',
  },
  statusBadge: {
    borderRadius: SIZE.MS(3),
    backgroundColor: '#2ED236',
    paddingHorizontal: SIZE.MS(5),
    paddingVertical: SIZE.MS(2),
  },
  inactiveStatusBadge: {backgroundColor: '#8E8E8E'},
  statusText: {
    fontSize: SIZE.MS(7),
    fontFamily: FONTS.BOLD,
    color: COLORS.WHITE,
  },
  detailText: {
    marginTop: SIZE.MS(3),
    fontSize: SIZE.MS(8),
    lineHeight: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#343943',
  },
  detailLabel: {fontFamily: FONTS.BOLD},
  imagesLabel: {
    marginTop: SIZE.MS(5),
    marginBottom: SIZE.MS(4),
    fontSize: SIZE.MS(8),
    fontFamily: FONTS.MEDIUM,
    color: '#343943',
  },
  supportImagesRow: {flexDirection: 'row', alignItems: 'flex-end'},
  supportImage: {
    width: SIZE.MS(82),
    height: SIZE.MS(68),
    marginRight: SIZE.MS(5),
    borderRadius: SIZE.MS(5),
    resizeMode: 'cover',
    backgroundColor: '#EEF1F5',
  },
  mapButton: {marginLeft: 'auto'},
  mapIcon: {width: SIZE.MS(23), height: SIZE.MS(23), resizeMode: 'contain'},
  mapOnlyButton: {
    marginTop: SIZE.MS(7),
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapOnlyText: {
    marginRight: SIZE.MS(5),
    fontSize: SIZE.MS(8),
    fontFamily: FONTS.MEDIUM,
    color: '#1577FF',
  },
  existingLoading: {
    height: SIZE.MS(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  existingLoadingText: {
    marginLeft: SIZE.MS(7),
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.MEDIUM,
    color: '#606771',
  },
  existingCard: {
    marginTop: SIZE.MS(5),
    borderRadius: SIZE.MS(5),
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MS(6),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  existingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewImagesButton: {flexDirection: 'row', alignItems: 'center'},
  viewImagesText: {
    fontSize: SIZE.MS(7),
    fontFamily: FONTS.MEDIUM,
    color: '#343943',
    textDecorationLine: 'underline',
  },
  viewImagesIcon: {
    width: SIZE.MS(14),
    height: SIZE.MS(14),
    marginLeft: SIZE.MS(4),
    resizeMode: 'contain',
    tintColor: '#49B9F7',
  },
  formCard: {
    marginTop: SIZE.MS(9),
    borderRadius: SIZE.MS(7),
    backgroundColor: COLORS.WHITE,
    padding: SIZE.MS(9),
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionLabel: {
    marginBottom: SIZE.MS(7),
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: '#343943',
  },
  required: {color: '#F5002E'},
  formImagesRow: {flexDirection: 'row', gap: SIZE.MS(8)},
  formImageColumn: {flex: 1},
  captureButton: {
    height: SIZE.MS(30),
    borderWidth: 1,
    borderColor: '#E1E4E9',
    borderRadius: SIZE.MS(15),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    width: SIZE.MS(13),
    height: SIZE.MS(13),
    marginRight: SIZE.MS(5),
    tintColor: '#444952',
  },
  captureText: {
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.MEDIUM,
    color: '#444952',
  },
  formImagePreview: {
    height: SIZE.MS(82),
    marginTop: SIZE.MS(5),
    borderWidth: 1,
    borderColor: '#E8EAEF',
    borderRadius: SIZE.MS(5),
    backgroundColor: '#FAFBFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formImage: {
    width: SIZE.MS(118),
    height: SIZE.MS(76),
    resizeMode: 'contain',
  },
  noImageText: {
    fontSize: SIZE.MS(8),
    fontFamily: FONTS.MEDIUM,
    color: '#9CA3AF',
  },
  removeImageButton: {
    position: 'absolute',
    top: -SIZE.MS(5),
    right: -SIZE.MS(4),
    width: SIZE.MS(15),
    height: SIZE.MS(15),
    borderRadius: SIZE.MS(8),
    backgroundColor: '#F5002E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    fontSize: SIZE.MS(12),
    lineHeight: SIZE.MS(13),
    fontFamily: FONTS.BOLD,
    color: COLORS.WHITE,
  },
  remarksInput: {
    height: SIZE.MS(36),
    borderWidth: 1,
    borderColor: '#E1E4E9',
    borderRadius: SIZE.MS(18),
    paddingHorizontal: SIZE.MS(11),
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.MEDIUM,
    color: '#343943',
  },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: SIZE.MS(8),
    paddingTop: SIZE.MS(10),
    paddingHorizontal: SIZE.MS(12),
    backgroundColor: '#F3F6FA',
  },
  resetButton: {
    flex: 1,
    height: SIZE.MS(44),
    borderRadius: SIZE.MS(5),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B5F66',
  },
  submitTouchable: {flex: 1},
  submitButton: {
    height: SIZE.MS(44),
    borderRadius: SIZE.MS(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.WHITE,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {width: '92%', height: '78%'},
  previewCloseButton: {
    position: 'absolute',
    top: SIZE.MS(48),
    right: SIZE.MS(18),
    zIndex: 2,
  },
  previewCloseText: {fontSize: SIZE.MS(30), color: COLORS.WHITE},
  previewPager: {
    position: 'absolute',
    bottom: SIZE.MS(45),
    flexDirection: 'row',
  },
  previewDot: {
    width: SIZE.MS(8),
    height: SIZE.MS(8),
    borderRadius: SIZE.MS(4),
    marginHorizontal: SIZE.MS(4),
    backgroundColor: '#777',
  },
  previewDotActive: {backgroundColor: COLORS.WHITE},
});
