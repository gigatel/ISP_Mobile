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
  RefreshControl,
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
import {COLORS, IMAGES, SIZE} from '@res';
import {
  GetDrumNumbersByFiberTypeAPI,
  GetFiberMasterListAPI,
  GetSLDDetailsPaggiISPAPI,
  GetStateMasterAPI,
  GetZonesByStateIdAPI,
} from '@slices/route.slice';
import {Common, Location, Preferences} from '@utils';
import {useDispatch} from 'react-redux';
import PointerSvg from '../../res/images/pointer.svg';
import GoogleMapsIconSvg from '../../res/images/Google_Maps_icon.svg';
import {getReplacementFiberLabel} from '../../services/routeFiberChangeStorage';
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
  | 'state'
  | 'zone'
  | 'address';

type FormField = PickerKey | 'routeName' | 'location';
type RouteMode = 'withSld' | 'withoutSld';

const parseLatLng = (value: any): Coordinate | null => {
  const [latitude, longitude] = String(value ?? '')
    .split(',')
    .map(Number);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? {latitude, longitude}
    : null;
};

const distanceBetween = (first: Coordinate, second: Coordinate) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const lat = radians(second.latitude - first.latitude);
  const lng = radians(second.longitude - first.longitude);
  const calculation =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(lng / 2) ** 2;
  return (
    6371000 * 2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation))
  );
};

const getSldFiberLabel = (item: any) => {
  const fiberType = String(
    item?.fiberTypeName ??
      item?.FiberTypeName ??
      item?.fiberIdStr ??
      item?.FiberIdStr ??
      item?.fiberNameStr ??
      '',
  ).trim();
  const specification = String(
    item?.fiberSpecificationName ??
      item?.FiberSpecificationName ??
      item?.fiberName ??
      item?.FiberName ??
      '',
  ).trim();
  return getReplacementFiberLabel(fiberType, specification) || '--';
};

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
  state: 'Select State',
  zone: 'Select Zone',
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
    response?.data?.stateMaster,
    response?.data?.states,
    response?.data?.zones,
    response?.data?.data,
    response?.data?.result,
    response?.data?.items,
    response?.data,
    response?.result,
    response?.items,
    response?.records,
    response?.stateMaster,
    response?.states,
    response?.zones,
  ];

  return candidates.find(Array.isArray) ?? [];
};

const buildGeographyOptions = (
  response: any,
  kind: 'state' | 'zone',
): PickerOption[] =>
  getDropdownListFromResponse(response)
    .map((item, index): PickerOption | null => {
      const label = String(
        kind === 'state'
          ? item?.stateName ??
              item?.StateName ??
              item?.name ??
              item?.Name ??
              item?.state ??
              item?.State ??
              item?.label ??
              item?.text ??
              item?.Text ??
              ''
          : item?.zoneName ??
              item?.ZoneName ??
              item?.name ??
              item?.Name ??
              item?.zone ??
              item?.Zone ??
              item?.label ??
              item?.text ??
              item?.Text ??
              '',
      ).trim();
      const rawValue =
        kind === 'state'
          ? item?.stateId ??
            item?.StateId ??
            item?.stateID ??
            item?.StateID ??
            item?.id ??
            item?.Id ??
            item?.value ??
            item?.Value
          : item?.zoneId ??
            item?.ZoneId ??
            item?.zoneID ??
            item?.ZoneID ??
            item?.id ??
            item?.Id ??
            item?.value ??
            item?.Value;
      const value = String(rawValue ?? '').trim();
      return label && value ? {label, value: value || String(index)} : null;
    })
    .filter((option): option is PickerOption => option !== null)
    .filter(
      (option, index, options) =>
        options.findIndex(item => item.value === option.value) === index,
    );

const buildFiberOptions = (response: any): PickerOption[] => {
  const options = getDropdownListFromResponse(response)
    .map((item, index): PickerOption | null => {
      const fiberIdStr = getReplacementFiberLabel(
        item?.fiberIdStr ??
          item?.FiberIdStr ??
          item?.fiberIDStr ??
          item?.FiberIDStr ??
          '',
      );
      const fiberName = getReplacementFiberLabel(
        item?.fiberName ?? item?.FiberName ?? item?.name ?? item?.Name ?? '',
      );
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
  const focusedInputRef = useRef<'routeName' | null>(null);
  const fiberRequestInFlightRef = useRef(false);
  const drumRequestIdRef = useRef(0);
  const geographyRequestIdRef = useRef(0);
  const sldListRef = useRef<FlatList<any>>(null);

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
  const [stateOptions, setStateOptions] = useState<PickerOption[]>([]);
  const [stateId, setStateId] = useState<string | null>(null);
  const [zoneOptions, setZoneOptions] = useState<PickerOption[]>([]);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [stateLoadError, setStateLoadError] = useState('');
  const [zoneLoadError, setZoneLoadError] = useState('');
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(
    route.params?.currentPosition ?? null,
  );
  const [currentAddress, setCurrentAddress] = useState(
    route.params?.currentAddress ?? '',
  );
  const [addressOptions, setAddressOptions] = useState<PickerOption[]>([]);
  const [_isLocating, setIsLocating] = useState(!route.params?.currentPosition);
  const [_locationError, setLocationError] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [routeMode, setRouteMode] = useState<RouteMode>(
    route.params?.initialRouteMode ??
      (route.params?.selectedMaster
        ? 'withoutSld'
        : route.params?.asBottomSheet
        ? 'withSld'
        : 'withoutSld'),
  );
  const [sldRoutes, setSldRoutes] = useState<any[]>([]);
  const [sldSearch, setSldSearch] = useState('');
  const [sldPage, setSldPage] = useState(1);
  const [sldTotal, setSldTotal] = useState(0);
  const [sldLoading, setSldLoading] = useState(false);
  const [sldLoadingMore, setSldLoadingMore] = useState(false);
  const [sldPullRefreshing, setSldPullRefreshing] = useState(false);
  const [sldError, setSldError] = useState('');
  const [locationRange, setLocationRange] = useState(200);
  const [sldRefreshingLocation, setSldRefreshingLocation] = useState(false);
  const [sldScrollRequest, setSldScrollRequest] = useState(0);
  const sldRequestRef = useRef(0);
  const didStartSldSearchRef = useRef(false);

  useEffect(() => {
    if (route.params?.initialRouteMode) {
      setRouteMode(route.params.initialRouteMode);
    }
  }, [route.params?.initialRouteMode, route.params?.selectedMasterVersion]);

  const scrollToInput = useCallback(
    (field: 'routeName' | null, animated = true) => {
      formScrollRef.current?.scrollTo({y: field ? 42 : 0, animated});
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
    (field: 'routeName') => {
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

  const loadStateOptions = useCallback(async () => {
    if (stateOptions.length > 0 || isLoadingStates) {
      return;
    }
    try {
      setIsLoadingStates(true);
      setStateLoadError('');
      const response = await dispatch(GetStateMasterAPI()).unwrap();
      const options = buildGeographyOptions(response, 'state');
      if (!mountedRef.current) {
        return;
      }
      setStateOptions(options);
      if (options.length === 0) {
        setStateLoadError('No states are available.');
      }
    } catch (error: any) {
      if (!mountedRef.current) {
        return;
      }
      setStateOptions([]);
      setStateLoadError(error?.message || 'Unable to load states.');
    } finally {
      if (mountedRef.current) {
        setIsLoadingStates(false);
      }
    }
  }, [dispatch, isLoadingStates, stateOptions.length]);

  const loadZoneOptions = useCallback(
    async (selectedStateId: string) => {
      const requestId = ++geographyRequestIdRef.current;
      try {
        setIsLoadingZones(true);
        setZoneLoadError('');
        const response = await dispatch(
          GetZonesByStateIdAPI({stateId: selectedStateId}),
        ).unwrap();
        if (
          !mountedRef.current ||
          requestId !== geographyRequestIdRef.current
        ) {
          return;
        }
        const options = buildGeographyOptions(response, 'zone');
        setZoneOptions(options);
        if (options.length === 0) {
          setZoneLoadError('No zones are available for this state.');
        }
      } catch (error: any) {
        if (mountedRef.current && requestId === geographyRequestIdRef.current) {
          setZoneOptions([]);
          setZoneLoadError(error?.message || 'Unable to load zones.');
        }
      } finally {
        if (mountedRef.current && requestId === geographyRequestIdRef.current) {
          setIsLoadingZones(false);
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
        return await requestCoordinate(true, 12000, 120000);
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

    let resolvedCoordinate: Coordinate | null = null;
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
      resolvedCoordinate = coordinate;
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
      return coordinate;
    } catch (error: any) {
      if (!mountedRef.current) {
        return;
      }
      setLocationError(
        error?.message || 'Unable to get your current location. Tap retry.',
      );
      return resolvedCoordinate;
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

  const loadSldRoutes = useCallback(
    async (page: number, search: string, showFullLoader = true) => {
      const requestId = ++sldRequestRef.current;
      if (page === 1) {
        if (showFullLoader) {
          setSldLoading(true);
        }
      } else {
        setSldLoadingMore(true);
      }
      setSldError('');
      try {
        const response = await dispatch(
          GetSLDDetailsPaggiISPAPI({page, size: 10, search}),
        ).unwrap();
        if (!mountedRef.current || requestId !== sldRequestRef.current) {
          return null;
        }
        const rows = Array.isArray(response?.data) ? response.data : [];
        const total = Number(response?.recordsFiltered) || rows.length;
        setSldRoutes(previous =>
          page === 1
            ? rows
            : [...previous, ...rows].filter(
                (item, index, all) =>
                  all.findIndex(value => value.id === item.id) === index,
              ),
        );
        setSldPage(page);
        setSldTotal(total);
        return {rows, total};
      } catch (error: any) {
        if (mountedRef.current && requestId === sldRequestRef.current) {
          const message = error?.message || 'Unable to load SLD routes.';
          if (page === 1) {
            setSldError(message);
            setSldRoutes([]);
          } else {
            Common.showToast(message);
          }
        }
        return null;
      } finally {
        if (mountedRef.current && requestId === sldRequestRef.current) {
          setSldLoading(false);
          setSldLoadingMore(false);
        }
      }
    },
    [dispatch],
  );

  const refreshSldRoutes = useCallback(async () => {
    if (sldPullRefreshing) {
      return;
    }
    setSldPullRefreshing(true);
    try {
      await loadSldRoutes(1, sldSearch, false);
    } finally {
      if (mountedRef.current) {
        setSldPullRefreshing(false);
      }
    }
  }, [loadSldRoutes, sldPullRefreshing, sldSearch]);

  useEffect(() => {
    loadSldRoutes(1, '');
  }, [loadSldRoutes]); // Load the With SLD tab immediately when the sheet opens.

  useEffect(() => {
    const timer = setTimeout(() => loadSldRoutes(1, sldSearch), 350);
    if (!didStartSldSearchRef.current) {
      didStartSldSearchRef.current = true;
      clearTimeout(timer);
      return;
    }
    return () => clearTimeout(timer);
  }, [loadSldRoutes, sldSearch]);

  const refreshSldAtCurrentLocation = useCallback(async () => {
    if (sldRefreshingLocation) {
      return;
    }
    setSldRefreshingLocation(true);
    try {
      const coordinate = await loadCurrentLocation();
      if (!coordinate) {
        return;
      }
      const firstPage = await loadSldRoutes(1, sldSearch);
      if (!firstPage) {
        return;
      }
      const totalPages = Math.ceil(firstPage.total / 10);
      for (let page = 2; page <= totalPages; page += 1) {
        const nextPage = await loadSldRoutes(page, sldSearch);
        if (!nextPage) {
          break;
        }
      }
      setSldScrollRequest(value => value + 1);
    } finally {
      if (mountedRef.current) {
        setSldRefreshingLocation(false);
      }
    }
  }, [loadCurrentLocation, loadSldRoutes, sldRefreshingLocation, sldSearch]);

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
      case 'state':
        return stateOptions;
      case 'zone':
        return zoneOptions;
      case 'address':
        return addressOptions;
      default:
        return [];
    }
  }, [
    activePicker,
    addressOptions,
    drumOptions,
    fiberOptions,
    stateOptions,
    zoneOptions,
  ]);

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
      case 'state':
        return stateId;
      case 'zone':
        return zoneId;
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
    stateId,
    tubeCount,
    zoneId,
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
    if (key === 'zone' && !stateId) {
      Common.showToast('Please select a state first');
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
    if (key === 'state') {
      loadStateOptions();
    }
    if (
      key === 'zone' &&
      stateId &&
      zoneOptions.length === 0 &&
      !isLoadingZones
    ) {
      loadZoneOptions(stateId);
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
      case 'state':
        setStateId(option.value);
        setZoneId(null);
        setZoneOptions([]);
        setZoneLoadError('');
        clearError('state');
        clearError('zone');
        loadZoneOptions(option.value);
        break;
      case 'zone':
        setZoneId(option.value);
        clearError('zone');
        break;
      case 'address':
        setCurrentAddress(option.label);
        clearError('location');
        break;
    }

    setActivePicker(null);
  };

  const validate = () => {
    const nextErrors: Partial<Record<FormField, string>> = {};
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
    if (!stateId) {
      nextErrors.state = 'Select a state';
    }
    if (!zoneId) {
      nextErrors.zone = 'Select a zone';
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
        stateId,
        stateName: getOption(stateOptions, stateId)?.label,
        zoneId,
        zoneName: getOption(zoneOptions, zoneId)?.label,
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
    (activePicker === 'drum' && isLoadingDrums) ||
    (activePicker === 'state' && isLoadingStates) ||
    (activePicker === 'zone' && isLoadingZones);
  const pickerLoadingText =
    activePicker === 'drum'
      ? 'Loading drum numbers...'
      : activePicker === 'state'
      ? 'Loading states...'
      : activePicker === 'zone'
      ? 'Loading zones...'
      : 'Loading fiber types...';
  const pickerLoadError =
    activePicker === 'fiberType'
      ? fiberLoadError
      : activePicker === 'drum'
      ? drumLoadError
      : activePicker === 'state'
      ? stateLoadError
      : activePicker === 'zone'
      ? zoneLoadError
      : '';
  const retryActivePicker = () => {
    if (activePicker === 'fiberType') {
      loadFiberOptions(true);
    } else if (activePicker === 'drum' && fiberType) {
      loadDrumOptions(fiberType);
    } else if (activePicker === 'state') {
      loadStateOptions();
    } else if (activePicker === 'zone' && stateId) {
      loadZoneOptions(stateId);
    }
  };
  const isBottomSheet = Boolean(route.params?.asBottomSheet);
  const openSldInstallation = (item: any) => {
    navigation.navigate('Install-Fiber-With-SLD', {
      selectedSld: item,
      ...(currentPosition ? {currentPosition} : {}),
      ...(currentAddress ? {currentAddress} : {}),
    });
  };

  const openSldRouteMap = (item: any) => {
    const target = parseLatLng(item.toLatLng) ?? parseLatLng(item.fromLatLng);
    if (!target) {
      Common.showToast('Route location is unavailable');
      return;
    }
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${target.latitude},${target.longitude}`,
    ).catch(() => Common.showToast('Unable to open Google Maps'));
  };

  const nearestSldRouteIndex = useMemo(() => {
    if (!currentPosition || sldRoutes.length === 0) {
      return -1;
    }

    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    sldRoutes.forEach((item, index) => {
      const endpoints = [
        parseLatLng(item.fromLatLng),
        parseLatLng(item.toLatLng),
      ].filter((value): value is Coordinate => value !== null);
      if (endpoints.length === 0) {
        return;
      }
      const routeDistance = Math.min(
        ...endpoints.map(value => distanceBetween(currentPosition, value)),
      );
      if (routeDistance < nearestDistance) {
        nearestDistance = routeDistance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }, [currentPosition, sldRoutes]);

  useEffect(() => {
    if (nearestSldRouteIndex < 0 || routeMode !== 'withSld') {
      return;
    }
    const timer = setTimeout(() => {
      sldListRef.current?.scrollToOffset({
        offset: Math.max(
          0,
          nearestSldRouteIndex * SIZE.MVS(118) - SIZE.MVS(80),
        ),
        animated: true,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [nearestSldRouteIndex, routeMode, sldScrollRequest]);

  const renderSldRoute = ({item, index}: {item: any; index: number}) => {
    const showLocationPointer = index === nearestSldRouteIndex;
    const fiberLabel = getSldFiberLabel(item);
    const routeId = item.routeId ?? item.RouteId;
    return (
      <View style={styles.sldCardRow}>
        {showLocationPointer ? (
          <View
            accessibilityLabel={`Your current location is nearest to ${
              item.routeName || 'this route'
            }`}
            style={styles.sldPointer}>
            <PointerSvg width={SIZE.MS(25)} height={SIZE.MS(25)} />
          </View>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.82}
          accessibilityState={{selected: showLocationPointer}}
          onPress={() => openSldInstallation(item)}
          style={[
            styles.sldCard,
            showLocationPointer && styles.sldCurrentCard,
          ]}>
          <View style={styles.sldTitleRow}>
            <Text numberOfLines={1} style={styles.sldRouteName}>
              {item.routeName || item.sldCode || 'Unnamed Route'}
            </Text>
            <Text numberOfLines={1} style={styles.sldRouteId}>
              {routeId !== null && routeId !== undefined && routeId !== ''
                ? `Route#${routeId}`
                : item.sldCode || `SLD#${item.id}`}
            </Text>
            <View
              style={[
                styles.sldStatus,
                item.isActive === false && styles.sldStatusInactive,
              ]}>
              <Text style={styles.sldStatusText}>
                {item.isActive === false ? 'Inactive' : 'Active'}
              </Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.sldAddress}>
            From: {item.fromAddress || '--'}
          </Text>
          <Text numberOfLines={2} style={styles.sldAddress}>
            To: {item.toAddress || '--'}
          </Text>
          <View style={styles.sldFooterRow}>
            <Text style={[styles.sldMeta, styles.sldMetaCompact]}>
              Total Dist:{' '}
              <Text style={styles.sldMetaValue}>
                {Math.round(Number(item.totalDistance) || 0)}m
              </Text>
            </Text>
            <Text style={[styles.sldMeta, styles.sldMetaCompact]}>
              Drum no.{' '}
              <Text style={styles.sldMetaValue}>{item.drumNo || '--'}</Text>
            </Text>
            <Text numberOfLines={1} style={styles.sldFiberMeta}>
              Fiber Type: <Text style={styles.sldMetaValue}>{fiberLabel}</Text>
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Open ${
                item.routeName || 'route'
              } in Google Maps`}
              onPress={event => {
                event.stopPropagation();
                openSldRouteMap(item);
              }}
              style={styles.sldMapIcon}>
              <GoogleMapsIconSvg width={SIZE.MS(27)} height={SIZE.MS(27)} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Screen
      preset="fixed"
      keyboardAvoidingEnabled={
        routeMode === 'withSld' && isBottomSheet
          ? false
          : Platform.OS === 'ios' || (isBottomSheet && isKeyboardVisible)
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
              routeMode === 'withSld' &&
              styles.bottomSheetCardSld,
            isBottomSheet &&
              isKeyboardVisible &&
              routeMode !== 'withSld' &&
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

          {isBottomSheet ? (
            <View style={styles.sldTabs}>
              {(
                [
                  ['withSld', 'With SLD'],
                  ['withoutSld', 'Without SLD'],
                ] as [RouteMode, string][]
              ).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  activeOpacity={0.84}
                  onPress={() => {
                    Keyboard.dismiss();
                    setRouteMode(value);
                  }}
                  style={[
                    styles.sldTab,
                    routeMode === value && styles.sldTabActive,
                  ]}>
                  <Text
                    style={[
                      styles.sldTabText,
                      routeMode === value && styles.sldTabTextActive,
                    ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {routeMode === 'withSld' && isBottomSheet ? (
            <View style={styles.sldContent}>
              <View style={styles.sldTools}>
                <View style={styles.sldSearchShell}>
                  <Image source={IMAGES.search} style={styles.sldSearchIcon} />
                  <TextInput
                    value={sldSearch}
                    onChangeText={setSldSearch}
                    placeholder="Search Route"
                    placeholderTextColor="#9398A0"
                    returnKeyType="search"
                    style={styles.sldSearchInput}
                  />
                  {sldSearch ? (
                    <TouchableOpacity onPress={() => setSldSearch('')}>
                      <Text style={styles.sldSearchClear}>×</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.sldRangeControl}>
                  <TouchableOpacity
                    onPress={() =>
                      setLocationRange(value => Math.max(50, value - 50))
                    }
                    style={styles.sldRangeButton}>
                    <Text style={styles.sldRangeButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.sldRangeText}>{locationRange}m</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setLocationRange(value => Math.min(1000, value + 50))
                    }
                    style={styles.sldRangeButton}>
                    <Text style={styles.sldRangeButtonText}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {sldLoading ? (
                <View style={styles.sldState}>
                  <ActivityIndicator color={COLORS.PRIMARY} />
                  <Text style={styles.sldStateText}>Loading SLD routes...</Text>
                </View>
              ) : sldError ? (
                <View style={styles.sldState}>
                  <Text style={styles.sldStateText}>{sldError}</Text>
                  <TouchableOpacity onPress={() => loadSldRoutes(1, sldSearch)}>
                    <Text style={styles.sldRetryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.sldListWrap}>
                  <View pointerEvents="none" style={styles.sldTimelineLine} />
                  <FlatList
                    ref={sldListRef}
                    data={sldRoutes}
                    renderItem={renderSldRoute}
                    keyExtractor={item => String(item.id)}
                    contentContainerStyle={styles.sldList}
                    showsVerticalScrollIndicator={false}
                    alwaysBounceVertical
                    overScrollMode="always"
                    refreshControl={
                      <RefreshControl
                        refreshing={sldPullRefreshing}
                        onRefresh={refreshSldRoutes}
                        colors={[COLORS.PRIMARY]}
                        progressBackgroundColor={COLORS.WHITE}
                        tintColor={COLORS.PRIMARY}
                        title="Refreshing routes…"
                        titleColor={COLORS.PRIMARY}
                      />
                    }
                    onScrollToIndexFailed={() => undefined}
                    onEndReachedThreshold={0.35}
                    onEndReached={() => {
                      if (!sldLoadingMore && sldRoutes.length < sldTotal) {
                        loadSldRoutes(sldPage + 1, sldSearch);
                      }
                    }}
                    ListEmptyComponent={
                      <Text style={styles.sldEmptyText}>
                        No SLD routes found.
                      </Text>
                    }
                    ListFooterComponent={
                      sldLoadingMore ? (
                        <ActivityIndicator color={COLORS.PRIMARY} />
                      ) : null
                    }
                  />
                </View>
              )}
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={_isLocating || sldRefreshingLocation}
                onPress={refreshSldAtCurrentLocation}
                style={styles.sldWhereButton}>
                <LinearGradient
                  colors={['#8B59F8', '#6036C4']}
                  style={styles.sldWhereGradient}>
                  <Text style={styles.sldWhereText}>
                    {sldRefreshingLocation || _isLocating
                      ? 'Refreshing location...'
                      : 'Where I am?'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <>
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
                  <View style={styles.twoColumnRow}>
                    <View style={styles.column}>
                      <FieldLabel>State</FieldLabel>
                      <SelectField
                        value={getOption(stateOptions, stateId)?.label}
                        placeholder="Select State"
                        accessibilityLabel="Select state"
                        error={errors.state}
                        onPress={() => openPicker('state')}
                      />
                    </View>
                    <View style={styles.column}>
                      <FieldLabel>Zone</FieldLabel>
                      <SelectField
                        value={getOption(zoneOptions, zoneId)?.label}
                        placeholder={
                          stateId ? 'Select Zone' : 'Select State First'
                        }
                        accessibilityLabel="Select zone"
                        disabled={!stateId}
                        error={errors.zone}
                        onPress={() => openPicker('zone')}
                      />
                    </View>
                  </View>

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
                            <Text style={styles.stockText}>
                              {selectedDrum.meta}m
                            </Text>
                          </View>
                        ) : null}
                      </View>
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
                        {routeType === 'change-fiber'
                          ? 'Change Fiber'
                          : 'Add Route'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          )}
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
                          activePicker === 'address' ||
                          activePicker === 'state' ||
                          activePicker === 'zone'
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
