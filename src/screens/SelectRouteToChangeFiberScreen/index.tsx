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
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {useDispatch} from 'react-redux';
import {BackHeader} from '@molecules';
import type {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {StoreDispatch} from '@reducers';
import {COLORS, IMAGES, SIZE} from '@res';
import {
  GetDrumNumbersByFiberTypeAPI,
  GetFiberMasterListAPI,
  GetRouteDetailsPaggiAPI,
} from '@slices/route.slice';
import {Common, Location} from '@utils';
import {
  appendRouteFiberSelection,
  getRouteFiberSelections,
  StoredRouteFiberSelection,
} from '../../services/routeFiberChangeStorage';
import PointerSvg from '../../res/images/pointer.svg';
import GoogleMapsIconSvg from '../../res/images/Google_Maps_icon.svg';
import styles from './styles';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'Select-Route-To-Change-Fiber'
>;

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RouteDetails = {
  routeId: number;
  routeIdStr?: string;
  routeName?: string;
  totalDistance?: number;
  routeLength?: number;
  startLatLng?: string;
  startAddress?: string;
  endLatLng?: string;
  endAddress?: string;
  isActive?: boolean;
  fiberTypeName?: string;
  fiberIdStr?: string;
  fibreType?: string;
  [key: string]: any;
};

type FiberOption = {
  label: string;
  value: string;
  fiberCount?: string;
};

type DrumOption = {
  label: string;
  value: string;
  availableLength: number;
  fiberSpecificationName?: string;
};

type PickerMode = 'fiber' | 'armour' | 'drum' | null;

type PickerItem = {
  label: string;
  value: string;
  meta?: string;
};

type RouteListRow = {
  type: 'route';
  key: string;
  route: RouteDetails;
  isNearest: boolean;
};

type CurrentPositionFix = Coordinate & {accuracy: number};

const PAGE_SIZE = 10;
const ARMOUR_OPTIONS: PickerItem[] = [
  {label: 'Armoured', value: 'armoured'},
  {label: 'Unarmoured', value: 'unarmoured'},
];

const FIBER_DEFAULTS: Record<string, {tubes: string; cores: string}> = {
  '6': {tubes: '1', cores: '6'},
  '12': {tubes: '1', cores: '12'},
  '24': {tubes: '2', cores: '12'},
  '48': {tubes: '4', cores: '12'},
  '96': {tubes: '8', cores: '12'},
  '144': {tubes: '12', cores: '12'},
};

const asText = (value: unknown) => String(value ?? '').trim();

const getListFromResponse = (response: any): any[] => {
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

const buildFiberOptions = (response: any): FiberOption[] =>
  getListFromResponse(response)
    .map((item, index): FiberOption | null => {
      const fiberIdStr = asText(
        item?.fiberIdStr ?? item?.FiberIdStr ?? item?.fiberIDStr,
      );
      const fiberName = asText(
        item?.fiberName ?? item?.FiberName ?? item?.name ?? item?.Name,
      );
      if (!fiberIdStr && !fiberName) {
        return null;
      }

      const id =
        item?.id ?? item?.Id ?? item?.fiberId ?? item?.FiberId ?? fiberIdStr;
      const label =
        fiberIdStr && fiberName && fiberIdStr !== fiberName
          ? `${fiberIdStr} - ${fiberName}`
          : fiberIdStr || fiberName;
      const fiberCount =
        fiberName.match(/\d+/)?.[0] ?? fiberIdStr.match(/(\d+)\s*F\b/i)?.[1];

      return {
        label,
        value: asText(id) || `${label}-${index}`,
        ...(fiberCount ? {fiberCount} : {}),
      };
    })
    .filter((item): item is FiberOption => item !== null)
    .filter(
      (item, index, items) =>
        items.findIndex(option => option.value === item.value) === index,
    );

const buildDrumOptions = (response: any): DrumOption[] =>
  getListFromResponse(response)
    .map((item, index): DrumOption | null => {
      const label = asText(
        typeof item === 'string' || typeof item === 'number'
          ? item
          : item?.drumNo ?? item?.DrumNo,
      );
      if (!label) {
        return null;
      }

      const id =
        item?.id ??
        item?.Id ??
        item?.drumId ??
        item?.DrumId ??
        item?.drumNoId ??
        item?.DrumNoId ??
        `${label}-${index}`;
      const availableLength = Number(
        item?.drumLength ??
          item?.DrumLength ??
          item?.availableLength ??
          item?.AvailableLength ??
          item?.remainingLength ??
          item?.RemainingLength ??
          0,
      );
      const fiberSpecificationName = asText(
        item?.fiberSpecificationName ?? item?.FiberSpecificationName,
      );

      return {
        label,
        value: String(id),
        availableLength: Number.isFinite(availableLength) ? availableLength : 0,
        ...(fiberSpecificationName ? {fiberSpecificationName} : {}),
      };
    })
    .filter((item): item is DrumOption => item !== null)
    .filter(
      (item, index, items) =>
        items.findIndex(option => option.value === item.value) === index,
    );

const getArmourValue = (value?: string) => {
  const normalized = asText(value)
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  if (normalized.includes('unarmoured') || normalized.includes('unarmored')) {
    return 'unarmoured';
  }
  if (normalized.includes('armoured') || normalized.includes('armored')) {
    return 'armoured';
  }
  return '';
};

const parseCoordinate = (value?: string): Coordinate | null => {
  const parts = asText(value)
    .split(',')
    .map(item => Number(item.trim()));
  if (
    parts.length < 2 ||
    !Number.isFinite(parts[0]) ||
    !Number.isFinite(parts[1]) ||
    Math.abs(parts[0]) > 90 ||
    Math.abs(parts[1]) > 180
  ) {
    return null;
  }
  return {latitude: parts[0], longitude: parts[1]};
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceBetween = (from: Coordinate, to: Coordinate) => {
  const radius = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const safeValue = Math.min(1, Math.max(0, value));
  return (
    radius * 2 * Math.atan2(Math.sqrt(safeValue), Math.sqrt(1 - safeValue))
  );
};

const distanceToRoute = (position: Coordinate, route: RouteDetails) => {
  const coordinates = [
    parseCoordinate(route.startLatLng),
    parseCoordinate(route.endLatLng),
  ].filter((item): item is Coordinate => item !== null);

  if (coordinates.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.min(
    ...coordinates.map(coordinate => distanceBetween(position, coordinate)),
  );
};

const requestCurrentPosition = ({
  enableHighAccuracy,
  timeout,
  maximumAge,
}: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}) =>
  new Promise<CurrentPositionFix>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number(position.coords.accuracy) || Number.MAX_VALUE,
        }),
      reject,
      {enableHighAccuracy, timeout, maximumAge},
    );
  });

const SelectRouteToChangeFiberScreen: FC<Props> = ({navigation}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const listRef = useRef<FlatList<RouteListRow>>(null);
  const routeRequestRef = useRef(0);
  const locationRequestRef = useRef(0);

  const [routes, setRoutes] = useState<RouteDetails[]>([]);
  const [searchText, setSearchText] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [range, setRange] = useState(200);
  const [page, setPage] = useState(1);
  const [recordCount, setRecordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(
    null,
  );
  const [isLocating, setIsLocating] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<RouteDetails | null>(null);
  const [fiberOptions, setFiberOptions] = useState<FiberOption[]>([]);
  const [fiberId, setFiberId] = useState('');
  const [armourValue, setArmourValue] = useState('');
  const [tubeCount, setTubeCount] = useState('');
  const [coreCount, setCoreCount] = useState('');
  const [drumOptions, setDrumOptions] = useState<DrumOption[]>([]);
  const [drumId, setDrumId] = useState('');
  const [lengthToUse, setLengthToUse] = useState('300');
  const [isLoadingFibers, setIsLoadingFibers] = useState(false);
  const [isLoadingDrums, setIsLoadingDrums] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [fiberSelections, setFiberSelections] = useState<
    Record<number, StoredRouteFiberSelection[]>
  >({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setServerSearch(searchText.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const loadRoutes = useCallback(
    async (nextPage: number, search: string, replace: boolean) => {
      const requestId = ++routeRequestRef.current;
      if (replace) {
        setIsLoading(true);
        setLoadError('');
      } else {
        setIsLoadingMore(true);
      }

      try {
        const response = await dispatch(
          GetRouteDetailsPaggiAPI({
            page: nextPage,
            size: PAGE_SIZE,
            search,
          }),
        ).unwrap();

        if (requestId !== routeRequestRef.current) {
          return;
        }

        const activeRoutes: RouteDetails[] = (
          Array.isArray(response?.data) ? response.data : []
        ).filter((route: RouteDetails) => route?.isActive !== false);

        setFiberSelections(previous => {
          const next = {...previous};
          activeRoutes.forEach(route => {
            next[route.routeId] = getRouteFiberSelections(
              route.routeId,
              route.routeName,
            );
          });
          return next;
        });

        setRoutes(previous => {
          const combined = replace
            ? activeRoutes
            : [...previous, ...activeRoutes];
          return combined.filter(
            (route, index, all) =>
              all.findIndex(item => item.routeId === route.routeId) === index,
          );
        });
        setPage(nextPage);
        setRecordCount(
          Number(response?.recordsFiltered ?? response?.recordsTotal) || 0,
        );
      } catch (error: any) {
        if (requestId === routeRequestRef.current) {
          setLoadError(error?.message || 'Unable to load active routes.');
          if (replace) {
            setRoutes([]);
          }
        }
      } finally {
        if (requestId === routeRequestRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [dispatch],
  );

  useFocusEffect(
    useCallback(() => {
      loadRoutes(1, serverSearch, true);
      return () => {
        routeRequestRef.current += 1;
        locationRequestRef.current += 1;
      };
    }, [loadRoutes, serverSearch]),
  );

  const nearestRouteIndex = useMemo(() => {
    if (!currentPosition || routes.length === 0) {
      return -1;
    }
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    routes.forEach((route, index) => {
      const distance = distanceToRoute(currentPosition, route);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }, [currentPosition, routes]);

  const listRows = useMemo<RouteListRow[]>(() => {
    return routes.map((route, index) => ({
      type: 'route',
      key: `route-${route.routeId}`,
      route,
      isNearest: Boolean(currentPosition && index === nearestRouteIndex),
    }));
  }, [currentPosition, nearestRouteIndex, routes]);

  useEffect(() => {
    if (!currentPosition || nearestRouteIndex < 0) {
      return;
    }

    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: nearestRouteIndex,
        animated: true,
        viewPosition: 0.45,
      });
    }, 180);

    return () => clearTimeout(timer);
  }, [currentPosition, nearestRouteIndex]);

  const showCurrentLocation = async () => {
    if (isLocating) {
      return;
    }

    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;

    try {
      setIsLocating(true);
      if (Platform.OS === 'android' && !(await Location.checkGps())) {
        throw new Error('Location services are disabled.');
      }

      let bestAccuracy = Number.POSITIVE_INFINITY;
      let hasPosition = false;

      await new Promise<void>((resolve, reject) => {
        let failures = 0;
        const handleFailure = (error: unknown) => {
          failures += 1;
          if (failures === 2 && !hasPosition) {
            reject(error);
          }
        };
        const showPosition = (fix: CurrentPositionFix) => {
          if (locationRequestRef.current !== requestId) {
            resolve();
            return;
          }
          if (
            !Number.isFinite(fix.latitude) ||
            !Number.isFinite(fix.longitude)
          ) {
            handleFailure(new Error('Invalid device location.'));
            return;
          }

          const isFirst = !hasPosition;
          if (!isFirst && fix.accuracy >= bestAccuracy) {
            return;
          }
          hasPosition = true;
          bestAccuracy = fix.accuracy;
          const position = {
            latitude: fix.latitude,
            longitude: fix.longitude,
          };
          setCurrentPosition(position);
          if (isFirst) {
            resolve();
          }
        };

        requestCurrentPosition({
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000,
        }).then(showPosition, handleFailure);
        requestCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }).then(showPosition, handleFailure);
      });
    } catch (error: any) {
      Alert.alert(
        'Current Location',
        error?.message || 'Unable to get your current location.',
      );
    } finally {
      if (locationRequestRef.current === requestId) {
        setIsLocating(false);
      }
    }
  };

  const loadFiberOptions = useCallback(async () => {
    if (fiberOptions.length > 0 || isLoadingFibers) {
      return;
    }
    try {
      setIsLoadingFibers(true);
      const response = await dispatch(GetFiberMasterListAPI()).unwrap();
      const options = buildFiberOptions(response);
      setFiberOptions(options);
      if (options.length === 0) {
        setSheetError('No fiber types are available.');
      }
    } catch (error: any) {
      setSheetError(error?.message || 'Unable to load fiber types.');
    } finally {
      setIsLoadingFibers(false);
    }
  }, [dispatch, fiberOptions.length, isLoadingFibers]);

  const loadDrumOptions = useCallback(
    async (selectedFiberId: string) => {
      try {
        setIsLoadingDrums(true);
        setSheetError('');
        const response = await dispatch(
          GetDrumNumbersByFiberTypeAPI({fiberTypeId: selectedFiberId}),
        ).unwrap();
        const options = buildDrumOptions(response);
        setDrumOptions(options);
        if (options.length === 0) {
          setSheetError('No drums are available for this fiber type.');
        }
      } catch (error: any) {
        setDrumOptions([]);
        setSheetError(error?.message || 'Unable to load drum numbers.');
      } finally {
        setIsLoadingDrums(false);
      }
    },
    [dispatch],
  );

  const openFiberSheet = (route: RouteDetails) => {
    setSelectedRoute(route);
    setFiberId('');
    setArmourValue('');
    setTubeCount('');
    setCoreCount('');
    setDrumId('');
    setDrumOptions([]);
    setLengthToUse('300');
    setSheetError('');
    loadFiberOptions();
  };

  const selectedFiber = useMemo(
    () => fiberOptions.find(option => option.value === fiberId) ?? null,
    [fiberId, fiberOptions],
  );
  const selectedDrum = useMemo(
    () => drumOptions.find(option => option.value === drumId) ?? null,
    [drumId, drumOptions],
  );
  const selectedArmour = useMemo(
    () => ARMOUR_OPTIONS.find(option => option.value === armourValue) ?? null,
    [armourValue],
  );

  const selectPickerItem = (item: PickerItem) => {
    if (pickerMode === 'fiber') {
      const fiber = fiberOptions.find(option => option.value === item.value);
      setFiberId(item.value);
      setDrumId('');
      setDrumOptions([]);
      setArmourValue('');
      const defaults = fiber?.fiberCount
        ? FIBER_DEFAULTS[fiber.fiberCount]
        : undefined;
      setTubeCount(defaults?.tubes ?? '');
      setCoreCount(defaults?.cores ?? '');
      loadDrumOptions(item.value);
    } else if (pickerMode === 'armour') {
      setArmourValue(item.value);
    } else if (pickerMode === 'drum') {
      const drum = drumOptions.find(option => option.value === item.value);
      setDrumId(item.value);
      const detectedArmour = getArmourValue(drum?.fiberSpecificationName);
      if (detectedArmour) {
        setArmourValue(detectedArmour);
      }
      if (drum?.availableLength && Number(lengthToUse) > drum.availableLength) {
        setLengthToUse(String(Math.min(300, drum.availableLength)));
      }
    }
    setSheetError('');
    setPickerMode(null);
  };

  const pickerItems = useMemo<PickerItem[]>(() => {
    if (pickerMode === 'fiber') {
      return fiberOptions;
    }
    if (pickerMode === 'armour') {
      return ARMOUR_OPTIONS;
    }
    if (pickerMode === 'drum') {
      return drumOptions.map(option => ({
        label: option.label,
        value: option.value,
        meta: option.availableLength ? `${option.availableLength}m` : '',
      }));
    }
    return [];
  }, [drumOptions, fiberOptions, pickerMode]);

  const pickerTitle =
    pickerMode === 'fiber'
      ? 'Select Fiber Type'
      : pickerMode === 'armour'
      ? 'Select Cable Type'
      : 'Select Drum';

  const confirmFiberSelection = () => {
    const requestedLength = Number(lengthToUse);
    if (!selectedRoute || !selectedFiber) {
      setSheetError('Select a fiber type.');
      return;
    }
    if (!selectedArmour) {
      setSheetError('Select Armoured or Unarmoured.');
      return;
    }
    if (!tubeCount || !coreCount) {
      setSheetError('Tube and core details are unavailable for this fiber.');
      return;
    }
    if (!selectedDrum) {
      setSheetError('Select an available drum.');
      return;
    }
    if (!requestedLength || requestedLength <= 0) {
      setSheetError('Enter a valid length to use.');
      return;
    }
    if (
      selectedDrum.availableLength > 0 &&
      requestedLength > selectedDrum.availableLength
    ) {
      setSheetError(
        `Only ${selectedDrum.availableLength}m is available in this drum.`,
      );
      return;
    }

    const nextFibers = appendRouteFiberSelection(
      selectedRoute.routeId,
      selectedRoute.routeName,
      {
        fiberId: selectedFiber.value,
        fiberLabel: selectedFiber.label,
        armourLabel: selectedArmour.label,
        tubeCount,
        coreCount,
        drumId: selectedDrum.value,
        drumLabel: selectedDrum.label,
        drumLength: selectedDrum.availableLength,
        lengthToUse: requestedLength,
      },
    );
    setFiberSelections(previous => ({
      ...previous,
      [selectedRoute.routeId]: nextFibers,
    }));
    const routeForChange = selectedRoute;
    setSelectedRoute(null);
    navigation.navigate('Fiber-Change', {
      selectedRoute: routeForChange,
      selectedFibers: nextFibers,
    });
  };

  const openRouteMap = (route: RouteDetails) => {
    const coordinate =
      parseCoordinate(route.endLatLng) ?? parseCoordinate(route.startLatLng);
    if (!coordinate) {
      Common.showToast('Route location is unavailable');
      return;
    }
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${coordinate.latitude},${coordinate.longitude}`,
    ).catch(() => Common.showToast('Unable to open Google Maps'));
  };

  const openFiberChange = (route: RouteDetails) => {
    const selections =
      fiberSelections[route.routeId] ??
      getRouteFiberSelections(route.routeId, route.routeName);
    navigation.navigate('Fiber-Change', {
      selectedRoute: route,
      selectedFibers: selections,
    });
  };

  const renderRouteCard = (
    route: RouteDetails,
    showLocationPointer: boolean,
  ) => {
    const selections = fiberSelections[route.routeId] ?? [];
    const selectedFiberLabels = selections.map(item => item.fiberLabel);
    const serverFiberLabel = asText(
      route.fiberIdStr ??
        route.fiberTypeName ??
        route.fibreType ??
        route.fiberType,
    );
    const fiberLabel =
      Array.from(
        new Set([serverFiberLabel, ...selectedFiberLabels].filter(Boolean)),
      ).join(', ') || '--';
    const totalDistance = Number(route.totalDistance ?? route.routeLength) || 0;

    return (
      <View style={styles.routeCardRow}>
        {showLocationPointer ? (
          <View style={styles.currentLocationMarker}>
            <PointerSvg width={SIZE.MS(25)} height={SIZE.MS(25)} />
          </View>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => openFiberSheet(route)}
          style={styles.routeCard}>
          <View style={styles.cardTitleRow}>
            <Text numberOfLines={1} style={styles.routeName}>
              {asText(route.routeName) || 'Unnamed Route'}
            </Text>
            <Text numberOfLines={1} style={styles.routeId}>
              Route#
              {asText(route.routeIdStr).replace(/^route/i, '') || route.routeId}
            </Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>Active</Text>
            </View>
          </View>

          <Text numberOfLines={2} style={styles.addressText}>
            <Text style={styles.addressLabel}>From: </Text>
            {asText(route.startAddress) || 'Address unavailable'}
          </Text>
          <Text numberOfLines={2} style={styles.addressText}>
            <Text style={styles.addressLabel}>To: </Text>
            {asText(route.endAddress) || 'Address unavailable'}
          </Text>
          <Text style={styles.fiberDetailText}>
            <Text style={styles.addressLabel}>Fiber Type: </Text>
            <Text style={styles.metaValue}>{fiberLabel}</Text>
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.metaText}>
              Total Distance:{' '}
              <Text style={styles.metaValue}>
                {Math.round(totalDistance)} meters
              </Text>
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={event => {
                event.stopPropagation();
                openFiberChange(route);
              }}
              style={styles.viewFiberButton}>
              <Text style={styles.viewFiberButtonText}>View Fibers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={event => {
                event.stopPropagation();
                openRouteMap(route);
              }}
              style={styles.mapButton}>
              <GoogleMapsIconSvg width={SIZE.MS(28)} height={SIZE.MS(28)} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderListRow = ({item}: {item: RouteListRow}) => {
    return renderRouteCard(item.route, item.isNearest);
  };

  const hasMoreRoutes = page * PAGE_SIZE < recordCount;

  return (
    <Screen
      preset="fixed"
      statusBgColor={COLORS.PRIMARY}
      navBarColor={COLORS.WHITE}>
      <View style={styles.screen}>
        <BackHeader
          title="Select Route to Change Fiber"
          showGps={false}
          onBackPress={() => navigation.goBack()}
        />

        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Image source={IMAGES.search} style={styles.searchIcon} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search Route"
              placeholderTextColor="#858B95"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {searchText ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setSearchText('')}
                style={styles.clearButton}>
                <Image source={IMAGES.close} style={styles.clearIcon} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.rangeControl}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setRange(value => Math.max(50, value - 50))}
              style={styles.rangeButton}>
              <Text style={styles.rangeButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.rangeText}>{range}m</Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setRange(value => Math.min(1000, value + 50))}
              style={styles.rangeButton}>
              <Text style={styles.rangeButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.listArea}>
          <View style={styles.timeline} />
          {isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
              <Text style={styles.stateText}>Loading active routes...</Text>
            </View>
          ) : loadError && routes.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>Unable to load routes</Text>
              <Text style={styles.stateText}>{loadError}</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => loadRoutes(1, serverSearch, true)}
                style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={listRows}
              keyExtractor={item => item.key}
              renderItem={renderListRow}
              contentContainerStyle={[
                styles.listContent,
                routes.length === 0 && styles.emptyListContent,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onEndReachedThreshold={0.35}
              onEndReached={() => {
                if (hasMoreRoutes && !isLoadingMore) {
                  loadRoutes(page + 1, serverSearch, false);
                }
              }}
              onScrollToIndexFailed={({averageItemLength, index}) => {
                listRef.current?.scrollToOffset({
                  offset: averageItemLength * index,
                  animated: false,
                });
                setTimeout(() => {
                  listRef.current?.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0.45,
                  });
                }, 180);
              }}
              ListFooterComponent={
                isLoadingMore ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.PRIMARY}
                    style={styles.moreLoader}
                  />
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <Text style={styles.emptyTitle}>No active routes</Text>
                  <Text style={styles.stateText}>
                    No route matches your current search.
                  </Text>
                </View>
              }
            />
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          disabled={isLocating || routes.length === 0}
          onPress={showCurrentLocation}
          style={[
            styles.whereButtonTouchable,
            (isLocating || routes.length === 0) && styles.buttonDisabled,
          ]}>
          <LinearGradient
            colors={['#8B59F8', '#6036C4']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.whereButton}>
            <Text style={styles.whereButtonText}>
              {isLocating ? 'Locating...' : 'Where I am?'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Modal
        visible={selectedRoute !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedRoute(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setSelectedRoute(null)}>
            <Pressable style={styles.fiberSheet} onPress={() => undefined}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Select Fiber Type to Change</Text>

              <View style={styles.sheetCard}>
                <View style={styles.twoColumnRow}>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.fieldLabel}>
                      Select Fiber Type<Text style={styles.required}> *</Text>
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      disabled={isLoadingFibers}
                      onPress={() => {
                        loadFiberOptions();
                        setPickerMode('fiber');
                      }}
                      style={styles.selectField}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.selectText,
                          !selectedFiber && styles.placeholderText,
                        ]}>
                        {isLoadingFibers
                          ? 'Loading...'
                          : selectedFiber?.label || 'Select Fiber Type'}
                      </Text>
                      <Image source={IMAGES.down} style={styles.chevron} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fieldColumn}>
                    <Text style={styles.fieldLabel}>
                      Armoured/Unarmoured
                      <Text style={styles.required}> *</Text>
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setPickerMode('armour')}
                      style={styles.selectField}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.selectText,
                          !selectedArmour && styles.placeholderText,
                        ]}>
                        {selectedArmour?.label || 'Select'}
                      </Text>
                      <Image source={IMAGES.down} style={styles.chevron} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.twoColumnRow}>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.fieldLabel}>No. of Tubes</Text>
                    <View style={[styles.selectField, styles.readOnlyField]}>
                      <Text style={styles.readOnlyText}>
                        {tubeCount || '--'}
                      </Text>
                      <Image
                        source={IMAGES.down}
                        style={styles.disabledChevron}
                      />
                    </View>
                  </View>
                  <View style={styles.fieldColumn}>
                    <Text style={styles.fieldLabel}>No. of Cores</Text>
                    <View style={[styles.selectField, styles.readOnlyField]}>
                      <Text style={styles.readOnlyText}>
                        {coreCount || '--'}
                      </Text>
                      <Image
                        source={IMAGES.down}
                        style={styles.disabledChevron}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.drumRow}>
                  <View style={styles.drumFieldColumn}>
                    <Text style={styles.fieldLabel}>
                      Available Drum Name / No.
                      <Text style={styles.required}> *</Text>
                    </Text>
                    <View style={styles.drumSelectRow}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        disabled={!fiberId || isLoadingDrums}
                        onPress={() => setPickerMode('drum')}
                        style={[styles.selectField, styles.drumSelectField]}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.selectText,
                            !selectedDrum && styles.placeholderText,
                          ]}>
                          {isLoadingDrums
                            ? 'Loading...'
                            : selectedDrum?.label || 'Select Drum'}
                        </Text>
                        <Image source={IMAGES.down} style={styles.chevron} />
                      </TouchableOpacity>
                      <View style={styles.drumLengthPill}>
                        <Text style={styles.drumLengthText}>
                          {selectedDrum?.availableLength
                            ? `${selectedDrum.availableLength}m`
                            : '--'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.lengthFieldColumn}>
                    <Text style={styles.fieldLabel}>
                      Length to Use<Text style={styles.required}> *</Text>
                    </Text>
                    <View style={styles.lengthInputWrap}>
                      <TextInput
                        value={lengthToUse}
                        onChangeText={value => {
                          setLengthToUse(value.replace(/[^0-9]/g, ''));
                          setSheetError('');
                        }}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#92969D"
                        maxLength={6}
                        style={styles.lengthInput}
                      />
                      <Text style={styles.lengthUnit}>m</Text>
                    </View>
                  </View>
                </View>

                {sheetError ? (
                  <Text style={styles.sheetError}>{sheetError}</Text>
                ) : null}
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => setSelectedRoute(null)}
                  style={styles.sheetActionButton}>
                  <LinearGradient
                    colors={['#73777A', '#4D5053']}
                    style={styles.sheetActionGradient}>
                    <Text style={styles.sheetActionText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={confirmFiberSelection}
                  style={styles.sheetActionButton}>
                  <LinearGradient
                    colors={['#8B59F8', '#6036C4']}
                    style={styles.sheetActionGradient}>
                    <Text style={styles.sheetActionText}>Select</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={pickerMode !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPickerMode(null)}>
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setPickerMode(null)}>
          <Pressable style={styles.pickerSheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <Text style={styles.pickerTitle}>{pickerTitle}</Text>
            <FlatList
              data={pickerItems}
              keyExtractor={item => item.value}
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              renderItem={({item}) => (
                <TouchableOpacity
                  activeOpacity={0.72}
                  onPress={() => selectPickerItem(item)}
                  style={styles.pickerItem}>
                  <Text style={styles.pickerItemText}>{item.label}</Text>
                  {item.meta ? (
                    <Text style={styles.pickerItemMeta}>{item.meta}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  {isLoadingFibers || isLoadingDrums ? (
                    <ActivityIndicator color={COLORS.PRIMARY} />
                  ) : (
                    <Text style={styles.stateText}>No options available</Text>
                  )}
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
};

export default SelectRouteToChangeFiberScreen;
