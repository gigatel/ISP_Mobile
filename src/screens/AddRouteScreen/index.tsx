import React, {FC, useCallback, useState, useRef, useEffect} from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {Screen} from '@organisms';
import styles from './styles';
import {BackHeader} from '@molecules';
import {MasterFormModal} from '../../components/molecules/MasterFormModal';
import {ScreenProps, DataType} from '@types';
import {COLORS, IMAGES, FONTS, SIZE} from '@res';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import {Location, Common, ImageWatermark} from '@utils';
import {parseAddressComponents} from '../../components/molecules/addressParser';
import {StoreDispatch} from '@reducers';
import {URLs} from '@apis';
import {UpdateMasterAPI, GetMasterByNameAPI} from '@slices/route.slice';
import {addRouteAPI} from '@slices/route.slice';
import {
  createInitialRouteAPI,
  updateRoutePathDetailsAPI,
  insertUpdateRouteChamberMappingAPI, // ✅ NEW IMPORT
} from '@slices/route.slice';
import {
  launchCamera,
  CameraOptions,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {useDispatch} from 'react-redux';
import {
  PERMISSIONS,
  check,
  request,
  RESULTS,
  openSettings,
} from 'react-native-permissions';

type RouteItem = {
  id: string;
  label: string;
  value: string;
  icon: any;
  status: 'idle' | 'started' | 'paused';
  completed: boolean;
  distance?: number;
  images: string[];
  masterData: any;
  name: string;
  address: string;
  apiImage?: string;
  apiImages?: string[];
  latitude?: number;
  longitude?: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

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
  icon: any;
  iconTint: string;
  iconBg: string;
  buttons: RouteAlertButton[];
};

type RouteAlertOptions = {
  title: string;
  message: string;
  tone?: RouteAlertTone;
  icon?: any;
  buttons?: RouteAlertButton[];
};

const NEAREST_MASTER_TOLERANCE_METERS = 5;
const NEAREST_MASTER_WARNING_LIMIT_METERS = 60;
const BUILDING_CROSSING_BUFFER_METERS = 25;
const BUILDING_ENDPOINT_BUFFER_METERS = 12;
const NEARBY_ROUTE_MASTER_SUGGESTION_METERS = 75;
const LOCATION_MATCH_TOLERANCE = 0.000001;

const isValidCoordinate = (coord?: Coordinate | null): coord is Coordinate =>
  Number.isFinite(coord?.latitude) && Number.isFinite(coord?.longitude);

const isSameCoordinate = (a: Coordinate, b: Coordinate) =>
  Math.abs(a.latitude - b.latitude) <= LOCATION_MATCH_TOLERANCE &&
  Math.abs(a.longitude - b.longitude) <= LOCATION_MATCH_TOLERANCE;

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

const getMasterLoopUsed = (master: any) => {
  const value = Number(
    master?.loopUsed ??
      master?.LoopUsed ??
      master?.loopMeters ??
      master?.LoopMeters ??
      master?.loop ??
      master?.Loop ??
      getValueByNormalizedKeys(master, [
        'loopUsed',
        'loopMeters',
        'loop',
        'loopLength',
      ]),
  );
  return Number.isFinite(value) && value >= 0 ? value : 0;
};

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

const buildRoutePathLineString = (coords: Coordinate[]) => {
  const validCoords = coords.filter(isValidCoordinate);
  const routeCoords = validCoords.filter(
    (coord, index) =>
      index === 0 || !isSameCoordinate(coord, validCoords[index - 1]),
  );

  if (routeCoords.length < 2) return null;

  return `LINESTRING(${routeCoords
    .map(coord => `${coord.longitude} ${coord.latitude}`)
    .join(',')})`;
};

const calculateDistanceBetweenCoords = (
  coord1: Coordinate,
  coord2: Coordinate,
): number => {
  const R = 6371e3;
  const phi1 = (coord1.latitude * Math.PI) / 180;
  const phi2 = (coord2.latitude * Math.PI) / 180;
  const deltaPhi = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLambda = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (distance?: number | null) => {
  if (!Number.isFinite(distance)) {
    return '-- m';
  }

  return `${Math.round(distance as number)} m`;
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

const isBuildingType = (masterType?: string | null) =>
  String(masterType ?? '').toLowerCase() === 'building';

const getMasterId = (master: any): string =>
  String(
    master?.id ?? master?.Id ?? master?.masterId ?? master?.MasterId ?? '',
  ).trim();

const getMasterDisplayName = (master: any, fallback = 'Unknown') =>
  String(
    master?.name ??
      master?.Name ??
      master?.masterName ??
      master?.MasterName ??
      fallback,
  ).trim() || fallback;

const getMasterTypeLabel = (source?: any, fallback = 'Master') => {
  const rawLabel =
    source?.masterType ??
    source?.MasterType ??
    source?.mastertype ??
    source?.master_type ??
    source?.Master_Type ??
    source?.label ??
    source?.value ??
    fallback;
  const label = String(rawLabel ?? fallback).trim();

  return label || fallback;
};

const getRouteItemTypeLabel = (item?: RouteItem | null) =>
  getMasterTypeLabel(item?.masterData, item?.label || 'Master');

const getUniqueStrings = (values: string[]) =>
  values.filter((value, index, self) => value && self.indexOf(value) === index);

const formatMasterNameList = (masters: any[], fallback = 'This master') => {
  const names = getUniqueStrings(
    masters
      .map(master => getMasterDisplayName(master, ''))
      .filter(Boolean),
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
  `Existing master(s): ${names}\nReason: Same location or address already exists.\nAction required: Review the details before adding another master.`;

const getImageStringValues = (value: any): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(getImageStringValues);
  }

  if (typeof value === 'object') {
    return getImageStringValues(
      value.uri ??
        value.url ??
        value.imageUrl1 ??
        value.ImageUrl1 ??
        value.imageUrl ??
        value.path ??
        value.filePath ??
        value.fileName,
    );
  }

  const imageValue = String(value)
    .trim()
    .replace(/^["']|["']$/g, '');
  const lowerImageValue = imageValue.toLowerCase();

  if (
    !imageValue ||
    lowerImageValue === 'null' ||
    lowerImageValue === 'undefined'
  ) {
    return [];
  }

  return [imageValue];
};

const getBase64ImageUri = (value: string) => {
  const compactValue = value.replace(/\s/g, '');

  if (compactValue.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${compactValue}`;
  }

  if (compactValue.startsWith('iVBOR')) {
    return `data:image/png;base64,${compactValue}`;
  }

  if (compactValue.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${compactValue}`;
  }

  if (compactValue.startsWith('UklGR')) {
    return `data:image/webp;base64,${compactValue}`;
  }

  return '';
};

const getMasterImageUriCandidates = (value: any): string[] => {
  const ispApiBaseUrl = URLs.BASE_URL_2.endsWith('/')
    ? URLs.BASE_URL_2
    : `${URLs.BASE_URL_2}/`;
  const ispRootBaseUrl = ispApiBaseUrl.replace(/\/api\/?$/i, '/');

  return getUniqueStrings(
    getImageStringValues(value).flatMap(imageValue => {
      if (
        /^(https?:\/\/|file:\/\/|content:\/\/|data:image\/)/i.test(imageValue)
      ) {
        return [imageValue];
      }

      const base64ImageUri = getBase64ImageUri(imageValue);

      if (base64ImageUri) {
        return [base64ImageUri];
      }

      const imagePath = imageValue.replace(/\\/g, '/').replace(/^~?\//, '');

      if (!imagePath) {
        return [];
      }

      const rootUrl = `${ispRootBaseUrl}${imagePath}`;
      const apiUrl = `${ispApiBaseUrl}${imagePath}`;

      return imagePath.toLowerCase().startsWith('api/')
        ? [rootUrl]
        : [rootUrl, apiUrl];
    }),
  );
};

const getMasterImageCandidates = (master: any): string[] =>
  getUniqueStrings(
    [
      master?.imageUrl1,
      master?.ImageUrl1,
      master?.imageURL1,
      master?.ImageURL1,
      master?.IMAGEURL1,
      master?.imageurl1,
      master?.image_url1,
      master?.image1,
      master?.Image1,
      master?.IMAGE1,
      master?.imageFile1,
      master?.ImageFile1,
      master?.uploadImage1,
      master?.UploadImage1,
      master?.uploadedImage1,
      master?.UploadedImage1,
      master?.imagePath1,
      master?.ImagePath1,
      master?.imageUrl,
      master?.ImageUrl,
      master?.imageURL,
      master?.ImageURL,
      master?.fileUrl,
      master?.FileUrl,
      master?.filePath,
      master?.FilePath,
      master?.imagePath,
      master?.ImagePath,
      master?.image,
      master?.Image,
    ].flatMap(getMasterImageUriCandidates),
  );

const getMasterFirstImage = (master: any): string =>
  getMasterImageCandidates(master)[0] || '';

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

const getRouteItemCoordinate = (item?: RouteItem | null): Coordinate | null => {
  if (!item) {
    return null;
  }

  const coordinate = {
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
  };

  return isValidCoordinate(coordinate)
    ? coordinate
    : getMasterCoordinate(item.masterData);
};

const getRouteItemsCoordinates = (items: RouteItem[]) =>
  items
    .map(item => getRouteItemCoordinate(item))
    .filter(isValidCoordinate);

const normalizeAddressValue = (value?: string | null) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const getMasterAddressCandidates = (source: any) =>
  getUniqueStrings(
    [
      source?.selectedAddress,
      source?.SelectedAddress,
      source?.selected_address,
      source?.address,
      source?.Address,
      getValueByNormalizedKeys(source, [
        'selectedAddress',
        'fullAddress',
        'masterAddress',
        'locationAddress',
        'address',
      ]),
      getMasterFullAddress(source),
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

const findDuplicateMasterName = (master: any, masters: any[]) => {
  const candidateName = getMasterNameValue(master);

  return masters.find(
    existingMaster =>
      !!candidateName && candidateName === getMasterNameValue(existingMaster),
  );
};

const getRouteItemAddressCandidates = (item: RouteItem) =>
  getUniqueStrings([
    ...getMasterAddressCandidates(item.masterData),
    normalizeAddressValue(item.address),
  ]).filter(Boolean);

const findDuplicateRouteLocations = (master: any, routeItems: RouteItem[]) => {
  const candidateCoordinate = getMasterCoordinate(master);
  const candidateAddresses = getMasterAddressCandidates(master);

  return routeItems.filter(item => {
    const itemCoordinate = getRouteItemCoordinate(item);
    const isSameLatLng =
      !!candidateCoordinate &&
      !!itemCoordinate &&
      isSameCoordinate(candidateCoordinate, itemCoordinate);
    const itemAddresses = getRouteItemAddressCandidates(item);
    const isSameAddress =
      candidateAddresses.length > 0 &&
      itemAddresses.some(itemAddress =>
        candidateAddresses.some(candidateAddress =>
          isSameAddressValue(candidateAddress, itemAddress),
        ),
      );

    return isSameLatLng || isSameAddress;
  });
};

const findDuplicateRouteLocation = (master: any, routeItems: RouteItem[]) =>
  findDuplicateRouteLocations(master, routeItems)[0];

const findDuplicateMasterLocations = (master: any, masters: any[]) => {
  const candidateCoordinate = getMasterCoordinate(master);
  const candidateAddresses = getMasterAddressCandidates(master);

  return masters.filter(existingMaster => {
    const existingCoordinate = getMasterCoordinate(existingMaster);
    const isSameLatLng =
      !!candidateCoordinate &&
      !!existingCoordinate &&
      isSameCoordinate(candidateCoordinate, existingCoordinate);
    const existingAddresses = getMasterAddressCandidates(existingMaster);
    const isSameAddress =
      candidateAddresses.length > 0 &&
      existingAddresses.some(existingAddress =>
        candidateAddresses.some(candidateAddress =>
          isSameAddressValue(candidateAddress, existingAddress),
        ),
      );

    return isSameLatLng || isSameAddress;
  });
};

const findDuplicateMasterLocation = (master: any, masters: any[]) =>
  findDuplicateMasterLocations(master, masters)[0];

const isSameMasterRecord = (first: any, second: any) => {
  const firstId = getMasterId(first);
  const secondId = getMasterId(second);

  if (firstId && secondId) {
    return firstId === secondId;
  }

  const firstCoord = getMasterCoordinate(first);
  const secondCoord = getMasterCoordinate(second);

  return (
    !!firstCoord && !!secondCoord && isSameCoordinate(firstCoord, secondCoord)
  );
};

const isMasterAlreadyInRoute = (master: any, routeItems: RouteItem[]) =>
  routeItems.some(item => isSameMasterRecord(master, item.masterData));

const getLocalMetersFromOrigin = (coord: Coordinate, origin: Coordinate) => {
  const latitudeRadians = (origin.latitude * Math.PI) / 180;

  return {
    x:
      (coord.longitude - origin.longitude) * Math.cos(latitudeRadians) * 111320,
    y: (coord.latitude - origin.latitude) * 110540,
  };
};

const getPointToSegmentDistanceInfo = (
  point: Coordinate,
  start: Coordinate,
  end: Coordinate,
) => {
  const pointMeters = getLocalMetersFromOrigin(point, start);
  const endMeters = getLocalMetersFromOrigin(end, start);
  const segmentLengthSquared =
    endMeters.x * endMeters.x + endMeters.y * endMeters.y;

  if (segmentLengthSquared === 0) {
    return {
      distance: calculateDistanceBetweenCoords(point, start),
      projection: 0,
    };
  }

  const rawProjection =
    (pointMeters.x * endMeters.x + pointMeters.y * endMeters.y) /
    segmentLengthSquared;
  const projection = Math.max(0, Math.min(1, rawProjection));
  const projectedPoint = {
    x: projection * endMeters.x,
    y: projection * endMeters.y,
  };
  const dx = pointMeters.x - projectedPoint.x;
  const dy = pointMeters.y - projectedPoint.y;

  return {
    distance: Math.sqrt(dx * dx + dy * dy),
    projection,
  };
};

const findCrossingBuilding = (
  start: Coordinate,
  end: Coordinate,
  buildingMasters: any[],
  routeItems: RouteItem[],
  candidateMaster: any,
) =>
  buildingMasters
    .map(master => {
      const coordinate = getMasterCoordinate(master);

      if (
        !coordinate ||
        isMasterAlreadyInRoute(master, routeItems) ||
        isSameMasterRecord(master, candidateMaster)
      ) {
        return null;
      }

      const segmentInfo = getPointToSegmentDistanceInfo(coordinate, start, end);
      const startDistance = calculateDistanceBetweenCoords(coordinate, start);
      const endDistance = calculateDistanceBetweenCoords(coordinate, end);

      if (
        segmentInfo.projection <= 0 ||
        segmentInfo.projection >= 1 ||
        segmentInfo.distance > BUILDING_CROSSING_BUFFER_METERS ||
        startDistance < BUILDING_ENDPOINT_BUFFER_METERS ||
        endDistance < BUILDING_ENDPOINT_BUFFER_METERS
      ) {
        return null;
      }

      return {
        master,
        coordinate,
        distanceToLine: segmentInfo.distance,
      };
    })
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        (a?.distanceToLine ?? Number.MAX_SAFE_INTEGER) -
        (b?.distanceToLine ?? Number.MAX_SAFE_INTEGER),
    )[0] as
    | {
        master: any;
        coordinate: Coordinate;
        distanceToLine: number;
      }
    | undefined;

const getNearestRouteItemToCoordinate = (
  coordinate: Coordinate,
  routeItems: RouteItem[],
) =>
  routeItems
    .map(item => {
      const itemCoordinate = getRouteItemCoordinate(item);

      if (!itemCoordinate) {
        return null;
      }

      return {
        item,
        distance: calculateDistanceBetweenCoords(coordinate, itemCoordinate),
      };
    })
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        (a?.distance ?? Number.MAX_SAFE_INTEGER) -
        (b?.distance ?? Number.MAX_SAFE_INTEGER),
    )[0] as {item: RouteItem; distance: number} | undefined;

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

type RouteSegment = {
  itemId: string;
  coords: Coordinate[];
};

const DashedLineVertical = () => {
  return (
    <View style={routeStyles.dashedLineVerticalWrapper}>
      {Array.from({length: 8}).map((_, i) => (
        <View key={i} style={routeStyles.dashedSegment} />
      ))}
    </View>
  );
};

const DashedLineHorizontal = () => {
  return (
    <View style={routeStyles.dashedLineHorizontalWrapper}>
      {Array.from({length: 5}).map((_, i) => (
        <View key={i} style={routeStyles.dashedSegmentHorizontal} />
      ))}
    </View>
  );
};

const AddRouteScreen: FC<ScreenProps.AddRouteScreen> = ({navigation}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const [routeName, setRouteName] = useState('');
  const [savedRouteName, setSavedRouteName] = useState('');
  const [isRouteAdded, setIsRouteAdded] = useState(false);
  const [selectedType, setSelectedType] = useState<any>(null);
  const [fullRouteCoords, setFullRouteCoords] = useState<Coordinate[]>([]);
  const mapRef = useRef<MapView>(null);
  const [_isLoading, setIsLoading] = useState(false);
  const [_locationError, setLocationError] = useState('');
  const [address, setAddress] = useState('');
  const [addedItems, setAddedItems] = useState<RouteItem[]>([]);
  const addedItemsRef = useRef<RouteItem[]>(addedItems);
  const completedCount = addedItems.filter(item => item.completed).length;
  const [isTracking, setIsTracking] = useState(false);
  const [pendingRouteActionItemId, setPendingRouteActionItemId] = useState<
    string | null
  >(null);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(
    null,
  );
  const [initialRegion, setInitialRegion] = useState({
    latitude: 28.5355,
    longitude: 77.391,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // Live coords for the current tracking segment only
  const [livePolylineCoords, setLivePolylineCoords] = useState<Coordinate[]>(
    [],
  );
  // ✅ Ref to always hold latest livePolylineCoords synchronously
  const livePolyCoordsRef = useRef<Coordinate[]>([]);

  // Completed segments — persist on map after each stop
  const [completedSegments, setCompletedSegments] = useState<RouteSegment[]>(
    [],
  );
  const [_polylineCoords, setPolylineCoords] = useState<Coordinate[]>([]);
  const [travelledDistance, setTravelledDistance] = useState(0);
  const travelledDistanceRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<Coordinate | null>(null);
  const trackingIntervalRef = useRef<any>(null);
  const currentTrackingItemIdRef = useRef<string | null>(null);
  const lastSegmentEndCoordRef = useRef<Coordinate | null>(null);
  const pendingRouteActionItemIdRef = useRef<string | null>(null);

  // Store the routeId returned from createInitialRouteAPI
  const initialRouteIdRef = useRef<number>(0);

  const [masterList, setMasterList] = useState<any[]>([]);
  const [buildingMasterList, setBuildingMasterList] = useState<any[]>([]);
  const buildingMasterListRef = useRef<any[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(false);
  const [existingvisible, setExistingvisible] = useState(false);
  const [addMasterModalVisible, setAddMasterModalVisible] = useState(false);
  const [mastervisible, setMastervisible] = useState(false);
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
  const [image1, setImage1] = useState<string>('');
  const [image2, setImage2] = useState<string>('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageFallbackIndexes, setImageFallbackIndexes] = useState<
    Record<string, number>
  >({});
  const initialRouteAlertVisual = getRouteAlertVisual('info');
  const [routeAlert, setRouteAlert] = useState<RouteAlertState>({
    visible: false,
    title: '',
    message: '',
    icon: initialRouteAlertVisual.icon,
    iconTint: initialRouteAlertVisual.iconTint,
    iconBg: initialRouteAlertVisual.iconBg,
    buttons: [],
  });

  const closeRouteAlert = useCallback(() => {
    setRouteAlert(prev => ({...prev, visible: false}));
  }, []);

  useEffect(() => {
    addedItemsRef.current = addedItems;
  }, [addedItems]);

  const setRouteItems = (
    updater: RouteItem[] | ((prev: RouteItem[]) => RouteItem[]),
  ) => {
    const currentItems = addedItemsRef.current;
    const nextItems =
      typeof updater === 'function'
        ? (updater as (prev: RouteItem[]) => RouteItem[])(currentItems)
        : updater;

    addedItemsRef.current = nextItems;
    setAddedItems(nextItems);
  };

  const showRouteAlert = useCallback(
    ({title, message, tone = 'info', icon, buttons}: RouteAlertOptions) => {
      const visual = getRouteAlertVisual(tone);

      setRouteAlert({
        visible: true,
        title,
        message,
        icon: icon ?? visual.icon,
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

  const handleRouteAlertButtonPress = useCallback(
    (button: RouteAlertButton) => {
      closeRouteAlert();

      if (button.onPress) {
        setTimeout(button.onPress, 120);
      }
    },
    [closeRouteAlert],
  );

  const pickerData = [
    {label: 'Pole', value: 'Pole', icon: IMAGES.PoleImage},
    {label: 'Tree', value: 'Tree', icon: IMAGES.treeIcon},
    {label: 'Building', value: 'Building', icon: IMAGES.TiffinIcon},
    {label: 'POP', value: 'POP', icon: IMAGES.FiberEnclosur},
    {label: 'Spliter/FatBox', value: 'Splitter', icon: IMAGES.enclosureIcon},
    {label: 'Tiffin', value: 'Tiffin', icon: IMAGES.TiffinIcon},
    {label: 'Enclosure', value: 'Enclosure', icon: IMAGES.jointEnclosure},
    {label: 'Chamber', value: 'Chamber', icon: IMAGES.ChamberNew},
  ];

  const getTotalDistance = (): number => {
    return addedItems
      .filter(item => item.completed && item.distance)
      .reduce((sum, item) => sum + (item.distance || 0), 0);
  };

  const getAddressLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setLocationError('');
      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        showRouteAlert({
          title: 'Location Permission Required',
          message: 'Please allow location access to fetch your route address.',
          tone: 'location',
        });
        return;
      }
      const data =
        (await Location.getAddressFromLatLong()) as DataType.GeoAddress;
      if (data?.address) {
        setAddress(data.address);
      } else {
        setLocationError('Unable to fetch address');
      }
    } catch (e: any) {
      setLocationError(e?.message || 'Location error');
    } finally {
      setIsLoading(false);
    }
  }, [showRouteAlert]);

  const handleSaveRoute = async () => {
    try {
      if (!savedRouteName) {
        showRouteAlert({
          title: 'Route Name Required',
          message: 'Please add a route name before saving this route.',
          tone: 'warning',
        });
        return;
      }
      if (addedItems.length < 2) {
        showRouteAlert({
          title: 'Add More Route Points',
          message:
            'A route needs at least 2 route points before it can be saved.',
          tone: 'warning',
        });
        return;
      }
      setIsSubmitting(true);
      const startItem = addedItems[0];
      const endItem = addedItems[addedItems.length - 1];
      const routeLength = Math.round(getTotalDistance());
      let routePath = '';

      const currentPos = lastPositionRef.current ?? currentPosition;
      const startLatLng = startItem.masterData?.latLng || '';
      if (currentPos && startLatLng) {
        const [startLat, startLng] = startLatLng
          .split(',')
          .map((v: string) => v.trim());
        routePath = `LINESTRING(${currentPos.longitude} ${currentPos.latitude}, ${startLng} ${startLat})`;
      } else if (fullRouteCoords.length > 1) {
        const lineStringCoords = fullRouteCoords
          .map(coord => `${coord.longitude} ${coord.latitude}`)
          .join(', ');
        routePath = `LINESTRING(${lineStringCoords})`;
      }
      const routeChamberMappingArray = addedItems.map(item => ({
        id: 0,
        masterId: item.masterData?.id || 0,
        masterType: item.value || '',
        latLng: item.masterData?.latLng || '',
        distance: item.distance || 0,
        address: item.masterData?.address || '',
        selectedAddress: item.masterData?.selectedAddress || '',
        city: item.masterData?.city || '',
        area: item.masterData?.area || '',
        state: item.masterData?.state || '',
        country: item.masterData?.country || '',
        pincode: item.masterData?.pincode || 0,
        landmark: item.masterData?.landmark || '',
        loopUsed: getMasterLoopUsed(item.masterData),
        extra1: item.masterData?.extra1 || '',
        extra2: item.masterData?.extra2 || '',
      }));
      const payload = {
        Id: 0,
        RouteId: '0',
        RouteName: savedRouteName,
        RouteLength: routeLength,
        StartAddress: startItem.masterData?.address || '',
        StartCity: startItem.masterData?.city || '',
        StartState: startItem.masterData?.state || '',
        StartCountry: startItem.masterData?.country || '',
        StartArea: startItem.masterData?.area || '',
        StartPincode: startItem.masterData?.pincode || 0,
        StartLandmark: startItem.masterData?.landmark || '',
        StartLatLng: startItem.masterData?.latLng || '',
        EndAddress: endItem.masterData?.address || '',
        EndCity: endItem.masterData?.city || '',
        EndState: endItem.masterData?.state || '',
        EndCountry: endItem.masterData?.country || '',
        EndArea: endItem.masterData?.area || '',
        EndPincode: endItem.masterData?.pincode || 0,
        EndLandmark: endItem.masterData?.landmark || '',
        EndLatLng: endItem.masterData?.latLng || '',
        RoutePath: routePath,
        RouteChamberMappingVM: routeChamberMappingArray,
      };

      console.log('📤 FINAL PAYLOAD:', JSON.stringify(payload, null, 2));
      await dispatch(addRouteAPI(payload)).unwrap();
      Common.showToast('Route Added Successfully ✅');
      navigation.goBack();
    } catch (error: any) {
      console.log('❌ Route Save Error:', error);
      showRouteAlert({
        title: 'Route Save Failed',
        message: error?.message || 'Failed to save route. Please try again.',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const permission =
        Platform.OS === 'android'
          ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
          : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
      let result = await check(permission);
      if (result === RESULTS.GRANTED) return true;
      if (result === RESULTS.BLOCKED || result === RESULTS.LIMITED) {
        showRouteAlert({
          title: 'Location Permission Required',
          message:
            'Location access is disabled. Enable it from settings to continue route tracking.',
          tone: 'location',
          buttons: [
            {text: 'Not Now', variant: 'secondary'},
            {
              text: 'Open Settings',
              variant: 'primary',
              onPress: () => openSettings().catch(() => Linking.openSettings()),
            },
          ],
        });
        return false;
      }
      if (result === RESULTS.DENIED || result === RESULTS.UNAVAILABLE) {
        result = await request(permission);
        return result === RESULTS.GRANTED;
      }
      return false;
    } catch (error) {
      console.error('⚠️ Permission error:', error);
      return false;
    }
  }, [showRouteAlert]);

  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) return;
        Geolocation.getCurrentPosition(
          position => {
            const {latitude, longitude} = position.coords;
            const newPosition = {latitude, longitude};
            setCurrentPosition(newPosition);
            lastPositionRef.current = newPosition;
            setInitialRegion({
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
            setTimeout(() => {
              mapRef.current?.animateToRegion(
                {
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                1000,
              );
            }, 500);
          },
          () => {
            Geolocation.getCurrentPosition(
              position => {
                const {latitude, longitude} = position.coords;
                setCurrentPosition({latitude, longitude});
                lastPositionRef.current = {latitude, longitude};
                setInitialRegion({
                  latitude,
                  longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
                mapRef.current?.animateToRegion(
                  {
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  1000,
                );
              },
              () => {},
              {enableHighAccuracy: false, timeout: 30000, maximumAge: 60000},
            );
          },
          {enableHighAccuracy: true, timeout: 20000, maximumAge: 10000},
        );
      } catch (error) {
        console.error('⚠️ Setup error:', error);
      }
    };
    getInitialLocation();
  }, [requestLocationPermission]);

  useEffect(() => {
    getAddressLocation();
  }, [getAddressLocation]);

  const calculateDistance = (coord1: Coordinate, coord2: Coordinate): number =>
    calculateDistanceBetweenCoords(coord1, coord2);

  const getMasterListDistanceSource = (): Coordinate | null => {
    const previousItem = addedItems[addedItems.length - 1];

    return (
      getRouteItemCoordinate(previousItem) ??
      currentPosition ??
      lastPositionRef.current
    );
  };

  const getMasterDistanceInMeters = (
    master: any,
    sourcePosition = getMasterListDistanceSource(),
  ): number | null => {
    const masterCoordinate = getMasterCoordinate(master);

    if (!isValidCoordinate(sourcePosition) || !masterCoordinate) {
      return null;
    }

    return calculateDistance(sourcePosition, masterCoordinate);
  };

  const getMasterDistanceLabel = (
    master: any,
    sourcePosition = getMasterListDistanceSource(),
  ): string => {
    const distance = getMasterDistanceInMeters(master, sourcePosition);

    return formatDistance(distance);
  };

  const sortMastersByDistance = (masters: any[]) => {
    const sourcePosition = getMasterListDistanceSource();

    return masters
      .map((master, index) => ({
        master,
        index,
        distance: getMasterDistanceInMeters(master, sourcePosition),
      }))
      .sort((a, b) => {
        const distanceA = a.distance ?? Number.MAX_SAFE_INTEGER;
        const distanceB = b.distance ?? Number.MAX_SAFE_INTEGER;

        if (distanceA === distanceB) {
          return a.index - b.index;
        }

        return distanceA - distanceB;
      })
      .map(({master}) => master);
  };
  // ✅ Called on Start of EVERY item — creates/updates the route record and saves routeId
  const callCreateInitialRoute = async (item: RouteItem, orderNo: number) => {
    const masterLatLng = item.masterData?.latLng || '';

    if (!masterLatLng) {
      throw new Error('Master LatLng not available');
    }

    const [masterLat, masterLng] = masterLatLng
      .split(',')
      .map((v: string) => v.trim());

    if (!masterLat || !masterLng) {
      throw new Error('Invalid master LatLng format');
    }

    // ✅ CURRENT USER LOCATION (LIVE GPS)
    const currentPos = lastPositionRef.current ?? currentPosition;

    if (!currentPos) {
      throw new Error('Current location not available');
    }

    const userLat = currentPos.latitude;
    const userLng = currentPos.longitude;

    // 🔥 FINAL LINESTRING (FIRST USER → THEN MASTER)
    const routePath = `LINESTRING(${userLng} ${userLat},${masterLng} ${masterLat})`;

    const payload = {
      id: initialRouteIdRef.current || 0,
      routeName: savedRouteName,

      startLatLng: masterLatLng,
      startAddress: item.masterData?.address || '',
      startLandmark: item.masterData?.landmark || '',
      startArea: item.masterData?.area || '',
      startCity: item.masterData?.city || '',
      startState: item.masterData?.state || '',
      startPincode: item.masterData?.pincode || 0,
      startCountry: item.masterData?.country || '',

      masterType: item.value,
      masterId: item.masterData?.id,
      orderNo,

      routePath, // ✅ FIXED
    };

    console.log('🚀 Initial Route Payload:', JSON.stringify(payload, null, 2));

    const result = await dispatch(createInitialRouteAPI(payload)).unwrap();

    if (result?.id) {
      initialRouteIdRef.current = result.id;
      console.log('🆔 RouteId Stored:', result.id);
    }
  };

  const appendLiveCoordinate = useCallback((coord?: Coordinate | null) => {
    if (!isValidCoordinate(coord)) return;

    const lastLiveCoord =
      livePolyCoordsRef.current[livePolyCoordsRef.current.length - 1];

    if (lastLiveCoord && isSameCoordinate(lastLiveCoord, coord)) return;

    const updatedLiveCoords = [...livePolyCoordsRef.current, coord];
    livePolyCoordsRef.current = updatedLiveCoords;
    setLivePolylineCoords(updatedLiveCoords);

    setPolylineCoords(prev => {
      const lastPolylineCoord = prev[prev.length - 1];
      if (lastPolylineCoord && isSameCoordinate(lastPolylineCoord, coord)) {
        return prev;
      }
      return [...prev, coord];
    });

    setFullRouteCoords(prev => {
      const lastFullRouteCoord = prev[prev.length - 1];
      if (lastFullRouteCoord && isSameCoordinate(lastFullRouteCoord, coord)) {
        return prev;
      }
      return [...prev, coord];
    });
  }, []);

  const getTrackingPosition = useCallback((): Promise<Coordinate> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        () => {
          Geolocation.getCurrentPosition(
            position =>
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            err => reject(err),
            {enableHighAccuracy: false, timeout: 20000, maximumAge: 5000},
          );
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 1000},
      );
    });
  }, []);

  const refreshCurrentPositionForDistance = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      const coord = await getTrackingPosition();
      setCurrentPosition(coord);
    } catch (error) {
      console.log('Unable to refresh current location for distance:', error);
    }
  };

  const handleTrackingPosition = useCallback(
    (newCoord: Coordinate) => {
      setCurrentPosition(newCoord);

      if (lastPositionRef.current) {
        const distance = calculateDistance(lastPositionRef.current, newCoord);

        if (distance >= 8) {
          console.log('📏 Moved:', distance.toFixed(2), 'm');
          travelledDistanceRef.current += distance;
          setTravelledDistance(prev => {
            const updated = prev + distance;
            travelledDistanceRef.current = updated;
            return updated;
          });
          appendLiveCoordinate(newCoord);
          lastPositionRef.current = newCoord;
        }
      } else {
        appendLiveCoordinate(newCoord);
        lastPositionRef.current = newCoord;
      }

      mapRef.current?.animateToRegion(
        {
          latitude: newCoord.latitude,
          longitude: newCoord.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        300,
      );
    },
    [appendLiveCoordinate],
  );

  const ensureTrackingStartPosition = useCallback(async () => {
    const existingPosition = lastPositionRef.current;

    if (isValidCoordinate(existingPosition)) {
      return existingPosition;
    }

    const coord = await getTrackingPosition();
    handleTrackingPosition(coord);
    return coord;
  }, [getTrackingPosition, handleTrackingPosition]);

  const startTracking = useCallback(
    async (itemId: string, resume = false) => {
      if (trackingIntervalRef.current !== null) {
        console.log('⚠️ Already tracking');
        return true;
      }
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        showRouteAlert({
          title: 'Location Permission Required',
          message:
            'Location permission is needed before route tracking starts.',
          tone: 'location',
        });
        return false;
      }
      console.log(
        resume
          ? '▶️ Resuming tracking for item:'
          : '🚀 Starting tracking for item:',
        itemId,
      );
      setIsTracking(true);

      if (resume) {
        setLivePolylineCoords(livePolyCoordsRef.current);
        setPolylineCoords(livePolyCoordsRef.current);
      } else {
        const prevEndCoord = lastSegmentEndCoordRef.current;
        const initialLiveCoords = prevEndCoord ? [prevEndCoord] : [];
        livePolyCoordsRef.current = initialLiveCoords;
        setLivePolylineCoords(initialLiveCoords);
        setPolylineCoords([]);
        travelledDistanceRef.current = 0;
        setTravelledDistance(0);
        lastPositionRef.current = null;
      }

      currentTrackingItemIdRef.current = itemId;

      const pollPosition = async () => {
        try {
          const newCoord = await getTrackingPosition();
          handleTrackingPosition(newCoord);
        } catch (error) {
          console.log('⚠️ Position update failed, will retry...');
        }
      };

      pollPosition();
      trackingIntervalRef.current = setInterval(pollPosition, 3000);

      console.log('✅ Tracking interval started');
      return true;
    },
    [
      getTrackingPosition,
      handleTrackingPosition,
      requestLocationPermission,
      showRouteAlert,
    ],
  );

  const stopTracking = useCallback(() => {
    console.log('🛑 Stopping tracking');
    if (trackingIntervalRef.current !== null) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const pauseTracking = useCallback(() => {
    const pauseCoord = currentPosition ?? lastPositionRef.current;

    if (isValidCoordinate(pauseCoord)) {
      appendLiveCoordinate(pauseCoord);
      lastPositionRef.current = pauseCoord;
    }

    stopTracking();
  }, [appendLiveCoordinate, currentPosition, stopTracking]);

  useEffect(() => {
    return () => {
      if (trackingIntervalRef.current !== null) {
        clearInterval(trackingIntervalRef.current);
      }
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const trimToWords = (text: string, wordLimit: number) => {
    if (!text) return '';
    const words = text.trim().replace(/\s+/g, ' ').split(' ');
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(' ') + '...';
  };

  const hasActiveItem = addedItems.some(
    item => item.status === 'started' || item.status === 'paused',
  );

  const shouldShowEndRouteButton = completedCount >= 2 && !hasActiveItem;

  const handleBackPress = useCallback(() => {
    if (isTracking) {
      showRouteAlert({
        title: 'Tracking In Progress',
        message:
          'Route tracking is currently active. Stop tracking before leaving this screen.',
        tone: 'warning',
        buttons: [
          {text: 'Stay', variant: 'secondary'},
          {
            text: 'Stop & Go Back',
            variant: 'danger',
            onPress: () => {
              stopTracking();
              navigation.goBack();
            },
          },
        ],
      });
    } else {
      navigation.goBack();
    }
  }, [navigation, isTracking, stopTracking, showRouteAlert]);

  const handleAddRoute = () => {
    if (!routeName.trim()) {
      showRouteAlert({
        title: 'Route Name Required',
        message: 'Enter a route name to start adding route data.',
        tone: 'warning',
      });
      return;
    }
    setSavedRouteName(routeName.trim());
    setIsRouteAdded(true);
  };

  const handleCheckboxSelect = (item: any) => {
    setSelectedType(item);
    fetchMasterList(item.value);
  };

  const updateBuildingMasterCache = (masters: any[]) => {
    buildingMasterListRef.current = masters;
    setBuildingMasterList(masters);
  };

  const ensureBuildingMasters = async () => {
    if (buildingMasterListRef.current.length > 0) {
      return buildingMasterListRef.current;
    }

    if (buildingMasterList.length > 0) {
      buildingMasterListRef.current = buildingMasterList;
      return buildingMasterList;
    }

    try {
      const response = await dispatch(
        GetMasterByNameAPI({name: 'Building'}),
      ).unwrap();
      const data = getMasterListFromResponse(response);
      updateBuildingMasterCache(data);
      return data;
    } catch (error) {
      console.log('Unable to fetch building masters for route warning:', error);
      return [];
    }
  };

  const loadMasterListByType = async (masterType: string) => {
    const response = await dispatch(
      GetMasterByNameAPI({name: masterType}),
    ).unwrap();
    const data = getMasterListFromResponse(response);

    setMasterList(data);

    if (isBuildingType(masterType)) {
      updateBuildingMasterCache(data);
    }

    return data;
  };

  const fetchMasterList = async (masterType: string) => {
    try {
      setIsLoadingMasters(true);
      setMasterList([]);
      await loadMasterListByType(masterType);
    } catch (error) {
      console.error('❌ Error fetching masters:', error);
      setMasterList([]);
    } finally {
      setIsLoadingMasters(false);
    }
  };

  const handleExistingClick = async () => {
    if (!selectedType) {
      showRouteAlert({
        title: 'Select Type',
        message: 'Choose a type before opening existing route data.',
        tone: 'info',
      });
      return;
    }
    try {
      setIsLoadingMasters(true);
      void refreshCurrentPositionForDistance();
      const response = await dispatch(
        GetMasterByNameAPI({name: selectedType.value}),
      ).unwrap();
      const data = getMasterListFromResponse(response);
      if (data.length === 0) {
        const typeLabel = getMasterTypeLabel(selectedType, selectedType.label);

        showRouteAlert({
          title: `No ${typeLabel} Found`,
          message: `No ${typeLabel} data is available right now.`,
          tone: 'info',
        });
        return;
      }
      setMasterList(data);
      if (isBuildingType(selectedType.value)) {
        updateBuildingMasterCache(data);
      }
      setExistingvisible(true);
    } catch (error) {
      showRouteAlert({
        title: 'Unable To Load Data',
        message: 'Failed to fetch route data. Please try again.',
        tone: 'error',
      });
    } finally {
      setIsLoadingMasters(false);
    }
  };

  const addMasterToRoute = (
    master: any,
    masterType: any,
    localImages: string[] = [],
  ) => {
    if (!masterType) return;

    const fullAddress = getMasterFullAddress(master);
    const masterCoordinate = getMasterCoordinate(master);
    const masterTypeLabel = getMasterTypeLabel(master, masterType.label);
    const apiImages = getMasterImageCandidates(master);
    const lat = masterCoordinate?.latitude;
    const lng = masterCoordinate?.longitude;
    const newItem: RouteItem = {
      id: Date.now().toString(),
      label: masterTypeLabel,
      value: masterType.value,
      icon: masterType.icon,
      status: 'idle',
      completed: false,
      images: localImages.filter(Boolean),
      masterData: master,
      name: getMasterDisplayName(master),
      address: fullAddress,
      apiImage: apiImages[0] || '',
      apiImages,
      latitude: lat,
      longitude: lng,
    };
    const nextAddedItems = [...addedItemsRef.current, newItem];
    const nextRouteCoords = getRouteItemsCoordinates(nextAddedItems);

    setRouteItems(nextAddedItems);
    setExistingvisible(false);
    setAddMasterModalVisible(false);
    setSelectedType(null);
    if (nextRouteCoords.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(nextRouteCoords, {
          edgePadding: {top: 90, right: 60, bottom: 260, left: 60},
          animated: true,
        });
      }, 300);
    } else if (masterCoordinate) {
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude: masterCoordinate.latitude,
            longitude: masterCoordinate.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          1000,
        );
      }, 300);
    }
  };

  const getNearestMasterSuggestion = (master: any) => {
    const previousItem = addedItems[addedItems.length - 1];

    if (!previousItem || masterList.length === 0) {
      return null;
    }

    const previousCoordinate = getRouteItemCoordinate(previousItem);
    const candidateCoordinate = getMasterCoordinate(master);

    if (!previousCoordinate || !candidateCoordinate) {
      return {
        type: 'missingCoordinate' as const,
        previousItem,
      };
    }

    const selectableMasters = masterList
      .map((item, index) => {
        const coordinate = getMasterCoordinate(item);

        if (!coordinate || isMasterAlreadyInRoute(item, addedItems)) {
          return null;
        }

        return {
          master: item,
          index,
          distance: calculateDistance(previousCoordinate, coordinate),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (a.distance === b.distance) {
          return a.index - b.index;
        }

        return a.distance - b.distance;
      }) as Array<{master: any; index: number; distance: number}>;

    if (selectableMasters.length <= 1) {
      return null;
    }

    const nearestMaster = selectableMasters[0];
    const candidateDistance = calculateDistance(
      previousCoordinate,
      candidateCoordinate,
    );

    if (
      isSameMasterRecord(master, nearestMaster.master) ||
      candidateDistance <=
        nearestMaster.distance + NEAREST_MASTER_TOLERANCE_METERS
    ) {
      return null;
    }

    return {
      type: 'nearestMismatch' as const,
      previousItem,
      nearestMaster,
      candidateDistance,
    };
  };

  const getBuildingCrossingWarning = async (master: any, masterType: any) => {
    const previousItem = addedItems[addedItems.length - 1];

    if (!previousItem) {
      return null;
    }

    const startCoordinate = getRouteItemCoordinate(previousItem);
    const endCoordinate = getMasterCoordinate(master);

    if (!startCoordinate || !endCoordinate) {
      return null;
    }

    const buildingMasters = isBuildingType(masterType?.value)
      ? [...masterList, ...buildingMasterListRef.current]
      : await ensureBuildingMasters();

    const uniqueBuildingMasters = buildingMasters.filter(
      (building, index, list) =>
        list.findIndex(item => isSameMasterRecord(item, building)) === index,
    );

    const crossingBuilding = findCrossingBuilding(
      startCoordinate,
      endCoordinate,
      uniqueBuildingMasters,
      addedItems,
      master,
    );

    if (!crossingBuilding) {
      return null;
    }

    const nearestRouteItem = getNearestRouteItemToCoordinate(
      crossingBuilding.coordinate,
      addedItems,
    );
    const routeSuggestion =
      nearestRouteItem &&
      nearestRouteItem.distance <= NEARBY_ROUTE_MASTER_SUGGESTION_METERS
        ? `\n\nNearby ${getRouteItemTypeLabel(
            nearestRouteItem.item,
          )} already in this route: ${
            nearestRouteItem.item.name
          } (${formatDistance(nearestRouteItem.distance)}).`
        : '';
    const selectedTypeLabel = getMasterTypeLabel(master, masterType?.label);

    return `You are crossing ${getMasterDisplayName(
      crossingBuilding.master,
    )}, but this building is not added in the route.${routeSuggestion}\n\nYou can add ${getMasterDisplayName(
      master,
    )} anyway, or cancel and add the nearby ${selectedTypeLabel} first.`;
  };

  const addMasterWithBuildingWarning = async (
    master: any,
    masterType: any,
    localImages: string[] = [],
  ) => {
    const buildingWarning = await getBuildingCrossingWarning(
      master,
      masterType,
    );

    if (buildingWarning) {
      showRouteAlert({
        title: 'Building Crossing Warning',
        message: buildingWarning,
        tone: 'warning',
        buttons: [
          {text: 'Cancel', variant: 'secondary'},
          {
            text: 'Add Anyway',
            variant: 'primary',
            onPress: () => addMasterToRoute(master, masterType, localImages),
          },
        ],
      });
      return;
    }

    addMasterToRoute(master, masterType, localImages);
  };

  const handleMasterSelect = async (
    master: any,
    localImages: string[] = [],
    masterType = selectedType,
    allowDuplicateLocation = false,
  ) => {
    const typeToUse = masterType ?? selectedType;
    if (!typeToUse) return;
    const typeLabel = getMasterTypeLabel(master, typeToUse.label);

    if (isMasterAlreadyInRoute(master, addedItems)) {
      showRouteAlert({
        title: `${typeLabel} Already Added`,
        message: `${getMasterDisplayName(
          master,
        )} is already present in this route.`,
        tone: 'info',
      });
      return;
    }

    const duplicateRouteLocations = findDuplicateRouteLocations(
      master,
      addedItems,
    );

    if (duplicateRouteLocations.length > 0 && !allowDuplicateLocation) {
      showRouteAlert({
        title: 'Location Already Exists',
        message: buildDuplicateLocationMessage(
          formatMasterNameList(duplicateRouteLocations),
        ),
        tone: 'warning',
        buttons: [
          {text: 'Review', variant: 'secondary'},
          {
            text: 'Add Anyway',
            variant: 'primary',
            onPress: () => {
              void handleMasterSelect(master, localImages, typeToUse, true);
            },
          },
        ],
      });
      return;
    }

    const nearestSuggestion = getNearestMasterSuggestion(master);

    if (nearestSuggestion?.type === 'missingCoordinate') {
      showRouteAlert({
        title: 'Lat/Lng Required',
        message: `Unable to verify the nearest ${typeLabel} because the previous or selected ${typeLabel} is missing Lat/Lng data.`,
        tone: 'warning',
      });
      return;
    }

    if (nearestSuggestion?.type === 'nearestMismatch') {
      const nearest = nearestSuggestion.nearestMaster;
      const nearestTypeLabel = getMasterTypeLabel(nearest.master, typeLabel);
      const isSelectedWithinWarningRange =
        nearestSuggestion.candidateDistance <=
        NEAREST_MASTER_WARNING_LIMIT_METERS;

      if (isSelectedWithinWarningRange) {
        showRouteAlert({
          title: `Nearest ${nearestTypeLabel} Missing`,
          message: `You are missing the nearest ${nearestTypeLabel} from ${
            nearestSuggestion.previousItem.name
          }.\n\nSuggested ${nearestTypeLabel}: ${getMasterDisplayName(
            nearest.master,
          )} (${formatDistance(
            nearest.distance,
          )}). Selected ${typeLabel} is ${formatDistance(
            nearestSuggestion.candidateDistance,
          )} away.`,
          tone: 'warning',
          buttons: [
            {text: 'Cancel', variant: 'secondary'},
            {
              text: 'Add Nearest',
              variant: 'secondary',
              onPress: () => {
                void handleMasterSelect(nearest.master);
              },
            },
            {
              text: 'Add Anyway',
              variant: 'primary',
              onPress: () => {
                void addMasterWithBuildingWarning(
                  master,
                  typeToUse,
                  localImages,
                );
              },
            },
          ],
        });
        return;
      }

      showRouteAlert({
        title: `Nearest ${nearestTypeLabel} Missing`,
        message: `Selected ${typeLabel} is ${formatDistance(
          nearestSuggestion.candidateDistance,
        )} away, which is above ${NEAREST_MASTER_WARNING_LIMIT_METERS} m.\n\nYou can add it anyway, or add the nearest ${nearestTypeLabel} first from ${
          nearestSuggestion.previousItem.name
        }.\n\nSuggested ${nearestTypeLabel}: ${getMasterDisplayName(
          nearest.master,
        )} (${formatDistance(nearest.distance)}).`,
        tone: 'warning',
        buttons: [
          {text: 'Cancel', variant: 'secondary'},
          {
            text: 'Add Nearest',
            variant: 'secondary',
            onPress: () => {
              void handleMasterSelect(nearest.master);
            },
          },
          {
            text: 'Add Anyway',
            variant: 'primary',
            onPress: () => {
              void addMasterWithBuildingWarning(
                master,
                typeToUse,
                localImages,
              );
            },
          },
        ],
      });
      return;
    }

    await addMasterWithBuildingWarning(master, typeToUse, localImages);
  };

  const handleOpenMasterModal = () => {
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
    setMastervisible(true);
  };

  const handleFetchLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        const typeLabel = getMasterTypeLabel(selectedType, 'route');

        showRouteAlert({
          title: 'Location Permission Required',
          message: `Location permission is needed to fetch ${typeLabel} coordinates.`,
          tone: 'location',
        });
        return;
      }
      const data: any = await Location.getAddressFromLatLong();
      if (data?.lat && data?.long) {
        setLatLngText(`${data.lat}, ${data.long}`);
        setSelectedAddress('');
        setMasterAddress('');
        setArea('');
        setCity('');
        setStateName('');
        setCountry('');
        setPincode('');

        if (data?.addressList?.length) {
          const formattedSuggestions = data.addressList.map(
            (item: string, index: number) => ({
              id: index,
              label: item,
              value: item,
            }),
          );
          const firstAddress = data.addressList[0];

          setAddressSuggestions(formattedSuggestions);
          setShowAddressDropdown(true);
          setSelectedAddress(firstAddress);
          setMasterAddress(firstAddress);
        } else {
          setAddressSuggestions([]);
          setShowAddressDropdown(false);
        }

        Common.showToast('Location fetched! Please select address.');
      } else {
        showRouteAlert({
          title: 'Location Not Found',
          message: 'Unable to fetch coordinates. Please try again.',
          tone: 'error',
        });
      }
    } catch (e: any) {
      showRouteAlert({
        title: 'Location Fetch Failed',
        message: e?.message || 'Failed to fetch location. Please try again.',
        tone: 'error',
      });
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleAddressDropdownToggle = () => {
    setShowAddressDropdown(prev => !prev);
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

  const requestCameraPermission = async (
    typeLabel = getMasterTypeLabel(selectedType, 'route'),
  ): Promise<boolean> => {
    if (Platform.OS === 'ios') return true;

    const permission = PERMISSIONS.ANDROID.CAMERA;
    try {
      const status = await check(permission);
      if (status === RESULTS.GRANTED) return true;

      if (status === RESULTS.DENIED) {
        const result = await request(permission);
        if (result === RESULTS.GRANTED) return true;

        showRouteAlert({
          title: 'Camera Permission Required',
          message: `Please allow camera access to capture ${typeLabel} images.`,
          tone: 'camera',
        });
        return false;
      }

      if (status === RESULTS.BLOCKED) {
        showRouteAlert({
          title: 'Camera Permission Blocked',
          message: `Camera access is blocked. Enable it from settings to capture ${typeLabel} images.`,
          tone: 'camera',
          buttons: [
            {text: 'Cancel', variant: 'secondary'},
            {
              text: 'Open Settings',
              variant: 'primary',
              onPress: () => openSettings().catch(() => Linking.openSettings()),
            },
          ],
        });
        return false;
      }

      showRouteAlert({
        title: 'Camera Not Available',
        message: 'Camera is not available on this device.',
        tone: 'camera',
      });
      return false;
    } catch (err) {
      console.warn('[Camera] Permission check error:', err);
      return false;
    }
  };

  const handleOpenCamera = async (itemId: string) => {
    const item = addedItems.find(i => i.id === itemId);
    const typeLabel = getRouteItemTypeLabel(item);
    if (item && item.images.length >= 1) {
      showRouteAlert({
        title: 'Image Already Added',
        message: `Only one route image is allowed for this ${typeLabel}.`,
        tone: 'camera',
      });
      return;
    }
    const hasPermission = await requestCameraPermission(typeLabel);
    if (!hasPermission) return;

    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.7,
      saveToPhotos: false,
    };
    launchCamera(options, async response => {
      if (response.didCancel || response.errorCode || !response.assets?.length)
        return;
      const uri = response.assets[0].uri;
      if (!uri) return;
      try {
        const watermarkedUri = await ImageWatermark.applyLocationWatermark(uri);
        addImagesToItem(itemId, [watermarkedUri]);
      } catch (error) {
        Common.error('Unable to watermark route image:', error);
        showRouteAlert({
          title: 'Photo Not Added',
          message:
            'The location watermark could not be added. Please capture the photo again.',
          tone: 'camera',
        });
      }
    });
  };

  const handleOpenCameraForModal = (imageSlot: 1 | 2) => {
    if ((imageSlot === 1 && image1) || (imageSlot === 2 && image2)) {
      showRouteAlert({
        title: 'Replace Image',
        message: `Image ${imageSlot} is already selected. Capture a new image to replace it?`,
        tone: 'camera',
        buttons: [
          {text: 'Cancel', variant: 'secondary'},
          {
            text: 'Replace',
            variant: 'primary',
            onPress: () => openCameraForSlot(imageSlot),
          },
        ],
      });
      return;
    }
    openCameraForSlot(imageSlot);
  };

  const openCameraForSlot = async (imageSlot: 1 | 2) => {
    const hasPermission = await requestCameraPermission(
      getMasterTypeLabel(selectedType, 'route'),
    );
    if (!hasPermission) return;

    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.4,
      maxWidth: 800,
      maxHeight: 800,
      saveToPhotos: false,
    };
    launchCamera(options, async (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode || !response.assets?.length)
        return;
      const uri = response.assets[0]?.uri;
      if (uri) {
        try {
          const watermarkedUri =
            await ImageWatermark.applyLocationWatermark(uri);
          if (imageSlot === 1) setImage1(watermarkedUri);
          else setImage2(watermarkedUri);
        } catch (error) {
          Common.error('Unable to watermark route master image:', error);
          showRouteAlert({
            title: 'Photo Not Added',
            message:
              'The location watermark could not be added. Please capture the photo again.',
            tone: 'camera',
          });
        }
      }
    });
  };

  const addImagesToItem = (id: string, uris: string[]) => {
    setRouteItems(prev =>
      prev.map(item =>
        item.id === id ? {...item, images: [...item.images, ...uris]} : item,
      ),
    );
  };

  const getRouteItemPreviewImages = (item: RouteItem) =>
    getUniqueStrings([
      ...item.images,
      ...(item.apiImages ?? []),
      item.apiImage ?? '',
      getMasterFirstImage(item.masterData),
    ]);

  const getRouteItemPreviewImage = (item: RouteItem) => {
    const images = getRouteItemPreviewImages(item);
    const fallbackIndex = Math.min(
      imageFallbackIndexes[item.id] ?? 0,
      Math.max(images.length - 1, 0),
    );

    return images[fallbackIndex] || '';
  };

  const handleRouteItemImageError = (item: RouteItem) => {
    const images = getRouteItemPreviewImages(item);
    const currentIndex = imageFallbackIndexes[item.id] ?? 0;

    if (currentIndex >= images.length - 1) {
      return;
    }

    setImageFallbackIndexes(prev => ({
      ...prev,
      [item.id]: currentIndex + 1,
    }));
  };

  const setRouteActionPending = (itemId: string | null) => {
    pendingRouteActionItemIdRef.current = itemId;
    setPendingRouteActionItemId(itemId);
  };

  const updateRouteItem = (id: string, updates: Partial<RouteItem>) => {
    setRouteItems(prev =>
      prev.map(item => (item.id === id ? {...item, ...updates} : item)),
    );
  };

  const handleDeleteRouteItem = (id: string) => {
    const item = addedItemsRef.current.find(routeItem => routeItem.id === id);

    if (!item) return;
    const typeLabel = getRouteItemTypeLabel(item);

    showRouteAlert({
      title: `Delete ${typeLabel}`,
      message: `Remove ${typeLabel} • ${item.name} from this route? This only removes it from the current route list.`,
      tone: 'delete',
      buttons: [
        {text: 'Cancel', variant: 'secondary'},
        {
          text: 'Delete',
          variant: 'danger',
          onPress: () => {
            const shouldClearTrackingState =
              currentTrackingItemIdRef.current === id ||
              item.status === 'started' ||
              item.status === 'paused';
            const remainingItems = addedItemsRef.current.filter(
              routeItem => routeItem.id !== id,
            );
            const remainingSegments = completedSegments.filter(
              segment => segment.itemId !== id,
            );

            setRouteItems(remainingItems);
            setCompletedSegments(remainingSegments);

            if (shouldClearTrackingState) {
              stopTracking();
              setRouteActionPending(null);
              resetActiveTrackingState();
            }

            if (remainingSegments.length > 0) {
              const lastSegment =
                remainingSegments[remainingSegments.length - 1];
              lastSegmentEndCoordRef.current =
                lastSegment.coords[lastSegment.coords.length - 1] ?? null;
            } else {
              lastSegmentEndCoordRef.current = null;
            }

            if (remainingItems.length === 0) {
              initialRouteIdRef.current = 0;
              setFullRouteCoords([]);
              resetActiveTrackingState();
            }

            Common.showToast('Master removed');
          },
        },
      ],
    });
  };

  const resetActiveTrackingState = () => {
    livePolyCoordsRef.current = [];
    setLivePolylineCoords([]);
    setPolylineCoords([]);
    travelledDistanceRef.current = 0;
    setTravelledDistance(0);
    lastPositionRef.current = null;
    currentTrackingItemIdRef.current = null;
  };

  const updateItemStatus = async (id: string, status: RouteItem['status']) => {
    if (pendingRouteActionItemIdRef.current) return;

    const routeItemsSnapshot = addedItemsRef.current;
    const itemIndex = routeItemsSnapshot.findIndex(item => item.id === id);
    if (itemIndex === -1) return;

    const currentItem = routeItemsSnapshot[itemIndex];

    if (status === 'started') {
      if (currentItem.status === 'paused') {
        updateRouteItem(id, {status: 'started'});
        setRouteActionPending(id);

        try {
          const resumed = await startTracking(id, true);
          if (!resumed) {
            updateRouteItem(id, {status: 'paused'});
          }
        } catch (error: any) {
          updateRouteItem(id, {status: 'paused'});
          showRouteAlert({
            title: 'Resume Failed',
            message: error?.message || 'Failed to resume route tracking.',
            tone: 'error',
          });
        } finally {
          setRouteActionPending(null);
        }
        return;
      }

      if (isTracking) return;

      const orderNo = itemIndex + 1;
      updateRouteItem(id, {status: 'started'});
      setRouteActionPending(id);
      let didStartTracking = false;

      try {
        const started = await startTracking(id);
        if (!started) {
          updateRouteItem(id, {status: 'idle'});
          return;
        }
        didStartTracking = true;
        setRouteActionPending(null);
        await ensureTrackingStartPosition();

        // 🟢 FIRST MASTER → create initial route
        if (itemIndex === 0) {
          await callCreateInitialRoute(currentItem, orderNo);
        }

        // 🔥 FROM SECOND MASTER ONWARDS → chamber mapping
        if (itemIndex > 0) {
          const previousItem = routeItemsSnapshot[itemIndex - 1];
          const routeId = initialRouteIdRef.current;

          // if (!routeId) {
          //   throw new Error('Route not initialized');
          // }

          // ✅ Segment distance (ONLY previous segment)
          const segmentDistance = previousItem.distance ?? 0;

          // ✅ Total route length till now (sum of completed segments)
          const totalRouteLength = routeItemsSnapshot
            .filter(i => i.completed)
            .reduce((sum, i) => sum + (i.distance || 0), 0);

          const payload = {
            id: 0,
            routeId,

            // 🔹 CURRENT master being inserted in RouteChamberMapping
            masterType: currentItem.value,
            masterId: currentItem.masterData?.id,
            distance: segmentDistance,

            // 🔹 TO (current master)
            endLatLng: currentItem.masterData?.latLng,
            endSelectedAddress:
              currentItem.masterData?.selectedAddress ||
              currentItem.masterData?.address ||
              '',
            endAddress: currentItem.masterData?.address,
            endLandmark: currentItem.masterData?.landmark,
            endArea: currentItem.masterData?.area,
            endCity: currentItem.masterData?.city,
            endState: currentItem.masterData?.state,
            endPincode: currentItem.masterData?.pincode,
            endCountry: currentItem.masterData?.country,

            // 🔹 TOTAL ROUTE LENGTH
            routeLength: Math.round(totalRouteLength),
            loopUsed: getMasterLoopUsed(currentItem.masterData),

            orderNo,
          };

          console.log(
            '📦 Chamber Mapping Payload:',
            JSON.stringify(payload, null, 2),
          );

          await dispatch(insertUpdateRouteChamberMappingAPI(payload)).unwrap();

          console.log(
            `✅ Mapping Sent | ${previousItem.name} → ${currentItem.name} | Segment: ${segmentDistance}m | Total: ${totalRouteLength}m`,
          );
        }

        updateRouteItem(id, {status: 'started'});
      } catch (error: any) {
        console.log('❌ Start failed:', error);
        if (didStartTracking) {
          stopTracking();
          resetActiveTrackingState();
        }
        updateRouteItem(id, {status: 'idle'});
        showRouteAlert({
          title: 'Start Failed',
          message: error?.message || 'Failed to start route tracking.',
          tone: 'error',
        });
      } finally {
        if (pendingRouteActionItemIdRef.current === id) {
          setRouteActionPending(null);
        }
      }
    }

    if (status === 'paused') {
      updateRouteItem(id, {status: 'paused'});

      if (currentItem.status === 'started') {
        pauseTracking();
      }
    }
  };

  // ✅ Call updateRoutePathDetailsAPI with coords passed directly (no async state issue)
  const callUpdateRoutePath = async (segmentCoords: Coordinate[]) => {
    const routeId = initialRouteIdRef.current;

    if (!routeId) return;

    const routePath = buildRoutePathLineString(segmentCoords);
    if (!routePath) {
      console.log(
        '⚠️ Route path update skipped: need at least 2 valid coordinates',
      );
      return;
    }

    const payload = {
      routeId,
      routePath,
    };

    console.log('📤 UpdateRoutePathDetails Payload:', JSON.stringify(payload));

    await dispatch(updateRoutePathDetailsAPI(payload)).unwrap();

    console.log('✅ Route Path Updated');
  };

  // ✅ FIXED handleStopItem: reads coords from ref synchronously before any state resets
  const handleStopItem = (id: string) => {
    if (pendingRouteActionItemIdRef.current) return;

    const segmentCoordsSnapshot = [...livePolyCoordsRef.current];
    const latestCoord = currentPosition ?? lastPositionRef.current;
    const lastSnapshotCoord =
      segmentCoordsSnapshot[segmentCoordsSnapshot.length - 1];

    if (
      isValidCoordinate(latestCoord) &&
      (!lastSnapshotCoord || !isSameCoordinate(lastSnapshotCoord, latestCoord))
    ) {
      segmentCoordsSnapshot.push(latestCoord);
    }

    const finalDistance = Math.round(travelledDistanceRef.current);

    console.log(
      '🏁 Stopped. Distance:',
      finalDistance,
      'm | Coords:',
      segmentCoordsSnapshot.length,
    );

    stopTracking();
    updateRouteItem(id, {
      status: 'idle',
      completed: true,
      distance: finalDistance,
    });

    // ✅ ONLY route path update here
    if (segmentCoordsSnapshot.length > 0) {
      callUpdateRoutePath(segmentCoordsSnapshot).catch((error: any) => {
        console.log('❌ Route Path Update Error:', error);
        showRouteAlert({
          title: 'Path Update Failed',
          message: error?.message || 'Failed to update route path.',
          tone: 'error',
        });
      });
    }

    if (segmentCoordsSnapshot.length > 1) {
      setCompletedSegments(prev => [
        ...prev,
        {itemId: id, coords: segmentCoordsSnapshot},
      ]);

      const lastCoord = segmentCoordsSnapshot[segmentCoordsSnapshot.length - 1];
      lastSegmentEndCoordRef.current = lastCoord;
    }

    resetActiveTrackingState();
  };

  const handleAddMasterButtonClick = () => {
    setSelectedType(null);
    setMasterList([]);
    setAddMasterModalVisible(true);
  };

  const handleAddAndSelect = async (allowDuplicateLocation = false) => {
    try {
      if (!selectedType) {
        showRouteAlert({
          title: 'Select Type',
          message: 'Please select a type before adding new route data.',
          tone: 'warning',
        });
        return;
      }
      const typeLabel = getMasterTypeLabel(selectedType, selectedType.label);
      if (!masterName.trim()) {
        showRouteAlert({
          title: `${typeLabel} Name Required`,
          message: `Enter a ${typeLabel} name to continue.`,
          tone: 'warning',
        });
        return;
      }
      if (!latLngText.trim()) {
        showRouteAlert({
          title: 'Lat/Lng Required',
          message: `Fetch or enter Lat/Lng before adding this ${typeLabel}.`,
          tone: 'warning',
        });
        return;
      }
      if (!masterAddress.trim()) {
        showRouteAlert({
          title: 'Address Required',
          message: `Please add the ${typeLabel} address.`,
          tone: 'warning',
        });
        return;
      }
      if (!landmark.trim()) {
        showRouteAlert({
          title: 'Landmark Required',
          message: `Please add a landmark for this ${typeLabel}.`,
          tone: 'warning',
        });
        return;
      }
      const duplicateDraftMaster = {
        name: masterName.trim(),
        latLng: latLngText.trim(),
        address: masterAddress.trim(),
        selectedAddress: selectedAddress.trim() || masterAddress.trim(),
        landmark: landmark.trim(),
      };
      setIsSubmitting(true);
      const latestMasters = await loadMasterListByType(selectedType.value);
      const duplicateName = findDuplicateMasterName(
        duplicateDraftMaster,
        latestMasters,
      );

      if (duplicateName) {
        const duplicateNameText = getMasterDisplayName(duplicateName);
        setIsSubmitting(false);
        showRouteAlert({
          title: 'Master Name Already Exists',
          message: buildDuplicateNameMessage(duplicateNameText),
          tone: 'error',
        });
        return;
      }

      if (!allowDuplicateLocation) {
        const duplicateRouteLocations = findDuplicateRouteLocations(
          duplicateDraftMaster,
          addedItems,
        );
        const duplicateMasterLocations = findDuplicateMasterLocations(
          duplicateDraftMaster,
          latestMasters,
        );
        const duplicateLocationNames = formatMasterNameList([
          ...duplicateRouteLocations,
          ...duplicateMasterLocations,
        ]);

        if (
          duplicateRouteLocations.length > 0 ||
          duplicateMasterLocations.length > 0
        ) {
          setIsSubmitting(false);
          showRouteAlert({
            title: 'Location Already Exists',
            message: buildDuplicateLocationMessage(duplicateLocationNames),
            tone: 'warning',
            buttons: [
              {text: 'Review', variant: 'secondary'},
              {
                text: 'Add Anyway',
                variant: 'primary',
                onPress: () => {
                  void handleAddAndSelect(true);
                },
              },
            ],
          });
          return;
        }
      }
      const typeToAdd = selectedType;
      const localImage1 = image1;
      const payload: any = {
        Id: 0,
        Name: masterName.trim(),
        MasterType: typeToAdd.value,
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
      const savedMasterResponse = await dispatch(
        UpdateMasterAPI(payload),
      ).unwrap();
      const savedMaster =
        savedMasterResponse?.data ?? savedMasterResponse ?? {};
      const routeMaster = {
        ...savedMaster,
        id: savedMaster?.id ?? savedMaster?.Id ?? savedMaster?.masterId ?? 0,
        name: savedMaster?.name ?? savedMaster?.Name ?? masterName.trim(),
        masterType: typeToAdd.value,
        address: masterAddress.trim(),
        selectedAddress: selectedAddress.trim() || masterAddress.trim(),
        city: city.trim(),
        state: stateName.trim(),
        country: country.trim(),
        area: area.trim(),
        pincode: pincode.trim(),
        landmark: landmark.trim(),
        latLng: latLngText.trim(),
        extra1: extra1.trim(),
        extra2: extra2.trim(),
        image1: localImage1 || getMasterFirstImage(savedMaster),
      };
      Common.showToast(`${typeLabel} added!`);
      // Reset form fields
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

      // Close ONLY MasterFormModal
      setMastervisible(false);

      // Optional: refresh master list
      fetchMasterList(typeToAdd.value);
      await handleMasterSelect(
        routeMaster,
        localImage1 ? [localImage1] : [],
        typeToAdd,
      );
    } catch (error: any) {
      const failedTypeLabel = getMasterTypeLabel(selectedType, 'Data');
      const errorMessage =
        error?.message ||
        error?.messege ||
        error?.data?.message ||
        error?.data?.messege ||
        error?.response?.data?.message ||
        error?.error ||
        `Failed to add ${failedTypeLabel}. Please try again.`;
      const errorMessageText = String(errorMessage);
      const duplicateServerMessage =
        /name/i.test(errorMessageText) &&
        /exist|duplicate|already/i.test(errorMessageText);

      showRouteAlert({
        title: duplicateServerMessage
          ? 'Master Name Already Exists'
          : `${failedTypeLabel} Add Failed`,
        message: duplicateServerMessage
          ? buildDuplicateNameMessage(masterName.trim())
          : String(errorMessage),
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const plannedRouteCoords = getRouteItemsCoordinates(addedItems);

  return (
    <Screen
      preset="fixed"
      statusBgColor={COLORS.PRIMARY}
      statusBarStyle="light">
      <BackHeader title="Add Route" onBackPress={handleBackPress} showGps />
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          followsUserLocation={isTracking}
          showsCompass={true}
          showsScale={true}>
          {currentPosition && (
            <Marker coordinate={currentPosition} anchor={{x: 0.5, y: 0.5}}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(66, 133, 244, 0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#4285F4',
                    borderWidth: 3,
                    borderColor: '#FFFFFF',
                  }}
                />
              </View>
            </Marker>
          )}
          {plannedRouteCoords.length > 1 && (
            <Polyline
              coordinates={plannedRouteCoords}
              strokeColor={COLORS.colorMediumslateblue}
              strokeWidth={4}
              lineDashPattern={[10, 6]}
              lineCap="round"
              lineJoin="round"
            />
          )}
          {addedItems.map((item, index) => {
            const itemCoordinate = getRouteItemCoordinate(item);

            if (itemCoordinate) {
              return (
                <Marker
                  key={item.id}
                  coordinate={itemCoordinate}
                  title={`${index + 1}. ${item.name}`}
                  description={`${item.label} - ${item.address}`}
                  anchor={{x: 0.5, y: 1}}>
                  <Image
                    source={item.icon}
                    style={{width: 35, height: 35}}
                    resizeMode="contain"
                  />
                </Marker>
              );
            }
            return null;
          })}
          {completedSegments.map((segment, index) => (
            <Polyline
              key={`completed-segment-${index}`}
              coordinates={segment.coords}
              strokeColor={COLORS.PRIMARY}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          ))}
          {livePolylineCoords.length > 1 && (
            <Polyline
              coordinates={livePolylineCoords}
              strokeColor={COLORS.PRIMARY}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          )}
        </MapView>
      </View>
      <View style={styles.bodyBg}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.row, styles.rowFlexBox]}>
            <Image
              source={IMAGES.mapLocation}
              style={styles.icon}
              resizeMode="cover"
            />
            <Text style={[styles.f13MainRd, styles.mTypo]}>
              {address ? `${address}` : 'Fetching location...'}
            </Text>
            <View style={routeStyles.fixedMeter}>
              <Text style={routeStyles.fixedMeterText}>
                {Math.round(getTotalDistance() + travelledDistance)}m
              </Text>
            </View>
          </View>
          <View style={styles.contentWrapper}>
            <View style={styles.routeNameSection}>
              <View style={styles.routeNameRow}>
                <Text style={styles.routeLabel}>Route Name:</Text>
                <Text style={styles.routeValue}>
                  {isRouteAdded ? savedRouteName : routeName || 'XXXXXXXX'}
                </Text>
              </View>
              {!isRouteAdded && (
                <View style={styles.inputContainer}>
                  <TextInput
                    value={routeName}
                    onChangeText={setRouteName}
                    placeholder="Enter Route Name"
                    placeholderTextColor="#999"
                    style={styles.textInput}
                    returnKeyType="done"
                    returnKeyLabel="done"
                  />
                  <TouchableOpacity onPress={handleAddRoute}>
                    <LinearGradient
                      style={styles.addButton}
                      colors={[COLORS.colorMediumslateblue, '#6036c4']}>
                      <Text style={styles.addButtonText}>Add</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {addedItems.map((item, index) => {
              const isLastItem = index === addedItems.length - 1;
              const showAddMasterButton = item.completed && isLastItem;
              const isRouteActionPending = pendingRouteActionItemId === item.id;
              const firstImage = getRouteItemPreviewImage(item);
              return (
                <View key={item.id}>
                  <View style={routeStyles.itemMainWrapper}>
                    <View style={routeStyles.leftSide}>
                      <Image
                        source={item.icon}
                        style={routeStyles.itemIconLeft}
                      />
                      <DashedLineVertical />
                      {!item.completed && <DashedLineHorizontal />}
                    </View>
                    <View style={routeStyles.rightSide}>
                      <View style={routeStyles.titleAndImageRow}>
                        <View style={routeStyles.itemInfoBlock}>
                          <View style={routeStyles.itemHeaderRow}>
                            <Text style={routeStyles.itemTitle}>
                              {item.label} • {item.name}
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleDeleteRouteItem(item.id)}
                              style={routeStyles.deleteMasterButton}
                              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                              <Image
                                source={IMAGES.close}
                                style={routeStyles.deleteMasterIcon}
                                resizeMode="contain"
                              />
                            </TouchableOpacity>
                          </View>
                          <Text style={routeStyles.itemAddress}>
                            {trimToWords(item.address, 10)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            firstImage
                              ? setPreviewImage(firstImage)
                              : void handleOpenCamera(item.id)
                          }
                          style={[
                            routeStyles.imageBox,
                            !firstImage && routeStyles.emptyImageBox,
                          ]}>
                          {firstImage ? (
                            <Image
                              source={{uri: firstImage}}
                              style={routeStyles.apiImageThumbnail}
                              onError={() => handleRouteItemImageError(item)}
                            />
                          ) : (
                            <Image
                              source={IMAGES.camera}
                              style={routeStyles.cameraIconSmall}
                              resizeMode="contain"
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                      {item.completed ? (
                        <Text style={routeStyles.completedDistance}>
                          {item.distance} m
                        </Text>
                      ) : (
                        <View style={routeStyles.actionButtonsBox}>
                          {item.status === 'started' && (
                            <View style={routeStyles.distancePill}>
                              <Image
                                source={IMAGES.walkingPerson}
                                style={routeStyles.buttonIcon2}
                              />
                              <Text style={routeStyles.distanceTextSmall}>
                                {Math.round(travelledDistance)} m
                              </Text>
                            </View>
                          )}
                          {item.status === 'idle' && (
                            <TouchableOpacity
                              disabled={isRouteActionPending}
                              onPress={() =>
                                updateItemStatus(item.id, 'started')
                              }
                              style={[
                                routeStyles.startButton,
                                isRouteActionPending &&
                                  routeStyles.actionButtonDisabled,
                              ]}>
                              <Image
                                source={IMAGES.playIcon}
                                style={routeStyles.buttonIcon}
                              />
                              <Text style={routeStyles.startButtonText}>
                                Start
                              </Text>
                            </TouchableOpacity>
                          )}
                          {item.status === 'started' && (
                            <TouchableOpacity
                              disabled={isRouteActionPending}
                              onPress={() =>
                                updateItemStatus(item.id, 'paused')
                              }
                              style={[
                                routeStyles.pauseButton,
                                isRouteActionPending &&
                                  routeStyles.actionButtonDisabled,
                              ]}>
                              <Image
                                source={IMAGES.pauseIcon}
                                style={routeStyles.buttonIcon}
                              />
                              <Text style={routeStyles.stopButtonText}>
                                Pause
                              </Text>
                            </TouchableOpacity>
                          )}
                          {item.status === 'paused' && (
                            <TouchableOpacity
                              disabled={isRouteActionPending}
                              onPress={() =>
                                updateItemStatus(item.id, 'started')
                              }
                              style={[
                                routeStyles.resumeButton,
                                isRouteActionPending &&
                                  routeStyles.actionButtonDisabled,
                              ]}>
                              <Image
                                source={IMAGES.resumeIcon}
                                style={routeStyles.buttonIcon}
                              />
                              <Text style={routeStyles.resumeButtonText}>
                                Resume
                              </Text>
                            </TouchableOpacity>
                          )}
                          {(item.status === 'started' ||
                            item.status === 'paused') && (
                            <TouchableOpacity
                              disabled={isRouteActionPending}
                              onPress={() => handleStopItem(item.id)}
                              style={[
                                routeStyles.stopButton,
                                isRouteActionPending &&
                                  routeStyles.actionButtonDisabled,
                              ]}>
                              <Image
                                source={IMAGES.stopIcon}
                                style={routeStyles.buttonIcon}
                              />
                              <Text style={routeStyles.stopButtonText}>
                                Stop
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                  {showAddMasterButton && (
                    <TouchableOpacity
                      onPress={handleAddMasterButtonClick}
                      style={routeStyles.addMasterButton}>
                      <Image
                        source={IMAGES.additionIcon}
                        style={routeStyles.addMasterIcon}
                      />
                      <Text style={routeStyles.addMasterText}>Add Master</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {isRouteAdded && addedItems.length === 0 && (
              <>
                <Text style={styles.routeLabel}>Route Start From</Text>
                <View style={styles.ul}>
                  {pickerData.map((item, index) => {
                    const isSelected = selectedType?.value === item.value;
                    const isLastItem = index === pickerData.length - 1;
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[styles.li, !isLastItem && styles.liSpaceBlock]}
                        onPress={() => handleCheckboxSelect(item)}
                        activeOpacity={0.7}>
                        <View style={[styles.select, styles.labelFlexBox]}>
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && styles.checkboxSelected,
                            ]}>
                            {isSelected && (
                              <Image
                                source={IMAGES.check}
                                style={styles.checkIconInner}
                                resizeMode="contain"
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.routeStartFrom,
                              styles.routeTypo,
                              isSelected && styles.selectedText,
                            ]}>
                            {item.label}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {isLoadingMasters && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.colorMediumslateblue}
                    />
                    <Text style={styles.loadingText}>Loading...</Text>
                  </View>
                )}
                {!isLoadingMasters && selectedType && masterList.length > 0 && (
                  <View style={styles.dataCountContainer}>
                    <Text style={styles.dataCountText}>
                      ✅ Found {masterList.length} {selectedType.label}(s)
                    </Text>
                  </View>
                )}
                {selectedType && !isLoadingMasters && (
                  <View style={styles.row4}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.gradientBtnTouchable}
                      onPress={handleOpenMasterModal}>
                      <LinearGradient
                        colors={[COLORS.colorMediumslateblue, '#6036c4']}
                        style={styles.gradientBg}
                        start={{x: 0.5, y: 0}}
                        end={{x: 0.5, y: 1}}
                      />
                      <Text style={styles.gradientBtnText}>Add New</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.gradientBtnTouchable}
                      onPress={handleExistingClick}>
                      <LinearGradient
                        colors={['#00c417', '#005e0b']}
                        style={styles.gradientBg}
                        start={{x: 0.5, y: 0}}
                        end={{x: 0.5, y: 1}}
                      />
                      <Text style={styles.gradientBtnText}>Existing</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
          {shouldShowEndRouteButton && (
            <TouchableOpacity
              onPress={handleSaveRoute}
              disabled={isSubmitting}
              style={routeStyles.view}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <>
                  <Image
                    source={IMAGES.close}
                    style={routeStyles.vectorIcon2}
                    resizeMode="cover"
                  />
                  <Text style={routeStyles.endRoute}>End Route</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {/* Modals */}
          <Modal
            visible={addMasterModalVisible}
            transparent
            animationType="slide">
            <View style={modalStyles.overlay}>
              <View style={modalStyles.container}>
                <View style={modalStyles.header}>
                  <Text style={modalStyles.headerText}>Add Master</Text>
                  <TouchableOpacity
                    onPress={() => setAddMasterModalVisible(false)}
                    style={modalStyles.closeBtn}>
                    <Image
                      source={IMAGES.close}
                      style={modalStyles.closeIcon}
                    />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={modalStyles.scrollView}
                  showsVerticalScrollIndicator={false}>
                  <View style={modalStyles.checkboxContainer}>
                    {pickerData.map((item, index) => {
                      const isSelected = selectedType?.value === item.value;
                      return (
                        <TouchableOpacity
                          key={item.value}
                          style={[
                            modalStyles.checkboxItem,
                            index < pickerData.length - 1 &&
                              modalStyles.checkboxItemBorder,
                          ]}
                          onPress={() => handleCheckboxSelect(item)}
                          activeOpacity={0.7}>
                          <View
                            style={[
                              modalStyles.radioCircle,
                              isSelected && modalStyles.radioCircleSelected,
                            ]}>
                            {isSelected && (
                              <View style={modalStyles.radioInner} />
                            )}
                          </View>
                          <Text
                            style={[
                              modalStyles.checkboxLabel,
                              isSelected && modalStyles.checkboxLabelSelected,
                            ]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {isLoadingMasters && (
                    <View style={modalStyles.loadingContainer}>
                      <ActivityIndicator
                        size="small"
                        color={COLORS.colorMediumslateblue}
                      />
                      <Text style={modalStyles.loadingText}>Loading...</Text>
                    </View>
                  )}
                  {!isLoadingMasters &&
                    selectedType &&
                    masterList.length > 0 && (
                      <View style={modalStyles.dataCountContainer}>
                        <Text style={modalStyles.dataCountText}>
                          ✅ Found {masterList.length} {selectedType.label}(s)
                        </Text>
                      </View>
                    )}
                  {selectedType && !isLoadingMasters && (
                    <View style={modalStyles.actionButtons}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleOpenMasterModal}
                        style={modalStyles.actionButton}>
                        <LinearGradient
                          colors={[COLORS.colorMediumslateblue, '#6036c4']}
                          style={modalStyles.gradientButton}
                          start={{x: 0.5, y: 0}}
                          end={{x: 0.5, y: 1}}>
                          <Text style={modalStyles.buttonText}>Add New</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={handleExistingClick}
                        style={modalStyles.actionButton}>
                        <LinearGradient
                          colors={['#00c417', '#005e0b']}
                          style={modalStyles.gradientButton}
                          start={{x: 0.5, y: 0}}
                          end={{x: 0.5, y: 1}}>
                          <Text style={modalStyles.buttonText}>Existing</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
          <Modal visible={existingvisible} transparent animationType="slide">
            <View style={styles.alertmodal}>
              <View style={styles.view2}>
                <View style={styles.ulmasterModal}>
                  <View
                    style={[
                      styles.limasterModal,
                      styles.liFlexBox,
                      {marginBottom: SIZE.MS(10)},
                    ]}>
                    <Text style={[styles.action, styles.actionTypo]}>
                      Choose {selectedType?.label || 'Master'}
                    </Text>
                  </View>
                  <View style={[styles.modalBody, {alignSelf: 'stretch'}]}>
                    {isLoadingMasters ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator
                          size="large"
                          color={COLORS.colorMediumslateblue}
                        />
                        <Text style={styles.loadingText}>Loading...</Text>
                      </View>
                    ) : masterList && masterList.length > 0 ? (
                      <>
                        <ScrollView
                          style={{maxHeight: 400}}
                          showsVerticalScrollIndicator={false}>
                          {sortMastersByDistance(masterList).map(
                            (master, index) => {
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
                                  onPress={() =>
                                    void handleMasterSelect(master)
                                  }
                                  style={{
                                    paddingVertical: 14,
                                    paddingHorizontal: 12,
                                    borderColor: COLORS.BACKGROUND_DEFAULT,
                                    borderWidth: 1,
                                  }}>
                                  <View
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'flex-start',
                                    }}>
                                    <View style={{flex: 1}}>
                                      <Text
                                        style={{
                                          fontSize: 14,
                                          fontWeight: '600',
                                          color: '#6C4DFF',
                                        }}>
                                        {master.name}{' '}
                                        {master.landmark
                                          ? `(${master.landmark})`
                                          : ''}
                                      </Text>
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          color: '#444',
                                          marginTop: 6,
                                        }}
                                        numberOfLines={3}>
                                        {fullAddress}
                                      </Text>
                                    </View>
                                    <View
                                      style={{
                                        backgroundColor: '#F1F1F1',
                                        borderRadius: 8,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderWidth: 1,
                                        borderColor: '#DDD',
                                        marginLeft: 8,
                                      }}>
                                      <Text
                                        style={{
                                          fontSize: 13,
                                          color: '#6C4DFF',
                                        }}>
                                        {getMasterDistanceLabel(master)}
                                      </Text>
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              );
                            },
                          )}
                        </ScrollView>
                        <View style={{alignSelf: 'stretch', paddingTop: 15}}>
                          <TouchableOpacity
                            onPress={() => setExistingvisible(false)}
                            style={{
                              backgroundColor: '#E5E5E5',
                              paddingVertical: 10,
                              borderRadius: 20,
                              alignItems: 'center',
                            }}>
                            <Text style={{fontSize: 13, color: '#333'}}>
                              Close
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>
                          No {selectedType?.label || 'data'} available
                        </Text>
                        <TouchableOpacity
                          onPress={() => setExistingvisible(false)}
                          style={[
                            styles.btn,
                            styles.btnFlexBox,
                            {
                              marginTop: 20,
                              backgroundColor: '#DBDBDB',
                              borderColor: '#DBDBDB',
                            },
                          ]}>
                          <Text style={[styles.selectMaster, styles.poleTypo]}>
                            Close
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Modal>

          <MasterFormModal
            visible={mastervisible}
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
            onClose={() => setMastervisible(false)}
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
        </ScrollView>
      </View>

      <Modal
        visible={routeAlert.visible}
        transparent
        animationType="fade"
        onRequestClose={closeRouteAlert}>
        <View style={routeStyles.routeAlertOverlay}>
          <View style={routeStyles.routeAlertCard}>
            <View
              style={[
                routeStyles.routeAlertIconBox,
                {backgroundColor: routeAlert.iconBg},
              ]}>
              <Image
                source={routeAlert.icon}
                style={[
                  routeStyles.routeAlertIcon,
                  {tintColor: routeAlert.iconTint},
                ]}
                resizeMode="contain"
              />
            </View>
            <Text style={routeStyles.routeAlertTitle}>{routeAlert.title}</Text>
            <ScrollView
              style={routeStyles.routeAlertMessageScroll}
              contentContainerStyle={routeStyles.routeAlertMessageContent}
              showsVerticalScrollIndicator={false}>
              <Text style={routeStyles.routeAlertMessage}>
                {routeAlert.message}
              </Text>
            </ScrollView>
            <View
              style={[
                routeStyles.routeAlertButtonRow,
                routeAlert.buttons.length === 1 &&
                  routeStyles.routeAlertButtonRowSingle,
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
                      routeStyles.routeAlertButton,
                      routeAlert.buttons.length === 1 &&
                        routeStyles.routeAlertButtonSingle,
                      isSecondary && routeStyles.routeAlertButtonSecondary,
                      isDanger && routeStyles.routeAlertButtonDanger,
                    ]}>
                    <Text
                      style={[
                        routeStyles.routeAlertButtonText,
                        isSecondary &&
                          routeStyles.routeAlertButtonTextSecondary,
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
        visible={!!previewImage}
        transparent
        onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity
          style={routeStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPreviewImage(null)}>
          <View style={routeStyles.modalContent}>
            <Image
              source={{uri: previewImage!}}
              style={routeStyles.previewImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={routeStyles.closeButton}
              onPress={() => setPreviewImage(null)}>
              <Text style={routeStyles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  );
};

export default AddRouteScreen;

const routeStyles = StyleSheet.create({
  itemMainWrapper: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    position: 'relative',
    marginBottom: 16,
  },
  leftSide: {alignItems: 'center', width: 34},
  itemIconLeft: {width: 34, height: 34, resizeMode: 'contain'},
  dashedLineVerticalWrapper: {
    height: 55,
    width: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  dashedSegment: {width: 2, height: 3, backgroundColor: '#CCCCCC'},
  dashedLineHorizontalWrapper: {
    width: 20,
    height: 2,
    alignSelf: 'flex-end',
    marginRight: -6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 1,
  },
  dashedSegmentHorizontal: {width: 3, height: 2, backgroundColor: '#CCCCCC'},
  addMasterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 10,
    marginHorizontal: 16,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: COLORS.colorMediumslateblue,
    borderStyle: 'dashed',
    backgroundColor: COLORS.WHITE,
  },
  addMasterIcon: {
    width: 16,
    height: 16,
    tintColor: COLORS.colorMediumslateblue,
    marginRight: 8,
  },
  addMasterText: {
    fontSize: 13,
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  rightSide: {flex: 1, gap: 10, marginLeft: 10, marginTop: 10},
  titleAndImageRow: {flexDirection: 'row', gap: 10, alignItems: 'flex-start'},
  itemInfoBlock: {flex: 1, minWidth: 0},
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemTitle: {
    fontSize: 14,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    flex: 1,
  },
  itemAddress: {
    fontSize: 12,
    color: '#666',
    fontFamily: FONTS.SEMI_BOLD,
    lineHeight: 16,
    marginTop: 4,
  },
  deleteMasterButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F6C7C7',
  },
  deleteMasterIcon: {
    width: 9,
    height: 9,
    tintColor: COLORS.ERROR,
  },
  imageBox: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#8858F9',
    backgroundColor: COLORS.colorWhite,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyImageBox: {
    borderStyle: 'dashed',
    borderColor: '#C9B6FF',
    backgroundColor: '#F8F5FF',
  },
  apiImageThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 7,
  },
  addImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C9B6FF',
    backgroundColor: COLORS.colorWhite,
  },
  cameraIconSmall: {
    width: 12,
    height: 12,
    tintColor: COLORS.colorMediumslateblue,
  },
  addImageText: {
    fontSize: 12,
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.SEMI_BOLD,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  actionButtonsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 5,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 50,
    padding: 4,
    alignSelf: 'flex-start',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 6,
    borderRadius: 50,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.ERROR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    marginLeft: 6,
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#B88D0D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    marginLeft: 6,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.colorDarkgoldenrod,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    marginLeft: 6,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  buttonIcon: {width: 9, height: 9, tintColor: COLORS.colorWhite},
  buttonIcon2: {width: 12, height: 12},
  startButtonText: {
    fontSize: 11,
    color: COLORS.colorWhite,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    paddingLeft: 1,
  },
  stopButtonText: {
    fontSize: 11,
    color: COLORS.colorWhite,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  resumeButtonText: {
    fontSize: 11,
    color: COLORS.colorWhite,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  completedDistance: {
    marginTop: -20,
    fontSize: 12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  distancePill: {
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 6,
    alignSelf: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    borderColor: '#C9B6FF',
  },
  distanceTextSmall: {
    fontSize: 11,
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.MEDIUM,
    fontWeight: FONTS.FONT_WEIGHT.MEDIUM,
  },
  view: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 10,
    gap: 6,
    backgroundColor: COLORS.colorCrimson,
    borderRadius: 20,
    alignSelf: 'flex-end',
    marginRight: 10,
  },
  vectorIcon2: {height: 12, width: 12, tintColor: COLORS.WHITE},
  endRoute: {
    fontSize: 12,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    color: COLORS.colorWhite,
    textAlign: 'left',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {width: '90%', height: '70%', position: 'relative'},
  previewImage: {width: '100%', height: '100%', borderRadius: 12},
  closeButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: COLORS.WHITE,
    fontSize: 24,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
  },
  fixedMeter: {
    width: 70,
    height: 28,
    borderRadius: 20,
    backgroundColor: COLORS.colorMediumslateblue,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  fixedMeterText: {
    fontSize: 12,
    color: COLORS.WHITE,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
  },
  routeAlertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 12, 18, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  routeAlertCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 12,
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEAFB',
  },
  routeAlertIconBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  routeAlertIcon: {
    width: 26,
    height: 26,
  },
  routeAlertTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    textAlign: 'center',
  },
  routeAlertMessageScroll: {
    maxHeight: 180,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  routeAlertMessageContent: {
    paddingHorizontal: 2,
  },
  routeAlertMessage: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5A5A66',
    fontFamily: FONTS.MEDIUM,
    textAlign: 'center',
  },
  routeAlertButtonRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 18,
  },
  routeAlertButtonRowSingle: {
    justifyContent: 'center',
  },
  routeAlertButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.colorMediumslateblue,
    paddingHorizontal: 12,
  },
  routeAlertButtonSingle: {
    flex: 0,
    width: 160,
  },
  routeAlertButtonSecondary: {
    backgroundColor: '#F0F0F3',
    borderWidth: 1,
    borderColor: '#E1E1E8',
  },
  routeAlertButtonDanger: {
    backgroundColor: COLORS.ERROR,
  },
  routeAlertButtonText: {
    color: COLORS.WHITE,
    fontSize: 13,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    textAlign: 'center',
  },
  routeAlertButtonTextSecondary: {
    color: COLORS.colorDarkslategray,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerText: {
    fontSize: 19,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    color: COLORS.colorDarkslategray,
  },
  closeBtn: {padding: 4},
  closeIcon: {width: 14, height: 14, tintColor: '#666'},
  scrollView: {paddingHorizontal: 20},
  checkboxContainer: {paddingVertical: 16},
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  checkboxItemBorder: {borderBottomWidth: 1, borderBottomColor: '#F0F0F0'},
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CCC',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {borderColor: COLORS.colorMediumslateblue},
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.colorMediumslateblue,
  },
  checkboxLabel: {fontSize: 16, fontFamily: FONTS.BOLD, color: '#333'},
  checkboxLabelSelected: {
    color: COLORS.colorMediumslateblue,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
  },
  loadingContainer: {paddingVertical: 20, alignItems: 'center'},
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontFamily: FONTS.MEDIUM,
  },
  dataCountContainer: {paddingVertical: 12},
  dataCountText: {fontSize: 12, color: '#4CAF50', fontFamily: FONTS.MEDIUM},
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  actionButton: {flex: 1},
  gradientButton: {paddingVertical: 12, borderRadius: 25, alignItems: 'center'},
  buttonText: {
    fontSize: 15,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    color: COLORS.WHITE,
  },
});
