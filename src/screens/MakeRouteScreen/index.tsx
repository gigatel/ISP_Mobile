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
  Animated,
  Easing,
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
import {Camera, CameraType, type CameraApi} from 'react-native-camera-kit';
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
  createInitialRouteAPI,
  GetDrumNumbersByFiberTypeAPI,
  GetFiberMasterListAPI,
  GetISPMasterByRouteIdISPAPI,
  GetNearestPoleTreeDDAPI,
  insertUpdateRouteChamberMappingAPI,
  updateRoutePathDetailsAPI,
} from '@slices/route.slice';
import {Common, ImageWatermark, Location} from '@utils';
import FullscreenImageViewer from '../../components/molecules/fullscreen-image-viewer';
import ConnectedFiberDetailsModal from '../../components/molecules/connected-fiber-details-modal';
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
type RouteMapDisplayType = 'standard' | 'satellite' | 'threeDimensional';

const ROUTE_MAP_DISPLAY_OPTIONS: {
  type: RouteMapDisplayType;
  label: string;
}[] = [
  {type: 'standard', label: 'Standard'},
  {type: 'satellite', label: 'Satellite'},
  {type: 'threeDimensional', label: '3D'},
];

type RouteAlertTone =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'delete'
  | 'camera'
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
  tone: RouteAlertTone;
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
  onPress: () => void;
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
  fiberTypeId?: string;
  fiberTypeName?: string;
};

type FiberOption = {
  label: string;
  value: string;
};

const MASTER_TYPES = [
  'pole',
  'tree',
  'building',
  'pop',
  'splitter',
  'tiffin',
  'enclosure',
  'chamber',
];
const DEFAULT_RANGE = 200;
const MIN_TRACK_DISTANCE_METERS = 0.5;
const MAX_TRACK_JUMP_METERS = 250;
const MAX_TRACK_ACCURACY_METERS = 60;
const MAX_WALKING_SPEED_METERS_PER_SECOND = 2.8;
const LIVE_LOCATION_POLL_INTERVAL_MS = 3000;

const MASTER_META: Record<string, {label: string; icon: any}> = {
  pole: {label: 'Pole', icon: IMAGES.PoleImage},
  tree: {label: 'Tree', icon: IMAGES.treeIcon},
  building: {label: 'Building', icon: IMAGES.Building},
  pop: {label: 'POP', icon: IMAGES.FiberEnclosur},
  splitter: {label: 'Spliter/FatBox', icon: IMAGES.enclosureIcon},
  tiffin: {label: 'Tiffin', icon: IMAGES.TiffinIcon},
  enclosure: {label: 'Enclosure', icon: IMAGES.jointEnclosure},
  chamber: {label: 'Chamber', icon: IMAGES.ChamberNew},
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
        item?.remainingDrumLength ??
          item?.RemainingDrumLength ??
          item?.drumRemainingLength ??
          item?.DrumRemainingLength ??
          item?.remainingLength ??
          item?.RemainingLength ??
          item?.balanceLength ??
          item?.BalanceLength ??
          item?.availableLength ??
          item?.AvailableLength ??
          item?.drumLength ??
          item?.DrumLength,
      );

      return {label, value: String(id), availableLength};
    })
    .filter((option): option is DrumOption => option !== null)
    .filter(
      (option, index, options) =>
        options.findIndex(item => item.value === option.value) === index,
    );

const buildFiberOptions = (response: any): FiberOption[] =>
  getListFromResponse(response)
    .map((item, index): FiberOption | null => {
      const fiberCode = asText(
        item?.fiberIdStr ??
          item?.FiberIdStr ??
          item?.fiberIDStr ??
          item?.FiberIDStr ??
          item?.fiberName ??
          item?.FiberName,
      );
      const fiberName = asText(
        item?.fiberName ?? item?.FiberName ?? item?.name ?? item?.Name,
      );
      const value = asText(
        item?.id ?? item?.Id ?? item?.fiberId ?? item?.FiberId ?? fiberCode,
      );
      if (!value || (!fiberCode && !fiberName)) {
        return null;
      }
      return {
        value,
        label:
          fiberCode && fiberName && fiberCode !== fiberName
            ? `${fiberCode} - ${fiberName}`
            : fiberCode || fiberName || `Fiber ${index + 1}`,
      };
    })
    .filter((option): option is FiberOption => option !== null)
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
    master?.point ??
      master?.Point ??
      master?.__masterType ??
      master?.masterType ??
      master?.MasterType ??
      master?.type ??
      master?.Type,
  );

const getMasterId = (master: any) =>
  asText(
    master?.IspMasterId ??
      master?.ispMasterId ??
      master?.masterId ??
      master?.MasterId ??
      master?.newMasterId ??
      master?.NewMasterId ??
      master?.newFiberMasterId ??
      master?.NewFiberMasterId ??
      master?.poleId ??
      master?.PoleId ??
      master?.treeId ??
      master?.TreeId ??
      master?.buildingId ??
      master?.BuildingId ??
      master?.tiffinId ??
      master?.TiffinId ??
      master?.enclosureId ??
      master?.EnclosureId ??
      master?.splitterId ??
      master?.SplitterId ??
      master?.chamberId ??
      master?.ChamberId ??
      master?.id ??
      master?.Id,
  );

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
    master?.__fiberChangePhotoUri ??
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
    case 'camera':
      return {
        icon: IMAGES.camera,
        iconTint: COLORS.colorMediumslateblue,
        iconBg: '#F2ECFF',
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
    imageUrls:
      Array.isArray(storedPoint?.imageUrls) && storedPoint.imageUrls.length > 0
        ? storedPoint.imageUrls
        : restored.imageUrls,
    loopMeters: asText(storedPoint?.loopMeters),
    isLocked: Boolean(storedPoint?.isLocked),
    isServerSaved: Boolean(storedPoint?.isServerSaved),
  };
};

const RouteMasterMapMarker: FC<RouteMasterMapMarkerProps> = ({
  point,
  index,
  isActive,
  onPress,
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
      anchor={{x: 0.5, y: 1}}
      zIndex={isActive ? 120 : 20}
      onPress={onPress}
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

const formatWalkingDistance = (distance: number) =>
  `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} meters`;

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
  const isFiberChange = Boolean(route.params.fiberChangeMode);
  const canEditFiberLoop = route.params.fiberChangeMode === 'withoutSld';
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

    if (route.params.selectedMaster && route.params.selectedMasterVersion) {
      return [
        makeRoutePoint(
          route.params.selectedMaster,
          route.params.selectedMasterVersion,
          initialCurrentPosition,
        ),
      ];
    }

    return [];
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
  const expandedMapRef = useRef<MapView>(null);
  const fiberCameraRef = useRef<CameraApi>(null);
  const watchIdRef = useRef<number | null>(null);
  const locationPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const locationPollInFlightRef = useRef(false);
  const lastProcessedFixTimestampRef = useRef(0);
  const lastAcceptedFixTimestampRef = useRef(Date.now());
  const rejectedLocationJumpRef = useRef<{
    coordinate: Coordinate;
    confirmations: number;
  } | null>(null);
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
  const savedMasterLoopValuesRef = useRef(
    new Map(
      initialRoutePoints
        .filter(point => point.isServerSaved)
        .map(point => [point.key, asPositiveNumber(point.loopMeters)]),
    ),
  );
  const masterMappingIdsRef = useRef(
    new Map(
      initialRoutePoints
        .map(
          point =>
            [
              point.key,
              Number(
                getMasterField(
                  point.master,
                  'routeChamberMappingId',
                  'RouteChamberMappingId',
                  'routeMasterMappingId',
                  'RouteMasterMappingId',
                  'mappingId',
                  'MappingId',
                ),
              ),
            ] as const,
        )
        .filter(
          ([, mappingId]) => Number.isInteger(mappingId) && mappingId > 0,
        ),
    ),
  );
  const masterSavePromisesRef = useRef(new Map<string, Promise<void>>());

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
  const [capturingMasterKey, setCapturingMasterKey] = useState('');
  const [fiberCameraPoint, setFiberCameraPoint] = useState<RoutePoint | null>(
    null,
  );
  const [isProcessingFiberPhoto, setIsProcessingFiberPhoto] = useState(false);
  const [capturedFiberMasterKeys, setCapturedFiberMasterKeys] = useState<
    Set<string>
  >(() => new Set());
  const [serverRouteId, setServerRouteId] = useState(initialServerRouteId);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapDisplayType, setMapDisplayType] =
    useState<RouteMapDisplayType>('standard');
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewTitle, setPreviewTitle] = useState('Master Images');
  const [connectedFiberMasterId, setConnectedFiberMasterId] = useState<
    string | number | null
  >(null);
  const [connectedFiberRouteMasters, setConnectedFiberRouteMasters] = useState<
    any[]
  >([]);
  const [drumAllocations, setDrumAllocations] = useState<DrumAllocation[]>(
    () => {
      if (resumeSnapshot?.drumAllocations?.length) {
        return resumeSnapshot.drumAllocations;
      }

      const drumId = asText(route.params.routeDraft?.drumId);
      const drumNo = asText(route.params.routeDraft?.drumNo);
      const fullDrumLength = asPositiveNumber(
        route.params.routeDraft?.totalDrumLength ??
          route.params.routeDraft?.drumLength,
      );
      const rawRemainingDrumLength = Number(
        route.params.routeDraft?.remainingDrumLength,
      );
      const availableDrumLength =
        Number.isFinite(rawRemainingDrumLength) && rawRemainingDrumLength >= 0
          ? rawRemainingDrumLength
          : fullDrumLength;

      return drumId && drumNo && fullDrumLength
        ? [
            {
              drumId,
              drumNo,
              availableLength: availableDrumLength,
              fiberTypeId: asText(route.params.routeDraft?.fiberTypeId),
              fiberTypeName: asText(
                route.params.routeDraft?.fiberTypeName ??
                  route.params.routeDraft?.fiberTypeLabel ??
                  route.params.routeDraft?.fiberType,
              ),
            },
          ]
        : [];
    },
  );
  const [isDrumSheetVisible, setIsDrumSheetVisible] = useState(false);
  const [drumOptions, setDrumOptions] = useState<DrumOption[]>([]);
  const [fiberOptions, setFiberOptions] = useState<FiberOption[]>([]);
  const [selectedAdditionalFiberId, setSelectedAdditionalFiberId] =
    useState('');
  const [selectedDrumId, setSelectedDrumId] = useState('');
  const [showFiberOptions, setShowFiberOptions] = useState(false);
  const [showDrumOptions, setShowDrumOptions] = useState(false);
  const [isLoadingFibers, setIsLoadingFibers] = useState(false);
  const [isLoadingDrums, setIsLoadingDrums] = useState(false);
  const [drumLoadError, setDrumLoadError] = useState('');
  const [drumSelectionError, setDrumSelectionError] = useState('');
  const [routeAlert, setRouteAlert] = useState<RouteAlertState>(() => {
    const visual = getRouteAlertVisual('info');
    return {
      visible: false,
      title: '',
      message: '',
      tone: 'info',
      icon: visual.icon,
      iconTint: visual.iconTint,
      iconBg: visual.iconBg,
      buttons: [],
    };
  });
  const alertCardAnimation = useRef(new Animated.Value(1)).current;
  const alertIconAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!routeAlert.visible || routeAlert.tone !== 'success') {
      alertCardAnimation.setValue(1);
      alertIconAnimation.setValue(1);
      return;
    }

    alertCardAnimation.setValue(0);
    alertIconAnimation.setValue(0);

    const animation = Animated.parallel([
      Animated.timing(alertCardAnimation, {
        toValue: 1,
        duration: 330,
        easing: Easing.out(Easing.back(1.25)),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(130),
        Animated.spring(alertIconAnimation, {
          toValue: 1,
          friction: 4,
          tension: 110,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [
    alertCardAnimation,
    alertIconAnimation,
    routeAlert.tone,
    routeAlert.visible,
  ]);

  useEffect(() => {
    let active = true;
    if (!serverRouteId) {
      setConnectedFiberRouteMasters([]);
      return () => {
        active = false;
      };
    }
    dispatch(GetISPMasterByRouteIdISPAPI({routeId: serverRouteId}))
      .unwrap()
      .then(response => {
        if (!active) {
          return;
        }
        const candidates = [
          response,
          response?.data,
          response?.items,
          response?.masters,
          response?.routeMasters,
          response?.masterDetails,
          response?.data?.items,
          response?.data?.masters,
          response?.data?.routeMasters,
          response?.data?.masterDetails,
        ];
        setConnectedFiberRouteMasters(candidates.find(Array.isArray) ?? []);
      })
      .catch(() => {
        if (active) {
          setConnectedFiberRouteMasters([]);
        }
      });
    return () => {
      active = false;
    };
  }, [dispatch, serverRouteId]);

  const activePoint =
    (isFiberChange && route.params.fiberChangeActiveMasterKey
      ? routePoints.find(
          point => point.key === route.params.fiberChangeActiveMasterKey,
        )
      : null) ??
    routePoints[routePoints.length - 1] ??
    null;
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
  const liveMasterDistance = liveWalkingDistance;
  const totalCableDistance =
    completedWalkingDistance + liveMasterDistance + totalLoopDistance;
  const totalAllocatedLength = useMemo(() => {
    const allocatedLength = drumAllocations.reduce(
      (sum, allocation) => sum + allocation.availableLength,
      0,
    );
    if (drumAllocations.length > 0) {
      return allocatedLength;
    }
    const rawRemainingDrumLength = Number(
      route.params.routeDraft?.remainingDrumLength,
    );
    return Number.isFinite(rawRemainingDrumLength) &&
      rawRemainingDrumLength >= 0
      ? rawRemainingDrumLength
      : asPositiveNumber(
          route.params.routeDraft?.totalDrumLength ??
            route.params.routeDraft?.drumLength,
        );
  }, [drumAllocations, route.params.routeDraft]);
  const hasConfiguredDrum =
    drumAllocations.length > 0 ||
    Boolean(
      asText(route.params.routeDraft?.drumId) ||
        asText(route.params.routeDraft?.drumNo),
    );
  const isDrumLengthExhausted =
    hasConfiguredDrum && totalCableDistance >= totalAllocatedLength;
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
      workflowType: isFiberChange ? 'fiberChange' : 'newRoute',
      resumeTarget: 'makeRoute',
      ...(isFiberChange
        ? {
            fiberChangeMode: route.params.fiberChangeMode,
            fiberChangeRoute: route.params.fiberChangeRoute,
            fiberChangeSelectedFibers:
              route.params.fiberChangeSelectedFibers ?? [],
            fiberChangeActiveMasterKey:
              route.params.fiberChangeActiveMasterKey ?? activePoint?.key,
          }
        : {}),
    };
  }, [
    currentAddress,
    currentPosition,
    drumAllocations,
    activePoint?.key,
    isFiberChange,
    route.params.fiberChangeActiveMasterKey,
    route.params.fiberChangeMode,
    route.params.fiberChangeRoute,
    route.params.fiberChangeSelectedFibers,
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
  const selectedAdditionalFiber = useMemo(
    () =>
      fiberOptions.find(option => option.value === selectedAdditionalFiberId) ??
      null,
    [fiberOptions, selectedAdditionalFiberId],
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
        tone,
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

  const captureFiberChangeMaster = async (point: RoutePoint) => {
    if (!isFiberChange || capturingMasterKey) {
      return;
    }
    try {
      const cameraPermission =
        Platform.OS === 'android'
          ? PERMISSIONS.ANDROID.CAMERA
          : PERMISSIONS.IOS.CAMERA;
      let permissionStatus = await check(cameraPermission);
      if (permissionStatus === RESULTS.DENIED) {
        permissionStatus = await request(cameraPermission);
      }
      if (
        permissionStatus !== RESULTS.GRANTED &&
        permissionStatus !== RESULTS.LIMITED
      ) {
        showRouteAlert({
          title: 'Camera Permission',
          message:
            'Camera access is required to capture this route master photo.',
          tone: 'camera',
          buttons:
            permissionStatus === RESULTS.BLOCKED
              ? [
                  {text: 'Cancel', variant: 'secondary'},
                  {
                    text: 'Open Settings',
                    onPress: () => {
                      openSettings().catch(() => Linking.openSettings());
                    },
                  },
                ]
              : undefined,
        });
        return;
      }

      // Full Route, Partial Route and Without SLD all use this in-app camera.
      // Keeping capture inside the current React Native activity preserves the
      // mounted map and route draft on devices that recreate external cameras.
      setIsMapExpanded(false);
      setCapturingMasterKey(point.key);
      setFiberCameraPoint(point);
    } catch (error: any) {
      setCapturingMasterKey('');
      showRouteAlert({
        title: 'Camera',
        message: error?.message || 'Unable to open the camera.',
        tone: 'camera',
      });
    }
  };

  const closeFiberCamera = () => {
    if (isProcessingFiberPhoto) {
      return;
    }
    setFiberCameraPoint(null);
    setCapturingMasterKey('');
  };

  const handleFiberCameraError = (message?: string) => {
    setFiberCameraPoint(null);
    setCapturingMasterKey('');
    setIsProcessingFiberPhoto(false);
    showRouteAlert({
      title: 'Camera',
      message: message || 'Unable to start the camera on this device.',
      tone: 'camera',
    });
  };

  const takeFiberChangePhoto = async () => {
    const point = fiberCameraPoint;
    if (!point || isProcessingFiberPhoto) {
      return;
    }

    try {
      setIsProcessingFiberPhoto(true);
      const capturedImage = await fiberCameraRef.current?.capture();
      if (!capturedImage?.uri) {
        throw new Error('The camera did not return a photo.');
      }

      // Unmount the live camera before decoding and watermarking the bitmap.
      // This keeps peak native memory low on devices with smaller heaps.
      setFiberCameraPoint(null);
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => resolve()),
      );

      const watermarkedUri = await ImageWatermark.applyLocationWatermark(
        capturedImage.uri,
        point.coordinate
          ? {
              latitude: point.coordinate.latitude,
              longitude: point.coordinate.longitude,
              address: point.address,
            }
          : undefined,
        {
          width: capturedImage.width,
          height: capturedImage.height,
        },
      );
      const fileName =
        capturedImage.name ||
        `fiber-master-${point.masterId || point.key}-${Date.now()}.jpg`;

      setRoutePoints(previous =>
        previous.map(routePoint =>
          routePoint.key === point.key
            ? {
                ...routePoint,
                master: {
                  ...routePoint.master,
                  __fiberChangePhotoUri: watermarkedUri,
                  __fiberChangePhotoType: 'image/jpeg',
                  __fiberChangePhotoName: fileName,
                },
                imageUrls: [watermarkedUri],
              }
            : routePoint,
        ),
      );
      setCapturedFiberMasterKeys(previous => {
        const next = new Set(previous);
        next.add(point.key);
        return next;
      });
    } catch (error: any) {
      Common.error('Unable to capture fiber-change image:', error);
      showRouteAlert({
        title: 'Photo Not Added',
        message:
          error?.message ||
          'The photo could not be processed. Please capture it again.',
        tone: 'camera',
      });
    } finally {
      setFiberCameraPoint(null);
      setCapturingMasterKey('');
      setIsProcessingFiberPhoto(false);
    }
  };

  const selectAdditionalDrum = useCallback((option: DrumOption) => {
    setSelectedDrumId(option.value);
    setShowDrumOptions(false);
    setDrumSelectionError('');
  }, []);

  const loadAdditionalDrums = useCallback(
    async (fiberTypeId: string) => {
      if (!fiberTypeId) {
        setDrumLoadError('Select a fiber type first.');
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

        const hasAvailableDrum = options.some(
          option =>
            option.availableLength > 0 &&
            !drumAllocations.some(
              allocation => allocation.drumId === option.value,
            ),
        );

        setSelectedDrumId('');
        if (!hasAvailableDrum) {
          setSelectedDrumId('');
          setDrumLoadError('No drum length is available for this fiber type.');
        }
      } catch (error: any) {
        setDrumOptions([]);
        setSelectedDrumId('');
        setDrumLoadError(
          error?.message || 'Unable to load drums. Please try again.',
        );
      } finally {
        setIsLoadingDrums(false);
      }
    },
    [dispatch, drumAllocations],
  );

  const selectAdditionalFiber = useCallback(
    (option: FiberOption) => {
      setSelectedAdditionalFiberId(option.value);
      setSelectedDrumId('');
      setDrumOptions([]);
      setShowFiberOptions(false);
      setShowDrumOptions(false);
      setDrumSelectionError('');
      loadAdditionalDrums(option.value);
    },
    [loadAdditionalDrums],
  );

  const loadAdditionalFibers = useCallback(async () => {
    try {
      setIsLoadingFibers(true);
      setDrumLoadError('');
      const response = await dispatch(GetFiberMasterListAPI()).unwrap();
      const options = buildFiberOptions(response);
      setFiberOptions(options);
      if (options.length === 0) {
        setDrumLoadError('No fiber types are available.');
      }
    } catch (error: any) {
      setFiberOptions([]);
      setDrumLoadError(
        error?.message || 'Unable to load fiber types. Please try again.',
      );
    } finally {
      setIsLoadingFibers(false);
    }
  }, [dispatch]);

  const openAddDrumSheet = useCallback(() => {
    if (!isDrumLengthExhausted) {
      return;
    }
    Keyboard.dismiss();
    setDrumSelectionError('');
    setSelectedAdditionalFiberId('');
    setSelectedDrumId('');
    setFiberOptions([]);
    setDrumOptions([]);
    setShowFiberOptions(false);
    setShowDrumOptions(false);
    setIsDrumSheetVisible(true);
    loadAdditionalFibers();
  }, [isDrumLengthExhausted, loadAdditionalFibers]);

  const closeAddDrumSheet = useCallback(() => {
    Keyboard.dismiss();
    setShowFiberOptions(false);
    setShowDrumOptions(false);
    setIsDrumSheetVisible(false);
  }, []);

  const confirmAdditionalDrum = useCallback(() => {
    if (!selectedAdditionalFiber) {
      setDrumSelectionError('Please select a fiber type.');
      return;
    }
    if (!selectedDrumOption) {
      setDrumSelectionError('Please select a drum number.');
      return;
    }

    const fullDrumLength = asPositiveNumber(selectedDrumOption.availableLength);
    if (!fullDrumLength) {
      setDrumSelectionError('The selected drum has no available length.');
      return;
    }

    const nextAllocatedLength = totalAllocatedLength + fullDrumLength;
    setDrumAllocations(previous => [
      ...previous,
      {
        drumId: selectedDrumOption.value,
        drumNo: selectedDrumOption.label,
        availableLength: fullDrumLength,
        fiberTypeId: selectedAdditionalFiber.value,
        fiberTypeName: selectedAdditionalFiber.label,
      },
    ]);
    closeAddDrumSheet();
    Common.showToast(
      `${Math.round(fullDrumLength)}m drum added. ${Math.round(
        nextAllocatedLength,
      )}m total available.`,
    );
  }, [
    closeAddDrumSheet,
    selectedAdditionalFiber,
    selectedDrumOption,
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
    if (locationPollTimerRef.current !== null) {
      clearInterval(locationPollTimerRef.current);
      locationPollTimerRef.current = null;
    }
    locationPollInFlightRef.current = false;
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
      new Promise<
        Coordinate & {
          accuracy?: number;
          timestamp?: number;
          speed?: number | null;
        }
      >((resolve, reject) => {
        Geolocation.getCurrentPosition(
          position =>
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp,
              speed: position.coords.speed,
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
    (
      coordinate: Coordinate,
      accuracy?: number,
      timestamp = Date.now(),
      speed?: number | null,
    ) => {
      if (timestamp <= lastProcessedFixTimestampRef.current) {
        return;
      }
      lastProcessedFixTimestampRef.current = timestamp;
      currentPositionRef.current = coordinate;
      setCurrentPosition(coordinate);

      const previous = lastAcceptedPositionRef.current;
      const moved = distanceBetween(previous, coordinate);
      const normalizedAccuracy = Number.isFinite(accuracy)
        ? Math.max(0, Number(accuracy))
        : 25;
      const inaccurate = normalizedAccuracy > MAX_TRACK_ACCURACY_METERS;
      const minimumReliableMovement = Math.max(
        MIN_TRACK_DISTANCE_METERS,
        Math.min(4, normalizedAccuracy * 0.2),
      );
      const elapsedSeconds = Math.max(
        0.5,
        (timestamp - lastAcceptedFixTimestampRef.current) / 1000,
      );
      const maximumPlausibleMovement = Math.max(
        6,
        Math.min(12, elapsedSeconds * MAX_WALKING_SPEED_METERS_PER_SECOND),
      );
      const reportedSpeedIsPlausible =
        !Number.isFinite(speed) ||
        Number(speed) < 0 ||
        Number(speed) <= MAX_WALKING_SPEED_METERS_PER_SECOND;
      const plausibleWalkingMovement =
        moved <= maximumPlausibleMovement && reportedSpeedIsPlausible;

      if (
        !inaccurate &&
        moved >= minimumReliableMovement &&
        plausibleWalkingMovement
      ) {
        segmentDistanceRef.current += moved;
        setSegmentDistance(segmentDistanceRef.current);
        appendCoordinate(coordinate);
        lastAcceptedPositionRef.current = coordinate;
        lastAcceptedFixTimestampRef.current = timestamp;
        rejectedLocationJumpRef.current = null;
      } else if (!inaccurate && moved > maximumPlausibleMovement) {
        const rejectedJump = rejectedLocationJumpRef.current;
        const sameRejectedArea =
          rejectedJump &&
          distanceBetween(rejectedJump.coordinate, coordinate) <=
            Math.max(5, normalizedAccuracy * 0.5);
        const confirmations = sameRejectedArea
          ? rejectedJump.confirmations + 1
          : 1;
        rejectedLocationJumpRef.current = {coordinate, confirmations};

        if (confirmations >= 2) {
          // Rebase to a repeatedly confirmed GPS relocation without counting
          // the relocation itself as walked distance.
          lastAcceptedPositionRef.current = coordinate;
          lastAcceptedFixTimestampRef.current = timestamp;
          rejectedLocationJumpRef.current = null;
        }
      }

      [mapRef.current, expandedMapRef.current].forEach(map =>
        map?.animateToRegion(
          {
            ...coordinate,
            latitudeDelta: 0.006,
            longitudeDelta: 0.006,
          },
          350,
        ),
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
    lastAcceptedFixTimestampRef.current = Date.now();
    rejectedLocationJumpRef.current = null;
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
          position.timestamp,
          position.coords.speed,
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

    locationPollTimerRef.current = setInterval(() => {
      if (
        trackingStateRef.current !== 'walking' ||
        locationPollInFlightRef.current
      ) {
        return;
      }
      locationPollInFlightRef.current = true;
      getCurrentCoordinate()
        .then(freshCoordinate => {
          if (trackingStateRef.current === 'walking') {
            handleLocationUpdate(
              freshCoordinate,
              freshCoordinate.accuracy,
              freshCoordinate.timestamp,
              freshCoordinate.speed,
            );
          }
        })
        .catch((error: any) => {
          console.warn(
            '[MakeRoute] Live GPS fallback update failed:',
            error?.message,
          );
        })
        .finally(() => {
          locationPollInFlightRef.current = false;
        });
    }, LIVE_LOCATION_POLL_INTERVAL_MS);

    getCurrentCoordinate()
      .then(freshCoordinate => {
        if (
          trackingStateRef.current === 'walking' &&
          watchIdRef.current !== null
        ) {
          handleLocationUpdate(
            freshCoordinate,
            freshCoordinate.accuracy,
            freshCoordinate.timestamp,
            freshCoordinate.speed,
          );
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
          [mapRef.current, expandedMapRef.current].forEach(map =>
            map?.fitToCoordinates(coordinates, {
              animated: true,
              edgePadding: {top: 50, right: 45, bottom: 50, left: 45},
            }),
          );
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
      Keyboard.dismiss();
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

  const routePolylineCoordinates = useMemo(() => {
    const coordinates = routePath.filter(
      coordinate =>
        Number.isFinite(coordinate.latitude) &&
        Number.isFinite(coordinate.longitude),
    );
    if (trackingState !== 'walking') {
      return coordinates;
    }

    const previous = coordinates[coordinates.length - 1];
    const liveDistance = previous
      ? distanceBetween(previous, currentPosition)
      : 0;
    if (
      previous &&
      liveDistance >= 0.5 &&
      liveDistance <= MAX_TRACK_JUMP_METERS
    ) {
      return [...coordinates, currentPosition];
    }

    return coordinates;
  }, [currentPosition, routePath, trackingState]);

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

  const getCreatedRouteId = (response: any): number => {
    const directId = Number(
      response?.id ??
        response?.Id ??
        response?.routeId ??
        response?.RouteId ??
        response?.routeIdInt ??
        response?.RouteIdInt ??
        (typeof response === 'number' || typeof response === 'string'
          ? response
          : 0),
    );
    if (Number.isInteger(directId) && directId > 0) {
      return directId;
    }

    // The initial-route endpoint has returned both {id} and nested
    // {data: {routeId}} shapes across deployments.
    if (response?.data && response.data !== response) {
      return getCreatedRouteId(response.data);
    }
    return 0;
  };

  const getCreatedMappingId = (response: any) =>
    Number(
      response?.id ??
        response?.Id ??
        response?.routeChamberMappingId ??
        response?.RouteChamberMappingId ??
        response?.mappingId ??
        response?.MappingId ??
        response?.data?.id ??
        response?.data?.Id ??
        0,
    ) || 0;

  const markMasterAsServerSaved = (
    pointKey: string,
    mappingId = 0,
    serverStatus?: 'unsave' | 'pause' | 'completed',
    loopUsed = 0,
  ) => {
    savedMasterKeysRef.current.add(pointKey);
    savedMasterLoopValuesRef.current.set(pointKey, loopUsed);
    if (mappingId > 0) {
      masterMappingIdsRef.current.set(pointKey, mappingId);
    }
    setRoutePoints(previous =>
      previous.map(item =>
        item.key === pointKey
          ? {
              ...item,
              isServerSaved: true,
              master: {
                ...(item.master ?? {}),
                ...(mappingId > 0 ? {routeChamberMappingId: mappingId} : {}),
                ...(serverStatus ? {routeStatus: serverStatus} : {}),
              },
            }
          : item,
      ),
    );
  };

  const getMappingFiberDetails = (
    point: RoutePoint,
    activeFiberTypeId?: string,
    activeFiberTypeName?: string,
  ) => {
    const toSingleFiberId = (value: unknown): number | undefined => {
      if (Array.isArray(value)) {
        return value.length === 1 ? toSingleFiberId(value[0]) : undefined;
      }
      if (value && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        return toSingleFiberId(
          source.fiberId ??
            source.FiberId ??
            source.fiberTypeId ??
            source.FiberTypeId ??
            source.value ??
            source.id,
        );
      }
      const text = asText(value);
      if (!/^\d+(?:\.0+)?$/.test(text)) {
        return undefined;
      }
      const id = Number(text);
      return Number.isInteger(id) && id > 0 ? id : undefined;
    };
    const selectedFiber = [...(route.params.fiberChangeSelectedFibers ?? [])]
      .reverse()
      .find(
        fiber =>
          toSingleFiberId(
            fiber?.fiberId ?? fiber?.FiberId ?? fiber?.fiberTypeId ?? fiber?.id,
          ) !== undefined,
      );
    const masterFiberId = [
      point.master?.fiberId,
      point.master?.FiberId,
      point.master?.fiberTypeId,
      point.master?.FiberTypeId,
    ]
      .map(toSingleFiberId)
      .find((value): value is number => value !== undefined);
    const routeFiberId = [
      activeFiberTypeId,
      selectedFiber?.fiberId,
      selectedFiber?.FiberId,
      selectedFiber?.fiberTypeId,
      selectedFiber?.id,
      route.params.routeDraft?.fiberTypeId,
      route.params.routeDraft?.fiberId,
      route.params.fiberChangeRoute?.fiberTypeId,
      route.params.fiberChangeRoute?.fiberId,
      masterFiberId,
    ]
      .map(toSingleFiberId)
      .find((value): value is number => value !== undefined);
    const fiberIdText = asText(
      activeFiberTypeId ??
        route.params.routeDraft?.fiberTypeId ??
        selectedFiber?.fiberId,
    );
    const numericFiberId = Number(fiberIdText);
    const rawFiberType =
      asText(activeFiberTypeName) ||
      asText(route.params.routeDraft?.fiberType) ||
      asText(route.params.routeDraft?.fiberTypeName) ||
      asText(route.params.routeDraft?.fiberTypeLabel) ||
      asText(
        selectedFiber?.fiberLabel ??
          selectedFiber?.fiberTypeName ??
          selectedFiber?.fiberTypeLabel ??
          selectedFiber?.fiberType,
      ) ||
      asText(
        point.master?.fiberType ??
          point.master?.FiberType ??
          point.master?.fiberTypeName ??
          point.master?.FiberTypeName ??
          point.master?.fiberTypeLabel,
      ) ||
      asText(
        route.params.fiberChangeRoute?.fiberType ??
          route.params.fiberChangeRoute?.fiberTypeName ??
          route.params.fiberChangeRoute?.fiberTypeLabel ??
          route.params.fiberChangeRoute?.fiberIdStr,
      );
    const fiberCapacity = rawFiberType.match(/(\d+)\s*F\b/i)?.[1];

    return {
      fiberId:
        (activeFiberTypeId
          ? routeFiberId
          : isFiberChange
          ? routeFiberId
          : masterFiberId) ??
        (!isFiberChange && fiberIdText && Number.isFinite(numericFiberId)
          ? numericFiberId
          : !isFiberChange
          ? fiberIdText
          : undefined),
      fiberType: fiberCapacity ? `${fiberCapacity}F` : rawFiberType,
      fiberUsedBy: asText(route.params.routeDraft?.fiberUsedBy),
    };
  };

  const getMappingDrumDetails = (totalLength: number) => {
    if (drumAllocations.length === 0) {
      const drumLength = asPositiveNumber(
        route.params.routeDraft?.totalDrumLength ??
          route.params.routeDraft?.drumLength,
      );
      const currentRemainingLength = Number(
        route.params.routeDraft?.remainingDrumLength,
      );
      const remainingBeforeChange =
        Number.isFinite(currentRemainingLength) && currentRemainingLength >= 0
          ? currentRemainingLength
          : drumLength;
      return {
        drumLength,
        drumRemainingLength: Math.max(0, remainingBeforeChange - totalLength),
        drumId: asText(route.params.routeDraft?.drumId),
        drumNo: asText(route.params.routeDraft?.drumNo),
        fiberTypeId: asText(route.params.routeDraft?.fiberTypeId),
        fiberTypeName: asText(
          route.params.routeDraft?.fiberTypeName ??
            route.params.routeDraft?.fiberTypeLabel ??
            route.params.routeDraft?.fiberType,
        ),
      };
    }

    let remainingCableLength = Math.max(0, totalLength);
    let activeAllocation = drumAllocations[0];
    const usedByDrum = new Map<string, number>();

    for (let index = 0; index < drumAllocations.length; index += 1) {
      const allocation = drumAllocations[index];
      const allocationLength = asPositiveNumber(allocation.availableLength);
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
      drumId: activeAllocation.drumId,
      drumNo: activeAllocation.drumNo,
      fiberTypeId: activeAllocation.fiberTypeId,
      fiberTypeName: activeAllocation.fiberTypeName,
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
        startState:
          asText(route.params.routeDraft?.stateName) ||
          asText(getMasterField(point.master, 'state', 'State')),
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
        loopUsed: asPositiveNumber(point.loopMeters),
      }),
    ).unwrap();
    const createdRouteId =
      getCreatedRouteId(result) || initialRouteIdRef.current;
    if (!createdRouteId) {
      throw new Error('Initial route was saved without a route ID.');
    }
    initialRouteIdRef.current = createdRouteId;
    setServerRouteId(createdRouteId);
    markMasterAsServerSaved(
      point.key,
      0,
      'unsave',
      asPositiveNumber(point.loopMeters),
    );
    return createdRouteId;
  };

  const resolveServerMappingId = async (point: RoutePoint, routeId: number) => {
    const existingMappingId = masterMappingIdsRef.current.get(point.key) ?? 0;
    if (existingMappingId > 0) {
      return existingMappingId;
    }

    const response = await dispatch(
      GetISPMasterByRouteIdISPAPI({routeId}),
    ).unwrap();
    const candidates = [
      response,
      response?.data,
      response?.items,
      response?.masters,
      response?.routeMasters,
      response?.masterDetails,
      response?.data?.items,
      response?.data?.masters,
      response?.data?.routeMasters,
      response?.data?.masterDetails,
    ];
    const serverMasters = candidates.find(Array.isArray) ?? [];
    const expectedMasterId = Number(point.masterId);
    const expectedMasterType = normalizeMasterType(point.masterTypeLabel);
    const matchingMaster = serverMasters.find((master: any) => {
      const masterId = Number(
        getMasterField(
          master,
          'IspMasterId',
          'ispMasterId',
          'masterId',
          'MasterId',
        ),
      );
      const masterType = normalizeMasterType(
        getMasterField(
          master,
          'masterType',
          'MasterType',
          'masterTypeName',
          'MasterTypeName',
          'point',
          'Point',
        ),
      );
      return (
        masterId === expectedMasterId &&
        (!expectedMasterType ||
          !masterType ||
          masterType === expectedMasterType)
      );
    });
    if (!matchingMaster) {
      return 0;
    }

    const explicitMappingId = Number(
      getMasterField(
        matchingMaster,
        'routeChamberMappingId',
        'RouteChamberMappingId',
        'routeMasterMappingId',
        'RouteMasterMappingId',
        'mappingId',
        'MappingId',
      ),
    );
    const recordId = Number(getMasterField(matchingMaster, 'id', 'Id'));
    const mappingId =
      Number.isInteger(explicitMappingId) && explicitMappingId > 0
        ? explicitMappingId
        : Number.isInteger(recordId) &&
          recordId > 0 &&
          recordId !== expectedMasterId
        ? recordId
        : 0;
    if (mappingId > 0) {
      masterMappingIdsRef.current.set(point.key, mappingId);
    }
    return mappingId;
  };

  const saveMappedMasterToServer = async (
    point: RoutePoint,
    pointIndex: number,
    routeId: number,
    serverStatus: 'unsave' | 'pause' | 'completed' = 'unsave',
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
    const drumDetails = getMappingDrumDetails(totalLength);
    const fiberDetails = getMappingFiberDetails(
      point,
      drumDetails.fiberTypeId,
      drumDetails.fiberTypeName,
    );
    const payloadFiberId = Number(fiberDetails.fiberId);
    if (!Number.isInteger(payloadFiberId) || payloadFiberId <= 0) {
      throw new Error(
        'A single fiber ID is unavailable for the selected master.',
      );
    }
    const fiberChangePhotoUri = asText(point.master?.__fiberChangePhotoUri);
    const routeOrderNo = isFiberChange
      ? Number(getMasterField(point.master, 'orderNo', 'OrderNo')) ||
        pointIndex + 1
      : pointIndex + 1;
    const routeChamberMappingId =
      masterMappingIdsRef.current.get(point.key) ??
      Number(
        getMasterField(
          point.master,
          'routeChamberMappingId',
          'RouteChamberMappingId',
          'routeMasterMappingId',
          'RouteMasterMappingId',
          'routeFiberMappingId',
          'RouteFiberMappingId',
          'mappingId',
          'MappingId',
        ),
      );
    const pointLatLng = getPointLatLng(point);
    const partialStartOrderNo = Number(
      route.params.routeDraft?.partialStartOrderNo,
    );
    const pointMasterId = Number(point.masterId);
    const sourceMasterId = Number(
      getMasterField(
        point.master,
        'IspMasterId',
        'ispMasterId',
        'masterId',
        'MasterId',
        'id',
        'Id',
      ),
    );
    const resolvedMasterId =
      Number.isInteger(pointMasterId) && pointMasterId > 0
        ? pointMasterId
        : Number.isInteger(sourceMasterId) && sourceMasterId > 0
        ? sourceMasterId
        : 0;
    const sourceMasterType = asText(
      getMasterField(
        point.master,
        'point',
        'Point',
        'masterType',
        'MasterType',
        'masterTypeName',
        'MasterTypeName',
        'type',
        'Type',
      ),
    );
    const normalizedSourceMasterType = normalizeMasterType(sourceMasterType);
    const resolvedMasterType =
      MASTER_META[normalizedSourceMasterType]?.label ||
      sourceMasterType ||
      point.masterTypeLabel;
    if (
      route.params.fiberChangeMode === 'withoutSld' &&
      resolvedMasterId === 0
    ) {
      throw new Error(`MasterId is unavailable for ${point.name}.`);
    }
    if (!isFiberChange && resolvedMasterId === 0) {
      throw new Error(`MasterId is unavailable for ${point.name}.`);
    }
    const mappingPayload = {
      id:
        Number.isInteger(routeChamberMappingId) && routeChamberMappingId > 0
          ? routeChamberMappingId
          : 0,
      routeId,
      masterType:
        route.params.fiberChangeMode === 'withoutSld'
          ? resolvedMasterType
          : point.masterTypeLabel,
      masterId: resolvedMasterId,
      distance: Math.round(mappedSegmentDistance),
      endLatLng: pointLatLng,
      endSelectedAddress:
        asText(
          getMasterField(point.master, 'selectedAddress', 'SelectedAddress'),
        ) || point.address,
      endAddress: point.address,
      endLandmark: asText(getMasterField(point.master, 'landmark', 'Landmark')),
      endArea: asText(getMasterField(point.master, 'area', 'Area')),
      endCity: asText(getMasterField(point.master, 'city', 'City')),
      endState:
        asText(route.params.routeDraft?.stateName) ||
        asText(getMasterField(point.master, 'state', 'State')),
      endPincode:
        Number(getMasterField(point.master, 'pincode', 'Pincode', 'PinCode')) ||
        0,
      endCountry: asText(getMasterField(point.master, 'country', 'Country')),
      routeLength: Math.round(totalLength),
      orderNo: routeOrderNo,
      totalLength: Math.round(totalLength),
      drumLength: Math.round(drumDetails.drumLength),
      drumRemainingLength: Math.round(drumDetails.drumRemainingLength),
      loopUsed,
      fiberId: payloadFiberId,
      fiberType: fiberDetails.fiberType,
      fiberUsedBy: fiberDetails.fiberUsedBy,
      ...(!isFiberChange
        ? {
            status: serverStatus,
            zoneId: Number(route.params.routeDraft?.zoneId) || 0,
          }
        : {}),
      ...(isFiberChange
        ? {
            fiberChangeScope:
              route.params.fiberChangeMode === 'full'
                ? ('FullRoute' as const)
                : route.params.fiberChangeMode === 'withoutSld'
                ? ('WithoutSLD' as const)
                : ('PartialRoute' as const),
          }
        : {}),
      ...(route.params.fiberChangeMode === 'partial'
        ? {
            isStartingPoint:
              Number.isFinite(partialStartOrderNo) &&
              routeOrderNo === partialStartOrderNo,
          }
        : {}),
      ...(isFiberChange
        ? {
            // Every installation mode updates only the photographed master.
            // Equal boundaries stop skipped route orders from being inferred
            // and inserted between masters that the user explicitly chose.
            isPartialChange: route.params.fiberChangeMode === 'partial',
            fromOrderNo: routeOrderNo,
            toOrderNo: routeOrderNo,
            fromMasterName: point.name,
            toMasterName: point.name,
            fromMasterType: point.masterTypeLabel,
            toMasterType: point.masterTypeLabel,
            fromAddress: point.address,
            toAddress: point.address,
            fromLatLng: pointLatLng,
            toLatLng: pointLatLng,
            segmentLength: 0,
          }
        : {}),
      ...(isFiberChange && fiberChangePhotoUri
        ? {
            imageFile: {
              uri: fiberChangePhotoUri,
              type:
                asText(point.master?.__fiberChangePhotoType) || 'image/jpeg',
              fileName:
                asText(point.master?.__fiberChangePhotoName) ||
                `fiber-master-${point.masterId || point.key}.jpg`,
            },
          }
        : {}),
      drumId: asText(drumDetails.drumId),
      drumNo: drumDetails.drumNo,
    };
    const mappingResponse = await dispatch(
      insertUpdateRouteChamberMappingAPI(mappingPayload),
    ).unwrap();
    markMasterAsServerSaved(
      point.key,
      getCreatedMappingId(mappingResponse) || routeChamberMappingId,
      !isFiberChange ? serverStatus : undefined,
      loopUsed,
    );
  };

  const saveStoppedMasterToServer = async (
    point: RoutePoint,
    stopPosition: Coordinate,
    serverStatus: 'unsave' | 'pause' | 'completed' = 'completed',
  ) => {
    if (isFiberChange) {
      const routeId = initialRouteIdRef.current;
      const pointIndex = routePoints.findIndex(item => item.key === point.key);
      if (!routeId || pointIndex < 0) {
        throw new Error('Selected fiber route master is unavailable.');
      }
      await saveMappedMasterToServer(point, pointIndex, routeId);
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
    }

    // The first master is already stored by createInitialRouteAPI. Each Stop
    // must insert only the newly selected destination master; walking earlier
    // points here created duplicate chamber and SLD rows.
    if (pointIndex === 0 && serverStatus === 'completed') {
      return;
    }
    await saveMappedMasterToServer(point, pointIndex, routeId, serverStatus);
  };

  const ensureMasterSavedToServer = (
    point: RoutePoint,
    position: Coordinate,
    serverStatus: 'unsave' | 'pause' | 'completed' = 'completed',
  ) => {
    const saveKey = point.key;
    const pendingSave = masterSavePromisesRef.current.get(saveKey);
    if (pendingSave) {
      return pendingSave;
    }

    const savePromise = (async () => {
      if (savedMasterKeysRef.current.has(point.key)) {
        const savedStatus = asText(point.master?.routeStatus).toLowerCase();
        const currentLoopUsed = asPositiveNumber(point.loopMeters);
        const savedLoopUsed = savedMasterLoopValuesRef.current.get(point.key);
        if (savedStatus === serverStatus && savedLoopUsed === currentLoopUsed) {
          return;
        }
        const routeId = initialRouteIdRef.current;
        if (!routeId) {
          return;
        }
        const mappingId = await resolveServerMappingId(point, routeId);
        // Never update an existing status with Id 0: the backend treats that
        // as a new row and creates duplicate chamber/SLD mappings.
        if (!mappingId) {
          return;
        }
      }
      await saveStoppedMasterToServer(point, position, serverStatus);
    })().finally(() => {
      masterSavePromisesRef.current.delete(saveKey);
    });
    masterSavePromisesRef.current.set(saveKey, savePromise);
    return savePromise;
  };

  const saveRoutePathProgress = async (position: Coordinate) => {
    const routeId = initialRouteIdRef.current;
    if (!routeId) {
      return;
    }

    const coordinates = [...routePathRef.current];
    const lastCoordinate = coordinates[coordinates.length - 1];
    if (coordinates.length === 0) {
      coordinates.push(position, position);
    } else if (coordinates.length === 1) {
      coordinates.push(position);
    } else if (
      !lastCoordinate ||
      distanceBetween(lastCoordinate, position) >= 0.5
    ) {
      coordinates.push(position);
    }

    await dispatch(
      updateRoutePathDetailsAPI({
        routeId,
        routePath: `LINESTRING(${coordinates
          .map(coordinate => `${coordinate.longitude} ${coordinate.latitude}`)
          .join(', ')})`,
      }),
    ).unwrap();
  };

  const handleStart = async () => {
    if (!activePoint || trackingState !== 'idle' || isSelectingMaster) {
      return;
    }

    const lockLoopImmediately = route.params.fiberChangeMode === 'withoutSld';
    try {
      // Save the loop currently entered for this master before the input is
      // locked and route tracking begins.
      if (!isFiberChange && !initialRouteIdRef.current) {
        await saveInitialMasterToServer(
          routePoints[0] ?? activePoint,
          currentPositionRef.current,
        );
      } else if (!isFiberChange) {
        await ensureMasterSavedToServer(
          activePoint,
          currentPositionRef.current,
          'unsave',
        );
      }
      if (route.params.fiberChangeMode !== 'withoutSld') {
        await saveRoutePathProgress(currentPositionRef.current);
      }
      segmentDistanceRef.current = 0;
      setSegmentDistance(0);
      if (lockLoopImmediately) {
        setRoutePoints(previous =>
          previous.map(point =>
            point.key === activePoint.key ? {...point, isLocked: true} : point,
          ),
        );
      }
      const started = await startLocationWatch();
      if (started) {
        if (!lockLoopImmediately) {
          setRoutePoints(previous =>
            previous.map(point =>
              point.key === activePoint.key
                ? {...point, isLocked: true}
                : point,
            ),
          );
        }
      } else {
        if (lockLoopImmediately) {
          setRoutePoints(previous =>
            previous.map(point =>
              point.key === activePoint.key
                ? {...point, isLocked: false}
                : point,
            ),
          );
        }
        setTrackingStateValue('idle');
      }
    } catch (error: any) {
      if (lockLoopImmediately) {
        setRoutePoints(previous =>
          previous.map(point =>
            point.key === activePoint.key ? {...point, isLocked: false} : point,
          ),
        );
      }
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
      if (!isFiberChange && activePoint) {
        try {
          await ensureMasterSavedToServer(
            activePoint,
            currentPositionRef.current,
            'pause',
          );
          await saveRoutePathProgress(currentPositionRef.current);
        } catch (error: any) {
          showRouteAlert({
            title: 'Pause Save Failed',
            message:
              error?.message || 'Unable to save the paused route status.',
            tone: 'error',
          });
        }
      }
      const pausedSnapshot: PausedRouteSnapshot = {
        ...persistedRouteSnapshot,
        routeDraft: {
          ...persistedRouteSnapshot.routeDraft,
          ...(initialRouteIdRef.current
            ? {routeId: initialRouteIdRef.current}
            : {}),
        },
        trackingState: 'paused',
        status: 'paused',
        updatedAt: Date.now(),
      };
      savePausedRouteSnapshot(pausedSnapshot);
      latestSnapshotRef.current = pausedSnapshot;
      Common.showToast(
        isFiberChange
          ? 'Fiber change saved to paused routes.'
          : 'Route saved to paused routes.',
      );
      return;
    }
    if (trackingState === 'paused') {
      try {
        if (!isFiberChange && activePoint) {
          await ensureMasterSavedToServer(
            activePoint,
            currentPositionRef.current,
            'unsave',
          );
        }
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
    if (
      isFiberChange &&
      !capturedFiberMasterKeys.has(activePoint.key) &&
      !asText(activePoint.master?.__fiberChangePhotoUri)
    ) {
      showRouteAlert({
        title: 'Master Photo Required',
        message:
          'Capture a photo of this route master before using Stop & Add Master.',
        tone: 'camera',
      });
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
      if (finalMovement >= MIN_TRACK_DISTANCE_METERS && finalMovement <= 12) {
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

      if (isFiberChange) {
        if (route.params.fiberChangeMode === 'withoutSld') {
          const photographedUnsavedMasters = routePoints.filter(
            point =>
              !savedMasterKeysRef.current.has(point.key) &&
              Boolean(asText(point.master?.__fiberChangePhotoUri)),
          );
          for (const point of photographedUnsavedMasters) {
            await ensureMasterSavedToServer(point, stopPosition);
          }
          await ensureMasterSavedToServer(activePoint, stopPosition);
        } else {
          await ensureMasterSavedToServer(activePoint, stopPosition);
        }
      }
      if (route.params.fiberChangeMode !== 'withoutSld') {
        await saveRoutePathProgress(stopPosition);
      }
      failureStage = 'masters';

      if (isFiberChange && route.params.fiberChangeRoute) {
        const completedSegment = {
          id: `${activePoint.key}-${Date.now()}`,
          afterPointKey: activePoint.key,
          distance: completedSegmentDistance,
        };
        const completedWalkingSegments = [...walkingSegments, completedSegment];
        const completedRoutePoints = routePoints.map(point => ({
          key: point.key,
          master: point.master,
          masterId: point.masterId,
          masterType: point.masterType,
          masterTypeLabel: point.masterTypeLabel,
          name: point.name,
          address: point.address,
          coordinate: point.coordinate,
          imageUrls: [...point.imageUrls],
          loopMeters: point.loopMeters,
          isLocked: true,
          isServerSaved: true,
        }));
        setWalkingSegments(completedWalkingSegments);
        segmentDistanceRef.current = 0;
        setSegmentDistance(0);
        setTrackingStateValue('idle');
        const stoppedSnapshot: PausedRouteSnapshot = {
          id: routeSnapshotIdRef.current,
          routeName: route.params.routeName,
          routeDraft: {
            ...route.params.routeDraft,
            routeId: initialRouteIdRef.current,
          },
          currentPosition: stopPosition,
          currentAddress: stopAddress,
          routePoints: completedRoutePoints,
          routePath: [...routePathRef.current],
          walkingSegments: completedWalkingSegments,
          segmentDistance: 0,
          trackingState: 'idle',
          drumAllocations,
          totalDistance:
            completedWalkingDistance +
            completedSegmentDistance +
            totalLoopDistance,
          status: 'stopped',
          createdAt: routeCreatedAtRef.current,
          updatedAt: Date.now(),
          workflowType: 'fiberChange',
          resumeTarget: 'makeRoute',
          fiberChangeMode: route.params.fiberChangeMode,
          fiberChangeRoute: route.params.fiberChangeRoute,
          fiberChangeSelectedFibers:
            route.params.fiberChangeSelectedFibers ?? [],
          fiberChangeActiveMasterKey: activePoint.key,
        };
        savePausedRouteSnapshot(stoppedSnapshot);
        latestSnapshotRef.current = stoppedSnapshot;
        Keyboard.dismiss();
        navigation.replace('Fiber-Change', {
          selectedRoute: route.params.fiberChangeRoute,
          selectedFibers: route.params.fiberChangeSelectedFibers ?? [],
          installationScope: route.params.fiberChangeMode,
          installationProgress: stoppedSnapshot,
        });
        return;
      }

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

  const handleAddFirstMaster = async () => {
    setIsSelectingMaster(true);
    try {
      const response = await dispatch(
        GetNearestPoleTreeDDAPI({
          latLng: `${currentPosition.latitude}, ${currentPosition.longitude}`,
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

      navigation.navigate('Select-Route-Master', {
        routeSelectionMode: true,
        returnToRouteBuilder: true,
        routeName: route.params.routeName,
        routeDraft: route.params.routeDraft,
        currentPosition,
        currentAddress,
        initialMasters,
        routeExistingMasters: [],
      });
    } catch (error: any) {
      showRouteAlert({
        title: 'Select Master',
        message: error?.message || 'Unable to load nearest masters.',
        tone: 'error',
      });
    } finally {
      setIsSelectingMaster(false);
    }
  };

  const completeRouteLocally = () => {
    stopLocationWatch();
    Keyboard.dismiss();
    setTrackingStateValue('idle');
    setIsEnding(false);

    saveCompletedAppRoute({
      serverRouteId: asText(initialRouteIdRef.current) || undefined,
      routeName: route.params.routeName,
      currentPosition: currentPositionRef.current,
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

    showRouteAlert({
      title: 'Saved Successfully',
      message: `${route.params.routeName} has been saved successfully.`,
      tone: 'success',
      buttons: [
        {
          text: 'OK',
          variant: 'primary',
          onPress: () => navigation.goBack(),
        },
      ],
    });
  };

  const handleEndRoute = async () => {
    if (isFiberChange && route.params.fiberChangeRoute) {
      if (trackingState !== 'idle') {
        showRouteAlert({
          title: 'Finish Current Master',
          message:
            'Use Stop & Save Master to save this master loop before ending the fiber change.',
          tone: 'warning',
        });
        return;
      }

      if (route.params.fiberChangeMode === 'withoutSld') {
        const photographedUnsavedMasters = routePoints.filter(
          point =>
            !savedMasterKeysRef.current.has(point.key) &&
            Boolean(asText(point.master?.__fiberChangePhotoUri)),
        );
        if (photographedUnsavedMasters.length > 0) {
          try {
            setIsEnding(true);
            for (const point of photographedUnsavedMasters) {
              await ensureMasterSavedToServer(
                point,
                currentPositionRef.current,
              );
            }
          } catch (error: any) {
            showRouteAlert({
              title: 'Fiber Change Save Failed',
              message:
                error?.message ||
                'Unable to save the photographed route masters.',
              tone: 'error',
            });
            return;
          } finally {
            setIsEnding(false);
          }
        }
      }

      routeCompletedRef.current = true;
      removeCompletedRouteSnapshot(routeSnapshotIdRef.current);
      Keyboard.dismiss();
      navigation.replace('Fiber-Change', {
        selectedRoute: route.params.fiberChangeRoute,
        selectedFibers: route.params.fiberChangeSelectedFibers ?? [],
        installationScope: route.params.fiberChangeMode,
      });
      return;
    }

    try {
      setIsEnding(true);
      stopLocationWatch();
      for (const point of routePoints) {
        await ensureMasterSavedToServer(
          point,
          currentPositionRef.current,
          'completed',
        );
      }
      await saveRoutePathProgress(currentPositionRef.current);
      completeRouteLocally();
    } catch (error: any) {
      setTrackingStateValue('paused');
      savePausedRouteSnapshot({
        ...persistedRouteSnapshot,
        trackingState: 'paused',
        status: 'paused',
        updatedAt: Date.now(),
      });
      showRouteAlert({
        title: 'Route Completion Failed',
        message: error?.message || 'Unable to save the completed route status.',
        tone: 'error',
      });
    } finally {
      setIsEnding(false);
    }
  };

  const handleBack = () => {
    if (trackingState === 'idle') {
      Keyboard.dismiss();
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
          onPress: async () => {
            stopLocationWatch();
            const stoppedSnapshot: PausedRouteSnapshot = {
              ...persistedRouteSnapshot,
              trackingState: 'idle',
              status: 'stopped',
              updatedAt: Date.now(),
            };
            savePausedRouteSnapshot(stoppedSnapshot);
            latestSnapshotRef.current = stoppedSnapshot;
            if (!isFiberChange && activePoint) {
              try {
                await ensureMasterSavedToServer(
                  activePoint,
                  currentPositionRef.current,
                  'completed',
                );
              } catch (error: any) {
                showRouteAlert({
                  title: 'Stop Save Failed',
                  message:
                    error?.message ||
                    'Unable to save the completed master status.',
                  tone: 'error',
                });
                return;
              }
            }
            Keyboard.dismiss();
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

  const deleteCapturedFiberPhoto = (pointKey: string) => {
    setRoutePoints(previous =>
      previous.map(point => {
        if (point.key !== pointKey) {
          return point;
        }
        const master = {...(point.master ?? {})};
        delete master.__fiberChangePhotoUri;
        delete master.__fiberChangePhotoType;
        delete master.__fiberChangePhotoName;
        return {...point, master, imageUrls: []};
      }),
    );
    setCapturedFiberMasterKeys(previous => {
      const next = new Set(previous);
      next.delete(pointKey);
      return next;
    });
  };

  const renderWalkingRow = (distance: number, key: string, isLive = false) => (
    <View key={key} style={styles.walkingRow}>
      <View style={styles.walkingLine} />
      <View style={isLive ? styles.liveWalkingPill : styles.distanceConnector}>
        {isLive ? (
          <Image
            source={
              trackingState === 'walking'
                ? IMAGES.manWalking
                : IMAGES.walkingManStatic
            }
            style={styles.walkingListImage}
          />
        ) : (
          <Text style={styles.distanceArrow}>↕</Text>
        )}
        <Text
          style={[
            styles.walkingDistance,
            isLive && styles.liveWalkingDistance,
          ]}>
          {formatWalkingDistance(distance)}
        </Text>
      </View>
    </View>
  );

  const fitExpandedMapToRoute = () => {
    const coordinates =
      routePolylineCoordinates.length > 1
        ? [
            ...routePolylineCoordinates,
            ...masterMarkers.map(point => point.coordinate),
          ]
        : [currentPosition, ...masterMarkers.map(point => point.coordinate)];

    if (coordinates.length > 1) {
      expandedMapRef.current?.fitToCoordinates(coordinates, {
        animated: false,
        edgePadding: {top: 100, right: 65, bottom: 120, left: 65},
      });
      return;
    }

    expandedMapRef.current?.animateToRegion(
      {
        ...currentPosition,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      },
      0,
    );
  };

  const handleRouteMapDisplayTypeChange = (type: RouteMapDisplayType) => {
    setMapDisplayType(type);
    requestAnimationFrame(() => {
      expandedMapRef.current?.animateCamera(
        type === 'threeDimensional'
          ? {pitch: 60, heading: 0, zoom: 18, altitude: 350}
          : {pitch: 0, heading: 0},
        {duration: type === 'threeDimensional' ? 650 : 350},
      );
    });
  };

  const openConnectedFiberForPoint = (point: RoutePoint) => {
    const pointCode = asText(
      getMasterField(point.master, 'masterCode', 'MasterCode', 'code', 'Code'),
    ).toLowerCase();
    const pointName =
      getMasterName(point.master).toLowerCase() || point.name.toLowerCase();
    const pointType = normalizeMasterType(
      point.masterType || point.masterTypeLabel,
    );
    const pointOrderNo = Number(
      getMasterField(point.master, 'orderNo', 'OrderNo'),
    );
    const matchingRecord = connectedFiberRouteMasters.find(record => {
      const recordCode = asText(
        getMasterField(record, 'masterCode', 'MasterCode', 'code', 'Code'),
      ).toLowerCase();
      if (pointCode && recordCode === pointCode) {
        return true;
      }
      const recordName = getMasterName(record).toLowerCase();
      const recordType = normalizeMasterType(getMasterType(record));
      const recordOrderNo = Number(
        getMasterField(record, 'orderNo', 'OrderNo'),
      );
      return Boolean(
        (pointName &&
          recordName === pointName &&
          (!pointType || !recordType || recordType === pointType)) ||
          (Number.isFinite(pointOrderNo) &&
            recordOrderNo === pointOrderNo &&
            (!pointType || !recordType || recordType === pointType)),
      );
    });
    const serverMasterId = Number(
      getMasterField(
        matchingRecord,
        'IspMasterId',
        'ispMasterId',
        'masterId',
        'MasterId',
        'newMasterId',
        'NewMasterId',
      ),
    );
    const localMasterId = Number(point.masterId || getMasterId(point.master));
    const resolvedMasterId =
      Number.isInteger(serverMasterId) && serverMasterId > 0
        ? serverMasterId
        : localMasterId;
    if (Number.isInteger(resolvedMasterId) && resolvedMasterId > 0) {
      setConnectedFiberMasterId(resolvedMasterId);
      return;
    }
    Common.showToast(
      `Master ID is unavailable for ${point.masterTypeLabel} - ${point.name}.`,
    );
  };

  const handleRouteMapPress = (event: any) => {
    const pressedCoordinate = event?.nativeEvent?.coordinate as
      | Coordinate
      | undefined;
    if (!pressedCoordinate || masterMarkers.length === 0) {
      return;
    }
    const nearest = masterMarkers.reduce<{
      point: RoutePoint & {coordinate: Coordinate};
      distance: number;
    } | null>((current, point) => {
      const distance = distanceBetween(pressedCoordinate, point.coordinate);
      return !current || distance < current.distance
        ? {point, distance}
        : current;
    }, null);
    if (nearest && nearest.distance <= 40) {
      openConnectedFiberForPoint(nearest.point);
    }
  };

  const renderRouteMap = (
    mapReference: React.RefObject<MapView>,
    expanded = false,
  ) => (
    <MapView
      ref={mapReference}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      mapType={mapDisplayType === 'satellite' ? 'satellite' : 'standard'}
      style={styles.map}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={expanded}
      toolbarEnabled={false}
      cacheEnabled={false}
      loadingEnabled={mapDisplayType === 'satellite'}
      loadingIndicatorColor={COLORS.PRIMARY}
      maxZoomLevel={20}
      pitchEnabled
      rotateEnabled
      showsBuildings
      zoomEnabled
      onPress={handleRouteMapPress}
      onMapReady={expanded ? fitExpandedMapToRoute : undefined}
      initialRegion={{
        ...route.params.currentPosition,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }}>
      {routePolylineCoordinates.length > 1 ? (
        <>
          <Polyline
            coordinates={routePolylineCoordinates}
            strokeColor="rgba(255,255,255,0.9)"
            strokeWidth={9}
            lineCap="round"
            lineJoin="round"
            geodesic
            zIndex={19}
          />
          <Polyline
            coordinates={routePolylineCoordinates}
            strokeColor="#6D43E5"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            geodesic
            zIndex={20}
          />
        </>
      ) : null}

      {masterMarkers.map((point, index) => {
        const isActiveMarker = point.key === activePoint?.key;

        return (
          <RouteMasterMapMarker
            key={`master-${point.key}`}
            point={point}
            index={index}
            isActive={isActiveMarker}
            onPress={() => openConnectedFiberForPoint(point)}
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
  );

  return (
    <Screen
      preset="fixed"
      keyboardAvoidingEnabled={Platform.OS === 'ios'}
      statusBgColor={COLORS.PRIMARY}
      navBarColor={COLORS.WHITE}>
      <View style={styles.screen}>
        <BackHeader
          title={
            isFiberChange
              ? 'Fiber Change'
              : isReadOnly
              ? 'Route Details'
              : 'Add Route'
          }
          onBackPress={handleBack}
        />

        <View style={styles.mapContainer}>
          {renderRouteMap(mapRef)}
          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Expand route map"
            onPress={() => setIsMapExpanded(true)}
            style={styles.mapExpandButton}>
            <View style={styles.expandIcon}>
              <View style={[styles.expandCorner, styles.expandCornerTopLeft]} />
              <View
                style={[styles.expandCorner, styles.expandCornerTopRight]}
              />
              <View
                style={[styles.expandCorner, styles.expandCornerBottomLeft]}
              />
              <View
                style={[styles.expandCorner, styles.expandCornerBottomRight]}
              />
            </View>
          </TouchableOpacity>
          <ConnectedFiberDetailsModal
            masterId={isMapExpanded ? null : connectedFiberMasterId}
            onClose={() => setConnectedFiberMasterId(null)}
          />
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
            const hasCapturedFiberPhoto =
              Boolean(point.imageUrls[0]) &&
              (capturedFiberMasterKeys.has(point.key) ||
                Boolean(asText(point.master?.__fiberChangePhotoUri)));

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
                        (point.isLocked ||
                          isReadOnly ||
                          (isFiberChange && !canEditFiberLoop)) &&
                          styles.loopControlLocked,
                      ]}>
                      {point.isLocked ||
                      isReadOnly ||
                      (isFiberChange && !canEditFiberLoop) ? (
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

                  {isFiberChange && hasCapturedFiberPhoto ? (
                    <View style={styles.fiberPhotoWrap}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`View captured photo for ${point.name}`}
                        onPress={() => openMasterImages(point)}
                        style={styles.masterThumbnail}>
                        <Image
                          source={{uri: point.imageUrls[0]}}
                          style={styles.masterThumbnailImage}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete captured photo for ${point.name}`}
                        onPress={() => deleteCapturedFiberPhoto(point.key)}
                        style={styles.fiberPhotoDelete}>
                        <Text style={styles.fiberPhotoDeleteText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isFiberChange ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Capture photo for ${point.name}`}
                      disabled={Boolean(capturingMasterKey)}
                      onPress={() => captureFiberChangeMaster(point)}
                      style={styles.masterThumbnail}>
                      {capturingMasterKey === point.key ? (
                        <ActivityIndicator size="small" color="#555A62" />
                      ) : (
                        <Image
                          source={IMAGES.camera}
                          style={[
                            styles.masterThumbnailImage,
                            styles.fiberCameraImage,
                          ]}
                        />
                      )}
                    </TouchableOpacity>
                  ) : (
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
                  )}

                  {!isReadOnly && !isFiberChange ? (
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
                      liveMasterDistance,
                      `live-${point.key}`,
                      true,
                    )
                  : null}
              </View>
            );
          })}

          {routePoints.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No master selected</Text>
              <Text style={styles.emptyText}>
                Tap Add Master to choose the first master for this route.
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
              disabled={
                trackingState !== 'idle' ||
                !activePoint ||
                isDrumLengthExhausted
              }
              onPress={handleStart}
              style={[
                styles.footerButton,
                styles.startButton,
                (trackingState !== 'idle' ||
                  !activePoint ||
                  isDrumLengthExhausted) &&
                  styles.footerButtonDisabled,
              ]}>
              <Text style={styles.footerButtonText}>Start</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              disabled={
                isSelectingMaster ||
                (Boolean(activePoint) && trackingState === 'idle') ||
                (isFiberChange && !canEditFiberLoop && !activePoint)
              }
              onPress={
                activePoint ? handleStopAndAddMaster : handleAddFirstMaster
              }
              style={[
                styles.footerButton,
                styles.addMasterButton,
                (isSelectingMaster ||
                  (Boolean(activePoint) && trackingState === 'idle') ||
                  (isFiberChange && !canEditFiberLoop && !activePoint)) &&
                  styles.footerButtonDisabled,
              ]}>
              {isSelectingMaster ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.footerButtonText}>
                  {activePoint
                    ? isFiberChange
                      ? 'Stop & Save Master'
                      : 'Stop & Add Master'
                    : isFiberChange && !canEditFiberLoop
                    ? 'Master Unavailable'
                    : 'Add Master'}
                </Text>
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
          visible={Boolean(fiberCameraPoint)}
          statusBarTranslucent
          presentationStyle="overFullScreen"
          animationType="fade"
          onRequestClose={closeFiberCamera}>
          <View style={styles.fiberCameraContainer}>
            {fiberCameraPoint ? (
              <Camera
                ref={fiberCameraRef}
                cameraType={CameraType.Back}
                flashMode="auto"
                resizeMode="cover"
                maxPhotoQualityPrioritization="speed"
                shutterPhotoSound
                onError={event =>
                  handleFiberCameraError(event.nativeEvent.errorMessage)
                }
                style={styles.fiberCameraPreview}
              />
            ) : null}

            <View style={styles.fiberCameraHeader}>
              <View style={styles.fiberCameraTitlePill}>
                <Text numberOfLines={1} style={styles.fiberCameraTitle}>
                  {fiberCameraPoint
                    ? `Capture ${fiberCameraPoint.name}`
                    : 'Capture Master Photo'}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close camera"
                disabled={isProcessingFiberPhoto}
                onPress={closeFiberCamera}
                style={styles.fiberCameraCloseButton}>
                <Text style={styles.fiberCameraCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fiberCameraFooter}>
              <Text style={styles.fiberCameraHint}>
                Keep the route master clearly visible in the frame
              </Text>
              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                disabled={isProcessingFiberPhoto}
                onPress={takeFiberChangePhoto}
                style={styles.fiberCameraShutter}>
                {isProcessingFiberPhoto ? (
                  <ActivityIndicator color={COLORS.WHITE} />
                ) : (
                  <View style={styles.fiberCameraShutterInner} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isMapExpanded}
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setIsMapExpanded(false)}>
          <View style={styles.expandedMapContainer}>
            {renderRouteMap(expandedMapRef, true)}
            <ConnectedFiberDetailsModal
              masterId={isMapExpanded ? connectedFiberMasterId : null}
              expanded
              onClose={() => setConnectedFiberMasterId(null)}
            />

            <View style={styles.expandedMapHeader} pointerEvents="box-none">
              <View style={styles.expandedMapTitlePill}>
                <Text numberOfLines={1} style={styles.expandedMapTitle}>
                  {route.params.routeName || 'Route Map'}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Close fullscreen route map"
                onPress={() => setIsMapExpanded(false)}
                style={styles.expandedMapCloseButton}>
                <Text style={styles.expandedMapCloseText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.expandedMapTypeControl}>
              {ROUTE_MAP_DISPLAY_OPTIONS.map(({type, label}) => {
                const isSelected = mapDisplayType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${label.toLowerCase()} map`}
                    accessibilityState={{selected: isSelected}}
                    onPress={() => handleRouteMapDisplayTypeChange(type)}
                    style={[
                      styles.expandedMapTypeOption,
                      isSelected && styles.expandedMapTypeOptionSelected,
                    ]}>
                    <Text
                      style={[
                        styles.expandedMapTypeText,
                        isSelected && styles.expandedMapTypeTextSelected,
                      ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>

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
              <Text style={styles.drumSheetTitle}>Select Fiber and Drum</Text>

              <View style={styles.drumFormCard}>
                <View style={styles.drumNumberField}>
                  <Text style={styles.drumFieldLabel}>
                    Fiber Type
                    <Text style={styles.drumRequired}> *</Text>
                  </Text>
                  <View style={styles.drumSelectRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      disabled={isLoadingFibers || fiberOptions.length === 0}
                      onPress={() => {
                        setShowFiberOptions(previous => !previous);
                        setShowDrumOptions(false);
                      }}
                      style={styles.drumSelectInput}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.drumSelectText,
                          !selectedAdditionalFiber &&
                            styles.drumPlaceholderText,
                        ]}>
                        {selectedAdditionalFiber?.label || 'Select Fiber Type'}
                      </Text>
                      <Image
                        source={IMAGES.down}
                        style={styles.drumSelectArrow}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {showFiberOptions ? (
                  <View style={styles.drumOptionsList}>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}>
                      {fiberOptions.map(option => {
                        const selected =
                          option.value === selectedAdditionalFiberId;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            activeOpacity={0.78}
                            onPress={() => selectAdditionalFiber(option)}
                            style={[
                              styles.drumOptionRow,
                              selected && styles.drumOptionRowSelected,
                            ]}>
                            <Text style={styles.drumOptionLabel}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={styles.additionalDrumField}>
                  <View style={styles.drumNumberField}>
                    <Text style={styles.drumFieldLabel}>
                      Available Drum Name / No.
                      <Text style={styles.drumRequired}> *</Text>
                    </Text>
                    <View style={styles.drumSelectRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={
                          !selectedAdditionalFiber ||
                          isLoadingDrums ||
                          drumOptions.length === 0
                        }
                        onPress={() => {
                          setShowDrumOptions(previous => !previous);
                          setShowFiberOptions(false);
                        }}
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
                          {Math.round(selectedDrumOption?.availableLength ?? 0)}
                          m
                        </Text>
                      </View>
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
                        const unavailable =
                          option.availableLength <= 0 ||
                          drumAllocations.some(
                            allocation => allocation.drumId === option.value,
                          );
                        const remaining = unavailable
                          ? 0
                          : option.availableLength;
                        const selected = option.value === selectedDrumId;

                        return (
                          <TouchableOpacity
                            key={option.value}
                            activeOpacity={0.78}
                            disabled={unavailable}
                            onPress={() => selectAdditionalDrum(option)}
                            style={[
                              styles.drumOptionRow,
                              selected && styles.drumOptionRowSelected,
                              unavailable && styles.drumOptionRowDisabled,
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

                {isLoadingFibers || isLoadingDrums ? (
                  <View style={styles.drumFeedbackRow}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.colorMediumslateblue}
                    />
                    <Text style={styles.drumFeedbackText}>
                      {isLoadingFibers
                        ? 'Loading fiber types...'
                        : 'Loading drum numbers...'}
                    </Text>
                  </View>
                ) : drumLoadError ? (
                  <View style={styles.drumFeedbackRow}>
                    <Text style={styles.drumErrorText}>{drumLoadError}</Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        if (selectedAdditionalFiberId) {
                          loadAdditionalDrums(selectedAdditionalFiberId);
                        } else {
                          loadAdditionalFibers();
                        }
                      }}
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
                  disabled={
                    isLoadingFibers ||
                    isLoadingDrums ||
                    !selectedAdditionalFiber ||
                    !selectedDrumOption
                  }
                  onPress={confirmAdditionalDrum}
                  style={[
                    styles.drumSheetAction,
                    (isLoadingFibers ||
                      isLoadingDrums ||
                      !selectedAdditionalFiber ||
                      !selectedDrumOption) &&
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
            <Animated.View
              style={[
                styles.alertCard,
                {
                  opacity: alertCardAnimation,
                  transform: [
                    {
                      translateY: alertCardAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [24, 0],
                      }),
                    },
                    {
                      scale: alertCardAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.88, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <Animated.View
                style={[
                  styles.alertIconBox,
                  {backgroundColor: routeAlert.iconBg},
                  {transform: [{scale: alertIconAnimation}]},
                ]}>
                <Image
                  source={routeAlert.icon}
                  style={[styles.alertIcon, {tintColor: routeAlert.iconTint}]}
                  resizeMode="contain"
                />
              </Animated.View>
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
            </Animated.View>
          </View>
        </Modal>

        <FullscreenImageViewer
          visible={previewImages.length > 0}
          images={previewImages}
          index={previewImageIndex}
          title={previewTitle}
          onIndexChange={setPreviewImageIndex}
          onClose={() => setPreviewImages([])}
        />
      </View>
    </Screen>
  );
};

export default MakeRouteScreen;
