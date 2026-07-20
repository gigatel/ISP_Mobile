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
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {
  Callout,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import {useDispatch} from 'react-redux';
import {URLs} from '@apis';
import {BackHeader} from '@molecules';
import type {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {StoreDispatch} from '@reducers';
import {COLORS, IMAGES} from '@res';
import {
  addRouteAPI,
  createInitialRouteAPI,
  GetDrumNumbersByFiberTypeAPI,
  GetNearestPoleTreeDDAPI,
  insertUpdateRouteChamberMappingAPI,
} from '@slices/route.slice';
import {Common, Location} from '@utils';
import {
  PausedRouteSnapshot,
  removeCompletedRouteSnapshot,
  savePausedRouteSnapshot,
} from '../../services/pausedRouteStorage';
import {saveCompletedAppRoute} from '../../services/routeFiberChangeStorage';
import StartingPointSvg from '../../res/images/StartingPoint.svg';
import styles from './styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Make-Route'>;

type Coordinate = {
  latitude: number;
  longitude: number;
};

type TrackingState = 'idle' | 'walking' | 'paused';

type RouteAlertTone =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'delete'
  | 'location';

type RouteAlertButton = {
  text: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onPress?: () => void;
};

type RouteAlertState = {
  visible: boolean;
  title: string;
  message: string;
  icon: any;
  iconTint: string;
  iconBg: string;
  buttons: RouteAlertButton[];
};

type RouteAlertOptions = {
  title: string;
  message: string;
  tone?: RouteAlertTone;
  buttons?: RouteAlertButton[];
};

type RoutePoint = {
  key: string;
  master: any;
  masterId: string;
  masterType: string;
  masterTypeLabel: string;
  name: string;
  address: string;
  coordinate: Coordinate | null;
  icon: any;
  imageUrls: string[];
  loopMeters: string;
  isLocked: boolean;
  isServerSaved: boolean;
};

type RouteMasterMapMarkerProps = {
  point: RoutePoint & {coordinate: Coordinate};
  index: number;
  isActive: boolean;
  overlapsCurrentLocation: boolean;
};

type RouteSegment = {
  id: string;
  afterPointKey: string;
  distance: number;
};

type DrumOption = {
  label: string;
  value: string;
  availableLength: number;
};

type DrumAllocation = {
  drumId: string;
  drumNo: string;
  availableLength: number;
  lengthToUse: number;
};

const MASTER_TYPES = [
  'pole',
  'tree',
  'building',
  'pop',
  'splitter',
  'tiffin',
  'enclosure',
];
const DEFAULT_RANGE = 200;
const MIN_TRACK_DISTANCE_METERS = 1;
const MAX_TRACK_JUMP_METERS = 250;

const MASTER_META: Record<string, {label: string; icon: any}> = {
  pole: {label: 'Pole', icon: IMAGES.PoleImage},
  tree: {label: 'Tree', icon: IMAGES.treeIcon},
  building: {label: 'Building', icon: IMAGES.Building},
  pop: {label: 'POP', icon: IMAGES.FiberEnclosur},
  splitter: {label: 'Splitter', icon: IMAGES.enclosureIcon},
  tiffin: {label: 'Tiffin', icon: IMAGES.TiffinIcon},
  enclosure: {label: 'Enclosure', icon: IMAGES.jointEnclosure},
};

const asText = (value: unknown) => String(value ?? '').trim();

const asPositiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

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
      const availableLength = asPositiveNumber(
        item?.drumLength ??
          item?.DrumLength ??
          item?.availableLength ??
          item?.AvailableLength ??
          item?.remainingLength ??
          item?.RemainingLength ??
          item?.balanceLength ??
          item?.BalanceLength,
      );

      return {label, value: String(id), availableLength};
    })
    .filter((option): option is DrumOption => option !== null)
    .filter(
      (option, index, options) =>
        options.findIndex(item => item.value === option.value) === index,
    );

const normalizeObjectKey = (key: string) =>
  key.toLowerCase().replace(/[^a-z0-9]/g, '');

const getMasterField = (master: any, ...keys: string[]) => {
  const entry = keys.find(key => master?.[key] !== undefined);
  return entry ? master?.[entry] : undefined;
};

const normalizeMasterType = (value: unknown) => {
  const type = asText(value).toLowerCase();
  const compactType = type.replace(/[^a-z0-9]/g, '');
  return (
    MASTER_TYPES.find(candidate => compactType.includes(candidate)) ?? type
  );
};

const getMasterType = (master: any) =>
  normalizeMasterType(
    master?.__masterType ??
      master?.masterType ??
      master?.MasterType ??
      master?.type ??
      master?.Type,
  );

const getMasterId = (master: any) =>
  asText(master?.id ?? master?.Id ?? master?.masterId ?? master?.MasterId);

const getMasterName = (master: any) =>
  asText(
    master?.name ?? master?.Name ?? master?.masterName ?? master?.MasterName,
  ) || 'Selected Master';

const getMasterAddress = (master: any) =>
  asText(
    master?.address ??
      master?.Address ??
      master?.selectedAddress ??
      master?.SelectedAddress,
  ) || 'Address not available';

const parseCoordinate = (master: any): Coordinate | null => {
  const raw = asText(
    master?.latLng ?? master?.LatLng ?? master?.latlng ?? master?.lat_lng,
  );
  const [lat, lng] = raw.split(',').map(Number);
  const coordinate = {
    latitude: Number.isFinite(lat)
      ? lat
      : Number(master?.latitude ?? master?.Latitude),
    longitude: Number.isFinite(lng)
      ? lng
      : Number(master?.longitude ?? master?.Longitude),
  };

  return Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude)
    ? coordinate
    : null;
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

  const raw = String(value).trim();
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      return getImageValue(JSON.parse(raw));
    } catch {
      // Continue as a regular path when the value is not valid JSON.
    }
  }

  const image = raw.replace(/^['"]|['"]$/g, '');
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

const getMasterImages = (master: any) => {
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
      const normalizedKey = normalizeObjectKey(key);
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

const getRouteAlertVisual = (tone: RouteAlertTone = 'info') => {
  switch (tone) {
    case 'success':
      return {
        icon: IMAGES.checkFill,
        iconTint: '#13A538',
        iconBg: '#EAF8EE',
      };
    case 'warning':
      return {
        icon: IMAGES.warning,
        iconTint: '#B7791F',
        iconBg: '#FFF7E6',
      };
    case 'error':
      return {
        icon: IMAGES.warning,
        iconTint: COLORS.ERROR,
        iconBg: '#FDECEC',
      };
    case 'delete':
      return {
        icon: IMAGES.close,
        iconTint: COLORS.ERROR,
        iconBg: '#FDECEC',
      };
    case 'location':
      return {
        icon: IMAGES.mapLocation,
        iconTint: COLORS.colorMediumslateblue,
        iconBg: '#F2ECFF',
      };
    case 'info':
    default:
      return {
        icon: IMAGES.infoFill,
        iconTint: COLORS.colorMediumslateblue,
        iconBg: '#F2ECFF',
      };
  }
};

const makeRoutePoint = (
  master: any,
  version: string,
  fallbackCoordinate?: Coordinate,
): RoutePoint => {
  const masterType = getMasterType(master);
  const meta = MASTER_META[masterType] ?? {
    label: asText(master?.__masterTypeLabel) || 'Master',
    icon: IMAGES.module,
  };

  return {
    key: `${version}-${getMasterId(master) || Date.now()}`,
    master,
    masterId: getMasterId(master),
    masterType,
    masterTypeLabel: meta.label,
    name: getMasterName(master),
    address: getMasterAddress(master),
    coordinate: parseCoordinate(master) ?? fallbackCoordinate ?? null,
    icon: meta.icon,
    imageUrls: getMasterImages(master),
    loopMeters: '',
    isLocked: false,
    isServerSaved: false,
  };
};

const restoreRoutePoint = (
  storedPoint: any,
  index: number,
  fallbackCoordinate: Coordinate,
): RoutePoint => {
  const version = asText(storedPoint?.key) || `restored-${index}-${Date.now()}`;
  const storedMasterType = normalizeMasterType(
    storedPoint?.masterType ?? storedPoint?.masterTypeLabel,
  );
  const storedMaster = storedPoint?.master ?? storedPoint;
  const restorableMaster =
    storedMasterType && !getMasterType(storedMaster)
      ? {
          ...storedMaster,
          __masterType: storedMasterType,
          __masterTypeLabel: storedPoint?.masterTypeLabel,
        }
      : storedMaster;
  const restored = makeRoutePoint(
    restorableMaster,
    version,
    storedPoint?.coordinate ?? fallbackCoordinate,
  );
  const masterType = storedMasterType || restored.masterType;
  const meta = MASTER_META[masterType] ?? {
    label:
      asText(storedPoint?.masterTypeLabel) ||
      restored.masterTypeLabel ||
      'Master',
    icon: IMAGES.module,
  };

  return {
    ...restored,
    key: version,
    masterId: asText(storedPoint?.masterId) || restored.masterId,
    masterType,
    masterTypeLabel: asText(storedPoint?.masterTypeLabel) || meta.label,
    name: asText(storedPoint?.name) || restored.name,
    address: asText(storedPoint?.address) || restored.address,
    coordinate: storedPoint?.coordinate ?? restored.coordinate,
    icon: meta.icon,
    loopMeters: asText(storedPoint?.loopMeters),
    isLocked: Boolean(storedPoint?.isLocked),
    isServerSaved: Boolean(storedPoint?.isServerSaved),
  };
};

const RouteMasterMapMarker: FC<RouteMasterMapMarkerProps> = ({
  point,
  index,
  isActive,
  overlapsCurrentLocation,
}) => {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const stopTrackingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setTracksViewChanges(true);
    return () => {
      if (stopTrackingTimerRef.current) {
        clearTimeout(stopTrackingTimerRef.current);
      }
    };
  }, [point.icon]);

  const handleIconLoad = useCallback(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (stopTrackingTimerRef.current) {
      clearTimeout(stopTrackingTimerRef.current);
    }
    stopTrackingTimerRef.current = setTimeout(() => {
      setTracksViewChanges(false);
    }, 250);
  }, []);

  return (
    <Marker
      coordinate={point.coordinate}
      anchor={overlapsCurrentLocation ? {x: 1, y: 0.7} : {x: 0.5, y: 1}}
      zIndex={isActive ? 120 : 20}
      tracksViewChanges={tracksViewChanges}
      accessibilityLabel={`${point.masterTypeLabel}: ${point.name}`}>
      <Image
        source={point.icon ?? IMAGES.mapPin}
        fadeDuration={0}
        onLoadEnd={handleIconLoad}
        style={[styles.masterMapIcon, isActive && styles.masterMapIconActive]}
      />
      <Callout>
        <View style={styles.masterMapCallout}>
          <Text style={styles.masterMapCalloutType}>
            {index + 1}. {point.masterTypeLabel}
          </Text>
          <Text numberOfLines={1} style={styles.masterMapCalloutName}>
            {point.name}
          </Text>
          <Text numberOfLines={2} style={styles.masterMapCalloutAddress}>
            {point.address}
          </Text>
          <Text style={styles.masterMapCalloutCoordinate}>
            {point.coordinate.latitude.toFixed(6)},{' '}
            {point.coordinate.longitude.toFixed(6)}
          </Text>
        </View>
      </Callout>
    </Marker>
  );
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

  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const getMasterToMasterDistance = (
  routePoints: RoutePoint[],
  walkingSegments: RouteSegment[],
  pointIndex: number,
) => {
  if (pointIndex <= 0 || pointIndex >= routePoints.length) {
    return 0;
  }

  const previousPoint = routePoints[pointIndex - 1];
  const currentPoint = routePoints[pointIndex];
  const trackedDistance = walkingSegments
    .filter(segment => segment.afterPointKey === previousPoint.key)
    .reduce(
      (sum, segment) =>
        sum + (Number.isFinite(segment.distance) ? segment.distance : 0),
      0,
    );

  if (trackedDistance > 0) {
    return trackedDistance;
  }
  if (previousPoint.coordinate && currentPoint.coordinate) {
    return distanceBetween(previousPoint.coordinate, currentPoint.coordinate);
  }
  return 0;
};

const normalizeMasterAddress = (value: unknown) =>
  asText(value).replace(/\s+/g, ' ').toLowerCase();

const getComparableMasterAddress = (master: any) =>
  normalizeMasterAddress(
    master?.selectedAddress ??
      master?.SelectedAddress ??
      master?.address ??
      master?.Address,
  );

const isSameMasterIdentity = (point: RoutePoint, master: any) => {
  const candidateId = getMasterId(master);
  const candidateType = getMasterType(master);
  return Boolean(
    point.masterId &&
      candidateId &&
      point.masterId === candidateId &&
      (!point.masterType ||
        !candidateType ||
        point.masterType === candidateType),
  );
};

const isSameMasterLocation = (point: RoutePoint, master: any) => {
  const candidateCoordinate = parseCoordinate(master);
  if (
    point.coordinate &&
    candidateCoordinate &&
    distanceBetween(point.coordinate, candidateCoordinate) <= 1
  ) {
    return true;
  }
  const pointAddress = getComparableMasterAddress(point.master);
  const candidateAddress = getComparableMasterAddress(master);
  return Boolean(
    pointAddress &&
      candidateAddress &&
      (pointAddress === candidateAddress ||
        (pointAddress.length >= 12 &&
          candidateAddress.includes(pointAddress)) ||
        (candidateAddress.length >= 12 &&
          pointAddress.includes(candidateAddress))),
  );
};

const formatDistance = (distance: number) => `${Math.round(distance)}m`;

const formatWalkingDistance = (distance: number) =>
  `${Math.round(distance)} meters`;

const buildInitialRoutePath = (
  masterCoordinate: Coordinate | null,
  currentPosition: Coordinate,
) => {
  if (!masterCoordinate) {
    return [currentPosition];
  }

  if (distanceBetween(masterCoordinate, currentPosition) < 0.5) {
    return [masterCoordinate];
  }

  return [masterCoordinate, currentPosition];
};

const MakeRouteScreen: FC<Props> = ({navigation, route}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const isReadOnly = Boolean(route.params.readOnly);
  const resumeSnapshot = route.params.resumeSnapshot;
  const initialServerRouteId =
    Number(
      resumeSnapshot?.routeDraft?.routeId ?? route.params.routeDraft?.routeId,
    ) || 0;
  const initialCurrentPosition =
    resumeSnapshot?.currentPosition ?? route.params.currentPosition;
  const initialRoutePoints = useMemo(() => {
    if (resumeSnapshot?.routePoints?.length) {
      return resumeSnapshot.routePoints.map((point, index) =>
        restoreRoutePoint(point, index, initialCurrentPosition),
      );
    }

    return [
      makeRoutePoint(
        route.params.selectedMaster,
        route.params.selectedMasterVersion,
        initialCurrentPosition,
      ),
    ];
  }, [
    initialCurrentPosition,
    resumeSnapshot?.routePoints,
    route.params.selectedMaster,
    route.params.selectedMasterVersion,
  ]);
  const initialRoutePath = useMemo(() => {
    if (resumeSnapshot?.routePath?.length) {
      return resumeSnapshot.routePath;
    }

    return buildInitialRoutePath(
      initialRoutePoints[0]?.coordinate ?? null,
      initialCurrentPosition,
    );
  }, [initialCurrentPosition, initialRoutePoints, resumeSnapshot?.routePath]);
  const restoredTrackingState: TrackingState = resumeSnapshot
    ? resumeSnapshot.trackingState === 'idle'
      ? 'idle'
      : 'paused'
    : 'idle';
  const mapRef = useRef<MapView>(null);
  const watchIdRef = useRef<number | null>(null);
  const currentPositionRef = useRef<Coordinate>(initialCurrentPosition);
  const lastAcceptedPositionRef = useRef<Coordinate>(initialCurrentPosition);
  const routePathRef = useRef<Coordinate[]>(initialRoutePath);
  const segmentDistanceRef = useRef(resumeSnapshot?.segmentDistance ?? 0);
  const trackingStateRef = useRef<TrackingState>(restoredTrackingState);
  const processedMasterVersionRef = useRef(route.params.selectedMasterVersion);
  const routeSnapshotIdRef = useRef(
    resumeSnapshot?.id ??
      `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const routeCreatedAtRef = useRef(resumeSnapshot?.createdAt ?? Date.now());
  const routeCompletedRef = useRef(isReadOnly);
  const latestSnapshotRef = useRef<PausedRouteSnapshot | null>(null);
  const initialRouteIdRef = useRef(initialServerRouteId);
  const savedMasterKeysRef = useRef(
    new Set(
      initialRoutePoints
        .filter(point => point.isServerSaved)
        .map(point => point.key),
    ),
  );

  const [currentPosition, setCurrentPosition] = useState<Coordinate>(
    initialCurrentPosition,
  );
  const [currentAddress, setCurrentAddress] = useState(
    resumeSnapshot?.currentAddress ?? route.params.currentAddress,
  );
  const [routePoints, setRoutePoints] =
    useState<RoutePoint[]>(initialRoutePoints);
  const [routePath, setRoutePath] = useState<Coordinate[]>(initialRoutePath);
  const [walkingSegments, setWalkingSegments] = useState<RouteSegment[]>(
    resumeSnapshot?.walkingSegments ?? [],
  );
  const [trackingState, setTrackingState] = useState<TrackingState>(
    restoredTrackingState,
  );
  const [segmentDistance, setSegmentDistance] = useState(
    resumeSnapshot?.segmentDistance ?? 0,
  );
  const [isSelectingMaster, setIsSelectingMaster] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [serverRouteId, setServerRouteId] = useState(initialServerRouteId);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewTitle, setPreviewTitle] = useState('Master Images');
  const [drumAllocations, setDrumAllocations] = useState<DrumAllocation[]>(
    () => {
      if (resumeSnapshot?.drumAllocations?.length) {
        return resumeSnapshot.drumAllocations;
      }

      const drumId = asText(route.params.routeDraft?.drumId);
      const drumNo = asText(route.params.routeDraft?.drumNo);
      const lengthToUse = asPositiveNumber(
        route.params.routeDraft?.lengthToUse,
      );

      return drumId && drumNo && lengthToUse
        ? [
            {
              drumId,
              drumNo,
              availableLength: asPositiveNumber(
                route.params.routeDraft?.drumLength,
              ),
              lengthToUse,
            },
          ]
        : [];
    },
  );
  const [isDrumSheetVisible, setIsDrumSheetVisible] = useState(false);
  const [drumOptions, setDrumOptions] = useState<DrumOption[]>([]);
  const [selectedDrumId, setSelectedDrumId] = useState('');
  const [additionalLength, setAdditionalLength] = useState('');
  const [showDrumOptions, setShowDrumOptions] = useState(false);
  const [isLoadingDrums, setIsLoadingDrums] = useState(false);
  const [drumLoadError, setDrumLoadError] = useState('');
  const [drumSelectionError, setDrumSelectionError] = useState('');
  const [routeAlert, setRouteAlert] = useState<RouteAlertState>(() => {
    const visual = getRouteAlertVisual('info');
    return {
      visible: false,
      title: '',
      message: '',
      icon: visual.icon,
      iconTint: visual.iconTint,
      iconBg: visual.iconBg,
      buttons: [],
    };
  });

  const activePoint = routePoints[routePoints.length - 1] ?? null;
  const completedWalkingDistance = useMemo(
    () =>
      routePoints.reduce(
        (sum, _point, pointIndex) =>
          sum +
          getMasterToMasterDistance(routePoints, walkingSegments, pointIndex),
        0,
      ),
    [routePoints, walkingSegments],
  );
  const totalLoopDistance = useMemo(
    () =>
      routePoints.reduce(
        (sum, point) => sum + asPositiveNumber(point.loopMeters),
        0,
      ),
    [routePoints],
  );
  const liveWalkingDistance = trackingState === 'idle' ? 0 : segmentDistance;
  const totalCableDistance =
    completedWalkingDistance + liveWalkingDistance + totalLoopDistance;
  const totalAllocatedLength = useMemo(
    () =>
      drumAllocations.reduce(
        (sum, allocation) => sum + allocation.lengthToUse,
        0,
      ),
    [drumAllocations],
  );
  const isDrumLengthExhausted =
    totalAllocatedLength > 0 && totalCableDistance >= totalAllocatedLength;
  const persistedRouteSnapshot = useMemo<PausedRouteSnapshot>(() => {
    const status =
      trackingState === 'walking'
        ? 'walking'
        : trackingState === 'paused'
        ? 'paused'
        : walkingSegments.length > 0 ||
          routePoints.some(point => point.isLocked)
        ? 'stopped'
        : 'unsaved';

    return {
      id: routeSnapshotIdRef.current,
      routeName: route.params.routeName,
      routeDraft: {
        ...route.params.routeDraft,
        ...(serverRouteId ? {routeId: serverRouteId} : {}),
      },
      currentPosition,
      currentAddress,
      routePoints: routePoints.map(point => ({
        key: point.key,
        master: point.master,
        masterId: point.masterId,
        masterType: point.masterType,
        masterTypeLabel: point.masterTypeLabel,
        name: point.name,
        address: point.address,
        coordinate: point.coordinate,
        loopMeters: point.loopMeters,
        isLocked: point.isLocked,
        isServerSaved: point.isServerSaved,
      })),
      routePath,
      walkingSegments,
      segmentDistance,
      trackingState,
      drumAllocations,
      totalDistance: totalCableDistance,
      status,
      createdAt: routeCreatedAtRef.current,
      updatedAt: Date.now(),
    };
  }, [
    currentAddress,
    currentPosition,
    drumAllocations,
    route.params.routeDraft,
    route.params.routeName,
    routePath,
    routePoints,
    segmentDistance,
    serverRouteId,
    totalCableDistance,
    trackingState,
    walkingSegments,
  ]);
  latestSnapshotRef.current = persistedRouteSnapshot;

  useEffect(() => {
    const saveTimer = setTimeout(() => {
      if (!routeCompletedRef.current) {
        savePausedRouteSnapshot(persistedRouteSnapshot);
      }
    }, 150);

    return () => clearTimeout(saveTimer);
  }, [persistedRouteSnapshot]);

  useEffect(
    () => () => {
      if (!routeCompletedRef.current && latestSnapshotRef.current) {
        savePausedRouteSnapshot(latestSnapshotRef.current);
      }
    },
    [],
  );
  const selectedDrumOption = useMemo(
    () => drumOptions.find(option => option.value === selectedDrumId) ?? null,
    [drumOptions, selectedDrumId],
  );
  const selectedDrumPreviouslyAllocated = useMemo(
    () =>
      drumAllocations
        .filter(allocation => allocation.drumId === selectedDrumId)
        .reduce((sum, allocation) => sum + allocation.lengthToUse, 0),
    [drumAllocations, selectedDrumId],
  );
  const selectedDrumRemainingLength = Math.max(
    0,
    (selectedDrumOption?.availableLength ?? 0) -
      selectedDrumPreviouslyAllocated,
  );

  const setTrackingStateValue = useCallback((value: TrackingState) => {
    trackingStateRef.current = value;
    setTrackingState(value);
  }, []);

  const closeRouteAlert = useCallback(() => {
    setRouteAlert(previous => ({...previous, visible: false}));
  }, []);

  const showRouteAlert = useCallback(
    ({title, message, tone = 'info', buttons}: RouteAlertOptions) => {
      const visual = getRouteAlertVisual(tone);
      setRouteAlert({
        visible: true,
        title,
        message,
        icon: visual.icon,
        iconTint: visual.iconTint,
        iconBg: visual.iconBg,
        buttons:
          buttons && buttons.length > 0
            ? buttons
            : [{text: 'OK', variant: 'primary'}],
      });
    },
    [],
  );

  const selectAdditionalDrum = useCallback(
    (option: DrumOption) => {
      const previouslyAllocated = drumAllocations
        .filter(allocation => allocation.drumId === option.value)
        .reduce((sum, allocation) => sum + allocation.lengthToUse, 0);
      const remaining = Math.max(
        0,
        option.availableLength - previouslyAllocated,
      );
      const preferredLength = asPositiveNumber(
        route.params.routeDraft?.lengthToUse,
      );

      setSelectedDrumId(option.value);
      setAdditionalLength(
        String(Math.min(preferredLength || remaining, remaining)),
      );
      setShowDrumOptions(false);
      setDrumSelectionError('');
    },
    [drumAllocations, route.params.routeDraft?.lengthToUse],
  );

  const loadAdditionalDrums = useCallback(async () => {
    const fiberTypeId = asText(route.params.routeDraft?.fiberTypeId);
    if (!fiberTypeId) {
      setDrumLoadError('Fiber type is unavailable for this route.');
      return;
    }

    try {
      setIsLoadingDrums(true);
      setDrumLoadError('');
      const response = await dispatch(
        GetDrumNumbersByFiberTypeAPI({fiberTypeId}),
      ).unwrap();
      const options = buildDrumOptions(response);
      setDrumOptions(options);

      const firstAvailable = options.find(option => {
        const allocated = drumAllocations
          .filter(allocation => allocation.drumId === option.value)
          .reduce((sum, allocation) => sum + allocation.lengthToUse, 0);
        return option.availableLength - allocated > 0;
      });

      if (firstAvailable) {
        selectAdditionalDrum(firstAvailable);
      } else {
        setSelectedDrumId('');
        setAdditionalLength('');
        setDrumLoadError('No drum length is available for this fiber type.');
      }
    } catch (error: any) {
      setDrumOptions([]);
      setSelectedDrumId('');
      setAdditionalLength('');
      setDrumLoadError(
        error?.message || 'Unable to load drums. Please try again.',
      );
    } finally {
      setIsLoadingDrums(false);
    }
  }, [
    dispatch,
    drumAllocations,
    route.params.routeDraft?.fiberTypeId,
    selectAdditionalDrum,
  ]);

  const openAddDrumSheet = useCallback(() => {
    Keyboard.dismiss();
    setDrumSelectionError('');
    setShowDrumOptions(false);
    setIsDrumSheetVisible(true);
    loadAdditionalDrums();
  }, [loadAdditionalDrums]);

  const closeAddDrumSheet = useCallback(() => {
    Keyboard.dismiss();
    setShowDrumOptions(false);
    setIsDrumSheetVisible(false);
  }, []);

  const confirmAdditionalDrum = useCallback(() => {
    if (!selectedDrumOption) {
      setDrumSelectionError('Please select a drum number.');
      return;
    }

    const requestedLength = asPositiveNumber(additionalLength);
    if (!requestedLength) {
      setDrumSelectionError('Enter a valid length to use.');
      return;
    }
    if (requestedLength > selectedDrumRemainingLength) {
      setDrumSelectionError(
        `Only ${Math.round(selectedDrumRemainingLength)}m is available.`,
      );
      return;
    }

    const nextAllocatedLength = totalAllocatedLength + requestedLength;
    setDrumAllocations(previous => [
      ...previous,
      {
        drumId: selectedDrumOption.value,
        drumNo: selectedDrumOption.label,
        availableLength: selectedDrumOption.availableLength,
        lengthToUse: requestedLength,
      },
    ]);
    closeAddDrumSheet();
    Common.showToast(
      `${Math.round(requestedLength)}m added. ${Math.round(
        nextAllocatedLength,
      )}m total available.`,
    );
  }, [
    additionalLength,
    closeAddDrumSheet,
    selectedDrumOption,
    selectedDrumRemainingLength,
    totalAllocatedLength,
  ]);

  const handleRouteAlertButtonPress = useCallback(
    (button: RouteAlertButton) => {
      closeRouteAlert();
      if (button.onPress) {
        setTimeout(button.onPress, 120);
      }
    },
    [closeRouteAlert],
  );

  const appendCoordinate = useCallback((coordinate: Coordinate) => {
    const previous = routePathRef.current[routePathRef.current.length - 1];
    if (
      previous &&
      Math.abs(previous.latitude - coordinate.latitude) < 0.000001 &&
      Math.abs(previous.longitude - coordinate.longitude) < 0.000001
    ) {
      return;
    }

    routePathRef.current = [...routePathRef.current, coordinate];
    setRoutePath(routePathRef.current);
  }, []);

  const stopLocationWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const requestLocationPermission = useCallback(async () => {
    const permission =
      Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
        : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    let result = await check(permission);

    if (result === RESULTS.DENIED) {
      result = await request(permission);
    }
    if (result === RESULTS.BLOCKED || result === RESULTS.LIMITED) {
      showRouteAlert({
        title: 'Location Permission',
        message:
          'Enable location permission from settings to track this route.',
        tone: 'location',
        buttons: [
          {text: 'Cancel', variant: 'secondary'},
          {
            text: 'Open Settings',
            onPress: () => openSettings().catch(() => Linking.openSettings()),
          },
        ],
      });
      return false;
    }

    if (result !== RESULTS.GRANTED) {
      showRouteAlert({
        title: 'Location Permission',
        message: 'Location permission is required to draw the walking route.',
        tone: 'location',
      });
      return false;
    }

    return true;
  }, [showRouteAlert]);

  const getCurrentCoordinate = useCallback(
    () =>
      new Promise<Coordinate>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position =>
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 2000,
          },
        );
      }),
    [],
  );

  const handleLocationUpdate = useCallback(
    (coordinate: Coordinate, accuracy?: number) => {
      currentPositionRef.current = coordinate;
      setCurrentPosition(coordinate);

      const previous = lastAcceptedPositionRef.current;
      const moved = distanceBetween(previous, coordinate);
      const inaccurate = Number.isFinite(accuracy) && Number(accuracy) > 80;

      if (
        !inaccurate &&
        moved >= MIN_TRACK_DISTANCE_METERS &&
        moved <= MAX_TRACK_JUMP_METERS
      ) {
        segmentDistanceRef.current += moved;
        setSegmentDistance(segmentDistanceRef.current);
        appendCoordinate(coordinate);
        lastAcceptedPositionRef.current = coordinate;
      } else if (moved > MAX_TRACK_JUMP_METERS) {
        lastAcceptedPositionRef.current = coordinate;
      }

      mapRef.current?.animateToRegion(
        {
          ...coordinate,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        350,
      );
    },
    [appendCoordinate],
  );

  const startLocationWatch = useCallback(async () => {
    const allowed = await requestLocationPermission();
    if (!allowed) {
      return false;
    }

    stopLocationWatch();
    const coordinate = currentPositionRef.current;
    currentPositionRef.current = coordinate;
    lastAcceptedPositionRef.current = coordinate;
    setCurrentPosition(coordinate);
    appendCoordinate(coordinate);

    watchIdRef.current = Geolocation.watchPosition(
      position =>
        handleLocationUpdate(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          position.coords.accuracy,
        ),
      error => {
        console.warn('[MakeRoute] Location watch error:', error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        interval: 1500,
        fastestInterval: 750,
        timeout: 20000,
        maximumAge: 1000,
      },
    );
    setTrackingStateValue('walking');

    getCurrentCoordinate()
      .then(freshCoordinate => {
        if (
          trackingStateRef.current === 'walking' &&
          watchIdRef.current !== null
        ) {
          handleLocationUpdate(freshCoordinate);
        }
      })
      .catch((error: any) => {
        console.warn(
          '[MakeRoute] GPS refresh will continue through the live watch:',
          error?.message,
        );
      });
    return true;
  }, [
    appendCoordinate,
    getCurrentCoordinate,
    handleLocationUpdate,
    requestLocationPermission,
    setTrackingStateValue,
    stopLocationWatch,
  ]);

  useEffect(() => {
    const version = route.params.selectedMasterVersion;
    if (!version || processedMasterVersionRef.current === version) {
      return;
    }

    processedMasterVersionRef.current = version;
    const nextPoint = makeRoutePoint(
      route.params.selectedMaster,
      version,
      route.params.currentPosition,
    );
    const appendSelectedMaster = () => {
      setRoutePoints(previous => [...previous, nextPoint]);
      appendCoordinate(route.params.currentPosition);
      if (nextPoint.coordinate) {
        appendCoordinate(nextPoint.coordinate);
      }
      currentPositionRef.current = route.params.currentPosition;
      lastAcceptedPositionRef.current = route.params.currentPosition;
      setCurrentPosition(route.params.currentPosition);
      setCurrentAddress(route.params.currentAddress);
      setTrackingStateValue('idle');

      setTimeout(() => {
        const coordinates = routePathRef.current;
        if (coordinates.length > 1) {
          mapRef.current?.fitToCoordinates(coordinates, {
            animated: true,
            edgePadding: {top: 50, right: 45, bottom: 50, left: 45},
          });
        }
      }, 180);
    };

    const existingMaster = routePoints.find(point =>
      isSameMasterIdentity(point, route.params.selectedMaster),
    );
    if (existingMaster) {
      showRouteAlert({
        title: `${existingMaster.masterTypeLabel} Already Added`,
        message: `${existingMaster.name} is already present in this route.`,
        tone: 'info',
      });
      return;
    }

    const duplicateLocations = routePoints.filter(point =>
      isSameMasterLocation(point, route.params.selectedMaster),
    );
    if (duplicateLocations.length > 0) {
      showRouteAlert({
        title: 'Location Already Exists',
        message: `This location is already used by ${duplicateLocations
          .map(point => `${point.masterTypeLabel} • ${point.name}`)
          .join(', ')}. Review the existing master or add this one anyway.`,
        tone: 'warning',
        buttons: [
          {text: 'Review', variant: 'secondary'},
          {
            text: 'Add Anyway',
            variant: 'primary',
            onPress: appendSelectedMaster,
          },
        ],
      });
      return;
    }

    appendSelectedMaster();
  }, [
    appendCoordinate,
    route.params.currentAddress,
    route.params.currentPosition,
    route.params.selectedMaster,
    route.params.selectedMasterVersion,
    routePoints,
    setTrackingStateValue,
    showRouteAlert,
  ]);

  useEffect(
    () => () => {
      stopLocationWatch();
    },
    [stopLocationWatch],
  );

  const masterMarkers = useMemo(
    () =>
      routePoints.filter(
        (point): point is RoutePoint & {coordinate: Coordinate} =>
          point.coordinate !== null,
      ),
    [routePoints],
  );

  const getPointLatLng = (point: RoutePoint) =>
    point.coordinate
      ? `${point.coordinate.latitude}, ${point.coordinate.longitude}`
      : asText(getMasterField(point.master, 'latLng', 'LatLng', 'latlng'));

  const buildCurrentRoutePath = (
    point: RoutePoint,
    stopPosition: Coordinate,
  ) => {
    const coordinates = [...routePathRef.current];
    if (coordinates.length < 2 && point.coordinate) {
      coordinates.splice(0, coordinates.length, point.coordinate, stopPosition);
    } else if (coordinates.length < 2) {
      coordinates.push(stopPosition);
    }
    if (coordinates.length < 2) {
      throw new Error('At least two route coordinates are required.');
    }
    return `LINESTRING(${coordinates
      .map(coordinate => `${coordinate.longitude} ${coordinate.latitude}`)
      .join(', ')})`;
  };

  const getCreatedRouteId = (response: any) =>
    Number(
      response?.id ??
        response?.Id ??
        response?.routeId ??
        response?.RouteId ??
        response?.routeIdInt ??
        response?.RouteIdInt ??
        (typeof response === 'number' || typeof response === 'string'
          ? response
          : 0),
    ) || 0;

  const markMasterAsServerSaved = (pointKey: string) => {
    savedMasterKeysRef.current.add(pointKey);
    setRoutePoints(previous =>
      previous.map(item =>
        item.key === pointKey ? {...item, isServerSaved: true} : item,
      ),
    );
  };

  const getMappingFiberDetails = () => {
    const fiberIdText = asText(route.params.routeDraft?.fiberTypeId);
    const numericFiberId = Number(fiberIdText);
    const rawFiberType =
      asText(route.params.routeDraft?.fiberType) ||
      asText(route.params.routeDraft?.fiberTypeName);
    const fiberCapacity = rawFiberType.match(/(\d+)\s*F\b/i)?.[1];

    return {
      fiberId:
        fiberIdText && Number.isFinite(numericFiberId)
          ? numericFiberId
          : fiberIdText,
      fiberType: fiberCapacity ? `${fiberCapacity}F` : rawFiberType,
      fiberUsedBy: asText(route.params.routeDraft?.fiberUsedBy),
    };
  };

  const getMappingDrumDetails = (totalLength: number) => {
    if (drumAllocations.length === 0) {
      const drumLength = asPositiveNumber(route.params.routeDraft?.drumLength);
      return {
        drumLength,
        drumRemainingLength: Math.max(0, drumLength - totalLength),
        drumNo: asText(route.params.routeDraft?.drumNo),
      };
    }

    let remainingCableLength = Math.max(0, totalLength);
    let activeAllocation = drumAllocations[0];
    const usedByDrum = new Map<string, number>();

    for (let index = 0; index < drumAllocations.length; index += 1) {
      const allocation = drumAllocations[index];
      const allocationLength = asPositiveNumber(allocation.lengthToUse);
      const usedFromAllocation = Math.min(
        remainingCableLength,
        allocationLength,
      );
      const drumKey = allocation.drumId || allocation.drumNo;

      usedByDrum.set(
        drumKey,
        (usedByDrum.get(drumKey) ?? 0) + usedFromAllocation,
      );
      activeAllocation = allocation;

      if (
        remainingCableLength <= allocationLength ||
        index === drumAllocations.length - 1
      ) {
        break;
      }
      remainingCableLength -= allocationLength;
    }

    const activeDrumKey = activeAllocation.drumId || activeAllocation.drumNo;
    const activeDrumUsed = usedByDrum.get(activeDrumKey) ?? 0;

    return {
      drumLength: activeAllocation.availableLength,
      drumRemainingLength: Math.max(
        0,
        activeAllocation.availableLength - activeDrumUsed,
      ),
      drumNo: activeAllocation.drumNo,
    };
  };

  const saveInitialMasterToServer = async (
    point: RoutePoint,
    stopPosition: Coordinate,
  ) => {
    const result = await dispatch(
      createInitialRouteAPI({
        id: initialRouteIdRef.current || 0,
        routeName: route.params.routeName,
        startLatLng: getPointLatLng(point),
        startAddress: point.address,
        startLandmark: asText(
          getMasterField(point.master, 'landmark', 'Landmark'),
        ),
        startArea: asText(getMasterField(point.master, 'area', 'Area')),
        startCity: asText(getMasterField(point.master, 'city', 'City')),
        startState: asText(getMasterField(point.master, 'state', 'State')),
        startPincode:
          Number(
            getMasterField(point.master, 'pincode', 'Pincode', 'PinCode'),
          ) || 0,
        startCountry: asText(
          getMasterField(point.master, 'country', 'Country'),
        ),
        masterType: point.masterTypeLabel,
        masterId: Number(point.masterId) || 0,
        orderNo: 1,
        routePath: buildCurrentRoutePath(point, stopPosition),
      }),
    ).unwrap();
    const createdRouteId =
      getCreatedRouteId(result) || initialRouteIdRef.current;
    if (!createdRouteId) {
      throw new Error('Initial route was saved without a route ID.');
    }
    initialRouteIdRef.current = createdRouteId;
    setServerRouteId(createdRouteId);
    markMasterAsServerSaved(point.key);
    return createdRouteId;
  };

  const saveMappedMasterToServer = async (
    point: RoutePoint,
    pointIndex: number,
    routeId: number,
  ) => {
    const mappedSegmentDistance = getMasterToMasterDistance(
      routePoints,
      walkingSegments,
      pointIndex,
    );
    const completedDistanceToPoint = routePoints
      .slice(0, pointIndex + 1)
      .reduce(
        (sum, _routePoint, currentPointIndex) =>
          sum +
          getMasterToMasterDistance(
            routePoints,
            walkingSegments,
            currentPointIndex,
          ),
        0,
      );
    const cumulativeLoopUsed = routePoints
      .slice(0, pointIndex + 1)
      .reduce(
        (sum, routePoint) => sum + asPositiveNumber(routePoint.loopMeters),
        0,
      );
    const totalLength = completedDistanceToPoint + cumulativeLoopUsed;
    const loopUsed = asPositiveNumber(point.loopMeters);
    const fiberDetails = getMappingFiberDetails();
    const drumDetails = getMappingDrumDetails(totalLength);
    await dispatch(
      insertUpdateRouteChamberMappingAPI({
        id: 0,
        routeId,
        masterType: point.masterTypeLabel,
        masterId: Number(point.masterId) || 0,
        distance: Math.round(mappedSegmentDistance),
        endLatLng: getPointLatLng(point),
        endSelectedAddress:
          asText(
            getMasterField(point.master, 'selectedAddress', 'SelectedAddress'),
          ) || point.address,
        endAddress: point.address,
        endLandmark: asText(
          getMasterField(point.master, 'landmark', 'Landmark'),
        ),
        endArea: asText(getMasterField(point.master, 'area', 'Area')),
        endCity: asText(getMasterField(point.master, 'city', 'City')),
        endState: asText(getMasterField(point.master, 'state', 'State')),
        endPincode:
          Number(
            getMasterField(point.master, 'pincode', 'Pincode', 'PinCode'),
          ) || 0,
        endCountry: asText(getMasterField(point.master, 'country', 'Country')),
        routeLength: Math.round(totalLength),
        orderNo: pointIndex + 1,
        totalLength: Math.round(totalLength),
        drumLength: Math.round(drumDetails.drumLength),
        drumRemainingLength: Math.round(drumDetails.drumRemainingLength),
        loopUsed: Math.round(loopUsed),
        fiberId: fiberDetails.fiberId,
        fiberType: fiberDetails.fiberType,
        fiberUsedBy: fiberDetails.fiberUsedBy,
        drumNo: drumDetails.drumNo,
      }),
    ).unwrap();
    markMasterAsServerSaved(point.key);
  };

  const saveStoppedMasterToServer = async (
    point: RoutePoint,
    stopPosition: Coordinate,
  ) => {
    if (savedMasterKeysRef.current.has(point.key)) {
      return;
    }

    const pointIndex = routePoints.findIndex(item => item.key === point.key);
    if (pointIndex < 0) {
      throw new Error('Selected route master is unavailable.');
    }

    let routeId = initialRouteIdRef.current;
    const firstPoint = routePoints[0];
    if (!routeId) {
      routeId = await saveInitialMasterToServer(firstPoint, stopPosition);
    } else if (!savedMasterKeysRef.current.has(firstPoint.key)) {
      // A stored server route ID means its initial master already succeeded.
      markMasterAsServerSaved(firstPoint.key);
    }

    for (let mappingIndex = 1; mappingIndex <= pointIndex; mappingIndex += 1) {
      const mappedPoint = routePoints[mappingIndex];
      if (!savedMasterKeysRef.current.has(mappedPoint.key)) {
        await saveMappedMasterToServer(mappedPoint, mappingIndex, routeId);
      }
    }
  };

  const handleStart = async () => {
    if (!activePoint || trackingState !== 'idle' || isSelectingMaster) {
      return;
    }

    try {
      segmentDistanceRef.current = 0;
      setSegmentDistance(0);
      const started = await startLocationWatch();
      if (started) {
        setRoutePoints(previous =>
          previous.map(point =>
            point.key === activePoint.key ? {...point, isLocked: true} : point,
          ),
        );
      } else {
        setTrackingStateValue('idle');
      }
    } catch (error: any) {
      setTrackingStateValue('idle');
      showRouteAlert({
        title: 'Start Route',
        message: error?.message || 'Unable to start tracking.',
        tone: 'error',
      });
    }
  };

  const handlePauseResume = async () => {
    if (trackingState === 'walking') {
      stopLocationWatch();
      setTrackingStateValue('paused');
      return;
    }
    if (trackingState === 'paused') {
      try {
        await startLocationWatch();
      } catch (error: any) {
        showRouteAlert({
          title: 'Resume Route',
          message: error?.message || 'Unable to resume tracking.',
          tone: 'error',
        });
      }
    }
  };

  const handleStopAndAddMaster = async () => {
    if (trackingState === 'idle' || !activePoint || isSelectingMaster) {
      return;
    }

    let failureStage: 'route' | 'masters' = 'route';
    try {
      setIsSelectingMaster(true);
      stopLocationWatch();
      setTrackingStateValue('paused');
      const stopPosition = currentPositionRef.current;

      currentPositionRef.current = stopPosition;
      setCurrentPosition(stopPosition);
      const finalMovement = distanceBetween(
        lastAcceptedPositionRef.current,
        stopPosition,
      );
      if (
        finalMovement >= MIN_TRACK_DISTANCE_METERS &&
        finalMovement <= MAX_TRACK_JUMP_METERS
      ) {
        segmentDistanceRef.current += finalMovement;
        setSegmentDistance(segmentDistanceRef.current);
      }
      appendCoordinate(stopPosition);
      lastAcceptedPositionRef.current = stopPosition;
      const completedSegmentDistance = segmentDistanceRef.current;
      let stopAddress = currentAddress;
      try {
        const geoAddress = await Location.getAddressWithLatLong(
          stopPosition.latitude,
          stopPosition.longitude,
        );
        stopAddress = geoAddress?.address || currentAddress;
      } catch (error) {
        console.warn(
          '[MakeRoute] Stop address lookup failed; saving GPS route data:',
          error,
        );
      }
      setCurrentAddress(stopAddress);

      await saveStoppedMasterToServer(activePoint, stopPosition);
      failureStage = 'masters';

      const response = await dispatch(
        GetNearestPoleTreeDDAPI({
          latLng: `${stopPosition.latitude}, ${stopPosition.longitude}`,
          labelType: MASTER_TYPES.join(','),
          range: DEFAULT_RANGE,
          type: 'master',
          status: true,
        }),
      ).unwrap();
      const initialMasters = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];

      setWalkingSegments(previous => [
        ...previous,
        {
          id: `${activePoint.key}-${Date.now()}`,
          afterPointKey: activePoint.key,
          distance: completedSegmentDistance,
        },
      ]);
      segmentDistanceRef.current = 0;
      setSegmentDistance(0);
      setTrackingStateValue('idle');

      navigation.navigate('Select-Route-Master', {
        routeSelectionMode: true,
        returnToRouteBuilder: true,
        routeName: route.params.routeName,
        routeDraft: {
          ...route.params.routeDraft,
          routeId: initialRouteIdRef.current,
        },
        currentPosition: stopPosition,
        currentAddress: stopAddress,
        initialMasters,
        routeExistingMasters: routePoints.map(point => ({
          ...point.master,
          id: point.masterId,
          masterId: point.masterId,
          masterType: point.masterType,
          name: point.name,
          address: point.address,
          latLng: getPointLatLng(point),
        })),
      });
    } catch (error: any) {
      setTrackingStateValue('paused');
      showRouteAlert({
        title:
          failureStage === 'route' ? 'Route Save Failed' : 'Add Master Failed',
        message:
          error?.message ||
          (failureStage === 'route'
            ? 'Unable to save this route segment.'
            : 'Unable to load masters from the stop location.'),
        tone: 'error',
      });
    } finally {
      setIsSelectingMaster(false);
    }
  };

  const saveAndEndRoute = async () => {
    if (routePoints.length < 2) {
      showRouteAlert({
        title: 'Add Another Master',
        message:
          'Stop and add at least one more master before ending the route.',
        tone: 'warning',
      });
      return;
    }
    if (routePathRef.current.length < 2) {
      showRouteAlert({
        title: 'Route Path',
        message: 'Start walking before ending the route.',
        tone: 'warning',
      });
      return;
    }

    const stateBeforeSave = trackingStateRef.current;
    stopLocationWatch();
    setTrackingStateValue('idle');
    setIsEnding(true);

    try {
      const firstPoint = routePoints[0];
      const lastPoint = routePoints[routePoints.length - 1];
      const routeLineString = `LINESTRING(${routePathRef.current
        .map(point => `${point.longitude} ${point.latitude}`)
        .join(', ')})`;
      const pointDistance = (_point: RoutePoint, index: number) => {
        const completedDistance = getMasterToMasterDistance(
          routePoints,
          walkingSegments,
          index,
        );
        const liveDistance =
          index === routePoints.length - 1 ? segmentDistanceRef.current : 0;
        return Math.round(completedDistance + liveDistance);
      };
      const toLatLng = (point: RoutePoint) =>
        point.coordinate
          ? `${point.coordinate.latitude}, ${point.coordinate.longitude}`
          : '';

      const saveResponse = await dispatch(
        addRouteAPI({
          Id: initialRouteIdRef.current || 0,
          RouteName: route.params.routeName,
          RouteLength: Math.round(
            completedWalkingDistance +
              segmentDistanceRef.current +
              totalLoopDistance,
          ),
          StartAddress: firstPoint.address,
          StartCity: asText(getMasterField(firstPoint.master, 'city', 'City')),
          StartState: asText(
            getMasterField(firstPoint.master, 'state', 'State'),
          ),
          StartCountry: asText(
            getMasterField(firstPoint.master, 'country', 'Country'),
          ),
          StartArea: asText(getMasterField(firstPoint.master, 'area', 'Area')),
          StartPincode:
            Number(
              getMasterField(
                firstPoint.master,
                'pincode',
                'Pincode',
                'PinCode',
              ),
            ) || 0,
          StartLandmark: asText(
            getMasterField(firstPoint.master, 'landmark', 'Landmark'),
          ),
          StartLatLng: toLatLng(firstPoint),
          EndAddress: lastPoint.address,
          EndCity: asText(getMasterField(lastPoint.master, 'city', 'City')),
          EndState: asText(getMasterField(lastPoint.master, 'state', 'State')),
          EndCountry: asText(
            getMasterField(lastPoint.master, 'country', 'Country'),
          ),
          EndArea: asText(getMasterField(lastPoint.master, 'area', 'Area')),
          EndPincode:
            Number(
              getMasterField(lastPoint.master, 'pincode', 'Pincode', 'PinCode'),
            ) || 0,
          EndLandmark: asText(
            getMasterField(lastPoint.master, 'landmark', 'Landmark'),
          ),
          EndLatLng: toLatLng(lastPoint),
          RoutePath: routeLineString,
          RouteChamberMappingVM: routePoints.map((point, index) => ({
            masterType: point.masterType,
            masterId: Number(point.masterId) || 0,
            distance: pointDistance(point, index),
            latLng: toLatLng(point),
            selectedAddress:
              asText(
                getMasterField(
                  point.master,
                  'selectedAddress',
                  'SelectedAddress',
                ),
              ) || point.address,
            address: point.address,
            pincode:
              Number(
                getMasterField(point.master, 'pincode', 'Pincode', 'PinCode'),
              ) || 0,
            area: asText(getMasterField(point.master, 'area', 'Area')),
            city: asText(getMasterField(point.master, 'city', 'City')),
            state: asText(getMasterField(point.master, 'state', 'State')),
            country: asText(getMasterField(point.master, 'country', 'Country')),
            landmark: asText(
              getMasterField(point.master, 'landmark', 'Landmark'),
            ),
            extra1: asText(getMasterField(point.master, 'extra1', 'Extra1')),
            extra2: asText(getMasterField(point.master, 'extra2', 'Extra2')),
          })),
        }),
      ).unwrap();

      const responseRouteId = asText(
        saveResponse?.routeId ??
          saveResponse?.RouteId ??
          saveResponse?.id ??
          saveResponse?.Id ??
          (typeof saveResponse === 'number' ? saveResponse : ''),
      );
      saveCompletedAppRoute({
        serverRouteId:
          responseRouteId || asText(initialRouteIdRef.current) || undefined,
        routeName: route.params.routeName,
        currentPosition,
        currentAddress,
        routePoints: persistedRouteSnapshot.routePoints,
        routePath: [...routePathRef.current],
        walkingSegments: [...walkingSegments],
        totalDistance:
          completedWalkingDistance +
          segmentDistanceRef.current +
          totalLoopDistance,
        createdAt: routeCreatedAtRef.current,
        updatedAt: Date.now(),
      });

      routeCompletedRef.current = true;
      removeCompletedRouteSnapshot(routeSnapshotIdRef.current);
      Common.showToast('Route completed successfully');
      (navigation as any).popTo('AddRouteFiberScreen');
    } catch (error: any) {
      setTrackingStateValue(stateBeforeSave === 'idle' ? 'idle' : 'paused');
      showRouteAlert({
        title: 'End Route',
        message: error?.message || 'Unable to save this route.',
        tone: 'error',
      });
    } finally {
      setIsEnding(false);
    }
  };

  const handleEndRoute = () => {
    showRouteAlert({
      title: 'End Route',
      message: `Complete ${route.params.routeName}?\nDistance: ${formatDistance(
        completedWalkingDistance +
          segmentDistanceRef.current +
          totalLoopDistance,
      )}\nMasters: ${routePoints.length}`,
      tone: 'warning',
      buttons: [
        {text: 'Cancel', variant: 'secondary'},
        {
          text: 'End',
          variant: 'danger',
          onPress: saveAndEndRoute,
        },
      ],
    });
  };

  const handleBack = () => {
    if (trackingState === 'idle') {
      navigation.goBack();
      return;
    }

    showRouteAlert({
      title: 'Route Tracking Active',
      message: 'Stop tracking and leave this route screen?',
      tone: 'warning',
      buttons: [
        {text: 'Stay', variant: 'secondary'},
        {
          text: 'Stop & Leave',
          variant: 'danger',
          onPress: () => {
            stopLocationWatch();
            navigation.goBack();
          },
        },
      ],
    });
  };

  const updateLoop = (key: string, value: string) => {
    setRoutePoints(previous =>
      previous.map(point =>
        point.key === key && !point.isLocked
          ? {...point, loopMeters: value.replace(/[^0-9]/g, '')}
          : point,
      ),
    );
  };

  const deletePoint = (key: string) => {
    const point = routePoints.find(item => item.key === key);
    if (!point) {
      return;
    }
    if (point?.isLocked) {
      showRouteAlert({
        title: 'Master Locked',
        message: `${point.masterTypeLabel} • ${point.name} cannot be deleted after its route segment has started.`,
        tone: 'warning',
      });
      return;
    }

    showRouteAlert({
      title: `Delete ${point.masterTypeLabel}?`,
      message: `Remove ${point.name} from this route?`,
      tone: 'delete',
      buttons: [
        {text: 'Cancel', variant: 'secondary'},
        {
          text: 'Delete',
          variant: 'danger',
          onPress: () =>
            setRoutePoints(previous =>
              previous.filter(item => item.key !== key),
            ),
        },
      ],
    });
  };

  const openMasterImages = (point: RoutePoint) => {
    if (point.imageUrls.length === 0) {
      showRouteAlert({
        title: 'View Images',
        message: `No images are available for ${point.name}.`,
        tone: 'info',
      });
      return;
    }

    setPreviewTitle(`${point.masterTypeLabel} • ${point.name}`);
    setPreviewImageIndex(0);
    setPreviewImages(point.imageUrls);
  };

  const renderWalkingRow = (distance: number, key: string, isLive = false) => (
    <View key={key} style={styles.walkingRow}>
      <View style={styles.walkingLine} />
      <View style={styles.walkingPill}>
        <Image
          source={isLive ? IMAGES.manWalking : IMAGES.walkingManStatic}
          style={styles.walkingListImage}
        />
        <Text style={styles.walkingDistance}>
          {formatWalkingDistance(distance)}
        </Text>
      </View>
    </View>
  );

  return (
    <Screen
      preset="fixed"
      keyboardAvoidingEnabled={Platform.OS === 'ios'}
      statusBgColor={COLORS.PRIMARY}
      navBarColor={COLORS.WHITE}>
      <View style={styles.screen}>
        <BackHeader
          title={isReadOnly ? 'Route Details' : 'Add Route'}
          onBackPress={handleBack}
        />

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            showsUserLocation={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            initialRegion={{
              ...route.params.currentPosition,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}>
            {routePath.length > 1 ? (
              <>
                <Polyline
                  coordinates={routePath}
                  strokeColor="rgba(255,255,255,0.9)"
                  strokeWidth={9}
                  lineCap="round"
                  lineJoin="round"
                  geodesic
                />
                <Polyline
                  coordinates={routePath}
                  strokeColor="#6D43E5"
                  strokeWidth={5}
                  lineCap="round"
                  lineJoin="round"
                  geodesic
                />
              </>
            ) : null}

            {masterMarkers.map((point, index) => {
              const overlapsCurrentLocation =
                distanceBetween(point.coordinate, currentPosition) <= 4;
              const isActiveMarker = point.key === activePoint?.key;

              return (
                <RouteMasterMapMarker
                  key={`master-${point.key}`}
                  point={point}
                  index={index}
                  isActive={isActiveMarker}
                  overlapsCurrentLocation={overlapsCurrentLocation}
                />
              );
            })}

            <Marker
              coordinate={currentPosition}
              anchor={{x: 0.5, y: 0.82}}
              zIndex={100}>
              <StartingPointSvg width={30} height={48} />
            </Marker>
          </MapView>
        </View>

        <View style={styles.addressBar}>
          <Image source={IMAGES.mapLocation} style={styles.addressIcon} />
          <Text numberOfLines={2} style={styles.addressText}>
            {currentAddress || 'Current route location'}
          </Text>
        </View>

        <View style={styles.routeNameBar}>
          <Text style={styles.routeNameLabel}>Route Name:</Text>
          <Text numberOfLines={1} style={styles.routeNameText}>
            {route.params.routeName}
          </Text>
          <Text style={styles.totalDistanceText}>
            Total: {Math.round(totalCableDistance)}m
          </Text>
        </View>

        <ScrollView
          style={styles.routeList}
          contentContainerStyle={styles.routeListContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {routePoints.map((point, index) => {
            const nextMasterDistance =
              index < routePoints.length - 1
                ? getMasterToMasterDistance(
                    routePoints,
                    walkingSegments,
                    index + 1,
                  )
                : null;
            const showLiveWalking =
              index === routePoints.length - 1 && trackingState !== 'idle';

            return (
              <View key={point.key}>
                <View style={styles.masterRow}>
                  <View style={styles.masterTimelineIcon}>
                    <Image source={point.icon} style={styles.masterTypeIcon} />
                  </View>

                  <View style={styles.masterCopy}>
                    <Text numberOfLines={1} style={styles.masterTitle}>
                      <Text style={styles.masterTypeText}>
                        {point.masterTypeLabel}
                      </Text>{' '}
                      • {point.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.masterAddress}>
                      {point.address}
                    </Text>
                  </View>

                  <View style={styles.loopColumn}>
                    <View
                      style={[
                        styles.loopControl,
                        styles.loopControlInColumn,
                        (point.isLocked || isReadOnly) &&
                          styles.loopControlLocked,
                      ]}>
                      {point.isLocked || isReadOnly ? (
                        <Text numberOfLines={1} style={styles.loopLockedText}>
                          Loop: {point.loopMeters || '0'} m
                        </Text>
                      ) : (
                        <View style={styles.loopInputRow}>
                          <TextInput
                            value={point.loopMeters}
                            onChangeText={value => updateLoop(point.key, value)}
                            placeholder="Loop"
                            placeholderTextColor="#9298A2"
                            keyboardType="number-pad"
                            maxLength={5}
                            style={styles.loopInput}
                          />
                          <Text style={styles.loopSuffix}>m</Text>
                        </View>
                      )}
                    </View>
                    {index === routePoints.length - 1 &&
                    routePoints.length > 1 ? (
                      <Text
                        numberOfLines={1}
                        style={styles.masterTotalDistance}>
                        Total: {Math.round(totalCableDistance)}m
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`View images for ${point.name}`}
                    onPress={() => openMasterImages(point)}
                    style={styles.masterThumbnail}>
                    <Image
                      source={
                        point.imageUrls[0]
                          ? {uri: point.imageUrls[0]}
                          : point.icon
                      }
                      style={styles.masterThumbnailImage}
                    />
                    {point.imageUrls.length > 1 ? (
                      <View style={styles.imageCountBadge}>
                        <Text style={styles.imageCountText}>
                          {point.imageUrls.length}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>

                  {!isReadOnly ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${point.name}`}
                      onPress={() => deletePoint(point.key)}
                      style={[
                        styles.deleteButton,
                        point.isLocked && styles.deleteButtonLocked,
                      ]}>
                      <Image source={IMAGES.close} style={styles.deleteIcon} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {nextMasterDistance !== null
                  ? renderWalkingRow(
                      nextMasterDistance,
                      `master-distance-${point.key}-${
                        routePoints[index + 1].key
                      }`,
                    )
                  : null}
                {showLiveWalking
                  ? renderWalkingRow(
                      segmentDistance,
                      `live-${point.key}`,
                      trackingState === 'walking',
                    )
                  : null}
              </View>
            );
          })}

          {routePoints.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No master selected</Text>
              <Text style={styles.emptyText}>
                Go back and choose a master to begin the route.
              </Text>
            </View>
          ) : null}

          {!isReadOnly && isDrumLengthExhausted ? (
            <View style={styles.drumWarningRow}>
              <Text style={styles.drumWarningText}>
                Warning: Your allocated drum length is finished. Add another
                drum to continue.
              </Text>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={openAddDrumSheet}
                style={styles.addDrumButton}>
                <Text style={styles.addDrumButtonText}>Add Drum</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>

        {!isReadOnly ? (
          <View style={styles.footer}>
            <TouchableOpacity
              activeOpacity={0.82}
              disabled={trackingState !== 'idle' || !activePoint}
              onPress={handleStart}
              style={[
                styles.footerButton,
                styles.startButton,
                (trackingState !== 'idle' || !activePoint) &&
                  styles.footerButtonDisabled,
              ]}>
              <Text style={styles.footerButtonText}>Start</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              disabled={trackingState === 'idle' || isSelectingMaster}
              onPress={handleStopAndAddMaster}
              style={[
                styles.footerButton,
                styles.addMasterButton,
                (trackingState === 'idle' || isSelectingMaster) &&
                  styles.footerButtonDisabled,
              ]}>
              {isSelectingMaster ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.footerButtonText}>Stop & Add Master</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              disabled={trackingState === 'idle'}
              onPress={handlePauseResume}
              style={[
                styles.footerButton,
                styles.pauseButton,
                trackingState === 'idle' && styles.footerButtonDisabled,
              ]}>
              <Text style={styles.pauseButtonText}>
                {trackingState === 'paused' ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              disabled={routePoints.length === 0 || isEnding}
              onPress={handleEndRoute}
              style={[
                styles.footerButton,
                styles.endButton,
                (routePoints.length === 0 || isEnding) &&
                  styles.footerButtonDisabled,
              ]}>
              {isEnding ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.footerButtonText}>End</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <Modal
          visible={isDrumSheetVisible}
          transparent
          statusBarTranslucent
          animationType="slide"
          onRequestClose={closeAddDrumSheet}>
          <Pressable
            style={styles.drumSheetOverlay}
            onPress={closeAddDrumSheet}>
            <Pressable
              style={styles.drumSheet}
              onPress={event => event.stopPropagation()}>
              <View style={styles.drumSheetHandle} />
              <Text style={styles.drumSheetTitle}>Select Drum</Text>

              <View style={styles.drumFormCard}>
                <View style={styles.drumFieldsRow}>
                  <View style={styles.drumNumberField}>
                    <Text style={styles.drumFieldLabel}>
                      Available Drum Name / No.
                      <Text style={styles.drumRequired}> *</Text>
                    </Text>
                    <View style={styles.drumSelectRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={isLoadingDrums || drumOptions.length === 0}
                        onPress={() =>
                          setShowDrumOptions(previous => !previous)
                        }
                        style={styles.drumSelectInput}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.drumSelectText,
                            !selectedDrumOption && styles.drumPlaceholderText,
                          ]}>
                          {selectedDrumOption?.label || 'Select Drum'}
                        </Text>
                        <Image
                          source={IMAGES.down}
                          style={styles.drumSelectArrow}
                        />
                      </TouchableOpacity>
                      <View style={styles.drumAvailablePill}>
                        <Text style={styles.drumAvailableText}>
                          {Math.round(selectedDrumRemainingLength)}m
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.drumLengthField}>
                    <Text style={styles.drumFieldLabel}>
                      Length to Use
                      <Text style={styles.drumRequired}> *</Text>
                    </Text>
                    <View style={styles.drumLengthInputWrap}>
                      <TextInput
                        value={additionalLength}
                        onChangeText={value => {
                          setAdditionalLength(value.replace(/[^0-9]/g, ''));
                          setDrumSelectionError('');
                        }}
                        placeholder="Enter"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={7}
                        style={styles.drumLengthInput}
                      />
                      <Text style={styles.drumLengthSuffix}>m</Text>
                    </View>
                  </View>
                </View>

                {showDrumOptions ? (
                  <View style={styles.drumOptionsList}>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}>
                      {drumOptions.map(option => {
                        const allocated = drumAllocations
                          .filter(
                            allocation => allocation.drumId === option.value,
                          )
                          .reduce(
                            (sum, allocation) => sum + allocation.lengthToUse,
                            0,
                          );
                        const remaining = Math.max(
                          0,
                          option.availableLength - allocated,
                        );
                        const selected = option.value === selectedDrumId;

                        return (
                          <TouchableOpacity
                            key={option.value}
                            activeOpacity={0.78}
                            disabled={remaining <= 0}
                            onPress={() => selectAdditionalDrum(option)}
                            style={[
                              styles.drumOptionRow,
                              selected && styles.drumOptionRowSelected,
                              remaining <= 0 && styles.drumOptionRowDisabled,
                            ]}>
                            <View style={styles.drumOptionCopy}>
                              <Text style={styles.drumOptionLabel}>
                                {option.label}
                              </Text>
                              <Text style={styles.drumOptionMeta}>
                                {Math.round(remaining)}m available
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.drumRadio,
                                selected && styles.drumRadioSelected,
                              ]}>
                              {selected ? (
                                <View style={styles.drumRadioDot} />
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {isLoadingDrums ? (
                  <View style={styles.drumFeedbackRow}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.colorMediumslateblue}
                    />
                    <Text style={styles.drumFeedbackText}>
                      Loading drum numbers...
                    </Text>
                  </View>
                ) : drumLoadError ? (
                  <View style={styles.drumFeedbackRow}>
                    <Text style={styles.drumErrorText}>{drumLoadError}</Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={loadAdditionalDrums}
                      style={styles.drumRetryButton}>
                      <Text style={styles.drumRetryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {drumSelectionError ? (
                  <Text style={styles.drumSelectionError}>
                    {drumSelectionError}
                  </Text>
                ) : null}
              </View>

              <View style={styles.drumSheetActions}>
                <TouchableOpacity
                  activeOpacity={0.84}
                  onPress={closeAddDrumSheet}
                  style={styles.drumSheetAction}>
                  <LinearGradient
                    colors={['#73777A', '#4D5053']}
                    style={styles.drumSheetActionGradient}>
                    <Text style={styles.drumSheetActionText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.84}
                  disabled={isLoadingDrums || !selectedDrumOption}
                  onPress={confirmAdditionalDrum}
                  style={[
                    styles.drumSheetAction,
                    (isLoadingDrums || !selectedDrumOption) &&
                      styles.drumSheetActionDisabled,
                  ]}>
                  <LinearGradient
                    colors={['#8B59F8', '#6036C4']}
                    style={styles.drumSheetActionGradient}>
                    <Text style={styles.drumSheetActionText}>Select</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={routeAlert.visible}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={closeRouteAlert}>
          <View style={styles.alertOverlay}>
            <View style={styles.alertCard}>
              <View
                style={[
                  styles.alertIconBox,
                  {backgroundColor: routeAlert.iconBg},
                ]}>
                <Image
                  source={routeAlert.icon}
                  style={[styles.alertIcon, {tintColor: routeAlert.iconTint}]}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.alertTitle}>{routeAlert.title}</Text>
              <ScrollView
                style={styles.alertMessageScroll}
                contentContainerStyle={styles.alertMessageContent}
                showsVerticalScrollIndicator={false}>
                <Text style={styles.alertMessage}>{routeAlert.message}</Text>
              </ScrollView>
              <View
                style={[
                  styles.alertButtonRow,
                  routeAlert.buttons.length === 1 &&
                    styles.alertButtonRowSingle,
                ]}>
                {routeAlert.buttons.map((button, index) => {
                  const isSecondary = button.variant === 'secondary';
                  const isDanger = button.variant === 'danger';
                  return (
                    <TouchableOpacity
                      key={`${button.text}-${index}`}
                      activeOpacity={0.85}
                      onPress={() => handleRouteAlertButtonPress(button)}
                      style={[
                        styles.alertButton,
                        routeAlert.buttons.length === 1 &&
                          styles.alertButtonSingle,
                        isSecondary && styles.alertButtonSecondary,
                        isDanger && styles.alertButtonDanger,
                      ]}>
                      <Text
                        style={[
                          styles.alertButtonText,
                          isSecondary && styles.alertButtonTextSecondary,
                        ]}>
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={previewImages.length > 0}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setPreviewImages([])}>
          <View style={styles.previewOverlay}>
            <View style={styles.previewHeader}>
              <Text numberOfLines={1} style={styles.previewTitle}>
                {previewTitle}
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close image viewer"
                onPress={() => setPreviewImages([])}
                style={styles.previewCloseButton}>
                <Text style={styles.previewCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            {previewImages[previewImageIndex] ? (
              <Image
                source={{uri: previewImages[previewImageIndex]}}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}

            {previewImages.length > 1 ? (
              <>
                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Previous image"
                  onPress={() =>
                    setPreviewImageIndex(previous =>
                      previous === 0 ? previewImages.length - 1 : previous - 1,
                    )
                  }
                  style={[styles.previewArrow, styles.previewArrowLeft]}>
                  <Text style={styles.previewArrowText}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Next image"
                  onPress={() =>
                    setPreviewImageIndex(previous =>
                      previous === previewImages.length - 1 ? 0 : previous + 1,
                    )
                  }
                  style={[styles.previewArrow, styles.previewArrowRight]}>
                  <Text style={styles.previewArrowText}>›</Text>
                </TouchableOpacity>
              </>
            ) : null}

            <View style={styles.previewFooter}>
              <Text style={styles.previewCounter}>
                {previewImageIndex + 1} of {previewImages.length}
              </Text>
              {previewImages.length > 1 ? (
                <View style={styles.previewPager}>
                  {previewImages.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      accessibilityRole="button"
                      accessibilityLabel={`Show image ${index + 1}`}
                      onPress={() => setPreviewImageIndex(index)}
                      style={[
                        styles.previewDot,
                        index === previewImageIndex && styles.previewDotActive,
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
};

export default MakeRouteScreen;
