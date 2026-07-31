import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import LinearGradient from 'react-native-linear-gradient';
import {BackHeader} from '@molecules';
import {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {StoreDispatch} from '@reducers';
import {COLORS, IMAGES} from '@res';
import {
  GetDrumNumbersByFiberTypeAPI,
  GetFiberMasterListAPI,
} from '@slices/route.slice';
import {Common, Location, Preferences} from '@utils';
import {useDispatch} from 'react-redux';
import styles from './styles';

type Props = NativeStackScreenProps<RootStackParamList, 'AddRouteFiberScreen'>;

type Coordinate = {
  latitude: number;
  longitude: number;
};

type PickerOption = {
  label: string;
  value: string;
  meta?: string;
  fiberCount?: string;
  fiberSpecificationName?: string;
};

type PickerKey =
  | 'routeType'
  | 'fiberUsedBy'
  | 'fiberType'
  | 'armourType'
  | 'tubeCount'
  | 'coreCount'
  | 'drum'
  | 'address';

type FormField = PickerKey | 'routeName' | 'lengthToUse' | 'location';

const ROUTE_TYPES: PickerOption[] = [
  {label: 'New Route', value: 'new-route'},
  {label: 'Existing Route (Change Fiber)', value: 'change-fiber'},
  {label: 'Paused Route / UnSaved Route', value: 'paused-route'},
];

const FIBER_USED_BY_OPTIONS: PickerOption[] = [
  {label: 'Under Ground (UGIG)', value: 'UGIG'},
  {label: 'Overhead (OGIG)', value: 'OGIG'},
  {label: 'Third Party Route (TPGIG)', value: 'TPGIG'},
  {label: 'Customer Last Mile (CGIG)', value: 'CGIG'},
];

const ARMOUR_TYPES: PickerOption[] = [
  {label: 'Armoured', value: 'armored'},
  {label: 'Unarmoured', value: 'unarmored'},
];

const TUBE_COUNTS: PickerOption[] = ['1', '2', '4', '6', '8', '12'].map(
  value => ({label: value, value}),
);

const CORE_COUNTS: PickerOption[] = ['4', '6', '8', '12', '24'].map(value => ({
  label: value,
  value,
}));

const FIBER_DEFAULTS: Record<string, {tubes: string; cores: string}> = {
  '6': {tubes: '1', cores: '6'},
  '12': {tubes: '1', cores: '12'},
  '24': {tubes: '2', cores: '12'},
  '48': {tubes: '4', cores: '12'},
  '96': {tubes: '8', cores: '12'},
  '144': {tubes: '12', cores: '12'},
};

const pickerTitle: Record<PickerKey, string> = {
  routeType: 'Select Route Type',
  fiberUsedBy: 'Select Fiber Used By',
  fiberType: 'Select Fiber Type',
  armourType: 'Select Cable Type',
  tubeCount: 'Select No. of Tubes',
  coreCount: 'Select No. of Cores',
  drum: 'Select Drum',
  address: 'Select Current Address',
};

const getOption = (options: PickerOption[], value: string | null) =>
  options.find(option => option.value === value) ?? null;

const getArmourTypeFromSpecification = (value?: string): string | null => {
  const normalized = value?.toLowerCase().replace(/[\s_-]/g, '') ?? '';

  if (normalized.includes('unarmoured') || normalized.includes('unarmored')) {
    return 'unarmored';
  }
  if (normalized.includes('armoured') || normalized.includes('armored')) {
    return 'armored';
  }

  return null;
};

const getDropdownListFromResponse = (response: any): any[] => {
  if (Array.isArray(response)) {
    return response;
  }

  const candidates = [
    response?.data?.data,
    response?.data?.result,
    response?.data?.items,
    response?.data,
    response?.result,
    response?.items,
    response?.records,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const buildFiberOptions = (response: any): PickerOption[] => {
  const options = getDropdownListFromResponse(response)
    .map((item, index): PickerOption | null => {
      const fiberIdStr = String(
        item?.fiberIdStr ??
          item?.FiberIdStr ??
          item?.fiberIDStr ??
          item?.FiberIDStr ??
          '',
      ).trim();
      const fiberName = String(
        item?.fiberName ?? item?.FiberName ?? item?.name ?? item?.Name ?? '',
      ).trim();
      const id =
        item?.id ?? item?.Id ?? item?.fiberId ?? item?.FiberId ?? fiberIdStr;

      if (!fiberIdStr && !fiberName) {
        return null;
      }

      const label =
        fiberIdStr && fiberName && fiberIdStr !== fiberName
          ? `${fiberIdStr} - ${fiberName}`
          : fiberIdStr || fiberName;
      const fiberCount = `${fiberName} ${fiberIdStr}`.match(/\d+/)?.[0];
      const value =
        id !== undefined && id !== null && String(id).trim()
          ? String(id)
          : `${fiberIdStr || fiberName}-${index}`;

      return {
        label,
        value,
        ...(fiberCount ? {fiberCount} : {}),
      };
    })
    .filter((option): option is PickerOption => option !== null);

  return options.filter(
    (option, index, all) =>
      all.findIndex(item => item.value === option.value) === index,
  );
};

const buildDrumOptions = (response: any): PickerOption[] => {
  const options = getDropdownListFromResponse(response)
    .map((item, index): PickerOption | null => {
      const drumNo = String(
        typeof item === 'string' || typeof item === 'number'
          ? item
          : item?.drumNo ?? item?.DrumNo ?? '',
      ).trim();

      if (!drumNo) {
        return null;
      }

      const id =
        item?.id ??
        item?.Id ??
        item?.drumId ??
        item?.DrumId ??
        item?.drumNoId ??
        item?.DrumNoId;
      const availableLength =
        item?.drumLength ??
        item?.DrumLength ??
        item?.availableLength ??
        item?.AvailableLength ??
        item?.remainingLength ??
        item?.RemainingLength ??
        item?.balanceLength ??
        item?.BalanceLength;
      const fiberSpecificationName = String(
        item?.fiberSpecificationName ?? item?.FiberSpecificationName ?? '',
      ).trim();
      const value =
        id !== undefined && id !== null && String(id).trim()
          ? String(id)
          : `${drumNo}-${index}`;

      return {
        label: drumNo,
        value,
        ...(availableLength !== undefined && availableLength !== null
          ? {meta: String(availableLength)}
          : {}),
        ...(fiberSpecificationName ? {fiberSpecificationName} : {}),
      };
    })
    .filter((option): option is PickerOption => option !== null);

  return options.filter(
    (option, index, all) =>
      all.findIndex(item => item.value === option.value) === index,
  );
};

interface FieldLabelProps {
  children: React.ReactNode;
  required?: boolean;
}

const FieldLabel: FC<FieldLabelProps> = ({children, required = true}) => (
  <Text style={styles.label}>
    {children}
    {required ? <Text style={styles.required}> *</Text> : null}
  </Text>
);

interface SelectFieldProps {
  value?: string;
  placeholder: string;
  onPress: () => void;
  error?: string;
  accessibilityLabel: string;
  disabled?: boolean;
}

const SelectField: FC<SelectFieldProps> = ({
  value,
  placeholder,
  onPress,
  error,
  accessibilityLabel,
  disabled = false,
}) => (
  <>
    <TouchableOpacity
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.inputShell,
        disabled && styles.inputShellDisabled,
        error && styles.inputShellError,
      ]}>
      <Text
        numberOfLines={1}
        style={[
          styles.inputText,
          !value && styles.placeholderText,
          disabled && styles.inputTextDisabled,
        ]}>
        {value || placeholder}
      </Text>
      <Image
        source={IMAGES.down}
        style={[styles.chevron, disabled && styles.chevronDisabled]}
        resizeMode="contain"
      />
    </TouchableOpacity>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </>
);

const AddRouteFiberScreen: FC<Props> = ({navigation, route}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const formScrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);
  const focusedInputRef = useRef<'routeName' | 'lengthToUse' | null>(null);
  const fiberRequestInFlightRef = useRef(false);
  const drumRequestIdRef = useRef(0);

  const [activePicker, setActivePicker] = useState<PickerKey | null>(null);
  const [routeType, setRouteType] = useState<string | null>('new-route');
  const [draftRouteType, setDraftRouteType] = useState<string | null>(null);
  const [routeName, setRouteName] = useState('');
  const [fiberUsedBy, setFiberUsedBy] = useState<string | null>('UGIG');
  const [fiberType, setFiberType] = useState<string | null>(null);
  const [fiberOptions, setFiberOptions] = useState<PickerOption[]>([]);
  const [isLoadingFibers, setIsLoadingFibers] = useState(false);
  const [fiberLoadError, setFiberLoadError] = useState('');
  const [armourType, setArmourType] = useState<string | null>(null);
  const [tubeCount, setTubeCount] = useState('2');
  const [coreCount, setCoreCount] = useState('12');
  const [drum, setDrum] = useState<string | null>(null);
  const [drumOptions, setDrumOptions] = useState<PickerOption[]>([]);
  const [isLoadingDrums, setIsLoadingDrums] = useState(false);
  const [drumLoadError, setDrumLoadError] = useState('');
  const [lengthToUse, setLengthToUse] = useState('300');
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(
    route.params?.currentPosition ?? null,
  );
  const [currentAddress, setCurrentAddress] = useState(
    route.params?.currentAddress ?? '',
  );
  const [addressOptions, setAddressOptions] = useState<PickerOption[]>([]);
  const [_isLocating, setIsLocating] = useState(
    !route.params?.currentPosition,
  );
  const [_locationError, setLocationError] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});

  const scrollToInput = useCallback(
    (field: 'routeName' | 'lengthToUse' | null, animated = true) => {
      if (field === 'lengthToUse') {
        formScrollRef.current?.scrollToEnd({animated});
      } else {
        formScrollRef.current?.scrollTo({y: 42, animated});
      }
    },
    [],
  );

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      focusedInputRef.current = null;
      requestAnimationFrame(() => {
        formScrollRef.current?.scrollTo({y: 0, animated: false});
      });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isKeyboardVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        Keyboard.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [isKeyboardVisible]);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (isKeyboardVisible) {
          scrollToInput(focusedInputRef.current);
        } else {
          formScrollRef.current?.scrollTo({y: 0, animated: true});
        }
      },
      isKeyboardVisible ? 120 : 80,
    );

    return () => clearTimeout(timer);
  }, [isKeyboardVisible, scrollToInput]);

  const handleInputFocus = useCallback(
    (field: 'routeName' | 'lengthToUse') => {
      focusedInputRef.current = field;
      if (isKeyboardVisible) {
        requestAnimationFrame(() => scrollToInput(field));
      }
    },
    [isKeyboardVisible, scrollToInput],
  );

  const clearError = useCallback((field: FormField) => {
    setErrors(previous => {
      if (!previous[field]) {
        return previous;
      }
      const next = {...previous};
      delete next[field];
      return next;
    });
  }, []);

  const loadFiberOptions = useCallback(
    async (forceRefresh = false) => {
      if (
        fiberRequestInFlightRef.current ||
        (!forceRefresh && fiberOptions.length > 0)
      ) {
        return;
      }

      fiberRequestInFlightRef.current = true;
      setIsLoadingFibers(true);
      setFiberLoadError('');

      try {
        const response = await dispatch(GetFiberMasterListAPI()).unwrap();
        const options = buildFiberOptions(response);

        if (!mountedRef.current) {
          return;
        }

        if (options.length === 0) {
          setFiberOptions([]);
          setFiberLoadError('No fiber types are available');
          return;
        }

        setFiberOptions(options);
        setFiberType(previous =>
          previous && options.some(option => option.value === previous)
            ? previous
            : null,
        );
      } catch (error: any) {
        if (!mountedRef.current) {
          return;
        }

        setFiberOptions([]);
        setFiberLoadError(
          error?.message || 'Unable to load fiber types. Please retry.',
        );
      } finally {
        fiberRequestInFlightRef.current = false;
        if (mountedRef.current) {
          setIsLoadingFibers(false);
        }
      }
    },
    [dispatch, fiberOptions.length],
  );

  const loadDrumOptions = useCallback(
    async (fiberTypeId: string) => {
      const requestId = ++drumRequestIdRef.current;
      setIsLoadingDrums(true);
      setDrumLoadError('');

      try {
        const response = await dispatch(
          GetDrumNumbersByFiberTypeAPI({fiberTypeId}),
        ).unwrap();
        const options = buildDrumOptions(response);

        if (!mountedRef.current || requestId !== drumRequestIdRef.current) {
          return;
        }

        setDrumOptions(options);
        if (options.length === 0) {
          setDrumLoadError('No drums are available for this fiber type');
        }
      } catch (error: any) {
        if (!mountedRef.current || requestId !== drumRequestIdRef.current) {
          return;
        }

        setDrumOptions([]);
        setDrumLoadError(
          error?.message || 'Unable to load drum numbers. Please retry.',
        );
      } finally {
        if (mountedRef.current && requestId === drumRequestIdRef.current) {
          setIsLoadingDrums(false);
        }
      }
    },
    [dispatch],
  );

  const requestLocationPermission = useCallback(async () => {
    const permission =
      Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
        : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    let status = await check(permission);

    if (status === RESULTS.DENIED) {
      status = await request(permission);
    }

    if (status === RESULTS.BLOCKED) {
      Alert.alert(
        'Location Permission Required',
        'Enable location access in Settings to place this fiber route on the map.',
        [
          {text: 'Not Now', style: 'cancel'},
          {
            text: 'Open Settings',
            onPress: () => openSettings().catch(() => Linking.openSettings()),
          },
        ],
      );
    }

    return status === RESULTS.GRANTED || status === RESULTS.LIMITED;
  }, []);

  const requestCoordinate = useCallback(
    (enableHighAccuracy: boolean, timeout: number, maximumAge: number) =>
      new Promise<Coordinate>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position =>
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          reject,
          {
            enableHighAccuracy,
            timeout,
            maximumAge,
          },
        );
      }),
    [],
  );

  const getCurrentCoordinate = useCallback(async () => {
    try {
      return await requestCoordinate(true, 15000, 10000);
    } catch (highAccuracyError) {
      try {
        return await requestCoordinate(false, 12000, 120000);
      } catch {
        const cachedLocation = Preferences.getData('LAST_GEO_ADDRESS');
        const cachedCoordinate = {
          latitude: Number(cachedLocation?.lat),
          longitude: Number(cachedLocation?.long),
        };

        if (
          Number.isFinite(cachedCoordinate.latitude) &&
          Number.isFinite(cachedCoordinate.longitude) &&
          cachedCoordinate.latitude !== 0 &&
          cachedCoordinate.longitude !== 0
        ) {
          return cachedCoordinate;
        }

        throw highAccuracyError;
      }
    }
  }, [requestCoordinate]);

  const loadCurrentLocation = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    setIsLocating(true);
    setLocationError('');

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        throw new Error(
          'Location permission is required. Tap retry to continue.',
        );
      }

      const coordinate = await getCurrentCoordinate();
      if (!mountedRef.current) {
        return;
      }

      setCurrentPosition(coordinate);
      clearError('location');
      const geoAddress = await Location.getAddressWithLatLong(
        coordinate.latitude,
        coordinate.longitude,
      );
      if (!mountedRef.current) {
        return;
      }

      const uniqueAddresses = Array.from(
        new Set(
          [geoAddress?.address, ...(geoAddress?.addressList ?? [])]
            .map(value => String(value ?? '').trim())
            .filter(value => value && value !== 'Address Not Found'),
        ),
      );
      const fallback = `${coordinate.latitude.toFixed(
        6,
      )}, ${coordinate.longitude.toFixed(6)}`;
      const nextAddresses = uniqueAddresses.length
        ? uniqueAddresses
        : [fallback];
      const nextOptions = nextAddresses.map((value, index) => ({
        label: value,
        value: `address-${index}`,
      }));

      setAddressOptions(nextOptions);
      setCurrentAddress(nextOptions[0].label);
    } catch (error: any) {
      if (!mountedRef.current) {
        return;
      }
      setLocationError(
        error?.message || 'Unable to get your current location. Tap retry.',
      );
    } finally {
      if (mountedRef.current) {
        setIsLocating(false);
      }
    }
  }, [clearError, getCurrentCoordinate, requestLocationPermission]);

  useEffect(() => {
    if (!route.params?.currentPosition) {
      loadCurrentLocation();
    }
  }, [loadCurrentLocation, route.params?.currentPosition]);

  const selectedDrum = useMemo(
    () => getOption(drumOptions, drum),
    [drum, drumOptions],
  );
  const selectedFiber = useMemo(
    () => getOption(fiberOptions, fiberType),
    [fiberOptions, fiberType],
  );
  const activeOptions = useMemo(() => {
    switch (activePicker) {
      case 'routeType':
        return ROUTE_TYPES;
      case 'fiberUsedBy':
        return FIBER_USED_BY_OPTIONS;
      case 'fiberType':
        return fiberOptions;
      case 'armourType':
        return ARMOUR_TYPES;
      case 'tubeCount':
        return TUBE_COUNTS;
      case 'coreCount':
        return CORE_COUNTS;
      case 'drum':
        return drumOptions;
      case 'address':
        return addressOptions;
      default:
        return [];
    }
  }, [activePicker, addressOptions, drumOptions, fiberOptions]);

  const currentPickerValue = useMemo(() => {
    switch (activePicker) {
      case 'routeType':
        return routeType;
      case 'fiberUsedBy':
        return fiberUsedBy;
      case 'fiberType':
        return fiberType;
      case 'armourType':
        return armourType;
      case 'tubeCount':
        return tubeCount;
      case 'coreCount':
        return coreCount;
      case 'drum':
        return drum;
      case 'address':
        return (
          addressOptions.find(option => option.label === currentAddress)
            ?.value ?? null
        );
      default:
        return null;
    }
  }, [
    activePicker,
    addressOptions,
    armourType,
    coreCount,
    currentAddress,
    drum,
    fiberUsedBy,
    fiberType,
    routeType,
    tubeCount,
  ]);

  const openPicker = (key: PickerKey) => {
    if (key === 'address' && addressOptions.length === 0) {
      loadCurrentLocation();
      return;
    }
    if (key === 'drum' && !fiberType) {
      Common.showToast('Please select a fiber type first');
      return;
    }
    Keyboard.dismiss();
    if (key === 'routeType') {
      setDraftRouteType(routeType);
    }
    setActivePicker(key);
    if (key === 'fiberType') {
      loadFiberOptions();
    }
    if (
      key === 'drum' &&
      fiberType &&
      drumOptions.length === 0 &&
      !isLoadingDrums
    ) {
      loadDrumOptions(fiberType);
    }
  };

  const closePicker = () => {
    setDraftRouteType(routeType);
    setActivePicker(null);
  };

  const confirmRouteType = () => {
    if (!draftRouteType) {
      Common.showToast('Please select a route type');
      return;
    }

    setRouteType(draftRouteType);
    clearError('routeType');
    setActivePicker(null);

    if (draftRouteType === 'paused-route') {
      requestAnimationFrame(() => {
        navigation.navigate('Select-Paused-Route');
      });
    } else if (draftRouteType === 'change-fiber') {
      requestAnimationFrame(() => {
        navigation.navigate('Select-Route-To-Change-Fiber');
      });
    }
  };

  const selectPickerOption = (option: PickerOption) => {
    if (!activePicker) {
      return;
    }

    switch (activePicker) {
      case 'routeType':
        setDraftRouteType(option.value);
        return;
      case 'fiberUsedBy':
        setFiberUsedBy(option.value);
        clearError('fiberUsedBy');
        break;
      case 'fiberType': {
        setFiberType(option.value);
        setDrum(null);
        setArmourType(null);
        setDrumOptions([]);
        setDrumLoadError('');
        clearError('drum');
        loadDrumOptions(option.value);
        const defaults = option.fiberCount
          ? FIBER_DEFAULTS[option.fiberCount]
          : undefined;
        if (defaults) {
          setTubeCount(defaults.tubes);
          setCoreCount(defaults.cores);
          clearError('tubeCount');
          clearError('coreCount');
        }
        clearError('fiberType');
        break;
      }
      case 'armourType':
        setArmourType(option.value);
        clearError('armourType');
        break;
      case 'tubeCount':
        setTubeCount(option.value);
        clearError('tubeCount');
        break;
      case 'coreCount':
        setCoreCount(option.value);
        clearError('coreCount');
        break;
      case 'drum': {
        setDrum(option.value);
        const detectedArmourType = getArmourTypeFromSpecification(
          option.fiberSpecificationName,
        );
        setArmourType(detectedArmourType);
        if (detectedArmourType) {
          clearError('armourType');
        }
        clearError('drum');
        break;
      }
      case 'address':
        setCurrentAddress(option.label);
        clearError('location');
        break;
    }

    setActivePicker(null);
  };

  const validate = () => {
    const nextErrors: Partial<Record<FormField, string>> = {};
    const requestedLength = Number(lengthToUse);
    const availableLength = Number(selectedDrum?.meta ?? 0);

    if (!routeName.trim()) {
      nextErrors.routeName = 'Enter a route name';
    }
    if (!fiberType) {
      nextErrors.fiberType = 'Select a fiber type';
    }
    if (!armourType) {
      nextErrors.armourType = 'Select a cable type';
    }
    if (!tubeCount) {
      nextErrors.tubeCount = 'Select the number of tubes';
    }
    if (!coreCount) {
      nextErrors.coreCount = 'Select the number of cores';
    }
    if (!drum) {
      nextErrors.drum = 'Select an available drum';
    }
    if (!requestedLength || requestedLength <= 0) {
      nextErrors.lengthToUse = 'Enter a valid length';
    } else if (availableLength && requestedLength > availableLength) {
      nextErrors.lengthToUse = `Only ${availableLength}m is available`;
    }
    if (!currentPosition || !currentAddress) {
      nextErrors.location = 'Current location is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitRoute = () => {
    if (!validate() || !currentPosition) {
      Common.showToast('Please complete the required fields');
      return;
    }

    const makeRouteParams = {
      routeName: routeName.trim(),
      currentPosition,
      currentAddress,
      routeDraft: {
        routeType: 'new-route',
        routeName: routeName.trim(),
        fiberUsedBy,
        fiberUsedByName: getOption(FIBER_USED_BY_OPTIONS, fiberUsedBy)?.label,
        fiberTypeId: fiberType,
        fiberTypeName: selectedFiber?.label,
        fiberType: selectedFiber?.fiberCount
          ? `${selectedFiber.fiberCount}F`
          : selectedFiber?.label,
        fibreSpecification: getOption(ARMOUR_TYPES, armourType)?.label,
        tubeCount,
        coreCount,
        drumId: drum,
        drumNo: selectedDrum?.label,
        drumLength: selectedDrum?.meta,
        lengthToUse,
      },
      selectedMaster: route.params?.selectedMaster,
      selectedMasterVersion: route.params?.selectedMasterVersion,
    };

    Keyboard.dismiss();
    if (route.params?.asBottomSheet) {
      (navigation as any).popTo('Route-Master-Hub', {
        currentPosition,
        currentAddress,
        pendingMakeRoute: makeRouteParams,
        pendingMakeRouteVersion: `${Date.now()}`,
      });
    } else {
      navigation.navigate('Make-Route', makeRouteParams);
    }
  };

  const renderPickerItem = ({item}: {item: PickerOption}) => {
    const selected = item.value === currentPickerValue;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => selectPickerOption(item)}
        style={[styles.optionRow, selected && styles.optionRowSelected]}>
        <View style={styles.optionCopy}>
          <Text
            style={[styles.optionText, selected && styles.optionTextSelected]}>
            {item.label}
          </Text>
          {activePicker === 'drum' && item.meta ? (
            <Text style={styles.optionMeta}>{item.meta}m available</Text>
          ) : null}
        </View>
        <View
          style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const isPickerLoading =
    (activePicker === 'fiberType' && isLoadingFibers) ||
    (activePicker === 'drum' && isLoadingDrums);
  const pickerLoadingText =
    activePicker === 'drum'
      ? 'Loading drum numbers...'
      : 'Loading fiber types...';
  const pickerLoadError =
    activePicker === 'fiberType'
      ? fiberLoadError
      : activePicker === 'drum'
      ? drumLoadError
      : '';
  const retryActivePicker = () => {
    if (activePicker === 'fiberType') {
      loadFiberOptions(true);
    } else if (activePicker === 'drum' && fiberType) {
      loadDrumOptions(fiberType);
    }
  };
  const isBottomSheet = Boolean(route.params?.asBottomSheet);

  return (
    <Screen
      preset="fixed"
      keyboardAvoidingEnabled={
        Platform.OS === 'ios' || (isBottomSheet && isKeyboardVisible)
      }
      statusBgColor={isBottomSheet ? 'transparent' : COLORS.PRIMARY}
      navBarColor={isBottomSheet ? 'transparent' : COLORS.WHITE}
      isSafeArea={!isBottomSheet}
      isNavSafeArea={!isBottomSheet}
      translucent={isBottomSheet}>
      <View
        style={[
          styles.presentationRoot,
          isBottomSheet && styles.bottomSheetOverlay,
        ]}>
        {isBottomSheet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close add new route"
            onPress={() => navigation.goBack()}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        <View
          style={[
            styles.screen,
            isBottomSheet && styles.bottomSheetCard,
            isBottomSheet &&
              isKeyboardVisible &&
              styles.bottomSheetCardKeyboard,
          ]}>
          {isBottomSheet ? (
            <View style={styles.bottomSheetHeader}>
              <View style={styles.bottomSheetHandle} />
              <Text style={styles.bottomSheetTitle}>Add New Route</Text>
            </View>
          ) : (
            <BackHeader
              title="Add New Route"
              onBackPress={() => navigation.goBack()}
              showGps={false}
            />
          )}

        <ScrollView
          ref={formScrollRef}
          style={[
            styles.formArea,
            isBottomSheet && styles.bottomSheetFormArea,
          ]}
          contentContainerStyle={[
            styles.formScrollContent,
            isKeyboardVisible && styles.formScrollContentKeyboard,
          ]}
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.formCard}>
            <View style={styles.fullField}>
              <FieldLabel>Route Name</FieldLabel>
              <View
                style={[
                  styles.inputShell,
                  errors.routeName && styles.inputShellError,
                ]}>
                <TextInput
                  value={routeName}
                  onChangeText={value => {
                    setRouteName(value);
                    clearError('routeName');
                  }}
                  placeholder="Enter Route Name"
                  placeholderTextColor="#92969D"
                  style={styles.textInput}
                  maxLength={80}
                  onFocus={() => handleInputFocus('routeName')}
                  onSubmitEditing={Keyboard.dismiss}
                  returnKeyType="done"
                />
              </View>
              {errors.routeName ? (
                <Text style={styles.errorText}>{errors.routeName}</Text>
              ) : null}
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <FieldLabel>Select Fiber Type</FieldLabel>
                <SelectField
                  value={getOption(fiberOptions, fiberType)?.label}
                  placeholder="Select Fiber Type"
                  accessibilityLabel="Select fiber type"
                  error={errors.fiberType}
                  onPress={() => openPicker('fiberType')}
                />
              </View>
              <View style={styles.column}>
                <FieldLabel>Armoured/Unarmoured</FieldLabel>
                <SelectField
                  value={getOption(ARMOUR_TYPES, armourType)?.label}
                  placeholder="Select"
                  accessibilityLabel="Select armoured or unarmoured cable"
                  error={errors.armourType}
                  onPress={() => openPicker('armourType')}
                />
              </View>
            </View>

            <View style={styles.twoColumnRow}>
              <View style={styles.column}>
                <FieldLabel required={false}>No. of Tubes</FieldLabel>
                <SelectField
                  value={getOption(TUBE_COUNTS, tubeCount)?.label}
                  placeholder="Select"
                  accessibilityLabel="Number of tubes, read only"
                  error={errors.tubeCount}
                  disabled
                  onPress={() => openPicker('tubeCount')}
                />
              </View>
              <View style={styles.column}>
                <FieldLabel required={false}>No. of Cores</FieldLabel>
                <SelectField
                  value={getOption(CORE_COUNTS, coreCount)?.label}
                  placeholder="Select"
                  accessibilityLabel="Number of cores, read only"
                  error={errors.coreCount}
                  disabled
                  onPress={() => openPicker('coreCount')}
                />
              </View>
            </View>

            <View style={styles.drumLengthRow}>
              <View style={styles.drumColumn}>
                <FieldLabel>Available Drum Name / No.</FieldLabel>
                <View style={styles.drumControlRow}>
                  <View style={styles.drumPickerWrap}>
                    <SelectField
                      value={selectedDrum?.label}
                      placeholder="Select Drum"
                      accessibilityLabel="Select available fiber drum"
                      error={errors.drum}
                      onPress={() => openPicker('drum')}
                    />
                  </View>
                  {selectedDrum?.meta ? (
                    <View style={styles.stockPill}>
                      <Text style={styles.stockText}>{selectedDrum.meta}m</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.lengthColumn}>
                <FieldLabel>Length to Use</FieldLabel>
                <View
                  style={[
                    styles.inputShell,
                    styles.lengthInputShell,
                    errors.lengthToUse && styles.inputShellError,
                  ]}>
                  <TextInput
                    value={lengthToUse}
                    onChangeText={value => {
                      setLengthToUse(value.replace(/[^0-9]/g, ''));
                      clearError('lengthToUse');
                    }}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#92969D"
                    style={styles.lengthInput}
                    maxLength={5}
                    onFocus={() => handleInputFocus('lengthToUse')}
                    onSubmitEditing={Keyboard.dismiss}
                    returnKeyType="done"
                  />
                  <Text style={styles.unitText}>m</Text>
                </View>
                {errors.lengthToUse ? (
                  <Text style={styles.errorText}>{errors.lengthToUse}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>

        {!isKeyboardVisible ? (
          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => navigation.goBack()}
              style={styles.footerButton}>
              <LinearGradient
                colors={['#777A7E', '#4C4F52']}
                style={styles.footerGradient}>
                <Text style={styles.footerButtonText}>Back</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={submitRoute}
              style={styles.footerButton}>
              <LinearGradient
                colors={['#8B59F8', '#6036C4']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.footerGradient}>
                <Text style={styles.footerButtonText}>
                  {routeType === 'change-fiber' ? 'Change Fiber' : 'Add Route'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closePicker}>
        <Pressable style={styles.modalOverlay} onPress={closePicker}>
          <Pressable
            style={[
              styles.pickerSheet,
              activePicker === 'routeType' && styles.routeTypePickerSheet,
            ]}
            onPress={() => undefined}>
            {activePicker === 'routeType' ? (
              <>
                <View style={styles.routeTypeHeader}>
                  <Text style={styles.routeTypeTitle}>Select Route Type</Text>
                </View>

                <View style={styles.routeTypeOptionsCard}>
                  {ROUTE_TYPES.map((option, index) => {
                    const selected = draftRouteType === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        activeOpacity={0.7}
                        onPress={() => setDraftRouteType(option.value)}
                        style={[
                          styles.routeTypeOptionRow,
                          index < ROUTE_TYPES.length - 1 &&
                            styles.routeTypeOptionBorder,
                        ]}>
                        <View
                          style={[
                            styles.routeTypeRadio,
                            selected && styles.routeTypeRadioSelected,
                          ]}>
                          {selected ? (
                            <View style={styles.routeTypeRadioInner} />
                          ) : null}
                        </View>
                        <Text style={styles.routeTypeOptionText}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.routeTypeActions}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={closePicker}
                    style={styles.routeTypeActionButton}>
                    <LinearGradient
                      colors={['#73777A', '#4D5053']}
                      style={styles.routeTypeActionGradient}>
                      <Text style={styles.routeTypeActionText}>Close</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={confirmRouteType}
                    style={styles.routeTypeActionButton}>
                    <LinearGradient
                      colors={['#8B59F8', '#6036C4']}
                      start={{x: 0, y: 0}}
                      end={{x: 1, y: 1}}
                      style={styles.routeTypeActionGradient}>
                      <Text style={styles.routeTypeActionText}>Select</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.sheetHandle} />
                <View style={styles.pickerHeader}>
                  <View style={styles.pickerTitleRow}>
                    <Image
                      source={
                        activePicker === 'address'
                          ? IMAGES.mapLocation
                          : IMAGES.FiberEnclosur
                      }
                      style={styles.pickerTitleIcon}
                      resizeMode="contain"
                    />
                    <Text style={styles.pickerTitle}>
                      {activePicker ? pickerTitle[activePicker] : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                    onPress={closePicker}>
                    <Image
                      source={IMAGES.close}
                      style={styles.pickerCloseIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
                {isPickerLoading ? (
                  <View style={styles.pickerFeedback}>
                    <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                    <Text style={styles.pickerFeedbackText}>
                      {pickerLoadingText}
                    </Text>
                  </View>
                ) : pickerLoadError ? (
                  <View style={styles.pickerFeedback}>
                    <Text style={styles.pickerFeedbackText}>
                      {pickerLoadError}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={retryActivePicker}
                      style={styles.pickerRetryButton}>
                      <Text style={styles.pickerRetryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    data={activeOptions}
                    renderItem={renderPickerItem}
                    keyExtractor={item => item.value}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                      styles.optionsList,
                      activeOptions.length === 0 && styles.optionsListEmpty,
                    ]}
                    ListEmptyComponent={
                      <Text style={styles.pickerFeedbackText}>
                        No options available
                      </Text>
                    }
                  />
                )}
              </>
            )}
          </Pressable>
        </Pressable>
        </Modal>
      </View>
    </Screen>
  );
};

export default AddRouteFiberScreen;
