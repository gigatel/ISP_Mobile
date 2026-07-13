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
import CustomAlert from '../../components/molecules/CustomAlert';
import {ScreenProps, DataType} from '@types';
import {COLORS, IMAGES, FONTS, SIZE} from '@res';
import LinearGradient from 'react-native-linear-gradient';
import {Location, Common} from '@utils';
import {parseAddressComponents} from '../../components/molecules/addressParser';
import {StoreDispatch} from '@reducers';
import {
  UpdateMasterAPI,
  GetMasterByNameAPI,
  GetNearestPoleTreeDDAPI,
} from '@slices/route.slice';
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

type Coordinate = {
  latitude: number;
  longitude: number;
};

type AddMasterAlertState = {
  visible: boolean;
  title: string;
  message: string;
  iconTint: string;
  confirmAddAnyway: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const PICKER_DATA: PickerItem[] = [
  {label: 'Pole', value: 'Pole', icon: IMAGES.PoleImage},
  {label: 'Tree', value: 'Tree', icon: IMAGES.treeIcon},
  {label: 'Building', value: 'Building', icon: IMAGES.TiffinIcon},
  {label: 'POP', value: 'POP', icon: IMAGES.FiberEnclosur},
  {label: 'Splitter', value: 'Splitter', icon: IMAGES.enclosureIcon},
  {label: 'Tiffin', value: 'Tiffin', icon: IMAGES.TiffinIcon},
  {label: 'Enclosure', value: 'Enclosure', icon: IMAGES.jointEnclosure},
];

const AIR_PLACED_MASTER_TYPES = new Set(['pop', 'tiffin', 'enclosure']);

const LOCATION_MATCH_TOLERANCE = 0.000001;

const isValidCoordinate = (coord?: Coordinate | null): coord is Coordinate =>
  Number.isFinite(coord?.latitude) && Number.isFinite(coord?.longitude);

const isSameCoordinate = (first: Coordinate, second: Coordinate) =>
  Math.abs(first.latitude - second.latitude) <= LOCATION_MATCH_TOLERANCE &&
  Math.abs(first.longitude - second.longitude) <= LOCATION_MATCH_TOLERANCE;

const parseLatLng = (latLng?: string | null): Coordinate | null => {
  const [latText, lngText] = String(latLng ?? '').split(',');
  const coordinate = {
    latitude: Number(latText?.trim()),
    longitude: Number(lngText?.trim()),
  };

  return isValidCoordinate(coordinate) ? coordinate : null;
};

const getMasterCoordinate = (master: any): Coordinate | null => {
  const latLng =
    master?.latLng ??
    master?.LatLng ??
    master?.latlng ??
    master?.lat_lng ??
    getValueByNormalizedKeys(master, [
      'latLng',
      'latLong',
      'latLon',
      'latitudeLongitude',
      'masterLatLng',
      'chamberLatLng',
    ]);
  const parsedLatLng = parseLatLng(latLng);

  if (parsedLatLng) {
    return parsedLatLng;
  }

  const coordinate = {
    latitude: Number(
      master?.latitude ??
        master?.Latitude ??
        master?.lat ??
        getValueByNormalizedKeys(master, [
          'latitude',
          'lat',
          'masterLatitude',
          'lattitude',
          'latitute',
          'chamberLatitude',
          'chamberLat',
        ]),
    ),
    longitude: Number(
      master?.longitude ??
        master?.Longitude ??
        master?.lng ??
        master?.lon ??
        master?.long ??
        getValueByNormalizedKeys(master, [
          'longitude',
          'lng',
          'lon',
          'long',
          'masterLongitude',
          'longitute',
          'chamberLongitude',
          'chamberLong',
        ]),
    ),
  };

  return isValidCoordinate(coordinate) ? coordinate : null;
};

const normalizeAddressValue = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const getUniqueStrings = (values: string[]) =>
  values.filter((value, index, self) => value && self.indexOf(value) === index);

const normalizeObjectKey = (key: string) =>
  key.toLowerCase().replace(/[^a-z0-9]/g, '');

const getValueByNormalizedKeys = (source: any, keys: string[]) => {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const normalizedKeys = keys.map(normalizeObjectKey);
  const entry = Object.entries(source).find(([key]) =>
    normalizedKeys.includes(normalizeObjectKey(key)),
  );

  return entry?.[1];
};

const getMasterFullAddress = (master: any) =>
  [
    master?.address ?? master?.Address,
    getValueByNormalizedKeys(master, [
      'fullAddress',
      'masterAddress',
      'locationAddress',
      'selectedAddress',
      'address',
    ]),
    master?.area ?? master?.Area,
    master?.city ?? master?.City,
    master?.state ?? master?.State,
    master?.pincode ?? master?.PinCode,
  ]
    .filter(Boolean)
    .join(', ');

const getMasterAddressCandidates = (master: any) =>
  getUniqueStrings(
    [
      master?.selectedAddress,
      master?.SelectedAddress,
      master?.selected_address,
      master?.address,
      master?.Address,
      getValueByNormalizedKeys(master, [
        'selectedAddress',
        'fullAddress',
        'masterAddress',
        'locationAddress',
        'address',
      ]),
      getMasterFullAddress(master),
    ]
      .map(normalizeAddressValue)
      .filter(Boolean),
  );

const isSameAddressValue = (first: string, second: string) => {
  if (!first || !second) {
    return false;
  }

  return (
    first === second ||
    (first.length >= 12 && second.includes(first)) ||
    (second.length >= 12 && first.includes(second))
  );
};

const normalizeComparableValue = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const getMasterNameValue = (master: any) =>
  normalizeComparableValue(
    master?.name ??
      master?.Name ??
      master?.masterName ??
      master?.MasterName ??
      getValueByNormalizedKeys(master, ['name', 'masterName']),
  );

const getMasterDisplayName = (master: any, fallback = 'This master') => {
  const name = String(
    master?.name ??
      master?.Name ??
      master?.masterName ??
      master?.MasterName ??
      getValueByNormalizedKeys(master, ['name', 'masterName']) ??
      fallback,
  ).trim();

  return name || fallback;
};

const formatMasterNameList = (masters: any[], fallback = 'This master') => {
  const names = getUniqueStrings(
    masters.map(master => getMasterDisplayName(master, '')).filter(Boolean),
  );

  if (names.length === 0) {
    return fallback;
  }

  if (names.length === 1) {
    return names[0];
  }

  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const buildDuplicateNameMessage = (name: string) =>
  `Existing master: ${name}\nReason: Same master name already exists.\nAction required: Use a unique master name.`;

const buildDuplicateLocationMessage = (names: string) =>
  `Existing master(s): ${names}\nReason: Same location or address already exists.\nAction required: Review the details before adding another record.`;

const findDuplicateMasterName = (master: any, masters: any[]) => {
  const candidateName = getMasterNameValue(master);

  return masters.find(
    existingMaster =>
      !!candidateName && candidateName === getMasterNameValue(existingMaster),
  );
};

const findDuplicateMasterLocations = (master: any, masters: any[]) => {
  const candidateCoordinate = getMasterCoordinate(master);
  const candidateAddresses = getMasterAddressCandidates(master);

  return masters.filter(existingMaster => {
    const existingCoordinate = getMasterCoordinate(existingMaster);
    const hasSameCoordinate =
      !!candidateCoordinate &&
      !!existingCoordinate &&
      isSameCoordinate(candidateCoordinate, existingCoordinate);
    const existingAddresses = getMasterAddressCandidates(existingMaster);
    const hasSameAddress =
      candidateAddresses.length > 0 &&
      existingAddresses.some(existingAddress =>
        candidateAddresses.some(candidateAddress =>
          isSameAddressValue(candidateAddress, existingAddress),
        ),
      );

    return hasSameCoordinate || hasSameAddress;
  });
};

const getMasterListFromResponse = (response: any): any[] => {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (response?.data && Array.isArray(response.data)) {
    return response.data;
  }

  const nestedList =
    response?.data?.data ??
    response?.data?.result ??
    response?.data?.items ??
    response?.data?.records ??
    response?.result ??
    response?.items ??
    response?.records ??
    response?.list ??
    response?.values;

  if (Array.isArray(nestedList)) {
    return nestedList;
  }

  return [];
};

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
  const [isOpeningAllMasters, setIsOpeningAllMasters] = useState(false);
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
  const [addMasterAlert, setAddMasterAlert] = useState<AddMasterAlertState>({
    visible: false,
    title: '',
    message: '',
    iconTint: '#B7791F',
    confirmAddAnyway: false,
  });
  // ── Get current address ────────────────────────────────────────────────────
  const getAddressLocation = async () => {
    try {
      setIsLocationLoading(true);
      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        return;
      }
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

  useEffect(() => {
    getAddressLocation();
  }, []);

  const showAddMasterAlert = ({
    title,
    message,
    iconTint = '#B7791F',
    confirmAddAnyway = false,
  }: {
    title: string;
    message: string;
    iconTint?: string;
    confirmAddAnyway?: boolean;
  }) => {
    setAddMasterAlert({
      visible: true,
      title,
      message,
      iconTint,
      confirmAddAnyway,
    });
  };

  const closeAddMasterAlert = () => {
    setAddMasterAlert(prev => ({...prev, visible: false}));
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
    closeAddMasterAlert();
  };

  // ── Fetch master list ──────────────────────────────────────────────────────
  const fetchMasterList = async (masterType: string) => {
    try {
      setIsLoadingMasters(true);
      setMasterList([]);
      const response = await dispatch(
        GetMasterByNameAPI({name: masterType}),
      ).unwrap();
      setMasterList(getMasterListFromResponse(response));
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
    if (AIR_PLACED_MASTER_TYPES.has(item.value.toLowerCase())) {
      setMasterList([]);
      setIsLoadingMasters(false);
      return;
    }
    fetchMasterList(item.value);
  };

  // ── Open nearest masters list ──────────────────────────────────────────────
  const handleOpenMasterForm = async () => {
    // Previous add-new-master flow kept for reference.
    // resetForm();
    // setMasterFormVisible(true);

    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select a master type first.');
      return;
    }

    try {
      setIsOpeningAllMasters(true);

      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Required', 'Location permission needed.');
        return;
      }

      const locationData = (await Location.getAddressFromLatLong()) as any;
      const currentPosition = {
        latitude: Number(locationData?.lat),
        longitude: Number(locationData?.long),
      };

      if (!isValidCoordinate(currentPosition)) {
        Alert.alert('Location', 'Unable to fetch your current location.');
        return;
      }

      const selectedMasterType = selectedType.value.toLowerCase();
      const currentAddress =
        locationData?.address || locationData?.addressList?.[0] || '';
      if (AIR_PLACED_MASTER_TYPES.has(selectedMasterType)) {
        navigation.navigate('All-Masters', {
          selectedMasterType,
          selectedMasterLabel: selectedType.label,
          currentPosition,
          currentAddress,
          initialMasters: [],
        });
        return;
      }

      const response = await dispatch(
        GetNearestPoleTreeDDAPI({
          latLng: `${currentPosition.latitude}, ${currentPosition.longitude}`,
          labelType: selectedMasterType,
          range: 200,
          type: 'master',
          status: true,
        }),
      ).unwrap();

      navigation.navigate('All-Masters', {
        selectedMasterType,
        selectedMasterLabel: selectedType.label,
        currentPosition,
        currentAddress,
        initialMasters: getMasterListFromResponse(response),
      });
    } catch (error: any) {
      Alert.alert(
        'All Masters',
        error?.message || 'Unable to load nearest masters.',
      );
    } finally {
      setIsOpeningAllMasters(false);
    }
  };

  // ── Location inside modal (GPS button) ────────────────────────────────────
  // const handleFetchLocation = async () => {
  //   console.log('handleFecthLocation');
  //   try {
  //     setIsFetchingLocation(true);
  //     const permissionStatus = await Location.checkPermission();
  //     if (permissionStatus !== 'granted') {
  //       Alert.alert('Permission Required', 'Location permission needed.');
  //       return;
  //     }
  //     console.log('log11');

  //     // const data: any = await Location.getAddressFromLatLong(true);
  //     const data: any = await Location.getAddressFromLatLong();
  //     console.log('log12', data);

  //     if (data?.lat && data?.long) {
  //       setLatLngText(`${data.lat}, ${data.long}`);

  //       // reset fields
  //       setSelectedAddress('');
  //       setMasterAddress('');
  //       setArea('');
  //       setCity('');
  //       setStateName('');
  //       setCountry('');
  //       setPincode('');
  //       console.log('data', {data});

  //       // ✅ ⭐ MAIN FIX: addressList ko dropdown me daal
  //       // if (data?.addressList?.length) {
  //       //   const formattedSuggestions = data.addressList.map(
  //       //     (item: string, index: number) => ({
  //       //       id: index,
  //       //       label: item,
  //       //       value: item,
  //       //     }),
  //       //   );

  //       //   console.log('✅ Suggestions:', formattedSuggestions);

  //       //   setAddressSuggestions(formattedSuggestions); // ⭐ yaha set kar
  //       //   setShowAddressDropdown(true); // ⭐ dropdown open kar
  //       // }
  //       if (data?.addressList?.length) {
  //         const formattedSuggestions = data.addressList.map(
  //           (item: string, index: number) => ({
  //             id: index,
  //             label: item,
  //             value: item,
  //           }),
  //         );
  //         setAddressSuggestions(formattedSuggestions);
  //         setShowAddressDropdown(true);
  //       }

  //       Common.showToast('Location fetched! Please select address.');
  //     } else {
  //       Alert.alert('Error', 'Unable to fetch coordinates');
  //     }
  //   } catch (e: any) {
  //     Alert.alert('Error', e?.message || 'Failed to fetch location');
  //   } finally {
  //     setIsFetchingLocation(false);
  //   }
  // };
  const handleFetchLocation = async () => {
    console.log('handleFecthLocation');
    try {
      setIsFetchingLocation(true);

      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        Alert.alert('Permission Required', 'Location permission needed.');
        return;
      }

      const data: any = await Location.getAddressFromLatLong();
      console.log('📦 Location Data:', data);

      if (data?.lat && data?.long) {
        setLatLngText(`${data.lat}, ${data.long}`);

        // ✅ reset fields
        setSelectedAddress('');
        setMasterAddress('');
        setArea('');
        setCity('');
        setStateName('');
        setCountry('');
        setPincode('');

        // ✅ ⭐ MULTIPLE ADDRESS → DROPDOWN
        if (data?.addressList?.length) {
          const formattedSuggestions = data.addressList.map(
            (item: string, index: number) => ({
              id: index,
              label: item,
              value: item,
            }),
          );
          console.log('✅ Suggestions:', formattedSuggestions);

          // 👉 dropdown list
          setAddressSuggestions(formattedSuggestions);
          setShowAddressDropdown(true);

          // ✅ ⭐ ONLY ONE ADDRESS SAVE (FIRST ONE DEFAULT)
          const firstAddress = data.addressList[0];

          console.log('✅ Default Selected Address:', firstAddress);

          setSelectedAddress(firstAddress);
          setMasterAddress(firstAddress);
        }

        Common.showToast('Location fetched! Please select address.');
      } else {
        Alert.alert('Error', 'Unable to fetch coordinates');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to fetch location');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleAddressDropdownToggle = () => {
    // if (addressSuggestions.length > 0) {
    setShowAddressDropdown(prev => !prev);
    // } else {
    //   Alert.alert('No Data', 'Please fetch location first');
    // }
  };

  const handleAddressSelect = (addr: string) => {
    setSelectedAddress(addr);
    setMasterAddress(addr);
    const parsed = parseAddressComponents(addr);
    if (parsed.area) setArea(parsed.area);
    if (parsed.city) setCity(parsed.city);
    if (parsed.state) setStateName(parsed.state);
    if (parsed.country) setCountry(parsed.country);
    if (parsed.pincode) setPincode(parsed.pincode);
    setShowAddressDropdown(false);
  };
  // ── ✅ Camera permission helper (Android only, iOS handled by launchCamera) ─
  const requestCameraPermission = async (): Promise<boolean> => {
    // iOS — launchCamera handles permission natively, no manual check needed
    if (Platform.OS === 'ios') return true;
    // Android — check then request
    const permission = PERMISSIONS.ANDROID.CAMERA;
    try {
      const status = await check(permission);
      if (status === RESULTS.GRANTED) return true;
      if (status === RESULTS.DENIED) {
        // First time or previously denied but requestable
        const result = await request(permission);
        if (result === RESULTS.GRANTED) return true;

        // User denied — show gentle alert without opening settings forcefully
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to capture images.',
          [{text: 'OK'}],
        );
        return false;
      }

      if (status === RESULTS.BLOCKED) {
        // Permanently denied — must go to settings
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

      // UNAVAILABLE or any other status
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
    // ✅ Check/request camera permission before launching
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
  const handleAddAndSelect = async (allowDuplicateLocation = false) => {
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

    const draftMaster = {
      name: masterName.trim(),
      latLng: latLngText.trim(),
      address: masterAddress.trim(),
      selectedAddress: selectedAddress.trim() || masterAddress.trim(),
      landmark: landmark.trim(),
    };

    setIsSubmitting(true);
    try {
      const latestMasterResponse = await dispatch(
        GetMasterByNameAPI({name: selectedType.value}),
      ).unwrap();
      const latestMasters = getMasterListFromResponse(latestMasterResponse);
      setMasterList(latestMasters);

      const duplicateName = findDuplicateMasterName(draftMaster, latestMasters);

      if (duplicateName) {
        const duplicateNameText = getMasterDisplayName(
          duplicateName,
          masterName.trim(),
        );
        setIsSubmitting(false);
        showAddMasterAlert({
          title: 'Master Name Already Exists',
          message: buildDuplicateNameMessage(duplicateNameText),
          iconTint: COLORS.ERROR,
          confirmAddAnyway: false,
        });
        return;
      }

      if (!allowDuplicateLocation) {
        const duplicateLocations = findDuplicateMasterLocations(
          draftMaster,
          latestMasters,
        );

        if (duplicateLocations.length > 0) {
          const duplicateLocationNames =
            formatMasterNameList(duplicateLocations);
          setIsSubmitting(false);
          showAddMasterAlert({
            title: 'Location Already Exists',
            message: buildDuplicateLocationMessage(duplicateLocationNames),
            iconTint: '#B7791F',
            confirmAddAnyway: true,
          });
          return;
        }
      }

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

      console.log('📤 [AddMaster] → UpdateMasterAPI');
      await dispatch(UpdateMasterAPI(payload)).unwrap();
      console.log('✅ Master added');

      Common.showToast(`${selectedType.label} added successfully! ✅`);
      resetForm();
      setMasterFormVisible(false);

      fetchMasterList(selectedType.value);
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
      const messageText = String(msg);
      const duplicateServerMessage =
        /name/i.test(messageText) &&
        /exist|duplicate|already/i.test(messageText);

      showAddMasterAlert({
        title: duplicateServerMessage
          ? 'Master Name Already Exists'
          : 'Unable To Add Master',
        message: duplicateServerMessage
          ? buildDuplicateNameMessage(masterName.trim())
          : String(msg),
        iconTint: COLORS.ERROR,
        confirmAddAnyway: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Screen
      preset="fixed"
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
        {/* {!isLoadingMasters && selectedType && masterList.length > 0 && (
          <Text style={localStyles.countText}>
            ✅ Found {masterList.length} {selectedType.label}(s)
          </Text>
        )} */}

        {/* ── Action Buttons ── */}
        {selectedType && !isLoadingMasters && (
          <View style={localStyles.actionRow}>
            {/* Add New */}
            <TouchableOpacity
              style={localStyles.actionBtn}
              activeOpacity={0.85}
              disabled={isOpeningAllMasters}
              onPress={handleOpenMasterForm}>
              <LinearGradient
                colors={[COLORS.colorMediumslateblue, '#6036c4']}
                style={localStyles.gradient}
                start={{x: 0.5, y: 0}}
                end={{x: 0.5, y: 1}}>
                {isOpeningAllMasters ? (
                  <ActivityIndicator size="small" color={COLORS.WHITE} />
                ) : (
                  <Text style={localStyles.actionBtnText}>
                    + Add {selectedType.label}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Existing */}
            {/* <TouchableOpacity
              style={localStyles.actionBtn}
              activeOpacity={0.85}
              onPress={handleExistingClick}>
              <LinearGradient
                colors={['#00c417', '#005e0b']}
                style={localStyles.gradient}
                start={{x: 0.5, y: 0}}
                end={{x: 0.5, y: 1}}>
                <Text style={localStyles.actionBtnText}>Existing</Text>
              </LinearGradient>
            </TouchableOpacity> */}
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
        //
        onAddressDropdownToggle={handleAddressDropdownToggle}
        //
        onAddressSelect={handleAddressSelect}
        onOpenCamera={handleOpenCameraForModal}
        onImagePreview={setPreviewImage}
        onSubmit={handleAddAndSelect}
      />

      <CustomAlert
        visible={addMasterAlert.visible}
        icon={IMAGES.warning}
        iconTint={addMasterAlert.iconTint}
        title={addMasterAlert.title}
        subTitle={addMasterAlert.message}
        leftBtnText={addMasterAlert.confirmAddAnyway ? 'Review' : 'Close'}
        leftBtnTextColor={COLORS.colorDarkslategray}
        leftBtnBg="#F0F0F3"
        onLeftPress={closeAddMasterAlert}
        rightBtnText={addMasterAlert.confirmAddAnyway ? 'Add Anyway' : 'OK'}
        rightBtnTextColor={COLORS.WHITE}
        rightBtnBg={
          addMasterAlert.confirmAddAnyway
            ? COLORS.colorMediumslateblue
            : COLORS.ERROR
        }
        onRightPress={() => {
          if (addMasterAlert.confirmAddAnyway) {
            closeAddMasterAlert();
            void handleAddAndSelect(true);
            return;
          }

          closeAddMasterAlert();
        }}
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
