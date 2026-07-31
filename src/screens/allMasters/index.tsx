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
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {
  Callout,
  Marker,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDispatch} from 'react-redux';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {StoreDispatch} from '@reducers';
import {GetMasterByNameAPI, GetNearestPoleTreeDDAPI} from '@slices/route.slice';
import {DataType} from '@types';
import {Location} from '@utils';
import {URLs} from '@apis';
import PointerSvg from '../../res/images/pointer.svg';
import PolygonSvg from '../../res/images/Polygon.svg';
import VectorSvg from '../../res/images/Vector.svg';
import BurgerSvg from '../../res/images/burger.svg';
import type {RootStackParamList} from '@navigation/navigator';
import {
  isFreeAirPlacedMaster,
  loadFreeAirPlacedMasters,
  loadRecentlyAddedMasters,
  loadStandalonePlacedMasters,
} from '../../services/airPlacedMasterStorage';

type AllMastersProps = NativeStackScreenProps<
  RootStackParamList,
  'All-Masters'
>;

type TabKey = 'list' | 'map';
type MapDisplayType = 'standard' | 'satellite' | 'threeDimensional';

const MAP_DISPLAY_OPTIONS: {type: MapDisplayType; label: string}[] = [
  {type: 'standard', label: 'Standard'},
  {type: 'satellite', label: 'Satellite'},
  {type: 'threeDimensional', label: '3D'},
];

type Coordinate = {
  latitude: number;
  longitude: number;
};

type MasterType = {
  label: string;
  value: string;
  icon: ImageSourcePropType;
};

type MasterItem = Record<string, any> & {
  __masterType: string;
  __masterTypeLabel: string;
  __masterIcon: ImageSourcePropType;
};

type CurrentLocationPlacement = {
  insertAfterIndex: number;
  nearestIndex: number;
  nearestDistance: number;
  isAtMaster: boolean;
};

type LocalAttachedMasterEntry = {
  supportKey: string;
  supportCoordinate: Coordinate | null;
  masters: any[];
};

type RouteAlertTone =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
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
  icon: ImageSourcePropType;
  iconTint: string;
  iconBg: string;
  buttons: RouteAlertButton[];
};

type RouteAlertOptions = {
  title: string;
  message: string;
  tone?: RouteAlertTone;
  icon?: ImageSourcePropType;
  buttons?: RouteAlertButton[];
};

const DEFAULT_DELHI_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};
const SATELLITE_DETAIL_DELTA = 0.004;

const DEFAULT_SEARCH_RANGE = 200;
const MIN_SEARCH_RANGE = 100;
const MAX_SEARCH_RANGE = 1000;
const SEARCH_RANGE_STEP = 100;
const LOCATION_MATCH_THRESHOLD_METERS = 5;
const ATTACHED_MASTER_MATCH_THRESHOLD_METERS = 8;
const NEAREST_MASTER_TOLERANCE_METERS = 5;
const NEAREST_MASTER_WARNING_LIMIT_METERS = 60;
const BUILDING_CROSSING_BUFFER_METERS = 25;
const BUILDING_ENDPOINT_BUFFER_METERS = 12;
const NEARBY_ROUTE_MASTER_SUGGESTION_METERS = 75;

const MASTER_TYPES: MasterType[] = [
  {label: 'Pole', value: 'pole', icon: IMAGES.PoleImage},
  {label: 'Tree', value: 'tree', icon: IMAGES.treeIcon},
  {label: 'Building', value: 'building', icon: IMAGES.Building},
  {label: 'POP', value: 'pop', icon: IMAGES.FiberEnclosur},
  {label: 'Splitter', value: 'splitter', icon: IMAGES.enclosureIcon},
  {label: 'Tiffin', value: 'tiffin', icon: IMAGES.TiffinIcon},
  {label: 'Enclosure', value: 'enclosure', icon: IMAGES.jointEnclosure},
];

const MAP_FILTER_MASTER_TYPES = MASTER_TYPES.filter(
  type => type.value !== 'splitter',
);

const AIR_PLACED_MASTER_TYPES = new Set(['pop', 'tiffin', 'enclosure']);
const FREE_AIR_MASTER_TYPES = new Set(['tiffin', 'enclosure']);
const SUPPORT_DETAIL_MASTER_TYPES = new Set(['pop', 'tiffin', 'enclosure']);
// Tiffin and Enclosure can be attached to every support offered in the
// "Where to add" selector. Keep this aligned with AIR_SUPPORT_TYPES so a
// submitted Building result is clickable and displays its attached count just
// like Pole and Tree.
const CLICKABLE_AIR_SUPPORT_TYPES = new Set(['pole', 'tree', 'building']);
const AIR_SUPPORT_TYPES = MASTER_TYPES.filter(type =>
  ['pole', 'tree', 'building'].includes(type.value),
);

const getAllowedAirSupportTypes = (masterType: string) =>
  masterType === 'pop'
    ? AIR_SUPPORT_TYPES.filter(type => type.value === 'building')
    : AIR_SUPPORT_TYPES;

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

  const rawImage = String(value).trim();
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

  return Array.isArray(nestedList) ? nestedList : [];
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

  return isValidCoordinate(coordinate) ? coordinate : null;
};

const isValidCoordinate = (
  coordinate?: Coordinate | null,
): coordinate is Coordinate =>
  Number.isFinite(coordinate?.latitude) &&
  Number.isFinite(coordinate?.longitude) &&
  Math.abs(coordinate?.latitude ?? 0) <= 90 &&
  Math.abs(coordinate?.longitude ?? 0) <= 180;

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
        ]),
    ),
  };

  return isValidCoordinate(coordinate) ? coordinate : null;
};

const getMasterLatLngText = (master: any) => {
  const rawLatLng =
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
    ]);
  const cleanLatLng = asCleanText(rawLatLng);

  if (cleanLatLng) {
    return cleanLatLng;
  }

  const coordinate = getMasterCoordinate(master);
  return coordinate
    ? `${coordinate.latitude}, ${coordinate.longitude}`
    : 'Not available';
};

const toRad = (value: number) => (value * Math.PI) / 180;

const getDistanceMeters = (
  from?: Coordinate | null,
  to?: Coordinate | null,
) => {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
    return null;
  }

  const radius = 6371000;
  const dLat = toRad(
    (to as Coordinate).latitude - (from as Coordinate).latitude,
  );
  const dLon = toRad(
    (to as Coordinate).longitude - (from as Coordinate).longitude,
  );
  const lat1 = toRad((from as Coordinate).latitude);
  const lat2 = toRad((to as Coordinate).latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (distance?: number | null) => {
  if (!Number.isFinite(distance)) {
    return '250 meters';
  }

  const value = Math.max(0, Math.round(distance as number));
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} meters`;
};

const formatDistanceShort = (distance?: number | null) => {
  if (!Number.isFinite(distance)) {
    return '251m';
  }

  const value = Math.max(0, Math.round(distance as number));
  return value >= 1000 ? `${(value / 1000).toFixed(1)}km` : `${value}m`;
};

const getMasterId = (master: any) =>
  asCleanText(
    master?.id ??
      master?.Id ??
      master?.masterId ??
      master?.MasterId ??
      getValueByNormalizedKeys(master, ['id', 'masterId']),
  );

const getMasterCode = (master: any) =>
  asCleanText(
    master?.code ??
      master?.Code ??
      master?.masterCode ??
      master?.MasterCode ??
      getValueByNormalizedKeys(master, ['code', 'masterCode']),
  );

const getMasterTypeValue = (master: any) =>
  asCleanText(
    master?.masterType ??
      master?.MasterType ??
      master?.type ??
      master?.Type ??
      getValueByNormalizedKeys(master, ['masterType', 'type']),
  ).toLowerCase();

const getMasterTypeMeta = (master: any) => {
  const typeValue = getMasterTypeValue(master);
  return (
    MASTER_TYPES.find(type => type.value === typeValue) ?? {
      label: asCleanText(master?.masterType ?? master?.MasterType) || 'Master',
      value: typeValue || 'master',
      icon: IMAGES.module,
    }
  );
};

const decorateMasters = (
  masterList: any[],
  fallbackMasterType?: string | null,
): MasterItem[] => {
  const fallbackType = asCleanText(fallbackMasterType).toLowerCase();
  const fallbackMeta = MASTER_TYPES.find(type => type.value === fallbackType);

  return masterList.map(master => {
    const meta =
      getMasterTypeValue(master) || !fallbackMeta
        ? getMasterTypeMeta(master)
        : fallbackMeta;

    return {
      ...master,
      __masterType: meta.value,
      __masterTypeLabel: meta.label,
      __masterIcon: meta.icon,
    };
  });
};

const getMasterName = (master: any) =>
  asCleanText(
    master?.name ??
      master?.Name ??
      master?.masterName ??
      master?.MasterName ??
      getValueByNormalizedKeys(master, ['name', 'masterName']),
  ) || 'EnclosureKalkaji';

const getMasterTypeLabel = (master: MasterItem) =>
  asCleanText(
    master.__masterTypeLabel ??
      master?.masterType ??
      master?.MasterType ??
      getValueByNormalizedKeys(master, ['masterType', 'type']),
  ) || 'Master';

const isSameMasterRecord = (first: any, second: any) => {
  const firstId = getMasterId(first);
  const secondId = getMasterId(second);
  const firstType = getMasterTypeValue(first);
  const secondType = getMasterTypeValue(second);
  const sameType = !firstType || !secondType || firstType === secondType;
  const sameName =
    asCleanText(getMasterName(first)).toLowerCase() ===
    asCleanText(getMasterName(second)).toLowerCase();
  const coordinateDistance = getDistanceMeters(
    getMasterCoordinate(first),
    getMasterCoordinate(second),
  );
  const sameLocation =
    coordinateDistance !== null && coordinateDistance <= 1;

  if (
    firstId &&
    secondId &&
    firstId !== '0' &&
    secondId !== '0' &&
    firstId === secondId
  ) {
    return sameType && (sameName || sameLocation);
  }

  return sameType && sameName && sameLocation;
};

const isMasterAlreadyInRoute = (master: any, existingMasters: any[]) =>
  existingMasters.some(existing => isSameMasterRecord(master, existing));

const getLocalMetersFromOrigin = (
  coordinate: Coordinate,
  origin: Coordinate,
) => {
  const latitudeRadians = (origin.latitude * Math.PI) / 180;
  return {
    x:
      (coordinate.longitude - origin.longitude) *
      Math.cos(latitudeRadians) *
      111320,
    y: (coordinate.latitude - origin.latitude) * 110540,
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
      distance: getDistanceMeters(point, start) ?? 0,
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

  return {
    distance: Math.sqrt(
      (pointMeters.x - projectedPoint.x) ** 2 +
        (pointMeters.y - projectedPoint.y) ** 2,
    ),
    projection,
  };
};

const findCrossingBuilding = (
  start: Coordinate,
  end: Coordinate,
  buildingMasters: any[],
  existingMasters: any[],
  candidateMaster: any,
) =>
  buildingMasters
    .map(master => {
      const coordinate = getMasterCoordinate(master);
      if (
        !coordinate ||
        isMasterAlreadyInRoute(master, existingMasters) ||
        isSameMasterRecord(master, candidateMaster)
      ) {
        return null;
      }

      const segmentInfo = getPointToSegmentDistanceInfo(coordinate, start, end);
      const startDistance = getDistanceMeters(coordinate, start) ?? 0;
      const endDistance = getDistanceMeters(coordinate, end) ?? 0;
      if (
        segmentInfo.projection <= 0 ||
        segmentInfo.projection >= 1 ||
        segmentInfo.distance > BUILDING_CROSSING_BUFFER_METERS ||
        startDistance < BUILDING_ENDPOINT_BUFFER_METERS ||
        endDistance < BUILDING_ENDPOINT_BUFFER_METERS
      ) {
        return null;
      }

      return {master, coordinate, distanceToLine: segmentInfo.distance};
    })
    .filter(Boolean)
    .sort(
      (first: any, second: any) => first.distanceToLine - second.distanceToLine,
    )[0] as
    | {master: any; coordinate: Coordinate; distanceToLine: number}
    | undefined;

const getStatusInfo = (master: any) => {
  const label =
    asCleanText(
      master?.status ??
        master?.Status ??
        master?.isActive ??
        master?.IsActive ??
        getValueByNormalizedKeys(master, ['status', 'isActive']),
    ) || 'true';
  const normalized = label.toLowerCase();
  const isInactive =
    normalized === 'inactive' ||
    normalized === 'in active' ||
    normalized === 'false' ||
    master?.isActive === false;
  const isActive =
    !isInactive &&
    (normalized.includes('active') ||
      normalized === 'true' ||
      master?.isActive === true);

  return {
    label: isInactive ? 'Inactive' : isActive ? 'Active' : label,
    active: isActive || (!isInactive && label === 'Active'),
  };
};

const getMasterDistance = (
  master: any,
  currentPosition?: Coordinate | null,
) => {
  const apiDistance = Number(
    master?.distance ??
      master?.Distance ??
      getValueByNormalizedKeys(master, ['distance']),
  );

  if (Number.isFinite(apiDistance)) {
    return apiDistance;
  }

  return getDistanceMeters(currentPosition, getMasterCoordinate(master));
};

const toLocalMeters = (origin: Coordinate, coordinate: Coordinate) => {
  const latitudeRadians = toRad(origin.latitude);

  return {
    x:
      (coordinate.longitude - origin.longitude) *
      Math.cos(latitudeRadians) *
      111320,
    y: (coordinate.latitude - origin.latitude) * 110540,
  };
};

const getPointToSegmentDistance = (
  point: Coordinate,
  start: Coordinate,
  end: Coordinate,
) => {
  const startPoint = toLocalMeters(point, start);
  const endPoint = toLocalMeters(point, end);
  const segmentX = endPoint.x - startPoint.x;
  const segmentY = endPoint.y - startPoint.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (lengthSquared === 0) {
    return {
      distance: Math.hypot(startPoint.x, startPoint.y),
      isBetween: false,
    };
  }

  const projection = -(
    (startPoint.x * segmentX + startPoint.y * segmentY) /
    lengthSquared
  );
  const clampedProjection = Math.max(0, Math.min(1, projection));
  const nearestX = startPoint.x + clampedProjection * segmentX;
  const nearestY = startPoint.y + clampedProjection * segmentY;

  return {
    distance: Math.hypot(nearestX, nearestY),
    isBetween: projection >= 0 && projection <= 1,
  };
};

const getCurrentLocationPlacement = (
  currentPosition: Coordinate | null,
  masters: MasterItem[],
): CurrentLocationPlacement | null => {
  if (!currentPosition) {
    return null;
  }

  const indexedCoordinates = masters
    .map((master, index) => ({
      index,
      coordinate: getMasterCoordinate(master),
    }))
    .filter(
      (
        item,
      ): item is {
        index: number;
        coordinate: Coordinate;
      } => isValidCoordinate(item.coordinate),
    );

  if (indexedCoordinates.length === 0) {
    return null;
  }

  let nearest = {
    index: indexedCoordinates[0].index,
    coordinate: indexedCoordinates[0].coordinate,
    distance:
      getDistanceMeters(currentPosition, indexedCoordinates[0].coordinate) ??
      Number.POSITIVE_INFINITY,
  };

  indexedCoordinates.forEach(item => {
    const distance =
      getDistanceMeters(currentPosition, item.coordinate) ??
      Number.POSITIVE_INFINITY;

    if (distance < nearest.distance) {
      nearest = {...item, distance};
    }
  });

  let insertAfterIndex = nearest.index;
  let bestSegmentDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < indexedCoordinates.length - 1; index += 1) {
    const start = indexedCoordinates[index];
    const end = indexedCoordinates[index + 1];
    const segment = getPointToSegmentDistance(
      currentPosition,
      start.coordinate,
      end.coordinate,
    );

    if (segment.isBetween && segment.distance < bestSegmentDistance) {
      bestSegmentDistance = segment.distance;
      insertAfterIndex = start.index;
    }
  }

  if (nearest.distance <= LOCATION_MATCH_THRESHOLD_METERS) {
    insertAfterIndex = nearest.index;
  }

  return {
    insertAfterIndex,
    nearestIndex: nearest.index,
    nearestDistance: nearest.distance,
    isAtMaster: nearest.distance <= LOCATION_MATCH_THRESHOLD_METERS,
  };
};

const getMasterUniqueKey = (master: any) =>
  [
    getMasterTypeValue(master),
    getMasterId(master),
    getMasterName(master),
    getMasterLatLngText(master),
  ]
    .map(asCleanText)
    .filter(Boolean)
    .join('|');

const getAttachedMasterCount = (master: any, masterType: string) => {
  const normalizedType = asCleanText(masterType).toLowerCase();
  const prefix = normalizedType === 'enclosure' ? 'enclosure' : 'tiffin';
  const value =
    master?.__airMasterCount ??
    getValueByNormalizedKeys(master, [
      `${prefix}Count`,
      `total${prefix}`,
      `total${prefix}Count`,
      `noOf${prefix}`,
    ]);
  const count = Number(value);

  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
};

const mergeUniqueAttachedMasters = (...groups: any[][]) =>
  groups.flat().filter((master, index, list) => {
    const masterId = getMasterId(master);
    const masterName = asCleanText(getMasterName(master)).toLowerCase();
    const masterType = getMasterTypeValue(master);
    const masterCoordinate = getMasterCoordinate(master);

    return (
      list.findIndex(item => {
        const itemId = getMasterId(item);
        const itemName = asCleanText(getMasterName(item)).toLowerCase();
        const itemType = getMasterTypeValue(item);
        const itemCoordinate = getMasterCoordinate(item);
        const sameServerId =
          masterId &&
          itemId &&
          masterId !== '0' &&
          itemId !== '0' &&
          masterId === itemId;
        const coordinateDistance = getDistanceMeters(
          masterCoordinate,
          itemCoordinate,
        );
        const sameNameAndLocation =
          masterName === itemName &&
          coordinateDistance !== null &&
          coordinateDistance <= 1;

        return (
          (!masterType || !itemType || masterType === itemType) &&
          (sameServerId || sameNameAndLocation)
        );
      }) === index
    );
  });

const addAttachedMastersToSupports = (
  supports: MasterItem[],
  attachedMasters: any[],
  masterType: string,
) =>
  supports.map(support => {
    const supportCoordinate = getMasterCoordinate(support);
    if (!supportCoordinate) {
      return support;
    }

    const matchingMasters = attachedMasters.filter(master => {
      if (isFreeAirPlacedMaster(master)) {
        return false;
      }
      const coordinate = getMasterCoordinate(master);
      const distance = getDistanceMeters(supportCoordinate, coordinate);

      return (
        Number.isFinite(distance) &&
        (distance as number) <= ATTACHED_MASTER_MATCH_THRESHOLD_METERS
      );
    });
    const uniqueMatchingMasters = mergeUniqueAttachedMasters(
      Array.isArray(support.__attachedAirMasters)
        ? support.__attachedAirMasters
        : [],
      matchingMasters,
    );

    return {
      ...support,
      __airMasterCount: Math.max(
        getAttachedMasterCount(support, masterType),
        uniqueMatchingMasters.length,
      ),
      __attachedAirMasters: uniqueMatchingMasters,
      __attachedAirMasterType: masterType,
    };
  });

const mergeLocalAttachedMastersIntoSupports = (
  supports: MasterItem[],
  localEntries: LocalAttachedMasterEntry[],
  masterType: string,
) =>
  supports.map(support => {
    const supportKey = getMasterUniqueKey(support);
    const supportCoordinate = getMasterCoordinate(support);
    const matchingLocalMasters = localEntries
      .filter(entry => {
        if (entry.supportKey === supportKey) {
          return true;
        }

        const distance = getDistanceMeters(
          entry.supportCoordinate,
          supportCoordinate,
        );
        return (
          distance !== null &&
          distance <= ATTACHED_MASTER_MATCH_THRESHOLD_METERS
        );
      })
      .flatMap(entry => entry.masters);

    if (matchingLocalMasters.length === 0) {
      return support;
    }

    const attachedMasters = mergeUniqueAttachedMasters(
      matchingLocalMasters,
      Array.isArray(support.__attachedAirMasters)
        ? support.__attachedAirMasters
        : [],
    );

    return {
      ...support,
      __airMasterCount: Math.max(
        getAttachedMasterCount(support, masterType),
        attachedMasters.length,
      ),
      __attachedAirMasters: attachedMasters,
      __attachedAirMasterType: masterType,
    };
  });

const insertMasterNearCoordinate = (
  list: MasterItem[],
  masterToInsert: MasterItem,
) => {
  const nextKey = getMasterUniqueKey(masterToInsert);
  if (nextKey && list.some(master => getMasterUniqueKey(master) === nextKey)) {
    return list;
  }

  const coordinate = getMasterCoordinate(masterToInsert);
  if (!coordinate || list.length === 0) {
    return [...list, masterToInsert];
  }

  const placement = getCurrentLocationPlacement(coordinate, list);
  if (!placement) {
    return [...list, masterToInsert];
  }

  const nextList = [...list];
  nextList.splice(placement.insertAfterIndex + 1, 0, masterToInsert);
  return nextList;
};

const mergeFreeAirMastersIntoList = (
  list: MasterItem[],
  freeAirMasters: any[],
  masterType: string,
  center: Coordinate,
  range: number,
) =>
  decorateMasters(
    freeAirMasters.filter(master => {
      const distance = getDistanceMeters(center, getMasterCoordinate(master));
      return (
        isFreeAirPlacedMaster(master) &&
        getMasterTypeValue(master) === masterType &&
        distance !== null &&
        distance <= range
      );
    }),
    masterType,
  ).reduce(
    (nextList, master) => insertMasterNearCoordinate(nextList, master),
    list,
  );

const mergeRecentlyAddedMastersIntoList = (
  list: MasterItem[],
  recentMasters: any[],
  masterTypes: string[],
  center: Coordinate,
  range: number,
) =>
  decorateMasters(
    recentMasters.filter(master => {
      const distance = getDistanceMeters(center, getMasterCoordinate(master));
      return (
        masterTypes.includes(getMasterTypeValue(master)) &&
        distance !== null &&
        distance <= range
      );
    }),
  ).reduce((nextList, master) => {
    const merged = mergeUniqueAttachedMasters(nextList, [master]);
    return merged.length === nextList.length
      ? nextList
      : insertMasterNearCoordinate(nextList, master);
  }, list);

const getMasterAddress = (master: any) =>
  [
    master?.selectedAddress ??
      master?.SelectedAddress ??
      master?.selected_address ??
      getValueByNormalizedKeys(master, ['selectedAddress']) ??
      master?.address ??
      master?.Address ??
      getValueByNormalizedKeys(master, ['address']),
    master?.area ?? master?.Area ?? getValueByNormalizedKeys(master, ['area']),
    master?.city ?? master?.City ?? getValueByNormalizedKeys(master, ['city']),
    master?.state ??
      master?.State ??
      getValueByNormalizedKeys(master, ['state']),
    master?.pincode ??
      master?.PinCode ??
      master?.pinCode ??
      getValueByNormalizedKeys(master, ['pincode', 'pinCode']),
  ]
    .map(asCleanText)
    .filter(Boolean)
    .join(', ') ||
  'Classical Dance Class, Tansen, F-14, 3rd Floor, Main Road, Block F, Kalkaji, New Delhi, Delhi, 110019, India';

const getMapRegion = (
  currentPosition: Coordinate | null,
  masters: MasterItem[],
): Region => {
  if (currentPosition) {
    return {
      ...currentPosition,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  const firstCoordinate = masters.map(getMasterCoordinate).find(Boolean);
  if (firstCoordinate) {
    return {
      ...(firstCoordinate as Coordinate),
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    };
  }

  return DEFAULT_DELHI_REGION;
};

const getLatLngPayload = (coordinate: Coordinate) =>
  `${coordinate.latitude}, ${coordinate.longitude}`;

const getCoordinateAddressText = (coordinate: Coordinate | null) =>
  coordinate
    ? `Lat/Lng: ${coordinate.latitude}, ${coordinate.longitude}`
    : 'Address Not Found';

const AllMasters: FC<AllMastersProps> = ({navigation, route}) => {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<StoreDispatch>();
  const mapRef = useRef<MapView | null>(null);
  const listScrollRef = useRef<ScrollView | null>(null);
  const currentLocationRowYRef = useRef(0);
  const pendingLocationScrollRef = useRef(false);
  const didInitialLoadRef = useRef(false);
  const lastAddedMasterKeyRef = useRef<string | null>(null);
  const lastUpdatedSupportVersionRef = useRef<string | null>(null);
  const lastPendingMakeRouteVersionRef = useRef<string | null>(null);
  const buildingMastersRef = useRef<any[]>([]);
  const localAttachedMastersRef = useRef<LocalAttachedMasterEntry[]>([]);
  const localFreeAirMastersRef = useRef<any[]>(loadFreeAirPlacedMasters());
  const localStandaloneMastersRef = useRef<any[]>(
    loadStandalonePlacedMasters(),
  );
  const localRecentlyAddedMastersRef = useRef<any[]>(
    loadRecentlyAddedMasters(),
  );
  const initialSelectedMasterType = asCleanText(
    route.params?.selectedMasterType,
  ).toLowerCase();
  const initialRoutePosition = route.params?.currentPosition ?? null;
  const initialPosition = isValidCoordinate(initialRoutePosition)
    ? initialRoutePosition
    : null;
  const initialMasters = getMasterListFromResponse(
    route.params?.initialMasters,
  );
  const initialCurrentAddress = asCleanText(route.params?.currentAddress);
  const isRouteHubMode = Boolean(route.params?.routeHubMode);
  const isRouteSelectionMode =
    Boolean(route.params?.routeSelectionMode) || isRouteHubMode;
  const routeDisplayName =
    asCleanText(route.params?.routeName) || 'Unnamed Route';
  const isAirPlacementFlow = AIR_PLACED_MASTER_TYPES.has(
    initialSelectedMasterType,
  );
  const isPopPlacementFlow = initialSelectedMasterType === 'pop';

  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [mapDisplayType, setMapDisplayType] =
    useState<MapDisplayType>('standard');
  const [masters, setMasters] = useState<MasterItem[]>(() =>
    isAirPlacementFlow
      ? []
      : decorateMasters(initialMasters, initialSelectedMasterType),
  );
  const [selectedMasterTypes, setSelectedMasterTypes] = useState<string[]>(() =>
    initialSelectedMasterType && !isAirPlacementFlow
      ? [initialSelectedMasterType]
      : [],
  );
  const [selectedAirSupportType, setSelectedAirSupportType] = useState(
    isPopPlacementFlow ? 'building' : '',
  );
  const [showAirSupportDropdown, setShowAirSupportDropdown] = useState(false);
  const [isMasterFilterVisible, setIsMasterFilterVisible] = useState(false);
  const [pendingMapMasterType, setPendingMapMasterType] = useState('pole');
  const [hasLoadedAirSupports, setHasLoadedAirSupports] = useState(false);
  const [searchRange, setSearchRange] = useState(DEFAULT_SEARCH_RANGE);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(
    initialPosition,
  );
  const [currentAddress, setCurrentAddress] = useState(initialCurrentAddress);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasAddedCurrentLocation, setHasAddedCurrentLocation] = useState(false);
  const [isRouteTypeSheetVisible, setIsRouteTypeSheetVisible] = useState(false);
  const [pendingRouteType, setPendingRouteType] = useState<
    'new-route' | 'change-fiber' | 'paused-route' | null
  >(null);
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

  const closeRouteAlert = useCallback(() => {
    setRouteAlert(previous => ({...previous, visible: false}));
  }, []);

  const showScreenAlert = useCallback(
    ({title, message, tone = 'info', icon, buttons}: RouteAlertOptions) => {
      const alertButtons =
        buttons && buttons.length > 0
          ? buttons
          : [{text: 'OK', variant: 'primary' as const}];

      if (!isRouteSelectionMode) {
        Alert.alert(
          title,
          message,
          alertButtons.map(button => ({
            text: button.text,
            style:
              button.variant === 'secondary'
                ? ('cancel' as const)
                : button.variant === 'danger'
                ? ('destructive' as const)
                : ('default' as const),
            onPress: button.onPress,
          })),
        );
        return;
      }

      const visual = getRouteAlertVisual(tone);
      setRouteAlert({
        visible: true,
        title,
        message,
        icon: icon ?? visual.icon,
        iconTint: visual.iconTint,
        iconBg: visual.iconBg,
        buttons: alertButtons,
      });
    },
    [isRouteSelectionMode],
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

  useEffect(() => {
    const nextSelectedMasterType = asCleanText(
      route.params?.selectedMasterType,
    ).toLowerCase();
    const nextRoutePosition = route.params?.currentPosition ?? null;
    const nextPosition = isValidCoordinate(nextRoutePosition)
      ? nextRoutePosition
      : null;
    const nextMasters = getMasterListFromResponse(route.params?.initialMasters);
    const nextIsAirPlacementFlow = AIR_PLACED_MASTER_TYPES.has(
      nextSelectedMasterType,
    );

    if (nextSelectedMasterType && !nextIsAirPlacementFlow) {
      setSelectedMasterTypes([nextSelectedMasterType]);
    } else if (
      nextIsAirPlacementFlow &&
      !route.params?.addedMaster &&
      !route.params?.updatedSupportKey
    ) {
      setSelectedMasterTypes([]);
      setSelectedAirSupportType(
        nextSelectedMasterType === 'pop' ? 'building' : '',
      );
      setShowAirSupportDropdown(false);
      setHasLoadedAirSupports(false);
    }

    if (nextPosition) {
      setCurrentPosition(nextPosition);
    }

    setCurrentAddress(asCleanText(route.params?.currentAddress));

    if (
      (!nextIsAirPlacementFlow ||
        (!route.params?.addedMaster && !route.params?.updatedSupportKey)) &&
      (nextMasters.length > 0 || route.params?.initialMasters)
    ) {
      setMasters(decorateMasters(nextMasters, nextSelectedMasterType));
    }
  }, [route.params]);

  useEffect(() => {
    const pendingMakeRoute = route.params?.pendingMakeRoute;
    const pendingVersion = asCleanText(
      route.params?.pendingMakeRouteVersion,
    );

    if (
      !pendingMakeRoute ||
      !pendingVersion ||
      lastPendingMakeRouteVersionRef.current === pendingVersion
    ) {
      return;
    }

    lastPendingMakeRouteVersionRef.current = pendingVersion;
    requestAnimationFrame(() => {
      navigation.navigate('Make-Route', pendingMakeRoute);
    });
  }, [
    navigation,
    route.params?.pendingMakeRoute,
    route.params?.pendingMakeRouteVersion,
  ]);

  useEffect(() => {
    const addedMaster = route.params?.addedMaster;
    const addedMasterKey = asCleanText(route.params?.addedMasterKey);

    if (!addedMaster || !addedMasterKey) {
      return;
    }

    if (lastAddedMasterKeyRef.current === addedMasterKey) {
      return;
    }

    lastAddedMasterKeyRef.current = addedMasterKey;
    const fallbackType =
      getMasterTypeValue(addedMaster) ||
      asCleanText(route.params?.selectedMasterType);
    const [decoratedMaster] = decorateMasters([addedMaster], fallbackType);

    if (isFreeAirPlacedMaster(addedMaster)) {
      localFreeAirMastersRef.current = mergeUniqueAttachedMasters(
        localFreeAirMastersRef.current,
        [addedMaster],
      );
    }
    localRecentlyAddedMastersRef.current = mergeUniqueAttachedMasters(
      localRecentlyAddedMastersRef.current,
      [addedMaster],
    );
    if (['pole', 'tree', 'building'].includes(getMasterTypeValue(addedMaster))) {
      localStandaloneMastersRef.current = mergeUniqueAttachedMasters(
        localStandaloneMastersRef.current,
        [addedMaster],
      );
    }

    setMasters(prev => insertMasterNearCoordinate(prev, decoratedMaster));
  }, [
    route.params?.addedMaster,
    route.params?.addedMasterKey,
    route.params?.selectedMasterType,
  ]);

  useEffect(() => {
    const supportKey = asCleanText(route.params?.updatedSupportKey);
    const version = asCleanText(route.params?.updatedSupportVersion);
    const count = Number(route.params?.updatedSupportCount);
    const addedMaster = route.params?.updatedSupportAddedMaster;

    if (
      !supportKey ||
      !version ||
      lastUpdatedSupportVersionRef.current === version ||
      !Number.isFinite(count)
    ) {
      return;
    }

    lastUpdatedSupportVersionRef.current = version;
    if (addedMaster) {
      const support = masters.find(
        master => getMasterUniqueKey(master) === supportKey,
      );
      const existingEntry = localAttachedMastersRef.current.find(
        entry => entry.supportKey === supportKey,
      );
      const nextMasters = mergeUniqueAttachedMasters(
        existingEntry?.masters ?? [],
        [addedMaster],
      );

      if (existingEntry) {
        existingEntry.masters = nextMasters;
        existingEntry.supportCoordinate =
          existingEntry.supportCoordinate ?? getMasterCoordinate(support);
      } else {
        localAttachedMastersRef.current.push({
          supportKey,
          supportCoordinate: getMasterCoordinate(support),
          masters: nextMasters,
        });
      }
    }

    setMasters(previous =>
      previous.map(master =>
        getMasterUniqueKey(master) === supportKey
          ? {
              ...master,
              __airMasterCount: Math.max(0, Math.floor(count)),
              __attachedAirMasters: addedMaster
                ? mergeUniqueAttachedMasters(
                    Array.isArray(master?.__attachedAirMasters)
                      ? master.__attachedAirMasters
                      : [],
                    [addedMaster],
                  )
                : master?.__attachedAirMasters,
            }
          : master,
      ),
    );
  }, [
    route.params?.updatedSupportAddedMaster,
    route.params?.updatedSupportCount,
    route.params?.updatedSupportKey,
    route.params?.updatedSupportVersion,
    masters,
  ]);

  const readCurrentLocation = useCallback(
    async (showAlert = true): Promise<Coordinate | null> => {
      try {
        setIsLocating(true);
        const data =
          (await Location.getAddressFromLatLong()) as DataType.GeoAddress;
        const nextPosition = {
          latitude: Number(data?.lat),
          longitude: Number(data?.long),
        };

        if (!isValidCoordinate(nextPosition)) {
          if (showAlert) {
            showScreenAlert({
              title: 'Location Unavailable',
              message: 'Unable to fetch your current location.',
              tone: 'location',
            });
          }
          return null;
        }

        const nextAddress =
          asCleanText(data?.address) ||
          asCleanText(data?.addressList?.[0]) ||
          getCoordinateAddressText(nextPosition);

        setCurrentPosition(nextPosition);
        setCurrentAddress(nextAddress);
        mapRef.current?.animateToRegion(
          {
            ...nextPosition,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );

        return nextPosition;
      } catch (error: any) {
        if (showAlert) {
          showScreenAlert({
            title: 'Location Unavailable',
            message: error?.message || 'Unable to fetch your current location.',
            tone: 'location',
          });
        }
        return null;
      } finally {
        setIsLocating(false);
      }
    },
    [showScreenAlert],
  );

  const loadMasters = useCallback(
    async ({
      refreshing = false,
      masterTypes = selectedMasterTypes,
      position = currentPosition,
      refreshLocation = false,
      range = searchRange,
      strictMasterTypeFilter = false,
    }: {
      refreshing?: boolean;
      masterTypes?: string[];
      position?: Coordinate | null;
      refreshLocation?: boolean;
      range?: number;
      strictMasterTypeFilter?: boolean;
    } = {}) => {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const cleanMasterTypesInput = Array.from(
          new Set(masterTypes.filter(Boolean)),
        );
        if (isAirPlacementFlow && cleanMasterTypesInput.length === 0) {
          setMasters([]);
          return;
        }
        const cleanMasterTypes =
          cleanMasterTypesInput.length > 0
            ? cleanMasterTypesInput
            : MASTER_TYPES.map(type => type.value);

        const locationToUse =
          refreshLocation || !position
            ? await readCurrentLocation(!position)
            : position;

        if (!locationToUse) {
          setMasters([]);
          return;
        }

        const response = await dispatch(
          GetNearestPoleTreeDDAPI({
            latLng: getLatLngPayload(locationToUse),
            labelType: cleanMasterTypes.join(','),
            range,
            type: 'master',
            status: true,
          }),
        ).unwrap();

        let nextMasters = decorateMasters(
          getMasterListFromResponse(response),
          cleanMasterTypes.length === 1 ? cleanMasterTypes[0] : null,
        );
        const storedRecentlyAddedMasters = loadRecentlyAddedMasters();
        const storedStandaloneMasters = loadStandalonePlacedMasters();
        localRecentlyAddedMastersRef.current = mergeUniqueAttachedMasters(
          localRecentlyAddedMastersRef.current,
          storedRecentlyAddedMasters,
        );
        localStandaloneMastersRef.current = mergeUniqueAttachedMasters(
          localStandaloneMastersRef.current,
          storedStandaloneMasters,
        );

        if (isAirPlacementFlow && initialSelectedMasterType) {
          try {
            const attachedResponse = await dispatch(
              GetNearestPoleTreeDDAPI({
                latLng: getLatLngPayload(locationToUse),
                labelType: initialSelectedMasterType,
                range: range + ATTACHED_MASTER_MATCH_THRESHOLD_METERS,
                type: 'master',
                status: true,
              }),
            ).unwrap();
            nextMasters = addAttachedMastersToSupports(
              nextMasters,
              getMasterListFromResponse(attachedResponse),
              initialSelectedMasterType,
            );
          } catch (error) {
            console.warn(
              '[AllMasters] Attached master count fetch failed:',
              error,
            );
          }

          nextMasters = mergeLocalAttachedMastersIntoSupports(
            nextMasters,
            localAttachedMastersRef.current,
            initialSelectedMasterType,
          );

          nextMasters = addAttachedMastersToSupports(
            nextMasters,
            localRecentlyAddedMastersRef.current.filter(
              master =>
                getMasterTypeValue(master) === initialSelectedMasterType &&
                !isFreeAirPlacedMaster(master),
            ),
            initialSelectedMasterType,
          );

          if (
            !strictMasterTypeFilter &&
            FREE_AIR_MASTER_TYPES.has(initialSelectedMasterType)
          ) {
            nextMasters = mergeFreeAirMastersIntoList(
              nextMasters,
              localFreeAirMastersRef.current,
              initialSelectedMasterType,
              locationToUse,
              range,
            );
          }
        }

        nextMasters = mergeRecentlyAddedMastersIntoList(
          nextMasters,
          localRecentlyAddedMastersRef.current,
          cleanMasterTypes,
          locationToUse,
          range,
        );
        nextMasters = mergeRecentlyAddedMastersIntoList(
          nextMasters,
          localStandaloneMastersRef.current,
          cleanMasterTypes,
          locationToUse,
          range,
        );

        setMasters(nextMasters);
      } catch (error: any) {
        showScreenAlert({
          title: 'Masters Load Failed',
          message: error?.message || 'Unable to load nearest masters.',
          tone: 'error',
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      currentPosition,
      dispatch,
      initialSelectedMasterType,
      isAirPlacementFlow,
      readCurrentLocation,
      selectedMasterTypes,
      searchRange,
      showScreenAlert,
    ],
  );

  const filteredMasters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!isRouteSelectionMode || !query) {
      return masters;
    }

    return masters.filter(master =>
      [
        getMasterName(master),
        getMasterTypeLabel(master),
        getMasterId(master),
        getMasterCode(master),
        getMasterAddress(master),
        getMasterLatLngText(master),
      ].some(value => value.toLowerCase().includes(query)),
    );
  }, [isRouteSelectionMode, masters, searchQuery]);

  const mapRegion = useMemo(
    () => getMapRegion(currentPosition, filteredMasters),
    [currentPosition, filteredMasters],
  );

  const handleMapDisplayTypeChange = useCallback(
    (type: MapDisplayType) => {
      setMapDisplayType(type);

      requestAnimationFrame(() => {
        if (type === 'threeDimensional') {
          mapRef.current?.animateCamera(
            {
              center: {
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
              },
              pitch: 60,
              heading: 0,
              zoom: 18,
              altitude: 350,
            },
            {duration: 650},
          );
          return;
        }

        mapRef.current?.animateCamera(
          {
            pitch: 0,
            heading: 0,
          },
          {duration: 350},
        );

        if (type === 'satellite') {
          mapRef.current?.animateToRegion(
            {
              ...mapRegion,
              latitudeDelta: Math.min(
                mapRegion.latitudeDelta,
                SATELLITE_DETAIL_DELTA,
              ),
              longitudeDelta: Math.min(
                mapRegion.longitudeDelta,
                SATELLITE_DETAIL_DELTA,
              ),
            },
            450,
          );
        }
      });
    },
    [mapRegion],
  );

  const currentLocationPlacement = useMemo(
    () => getCurrentLocationPlacement(currentPosition, filteredMasters),
    [currentPosition, filteredMasters],
  );

  const currentLocationAddress =
    currentAddress || getCoordinateAddressText(currentPosition);
  // Android already lays this screen out above the system navigation bar.
  // Re-applying its bottom inset after returning from Make Route adds the
  // navigation-bar height twice and visibly pushes the footer upward.
  const footerBottomPadding =
    Platform.OS === 'ios'
      ? Math.max(insets.bottom, SIZE.MS(10))
      : SIZE.MS(10);

  const screenTitle = isRouteSelectionMode
    ? 'Select Master'
    : route.params?.selectedMasterLabel
    ? `Add ${route.params.selectedMasterLabel}`
    : 'All Masters';

  useEffect(() => {
    if (didInitialLoadRef.current) {
      return;
    }

    didInitialLoadRef.current = true;

    if (
      (!isRouteSelectionMode || isRouteHubMode) &&
      !isAirPlacementFlow &&
      initialMasters.length === 0
    ) {
      loadMasters();
    }
  }, [
    initialMasters.length,
    isAirPlacementFlow,
    isRouteHubMode,
    isRouteSelectionMode,
    loadMasters,
  ]);

  const onRefresh = async () => {
    if (
      isAirPlacementFlow &&
      (!selectedAirSupportType || !hasLoadedAirSupports)
    ) {
      return;
    }

    await loadMasters({
      refreshing: true,
      refreshLocation: true,
      masterTypes: isAirPlacementFlow
        ? [selectedAirSupportType]
        : selectedMasterTypes,
    });
  };

  const handleWhereIAm = async () => {
    const nextPosition = await readCurrentLocation(true);
    if (!nextPosition) {
      return;
    }

    if (isRouteSelectionMode) {
      setHasAddedCurrentLocation(false);
    }

    if (
      isAirPlacementFlow &&
      (!selectedAirSupportType || !hasLoadedAirSupports)
    ) {
      return;
    }

    await loadMasters({
      position: nextPosition,
      masterTypes: isAirPlacementFlow
        ? [selectedAirSupportType]
        : selectedMasterTypes,
    });

    if (activeTab === 'list') {
      pendingLocationScrollRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!pendingLocationScrollRef.current) {
            return;
          }

          pendingLocationScrollRef.current = false;
          listScrollRef.current?.scrollTo({
            y: Math.max(0, currentLocationRowYRef.current - SIZE.MS(16)),
            animated: true,
          });
        });
      });
    }
  };

  const handleAddCurrentLocation = () => {
    if (isPopPlacementFlow) {
      showScreenAlert({
        title: 'Select a Building',
        message: 'POP can only be added by selecting a Building card.',
        tone: 'warning',
      });
      return;
    }

    if (!currentPosition) {
      showScreenAlert({
        title: 'Location Unavailable',
        message: 'Unable to find your current location.',
        tone: 'location',
      });
      return;
    }

    if (isRouteSelectionMode) {
      navigation.navigate('Add-Master-Form', {
        routeMasterSelectionMode: true,
        routeName: routeDisplayName,
        routeDraft: route.params?.routeDraft ?? {},
        returnToRouteBuilder: route.params?.returnToRouteBuilder,
        returnToRouteHub: isRouteHubMode,
        routeInitialMasters: masters,
        currentPosition,
        currentAddress: currentLocationAddress,
      });
      return;
    }

    navigation.navigate('Add-Master-Form', {
      selectedMasterType: asCleanText(route.params?.selectedMasterType),
      selectedMasterLabel: asCleanText(route.params?.selectedMasterLabel),
      currentPosition,
      currentAddress: currentLocationAddress,
    });
  };

  const updateSearchRange = (direction: -1 | 1) => {
    const nextRange = Math.min(
      MAX_SEARCH_RANGE,
      Math.max(MIN_SEARCH_RANGE, searchRange + direction * SEARCH_RANGE_STEP),
    );

    if (nextRange === searchRange) {
      return;
    }

    setSearchRange(nextRange);
    if (
      isAirPlacementFlow &&
      (!selectedAirSupportType || !hasLoadedAirSupports)
    ) {
      return;
    }

    loadMasters({
      range: nextRange,
      masterTypes: isAirPlacementFlow
        ? [selectedAirSupportType]
        : selectedMasterTypes,
    });
  };

  const handleLoadAirSupports = async () => {
    if (!selectedAirSupportType) {
      showScreenAlert({
        title: 'Where to Add',
        message: `Please select where you want to add ${
          route.params?.selectedMasterLabel || 'this master'
        }.`,
        tone: 'warning',
      });
      return;
    }

    setShowAirSupportDropdown(false);
    setSelectedMasterTypes([selectedAirSupportType]);
    setHasLoadedAirSupports(true);
    await loadMasters({masterTypes: [selectedAirSupportType]});
  };

  const openMaps = (master: MasterItem) => {
    const coordinate = getMasterCoordinate(master);
    if (!coordinate) {
      showScreenAlert({
        title: 'Google Maps',
        message: 'Location is not available for this master.',
        tone: 'location',
        icon: IMAGES.GoogleMapsIcon,
      });
      return;
    }

    const url = `https://maps.google.com/?q=${coordinate.latitude},${coordinate.longitude}`;
    Linking.openURL(url).catch(() => {
      showScreenAlert({
        title: 'Google Maps',
        message: 'Unable to open map.',
        tone: 'error',
        icon: IMAGES.GoogleMapsIcon,
      });
    });
  };

  const openMasterImages = (master: MasterItem) => {
    const images = getMasterImages(master);
    if (images.length === 0) {
      showScreenAlert({
        title: 'View Images',
        message: 'No images are available for this master.',
        tone: 'camera',
      });
      return;
    }

    setPreviewImages(images);
    setPreviewImageIndex(0);
  };

  const canOpenSupportDetails = (master: MasterItem) =>
    isAirPlacementFlow &&
    SUPPORT_DETAIL_MASTER_TYPES.has(initialSelectedMasterType) &&
    (isPopPlacementFlow
      ? master.__masterType === 'building'
      : CLICKABLE_AIR_SUPPORT_TYPES.has(master.__masterType));

  const openSupportDetails = (master: MasterItem) => {
    if (!canOpenSupportDetails(master)) {
      return;
    }

    navigation.navigate('Add-Air-Master-On-Support', {
      selectedMasterType: initialSelectedMasterType as
        | 'pop'
        | 'tiffin'
        | 'enclosure',
      selectedMasterLabel:
        asCleanText(route.params?.selectedMasterLabel) ||
        (initialSelectedMasterType === 'pop'
          ? 'POP'
          : initialSelectedMasterType === 'tiffin'
          ? 'Tiffin'
          : 'Enclosure'),
      supportMaster: master,
      supportKey: getMasterUniqueKey(master),
      currentPosition: currentPosition ?? undefined,
      currentAddress: currentLocationAddress,
      localAttachedMasters: Array.isArray(master?.__attachedAirMasters)
        ? master.__attachedAirMasters
        : [],
    });
  };

  const ensureBuildingMasters = useCallback(async () => {
    if (buildingMastersRef.current.length > 0) {
      return buildingMastersRef.current;
    }

    try {
      const response = await dispatch(
        GetMasterByNameAPI({name: 'Building'}),
      ).unwrap();
      const buildingMasters = getMasterListFromResponse(response);
      buildingMastersRef.current = buildingMasters;
      return buildingMasters;
    } catch (error) {
      console.warn(
        '[SelectRouteMaster] Unable to load buildings for crossing warning:',
        error,
      );
      return [];
    }
  }, [dispatch]);

  const handleSelectRouteMaster = async (
    master: MasterItem,
    allowDuplicateLocation = false,
  ) => {
    if (!isRouteSelectionMode || isRouteHubMode) {
      return;
    }
    if (!currentPosition) {
      showScreenAlert({
        title: 'Select Master',
        message: 'Current route location is unavailable.',
        tone: 'location',
      });
      return;
    }

    const navigateWithMaster = (selectedMaster: MasterItem) => {
      const params = {
        routeName: routeDisplayName,
        routeDraft: route.params?.routeDraft ?? {},
        currentPosition,
        currentAddress: currentLocationAddress,
        selectedMaster,
        selectedMasterVersion: `${Date.now()}-${getMasterUniqueKey(
          selectedMaster,
        )}`,
      };

      if (route.params?.returnToRouteBuilder) {
        (navigation as any).popTo('Make-Route', params);
      } else {
        navigation.navigate('Make-Route', params);
      }
    };

    const existingMasters = getMasterListFromResponse(
      route.params?.routeExistingMasters,
    );

    const validateBuildingCrossingAndNavigate = async (
      selectedMaster: MasterItem,
    ) => {
      const previousMaster = existingMasters[existingMasters.length - 1];
      const startCoordinate = getMasterCoordinate(previousMaster);
      const endCoordinate = getMasterCoordinate(selectedMaster);
      if (!startCoordinate || !endCoordinate) {
        navigateWithMaster(selectedMaster);
        return;
      }

      const serverBuildings = await ensureBuildingMasters();
      const visibleBuildings = masters.filter(
        item => getMasterTypeValue(item) === 'building',
      );
      const uniqueBuildings = [...visibleBuildings, ...serverBuildings].filter(
        (building, index, list) =>
          list.findIndex(item => isSameMasterRecord(item, building)) === index,
      );
      const crossingBuilding = findCrossingBuilding(
        startCoordinate,
        endCoordinate,
        uniqueBuildings,
        existingMasters,
        selectedMaster,
      );

      if (!crossingBuilding) {
        navigateWithMaster(selectedMaster);
        return;
      }

      const nearestRouteMaster = existingMasters
        .map(existing => ({
          master: existing,
          distance: getDistanceMeters(
            crossingBuilding.coordinate,
            getMasterCoordinate(existing),
          ),
        }))
        .filter(item => item.distance !== null)
        .sort(
          (first, second) =>
            (first.distance ?? Number.MAX_SAFE_INTEGER) -
            (second.distance ?? Number.MAX_SAFE_INTEGER),
        )[0];
      const routeSuggestion =
        nearestRouteMaster &&
        Number(nearestRouteMaster.distance) <=
          NEARBY_ROUTE_MASTER_SUGGESTION_METERS
          ? `\n\nNearby ${
              getMasterTypeMeta(nearestRouteMaster.master).label
            } already in this route: ${getMasterName(
              nearestRouteMaster.master,
            )} (${formatDistance(nearestRouteMaster.distance)}).`
          : '';

      showScreenAlert({
        title: 'Building Crossing Warning',
        message: `You are crossing ${getMasterName(
          crossingBuilding.master,
        )}, but this building is not added in the route.${routeSuggestion}\n\nYou can add ${getMasterName(
          selectedMaster,
        )} anyway, or cancel and add the crossing building first.`,
        tone: 'warning',
        buttons: [
          {text: 'Cancel', variant: 'secondary'},
          {
            text: 'Add Anyway',
            variant: 'primary',
            onPress: () => navigateWithMaster(selectedMaster),
          },
        ],
      });
    };

    const selectedId = getMasterId(master);
    const selectedType = getMasterTypeValue(master);
    const sameMaster = existingMasters.find(existing => {
      const existingId = getMasterId(existing);
      const existingType = getMasterTypeValue(existing);
      return Boolean(
        selectedId &&
          existingId &&
          selectedId === existingId &&
          (!selectedType || !existingType || selectedType === existingType),
      );
    });

    if (sameMaster) {
      const typeLabel = getMasterTypeLabel(master);
      showScreenAlert({
        title: `${typeLabel} Already Added`,
        message: `${getMasterName(master)} is already present in this route.`,
        tone: 'info',
      });
      return;
    }

    const selectedCoordinate = getMasterCoordinate(master);
    const selectedAddress = asCleanText(getMasterAddress(master))
      .replace(/\s+/g, ' ')
      .toLowerCase();
    const duplicateLocations = existingMasters.filter(existing => {
      const existingCoordinate = getMasterCoordinate(existing);
      const existingAddress = asCleanText(getMasterAddress(existing))
        .replace(/\s+/g, ' ')
        .toLowerCase();
      const coordinateDistance =
        selectedCoordinate && existingCoordinate
          ? getDistanceMeters(selectedCoordinate, existingCoordinate)
          : null;
      const sameCoordinate =
        coordinateDistance !== null && coordinateDistance <= 1;
      const sameAddress = Boolean(
        selectedAddress &&
          existingAddress &&
          (selectedAddress === existingAddress ||
            (selectedAddress.length >= 12 &&
              existingAddress.includes(selectedAddress)) ||
            (existingAddress.length >= 12 &&
              selectedAddress.includes(existingAddress))),
      );
      return sameCoordinate || sameAddress;
    });

    if (duplicateLocations.length > 0 && !allowDuplicateLocation) {
      showScreenAlert({
        title: 'Location Already Exists',
        message: `This location is already used by ${duplicateLocations
          .map(existing => getMasterName(existing))
          .join(', ')}. Review the existing master or add this one anyway.`,
        tone: 'warning',
        buttons: [
          {text: 'Review', variant: 'secondary'},
          {
            text: 'Add Anyway',
            variant: 'primary',
            onPress: () => {
              handleSelectRouteMaster(master, true);
            },
          },
        ],
      });
      return;
    }

    const previousMaster = existingMasters[existingMasters.length - 1];
    const previousCoordinate = getMasterCoordinate(previousMaster);
    if (previousMaster && (!previousCoordinate || !selectedCoordinate)) {
      showScreenAlert({
        title: 'Lat/Lng Required',
        message: `Unable to verify the nearest ${getMasterTypeLabel(
          master,
        )} because the previous or selected master is missing Lat/Lng data.`,
        tone: 'warning',
      });
      return;
    }

    if (previousCoordinate && selectedCoordinate) {
      const selectableMasters = masters
        .filter(
          item =>
            getMasterTypeValue(item) === selectedType &&
            !isMasterAlreadyInRoute(item, existingMasters),
        )
        .map((item, index) => ({
          master: item,
          index,
          distance:
            getDistanceMeters(previousCoordinate, getMasterCoordinate(item)) ??
            Number.MAX_SAFE_INTEGER,
        }))
        .filter(item => Number.isFinite(item.distance))
        .sort((first, second) =>
          first.distance === second.distance
            ? first.index - second.index
            : first.distance - second.distance,
        );

      if (selectableMasters.length > 1) {
        const nearestMaster = selectableMasters[0];
        const candidateDistance =
          getDistanceMeters(previousCoordinate, selectedCoordinate) ?? 0;
        const selectedIsNearest = isSameMasterRecord(
          master,
          nearestMaster.master,
        );

        if (
          !selectedIsNearest &&
          candidateDistance >
            nearestMaster.distance + NEAREST_MASTER_TOLERANCE_METERS
        ) {
          const selectedTypeLabel = getMasterTypeLabel(master);
          const nearestTypeLabel = getMasterTypeMeta(
            nearestMaster.master,
          ).label;
          const selectedWithinWarningRange =
            candidateDistance <= NEAREST_MASTER_WARNING_LIMIT_METERS;
          showScreenAlert({
            title: `Nearest ${nearestTypeLabel} Missing`,
            message: selectedWithinWarningRange
              ? `You are missing the nearest ${nearestTypeLabel} from ${getMasterName(
                  previousMaster,
                )}.\n\nSuggested ${nearestTypeLabel}: ${getMasterName(
                  nearestMaster.master,
                )} (${formatDistance(
                  nearestMaster.distance,
                )}). Selected ${selectedTypeLabel} is ${formatDistance(
                  candidateDistance,
                )} away.`
              : `Selected ${selectedTypeLabel} is ${formatDistance(
                  candidateDistance,
                )} away, which is above ${NEAREST_MASTER_WARNING_LIMIT_METERS} meters.\n\nYou can add it anyway, or add the nearest ${nearestTypeLabel} first from ${getMasterName(
                  previousMaster,
                )}.\n\nSuggested ${nearestTypeLabel}: ${getMasterName(
                  nearestMaster.master,
                )} (${formatDistance(nearestMaster.distance)}).`,
            tone: 'warning',
            buttons: [
              {text: 'Cancel', variant: 'secondary'},
              {
                text: 'Add Nearest',
                variant: 'secondary',
                onPress: () => {
                  handleSelectRouteMaster(nearestMaster.master);
                },
              },
              {
                text: 'Add Anyway',
                variant: 'primary',
                onPress: () => {
                  validateBuildingCrossingAndNavigate(master);
                },
              },
            ],
          });
          return;
        }
      }
    }

    await validateBuildingCrossingAndNavigate(master);
  };

  const openNewRouteForMaster = (master: MasterItem) => {
    if (!currentPosition) {
      showScreenAlert({
        title: 'Location Unavailable',
        message: 'Please wait for your current location and try again.',
        tone: 'location',
      });
      return;
    }

    navigation.navigate('AddRouteFiberScreen', {
      routeType: 'new-route',
      asBottomSheet: true,
      currentPosition,
      currentAddress: currentLocationAddress,
      selectedMaster: master,
      selectedMasterVersion: `${Date.now()}-${getMasterUniqueKey(master)}`,
    });
  };

  const renderTabs = () => (
    <View style={styles.tabBar}>
      {(['list', 'map'] as TabKey[]).map(tab => {
        const isActive = activeTab === tab;
        const title = tab === 'list' ? 'List View' : 'Map View';

        return (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.85}
            onPress={() => setActiveTab(tab)}
            style={styles.tabTouchable}>
            {isActive ? (
              <LinearGradient
                colors={['#8858F9', '#6036C4']}
                useAngle
                angle={148.57}
                style={styles.activeTab}>
                <Text style={styles.activeTabText}>{title}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.inactiveTab}>
                <Text style={styles.inactiveTabText}>{title}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFilterButton = () => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        const appliedType =
          selectedMasterTypes.length === 1 &&
          MAP_FILTER_MASTER_TYPES.some(
            type => type.value === selectedMasterTypes[0],
          )
            ? selectedMasterTypes[0]
            : 'pole';
        setPendingMapMasterType(appliedType);
        setIsMasterFilterVisible(true);
      }}
      disabled={isLoading}
      style={styles.filterButtonTouchable}>
      <LinearGradient
        colors={['#8858F9', '#6036C4']}
        useAngle
        angle={148.57}
        style={styles.filterButton}>
        <Image source={IMAGES.filterFill} style={styles.filterIcon} />
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderAirSupportSelector = () => {
    const allowedSupportTypes = getAllowedAirSupportTypes(
      initialSelectedMasterType,
    );
    const selectedSupport = allowedSupportTypes.find(
      type => type.value === selectedAirSupportType,
    );

    return (
      <View style={styles.airSupportCard}>
        <Text style={styles.airSupportTitle}>
          Where do you want to add{' '}
          {route.params?.selectedMasterLabel || 'this master'}?
        </Text>
        <View style={styles.airSupportActionRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setShowAirSupportDropdown(prev => !prev)}
            style={styles.airSupportSelect}>
            {selectedSupport ? (
              <Image
                source={selectedSupport.icon}
                style={styles.airSupportIcon}
              />
            ) : null}
            <Text
              style={[
                styles.airSupportSelectText,
                !selectedSupport && styles.airSupportPlaceholder,
              ]}>
              {selectedSupport ? `On ${selectedSupport.label}` : 'Select'}
            </Text>
            <Image source={IMAGES.down} style={styles.airSupportDownIcon} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleLoadAirSupports}
            disabled={!selectedAirSupportType || isLoading}
            style={[
              styles.airSupportSubmit,
              (!selectedAirSupportType || isLoading) &&
                styles.airSupportSubmitDisabled,
            ]}>
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.WHITE} />
            ) : (
              <Text style={styles.airSupportSubmitText}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>

        {showAirSupportDropdown ? (
          <View style={styles.airSupportDropdown}>
            {allowedSupportTypes.map(type => (
              <TouchableOpacity
                key={type.value}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedAirSupportType(type.value);
                  setShowAirSupportDropdown(false);
                  setHasLoadedAirSupports(false);
                  setMasters([]);
                }}
                style={styles.airSupportOption}>
                <Image source={type.icon} style={styles.airSupportOptionIcon} />
                <Text style={styles.airSupportOptionText}>On {type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderRangeControl = () => (
    <View style={styles.rangeControl}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => updateSearchRange(-1)}
        style={styles.rangeButton}
        disabled={searchRange <= MIN_SEARCH_RANGE}>
        <Text style={styles.rangeButtonText}>-</Text>
      </TouchableOpacity>
      <Text style={styles.rangeText}>{searchRange}m</Text>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => updateSearchRange(1)}
        style={styles.rangeButton}
        disabled={searchRange >= MAX_SEARCH_RANGE}>
        <Text style={styles.rangeButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRouteSelectionControls = () => (
    <View style={styles.routeSelectionControls}>
      <View style={styles.routeSearchRow}>
        <View style={styles.routeSearchBox}>
          <Image source={IMAGES.search} style={styles.routeSearchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor="#9298A2"
            style={styles.routeSearchInput}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Clear master search"
              onPress={() => setSearchQuery('')}
              style={styles.routeSearchClear}>
              <Text style={styles.routeSearchClearText}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {renderRangeControl()}
      </View>

      {!isRouteHubMode ? (
        <View style={styles.routeNameRow}>
          <Text style={styles.routeNameLabel}>Route Name:</Text>
          <Text numberOfLines={1} style={styles.routeNameValue}>
            {routeDisplayName}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderDistanceSeparator = (
    distance: number | null | undefined,
    key: string,
  ) => (
    <View key={key} style={styles.betweenDistanceRow}>
      <View style={styles.betweenDistancePill}>
        <Text style={styles.betweenDistanceText}>Distance:</Text>
        <VectorSvg
          width={SIZE.MS(7)}
          height={SIZE.MS(15)}
          style={styles.distanceArrow}
        />
        <Text style={styles.betweenDistanceText}>
          {formatDistanceShort(distance)}
        </Text>
      </View>
    </View>
  );

  const renderCurrentLocationRow = () => {
    const nearestMaster =
      currentLocationPlacement?.nearestIndex !== undefined
        ? filteredMasters[currentLocationPlacement.nearestIndex]
        : null;
    const nearestText = nearestMaster
      ? `${
          currentLocationPlacement?.isAtMaster ? 'At' : 'Nearest'
        } ${getMasterTypeLabel(nearestMaster)}: ${formatDistance(
          currentLocationPlacement?.nearestDistance,
        )}`
      : 'Nearest master not available';

    return (
      <View
        key="current-location"
        onLayout={(event: LayoutChangeEvent) => {
          currentLocationRowYRef.current = event.nativeEvent.layout.y;

          if (pendingLocationScrollRef.current) {
            pendingLocationScrollRef.current = false;
            requestAnimationFrame(() => {
              listScrollRef.current?.scrollTo({
                y: Math.max(
                  0,
                  currentLocationRowYRef.current - SIZE.MS(16),
                ),
                animated: true,
              });
            });
          }
        }}
        style={styles.currentLocationRow}>
        <View style={styles.currentMarkerWrap}>
          <PointerSvg width={SIZE.MS(24)} height={SIZE.MS(24)} />
        </View>
        <PolygonSvg
          width={SIZE.MS(9)}
          height={SIZE.MS(10)}
          style={styles.locationPointer}
        />
        <View style={styles.currentLocationCard}>
          <View style={styles.currentLocationTextWrap}>
            <Text style={styles.currentLocationText} numberOfLines={2}>
              <Text style={styles.currentLocationLabel}>Current Address: </Text>
              {currentLocationAddress}
            </Text>
            <Text style={styles.nearestMasterText} numberOfLines={1}>
              {nearestText}
            </Text>
          </View>
          {!isPopPlacementFlow ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAddCurrentLocation}
              disabled={isRouteSelectionMode && hasAddedCurrentLocation}
              style={[
                styles.addCurrentButton,
                isRouteSelectionMode &&
                  hasAddedCurrentLocation &&
                  styles.addCurrentButtonDisabled,
              ]}>
              <Text style={styles.addCurrentButtonText}>
                {isRouteSelectionMode && hasAddedCurrentLocation
                  ? 'Added'
                  : 'Add'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderMastersWithCurrentLocation = () => {
    const rows: React.ReactNode[] = [];
    const insertAfterIndex = currentLocationPlacement?.insertAfterIndex;

    filteredMasters.forEach((master, index) => {
      const nextMaster = filteredMasters[index + 1];
      const currentIsAfterThisMaster = insertAfterIndex === index;

      rows.push(renderMasterCard(master, index));

      if (currentIsAfterThisMaster && currentPosition) {
        rows.push(
          renderDistanceSeparator(
            getDistanceMeters(getMasterCoordinate(master), currentPosition),
            `distance-${index}-current`,
          ),
        );
        rows.push(renderCurrentLocationRow());

        if (nextMaster) {
          rows.push(
            renderDistanceSeparator(
              getDistanceMeters(
                currentPosition,
                getMasterCoordinate(nextMaster),
              ),
              `distance-current-${index + 1}`,
            ),
          );
        }
      } else if (nextMaster) {
        rows.push(
          renderDistanceSeparator(
            getDistanceMeters(
              getMasterCoordinate(master),
              getMasterCoordinate(nextMaster),
            ),
            `distance-${index}-${index + 1}`,
          ),
        );
      }
    });

    if (isAirPlacementFlow && currentPosition && !currentLocationPlacement) {
      rows.push(renderCurrentLocationRow());
    }

    return rows;
  };

  const renderMasterCard = (master: MasterItem, index: number) => {
    const status = getStatusInfo(master);
    const distance = getMasterDistance(master, currentPosition);
    const masterId = getMasterId(master);
    const masterCode = getMasterCode(master);
    const showSupportDetails = canOpenSupportDetails(master);
    const attachedMasterCount = getAttachedMasterCount(
      master,
      initialSelectedMasterType,
    );
    const isCardInteractive = showSupportDetails || isRouteSelectionMode;
    const isFreeAirMaster = isFreeAirPlacedMaster(master);

    return (
      <View key={`${master.__masterType}-${masterId || index}`}>
        <TouchableOpacity
          activeOpacity={isCardInteractive ? 0.82 : 1}
          disabled={!isCardInteractive}
          onPress={() =>
            isRouteHubMode
              ? openNewRouteForMaster(master)
              : isRouteSelectionMode
              ? handleSelectRouteMaster(master)
              : openSupportDetails(master)
          }
          style={styles.masterCard}>
          {isFreeAirMaster ? (
            <View style={styles.freeAirBadge}>
              <Text style={styles.freeAirBadgeText}>Placed in the air</Text>
            </View>
          ) : null}

          <View style={styles.cardTitleRow}>
            <Text style={styles.masterName} numberOfLines={1}>
              {getMasterName(master)}
            </Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status :</Text>
              <View
                style={[
                  styles.statusBadge,
                  status.active ? styles.activeBadge : styles.inactiveBadge,
                ]}>
                <Text style={styles.statusBadgeText}>{status.label}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.masterIdText} numberOfLines={1}>
            {masterCode || `${getMasterTypeLabel(master)}#${masterId || 'ID'}`}
          </Text>

          <Text style={styles.addressText} numberOfLines={3}>
            <Text style={styles.addressLabel}>Address: </Text>
            {getMasterAddress(master)}
          </Text>

          <Text style={styles.latLngText} numberOfLines={2}>
            <Text style={styles.addressLabel}>Lat/Lng: </Text>
            {getMasterLatLngText(master)}
          </Text>

          <View style={styles.cardFooterRow}>
            <Text style={styles.distanceText}>
              Distance:{' '}
              <Text style={styles.distanceValue}>
                {formatDistance(distance)}
              </Text>
            </Text>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={event => {
                event.stopPropagation();
                openMasterImages(master);
              }}
              style={styles.viewMasterImagesButton}>
              <Text style={styles.viewMasterImagesText}>View Images</Text>
              <Image
                source={IMAGES.camera}
                style={styles.viewMasterImagesIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={event => {
                event.stopPropagation();
                openMaps(master);
              }}
              style={styles.googleButton}>
              <Image source={IMAGES.GoogleMapsIcon} style={styles.googleIcon} />
            </TouchableOpacity>
          </View>
          {showSupportDetails ? (
            <View style={styles.supportDetailFooter}>
              <Text style={styles.supportDetailHint}>
                Tap to add {route.params?.selectedMasterLabel}
              </Text>
              <View style={styles.supportCountBadge}>
                <Text style={styles.supportCountText}>
                  {route.params?.selectedMasterLabel}: {attachedMasterCount}
                </Text>
              </View>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    );
  };

  const renderMapMasterCallout = (master: MasterItem) => {
    const status = getStatusInfo(master);
    const distance = getMasterDistance(master, currentPosition);
    const masterId = getMasterId(master);
    const masterCode = getMasterCode(master);

    return (
      <Callout tooltip>
        <View style={styles.mapCalloutWrap}>
          <View style={styles.mapCalloutCard}>
            <View style={styles.mapCalloutTitleRow}>
              <Text style={styles.mapCalloutName} numberOfLines={1}>
                {getMasterName(master)}
              </Text>
              <Text style={styles.mapCalloutClose}>×</Text>
            </View>

            <Text style={styles.mapCalloutIdText} numberOfLines={1}>
              {masterCode ||
                `${getMasterTypeLabel(master)}#${masterId || 'ID'}`}
            </Text>

            <View style={styles.mapCalloutStatusRow}>
              <Text style={styles.mapCalloutLabel}>Status: </Text>
              <View
                style={[
                  styles.mapCalloutStatusBadge,
                  status.active ? styles.activeBadge : styles.inactiveBadge,
                ]}>
                <Text style={styles.mapCalloutStatusText}>{status.label}</Text>
              </View>
            </View>

            <Text style={styles.mapCalloutBodyText} numberOfLines={4}>
              <Text style={styles.mapCalloutLabel}>Address: </Text>
              {getMasterAddress(master)}
            </Text>

            <Text style={styles.mapCalloutBodyText} numberOfLines={2}>
              <Text style={styles.mapCalloutLabel}>Lat/Lng: </Text>
              {getMasterLatLngText(master)}
            </Text>

            <View style={styles.mapCalloutFooter}>
              <Text style={styles.mapCalloutDistanceText}>
                Distance:{' '}
                <Text style={styles.distanceValue}>
                  {formatDistance(distance)}
                </Text>
              </Text>
              <View style={styles.mapCalloutGoogleButton}>
                <Image
                  source={IMAGES.GoogleMapsIcon}
                  style={styles.mapCalloutGoogleIcon}
                />
              </View>
            </View>
          </View>
          <View style={styles.mapCalloutArrow} />
        </View>
      </Callout>
    );
  };

  const renderListView = () => (
    <ScrollView
      ref={listScrollRef}
      style={styles.listScroll}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }>
      <View style={styles.timelineWrap}>
        <View style={styles.timelineLine} />
        <View style={styles.cardsColumn}>
          {isLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator
                size="large"
                color={COLORS.colorMediumslateblue}
              />
              <Text style={styles.stateText}>Loading masters...</Text>
            </View>
          ) : isAirPlacementFlow && !hasLoadedAirSupports ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Select where to add</Text>
              <Text style={styles.stateText}>
                {isPopPlacementFlow
                  ? 'Building is selected for POP. Tap Submit to load nearby buildings.'
                  : 'Choose Pole, Tree, or Building above and tap Submit.'}
              </Text>
            </View>
          ) : filteredMasters.length > 0 ? (
            renderMastersWithCurrentLocation()
          ) : isAirPlacementFlow && currentPosition ? (
            <>
              {renderCurrentLocationRow()}
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>No supports found</Text>
              <Text style={styles.stateText}>
                  {isPopPlacementFlow
                    ? 'No Building is available nearby. POP can only be added by selecting a Building card.'
                    : `You can still add ${
                        route.params?.selectedMasterLabel || 'this master'
                      } at your current address using the Add button above.`}
              </Text>
              </View>
            </>
          ) : (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>No masters found</Text>
              <Text style={styles.stateText}>
                Tap Where I am? to reload nearest masters for this location.
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const renderMapView = () => (
    <View style={styles.mapPanel}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType={mapDisplayType === 'satellite' ? 'satellite' : 'standard'}
        style={styles.map}
        initialRegion={mapRegion}
        region={mapRegion}
        cacheEnabled={false}
        loadingEnabled={mapDisplayType === 'satellite'}
        loadingIndicatorColor={COLORS.colorMediumslateblue}
        maxZoomLevel={20}
        pitchEnabled
        rotateEnabled
        showsBuildings
        zoomEnabled>
        {currentPosition ? (
          <Marker coordinate={currentPosition} title="You are here">
            <PointerSvg width={SIZE.MS(38)} height={SIZE.MS(38)} />
          </Marker>
        ) : null}

        {filteredMasters.map((master, index) => {
          const coordinate = getMasterCoordinate(master);
          if (!coordinate) {
            return null;
          }

          return (
            <Marker
              key={`${master.__masterType}-${getMasterId(master) || index}`}
              coordinate={coordinate}>
              <Image
                source={master.__masterIcon}
                style={styles.mapMasterIcon}
              />
              {renderMapMasterCallout(master)}
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.mapTypeControl}>
        {MAP_DISPLAY_OPTIONS.map(({type, label}) => {
          const isSelected = mapDisplayType === type;

          return (
            <TouchableOpacity
              key={type}
              accessibilityRole="button"
              accessibilityLabel={`Show ${label.toLowerCase()} map`}
              accessibilityState={{selected: isSelected}}
              activeOpacity={0.8}
              onPress={() => handleMapDisplayTypeChange(type)}
              style={[
                styles.mapTypeOption,
                isSelected && styles.mapTypeOptionSelected,
              ]}>
              <Text
                style={[
                  styles.mapTypeOptionText,
                  isSelected && styles.mapTypeOptionTextSelected,
                ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.mapLoading}>
          <ActivityIndicator color={COLORS.colorMediumslateblue} />
          <Text style={styles.mapLoadingText}>Loading masters...</Text>
        </View>
      ) : null}
    </View>
  );

  const renderHubMap = () => (
    <View style={styles.hubMapContainer}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={mapRegion}
        region={mapRegion}
        showsCompass
        showsMyLocationButton={false}
        toolbarEnabled={false}>
        {currentPosition ? (
          <Marker coordinate={currentPosition} title="You are here">
            <PointerSvg width={SIZE.MS(34)} height={SIZE.MS(34)} />
          </Marker>
        ) : null}

        {filteredMasters.slice(0, 3).map((master, index) => {
          const coordinate = getMasterCoordinate(master);
          if (!coordinate) {
            return null;
          }

          return (
            <Marker
              key={`hub-${master.__masterType}-${getMasterId(master) || index}`}
              coordinate={coordinate}>
              <Image
                source={master.__masterIcon}
                style={styles.hubMapMasterIcon}
              />
              {renderMapMasterCallout(master)}
            </Marker>
          );
        })}
      </MapView>

      {isLocating || isLoading ? (
        <View style={styles.hubMapLoading} pointerEvents="none">
          <ActivityIndicator size="small" color={COLORS.colorMediumslateblue} />
          <Text style={styles.hubMapLoadingText}>
            {isLocating ? 'Finding your location...' : 'Loading masters...'}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen
      preset="fixed"
      isSafeArea={false}
      isNavSafeArea={false}
      keyboardAvoidingEnabled={Platform.OS === 'ios'}
      statusBgColor="#8858F9"
      statusBarStyle="light">
      <StatusBar barStyle="light-content" backgroundColor="#8858F9" />
      <View style={styles.screen}>
        <LinearGradient
          colors={['#8858F9', '#6036C4']}
          useAngle
          angle={180}
          style={[styles.header, {paddingTop: insets.top + SIZE.MS(10)}]}>
          <View style={styles.starTwo} />
          <View style={styles.starThree} />
          <View style={styles.headerRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => navigation.goBack()}
              style={styles.backButton}>
              <Image source={IMAGES.back} style={styles.backIcon} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{screenTitle}</Text>
            {isRouteHubMode ? (
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Select route type"
                onPress={() => setIsRouteTypeSheetVisible(true)}
                style={styles.burgerButton}>
                <BurgerSvg width={SIZE.MS(19)} height={SIZE.MS(14)} />
              </TouchableOpacity>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {isRouteHubMode ? renderHubMap() : null}

          {isRouteSelectionMode ? (
            renderRouteSelectionControls()
          ) : (
            <View style={styles.topControls}>
              <View style={styles.tabsWrap}>{renderTabs()}</View>
              {activeTab === 'list'
                ? renderRangeControl()
                : renderFilterButton()}
            </View>
          )}

          {isAirPlacementFlow && activeTab === 'list'
            ? renderAirSupportSelector()
            : null}

          <View style={styles.contentArea}>
            {activeTab === 'list' ? renderListView() : renderMapView()}
          </View>

          <View
            style={[
              styles.footer,
              {paddingBottom: footerBottomPadding},
            ]}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                handleWhereIAm();
              }}
              disabled={isLocating}>
              <LinearGradient
                colors={['#8858F9', '#6036C4']}
                useAngle
                angle={148.57}
                style={styles.whereButton}>
                <Text style={styles.whereButtonText}>
                  {isLocating ? 'Locating...' : 'Where I am?'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={isRouteTypeSheetVisible}
          transparent
          statusBarTranslucent
          animationType="slide"
          onRequestClose={() => setIsRouteTypeSheetVisible(false)}>
          <Pressable
            onPress={() => setIsRouteTypeSheetVisible(false)}
            style={styles.routeTypeOverlay}>
            <Pressable
              onPress={event => event.stopPropagation()}
              style={styles.routeTypeSheet}>
              <View style={styles.routeTypeHandle} />
              <Text style={styles.routeTypeSheetTitle}>Select Route Type</Text>
              <View style={styles.routeTypeOptions}>
                {[
                  {label: 'New Route', value: 'new-route' as const},
                  {
                    label: 'Existing Route (Change Fiber)',
                    value: 'change-fiber' as const,
                  },
                  {
                    label: 'Paused Route / UnSaved Route',
                    value: 'paused-route' as const,
                  },
                ].map((option, index, options) => {
                  const selected = pendingRouteType === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      activeOpacity={0.75}
                      onPress={() => setPendingRouteType(option.value)}
                      style={[
                        styles.routeTypeOption,
                        index < options.length - 1 &&
                          styles.routeTypeOptionBorder,
                      ]}>
                      <View
                        style={[
                          styles.routeTypeRadio,
                          selected && styles.routeTypeRadioSelected,
                        ]}>
                        {selected ? (
                          <View style={styles.routeTypeRadioDot} />
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
                  activeOpacity={0.85}
                  onPress={() => {
                    setPendingRouteType(null);
                    setIsRouteTypeSheetVisible(false);
                  }}
                  style={[styles.routeTypeAction, styles.routeTypeClose]}>
                  <Text style={styles.routeTypeActionText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (!pendingRouteType) {
                      showScreenAlert({
                        title: 'Select Route Type',
                        message: 'Please select a route type.',
                        tone: 'warning',
                      });
                      return;
                    }

                    setIsRouteTypeSheetVisible(false);
                    if (pendingRouteType === 'new-route') {
                      navigation.navigate('AddRouteFiberScreen', {
                        routeType: 'new-route',
                        asBottomSheet: true,
                        currentPosition: currentPosition ?? undefined,
                        currentAddress: currentLocationAddress,
                      });
                    } else if (pendingRouteType === 'change-fiber') {
                      navigation.navigate('Select-Route-To-Change-Fiber');
                    } else {
                      navigation.navigate('Select-Paused-Route');
                    }
                    setPendingRouteType(null);
                  }}
                  style={[styles.routeTypeAction, styles.routeTypeSelect]}>
                  <Text style={styles.routeTypeActionText}>Select</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={isMasterFilterVisible}
          transparent
          statusBarTranslucent
          animationType="slide"
          onRequestClose={() => setIsMasterFilterVisible(false)}>
          <Pressable
            onPress={() => setIsMasterFilterVisible(false)}
            style={styles.masterFilterOverlay}>
            <Pressable
              onPress={event => event.stopPropagation()}
              style={styles.masterFilterSheet}>
              <View style={styles.masterFilterHandle} />
              <Text style={styles.masterFilterTitle}>Select Master Type</Text>

              <View style={styles.masterFilterOptions}>
                {MAP_FILTER_MASTER_TYPES.map((option, index) => {
                  const selected = pendingMapMasterType === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      activeOpacity={0.75}
                      onPress={() => setPendingMapMasterType(option.value)}
                      style={[
                        styles.masterFilterOption,
                        index < MAP_FILTER_MASTER_TYPES.length - 1 &&
                          styles.masterFilterOptionBorder,
                      ]}>
                      <View
                        style={[
                          styles.masterFilterCheckbox,
                          selected && styles.masterFilterCheckboxSelected,
                        ]}>
                        {selected ? (
                          <Text style={styles.masterFilterCheckmark}>✓</Text>
                        ) : null}
                      </View>
                      <Text style={styles.masterFilterOptionText}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.masterFilterActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsMasterFilterVisible(false)}
                  style={[
                    styles.masterFilterAction,
                    styles.masterFilterCloseAction,
                  ]}>
                  <Text style={styles.masterFilterActionText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={async () => {
                    if (!pendingMapMasterType) {
                      showScreenAlert({
                        title: 'Select Master Type',
                        message: 'Please select a master type.',
                        tone: 'warning',
                      });
                      return;
                    }

                    const selectedTypes = [pendingMapMasterType];
                    setSelectedMasterTypes(selectedTypes);
                    setIsMasterFilterVisible(false);
                    await loadMasters({
                      range: searchRange,
                      masterTypes: selectedTypes,
                      strictMasterTypeFilter: true,
                    });
                  }}
                  style={[
                    styles.masterFilterAction,
                    styles.masterFilterSaveAction,
                  ]}>
                  <Text style={styles.masterFilterActionText}>Save</Text>
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
          <View style={styles.routeAlertOverlay}>
            <View style={styles.routeAlertCard}>
              <View
                style={[
                  styles.routeAlertIconBox,
                  {backgroundColor: routeAlert.iconBg},
                ]}>
                <Image
                  source={routeAlert.icon}
                  style={[
                    styles.routeAlertIcon,
                    {tintColor: routeAlert.iconTint},
                  ]}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.routeAlertTitle}>{routeAlert.title}</Text>
              <ScrollView
                style={styles.routeAlertMessageScroll}
                contentContainerStyle={styles.routeAlertMessageContent}
                showsVerticalScrollIndicator={false}>
                <Text style={styles.routeAlertMessage}>
                  {routeAlert.message}
                </Text>
              </ScrollView>
              <View
                style={[
                  styles.routeAlertButtonRow,
                  routeAlert.buttons.length === 1 &&
                    styles.routeAlertButtonRowSingle,
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
                        styles.routeAlertButton,
                        routeAlert.buttons.length === 1 &&
                          styles.routeAlertButtonSingle,
                        isSecondary && styles.routeAlertButtonSecondary,
                        isDanger && styles.routeAlertButtonDanger,
                      ]}>
                      <Text
                        style={[
                          styles.routeAlertButtonText,
                          isSecondary && styles.routeAlertButtonTextSecondary,
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
          onRequestClose={() => setPreviewImages([])}>
          <View style={styles.previewOverlay}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPreviewImages([])}
              style={styles.previewCloseButton}>
              <Text style={styles.previewCloseText}>×</Text>
            </TouchableOpacity>
            {previewImages[previewImageIndex] ? (
              <Image
                source={{uri: previewImages[previewImageIndex]}}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
            {previewImages.length > 1 ? (
              <View style={styles.previewPager}>
                {previewImages.map((_, index) => (
                  <TouchableOpacity
                    key={index}
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
        </Modal>
      </View>
    </Screen>
  );
};

export default AllMasters;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EDF1F6',
  },
  header: {
    height: SIZE.MS(96),
    justifyContent: 'flex-end',
    paddingHorizontal: SIZE.MS(14),
    paddingBottom: SIZE.MS(15),
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: SIZE.MS(28),
    height: SIZE.MS(28),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZE.MS(2),
  },
  backIcon: {
    width: SIZE.MS(16),
    height: SIZE.MS(16),
    tintColor: COLORS.WHITE,
    resizeMode: 'contain',
  },
  headerTitle: {
    flex: 1,
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.WHITE,
  },
  burgerButton: {
    width: SIZE.MS(28),
    height: SIZE.MS(28),
    borderRadius: SIZE.MS(5),
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTypeOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(19, 22, 28, 0.28)',
  },
  routeTypeSheet: {
    backgroundColor: '#F5F6F8',
    borderTopLeftRadius: SIZE.MS(16),
    borderTopRightRadius: SIZE.MS(16),
    paddingHorizontal: SIZE.MS(15),
    paddingTop: SIZE.MVS(7),
    paddingBottom: SIZE.MVS(18),
  },
  routeTypeHandle: {
    width: SIZE.MS(48),
    height: SIZE.MVS(4),
    borderRadius: SIZE.MS(2),
    alignSelf: 'center',
    backgroundColor: '#737A82',
    marginBottom: SIZE.MVS(10),
  },
  routeTypeSheetTitle: {
    color: '#353A42',
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(18),
    textAlign: 'center',
    marginBottom: SIZE.MVS(12),
  },
  routeTypeOptions: {
    overflow: 'hidden',
    borderRadius: SIZE.MS(8),
    backgroundColor: COLORS.WHITE,
  },
  routeTypeOption: {
    minHeight: SIZE.MVS(48),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(14),
  },
  routeTypeOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#DADDE2',
  },
  routeTypeRadio: {
    width: SIZE.MS(13),
    height: SIZE.MS(13),
    borderRadius: SIZE.MS(7),
    borderWidth: 1,
    borderColor: '#8B9097',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZE.MS(10),
  },
  routeTypeRadioSelected: {
    borderColor: '#7545E7',
  },
  routeTypeRadioDot: {
    width: SIZE.MS(7),
    height: SIZE.MS(7),
    borderRadius: SIZE.MS(4),
    backgroundColor: '#7545E7',
  },
  routeTypeOptionText: {
    color: '#32363D',
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(15),
  },
  routeTypeActions: {
    flexDirection: 'row',
    gap: SIZE.MS(9),
    marginTop: SIZE.MVS(25),
  },
  routeTypeAction: {
    flex: 1,
    height: SIZE.MVS(39),
    borderRadius: SIZE.MS(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeTypeClose: {
    backgroundColor: '#5B5E61',
  },
  routeTypeSelect: {
    backgroundColor: '#7040DF',
  },
  routeTypeActionText: {
    color: COLORS.WHITE,
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(14),
  },
  masterFilterOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(19, 22, 28, 0.3)',
  },
  masterFilterSheet: {
    backgroundColor: '#F5F6F8',
    borderTopLeftRadius: SIZE.MS(16),
    borderTopRightRadius: SIZE.MS(16),
    paddingHorizontal: SIZE.MS(14),
    paddingTop: SIZE.MVS(7),
    paddingBottom: SIZE.MVS(18),
  },
  masterFilterHandle: {
    width: SIZE.MS(46),
    height: SIZE.MVS(4),
    borderRadius: SIZE.MS(2),
    alignSelf: 'center',
    backgroundColor: '#858A91',
    marginBottom: SIZE.MVS(8),
  },
  masterFilterTitle: {
    color: '#353A42',
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(17),
    textAlign: 'center',
    marginBottom: SIZE.MVS(10),
  },
  masterFilterOptions: {
    overflow: 'hidden',
    borderRadius: SIZE.MS(10),
    backgroundColor: COLORS.WHITE,
  },
  masterFilterOption: {
    minHeight: SIZE.MVS(42),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(13),
  },
  masterFilterOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#D9DDE3',
  },
  masterFilterCheckbox: {
    width: SIZE.MS(14),
    height: SIZE.MS(14),
    borderRadius: SIZE.MS(3),
    borderWidth: 1,
    borderColor: '#A4AAB2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZE.MS(10),
    backgroundColor: COLORS.WHITE,
  },
  masterFilterCheckboxSelected: {
    borderColor: '#2878E6',
    backgroundColor: '#2878E6',
  },
  masterFilterCheckmark: {
    color: COLORS.WHITE,
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(10),
    lineHeight: SIZE.MS(12),
  },
  masterFilterOptionText: {
    color: '#30343A',
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(14),
  },
  masterFilterActions: {
    flexDirection: 'row',
    gap: SIZE.MS(8),
    marginTop: SIZE.MVS(22),
  },
  masterFilterAction: {
    flex: 1,
    height: SIZE.MVS(39),
    borderRadius: SIZE.MS(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterFilterCloseAction: {
    backgroundColor: '#5B5E61',
  },
  masterFilterSaveAction: {
    backgroundColor: '#7040DF',
  },
  masterFilterActionText: {
    color: COLORS.WHITE,
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MS(13),
  },
  starOne: {
    position: 'absolute',
    top: SIZE.MS(18),
    alignSelf: 'center',
    width: SIZE.MS(14),
    height: SIZE.MS(14),
    borderRadius: SIZE.MS(7),
    backgroundColor: COLORS.WHITE,
  },
  starTwo: {
    position: 'absolute',
    top: SIZE.MS(36),
    left: SIZE.MS(92),
    width: SIZE.MS(2),
    height: SIZE.MS(2),
    borderRadius: SIZE.MS(1),
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  starThree: {
    position: 'absolute',
    top: SIZE.MS(66),
    right: SIZE.MS(48),
    width: SIZE.MS(2),
    height: SIZE.MS(2),
    borderRadius: SIZE.MS(1),
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  body: {
    flex: 1,
    paddingHorizontal: SIZE.MS(14),
    paddingTop: SIZE.MS(10),
  },
  topControls: {
    height: SIZE.MS(34),
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(8),
    marginBottom: SIZE.MS(8),
  },
  routeSelectionControls: {
    marginBottom: SIZE.MS(7),
  },
  routeSearchRow: {
    height: SIZE.MS(34),
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(8),
  },
  routeSearchBox: {
    flex: 1,
    height: SIZE.MS(34),
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SIZE.MS(9),
    paddingRight: SIZE.MS(4),
    borderRadius: SIZE.MS(6),
    backgroundColor: COLORS.WHITE,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  routeSearchIcon: {
    width: SIZE.MS(13),
    height: SIZE.MS(13),
    resizeMode: 'contain',
    tintColor: '#8A919D',
    marginRight: SIZE.MS(6),
  },
  routeSearchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.REGULAR,
    color: '#393D45',
  },
  routeSearchClear: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    borderRadius: SIZE.MS(5),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF1F6',
  },
  routeSearchClearText: {
    fontSize: SIZE.MS(18),
    lineHeight: SIZE.MS(20),
    fontFamily: FONTS.REGULAR,
    color: '#5B6170',
  },
  routeNameRow: {
    minHeight: SIZE.MS(25),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(1),
    paddingTop: SIZE.MS(5),
  },
  routeNameLabel: {
    marginRight: SIZE.MS(4),
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#393D45',
  },
  routeNameValue: {
    flex: 1,
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.BOLD,
    color: '#7754F7',
  },
  tabsWrap: {
    flex: 1,
  },
  tabBar: {
    height: SIZE.MS(34),
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(6),
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  tabTouchable: {
    flex: 1,
  },
  activeTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabText: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.WHITE,
  },
  inactiveTabText: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  rangeControl: {
    height: SIZE.MS(34),
    minWidth: SIZE.MS(82),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(6),
    paddingHorizontal: SIZE.MS(4),
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  rangeButton: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    borderRadius: SIZE.MS(5),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF1F6',
  },
  rangeButtonText: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.BOLD,
    color: '#5B6170',
    lineHeight: SIZE.MS(17),
  },
  rangeText: {
    minWidth: SIZE.MS(34),
    textAlign: 'center',
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  filterButtonTouchable: {
    height: SIZE.MS(34),
    width: SIZE.MS(34),
    borderRadius: SIZE.MS(6),
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    width: SIZE.MS(17),
    height: SIZE.MS(17),
    resizeMode: 'contain',
    tintColor: COLORS.WHITE,
  },
  contentArea: {
    flex: 1,
  },
  airSupportCard: {
    marginBottom: SIZE.MS(8),
    borderRadius: SIZE.MS(8),
    backgroundColor: COLORS.WHITE,
    padding: SIZE.MS(10),
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 5,
  },
  airSupportTitle: {
    marginBottom: SIZE.MS(8),
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#393D45',
  },
  airSupportActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(8),
  },
  airSupportSelect: {
    flex: 1,
    height: SIZE.MS(38),
    borderWidth: 1,
    borderColor: '#E0E4EA',
    borderRadius: SIZE.MS(6),
    backgroundColor: '#F8F9FB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(10),
  },
  airSupportIcon: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    resizeMode: 'contain',
    marginRight: SIZE.MS(7),
  },
  airSupportSelectText: {
    flex: 1,
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  airSupportPlaceholder: {
    color: '#949AA6',
  },
  airSupportDownIcon: {
    width: SIZE.MS(12),
    height: SIZE.MS(12),
    resizeMode: 'contain',
    tintColor: '#5B6170',
  },
  airSupportSubmit: {
    width: SIZE.MS(82),
    height: SIZE.MS(38),
    borderRadius: SIZE.MS(6),
    backgroundColor: '#7754F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  airSupportSubmitDisabled: {
    backgroundColor: '#B9A9F8',
  },
  airSupportSubmitText: {
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.WHITE,
  },
  airSupportDropdown: {
    marginTop: SIZE.MS(6),
    borderWidth: 1,
    borderColor: '#E0E4EA',
    borderRadius: SIZE.MS(6),
    overflow: 'hidden',
    backgroundColor: COLORS.WHITE,
  },
  airSupportOption: {
    minHeight: SIZE.MS(38),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(10),
    borderBottomWidth: 1,
    borderBottomColor: '#EFF1F4',
  },
  airSupportOptionIcon: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    resizeMode: 'contain',
    marginRight: SIZE.MS(8),
  },
  airSupportOptionText: {
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SIZE.MS(18),
  },
  timelineWrap: {
    minHeight: SIZE.MS(500),
    position: 'relative',
    paddingLeft: SIZE.MS(28),
  },
  timelineLine: {
    position: 'absolute',
    left: SIZE.MS(15),
    top: 0,
    bottom: 0,
    width: 1,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#AEB9C5',
  },
  cardsColumn: {
    flex: 1,
  },
  masterCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: SIZE.MS(8),
    paddingHorizontal: SIZE.MS(10),
    minHeight: SIZE.MVS(128),
    paddingVertical: SIZE.MS(11),
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterName: {
    flex: 1,
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.BOLD,
    color: '#7754F7',
    marginRight: SIZE.MS(8),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#393D45',
    marginRight: SIZE.MS(4),
  },
  statusBadge: {
    borderRadius: SIZE.MS(5),
    paddingHorizontal: SIZE.MS(5),
    paddingVertical: SIZE.MS(2),
  },
  activeBadge: {
    backgroundColor: '#2ED236',
  },
  inactiveBadge: {
    backgroundColor: '#8E8E8E',
  },
  statusBadgeText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.BOLD,
    color: COLORS.WHITE,
  },
  masterIdText: {
    marginTop: SIZE.MS(4),
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#393D45',
  },
  addressText: {
    marginTop: SIZE.MS(4),
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#393D45',
    lineHeight: SIZE.MS(16),
  },
  latLngText: {
    marginTop: SIZE.MS(2),
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#393D45',
    lineHeight: SIZE.MS(14),
  },
  addressLabel: {
    fontFamily: FONTS.BOLD,
  },
  cardFooterRow: {
    marginTop: SIZE.MS(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceText: {
    flex: 1,
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#393D45',
  },
  distanceValue: {
    color: '#00A3FF',
    fontFamily: FONTS.SEMI_BOLD,
  },
  viewMasterImagesButton: {
    height: SIZE.MS(24),
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZE.MS(5),
  },
  viewMasterImagesText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#393D45',
    textDecorationLine: 'underline',
  },
  viewMasterImagesIcon: {
    width: SIZE.MS(14),
    height: SIZE.MS(14),
    marginLeft: SIZE.MS(4),
    resizeMode: 'contain',
    tintColor: '#49B9F7',
  },
  googleButton: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    resizeMode: 'contain',
  },
  freeAirBadge: {
    alignSelf: 'stretch',
    marginBottom: SIZE.MS(7),
    borderRadius: SIZE.MS(6),
    borderWidth: 1,
    borderColor: '#7040DF',
    backgroundColor: '#EEE7FF',
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MS(5),
  },
  freeAirBadgeText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.BOLD,
    color: '#6036C4',
    textAlign: 'center',
  },
  supportDetailFooter: {
    marginTop: SIZE.MS(7),
    paddingTop: SIZE.MS(7),
    borderTopWidth: 1,
    borderTopColor: '#EEEAFD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  supportDetailHint: {
    flex: 1,
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#7754F7',
  },
  supportCountBadge: {
    borderRadius: SIZE.MS(10),
    backgroundColor: '#EEE9FF',
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MS(3),
  },
  supportCountText: {
    fontSize: SIZE.MS(8),
    fontFamily: FONTS.BOLD,
    color: '#6036C4',
  },
  routeAlertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(12, 12, 18, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(22),
  },
  routeAlertCard: {
    width: '100%',
    maxWidth: SIZE.MS(360),
    borderRadius: SIZE.MS(12),
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SIZE.MS(18),
    paddingTop: SIZE.MS(20),
    paddingBottom: SIZE.MS(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEAFB',
  },
  routeAlertIconBox: {
    width: SIZE.MS(58),
    height: SIZE.MS(58),
    borderRadius: SIZE.MS(29),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZE.MS(12),
  },
  routeAlertIcon: {
    width: SIZE.MS(26),
    height: SIZE.MS(26),
  },
  routeAlertTitle: {
    fontSize: SIZE.MS(17),
    lineHeight: SIZE.MS(22),
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    textAlign: 'center',
  },
  routeAlertMessageScroll: {
    maxHeight: SIZE.MS(180),
    alignSelf: 'stretch',
    marginTop: SIZE.MS(8),
  },
  routeAlertMessageContent: {
    paddingHorizontal: SIZE.MS(2),
  },
  routeAlertMessage: {
    fontSize: SIZE.MS(13),
    lineHeight: SIZE.MS(19),
    color: '#5A5A66',
    fontFamily: FONTS.MEDIUM,
    textAlign: 'center',
  },
  routeAlertButtonRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: SIZE.MS(10),
    marginTop: SIZE.MS(18),
  },
  routeAlertButtonRowSingle: {
    justifyContent: 'center',
  },
  routeAlertButton: {
    flex: 1,
    minHeight: SIZE.MS(42),
    borderRadius: SIZE.MS(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.colorMediumslateblue,
    paddingHorizontal: SIZE.MS(12),
  },
  routeAlertButtonSingle: {
    flex: 0,
    width: SIZE.MS(160),
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
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.BOLD,
    fontWeight: FONTS.FONT_WEIGHT.BOLD,
    textAlign: 'center',
  },
  routeAlertButtonTextSecondary: {
    color: COLORS.colorDarkslategray,
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
  betweenDistanceRow: {
    height: SIZE.MS(28),
    justifyContent: 'center',
    alignItems: 'center',
  },
  betweenDistancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  betweenDistanceText: {
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  distanceArrow: {
    width: SIZE.MS(7),
    height: SIZE.MS(15),
    resizeMode: 'contain',
    marginHorizontal: SIZE.MS(4),
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -SIZE.MS(24),
  },
  locationAwayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZE.MS(72),
    marginLeft: -SIZE.MS(26),
  },
  currentMarkerWrap: {
    width: SIZE.MS(30),
    height: SIZE.MS(30),
    borderRadius: SIZE.MS(15),
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SIZE.MS(6),
    zIndex: 2,
    elevation: 2,
  },
  currentMarker: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    resizeMode: 'contain',
  },
  locationPointer: {
    width: SIZE.MS(9),
    height: SIZE.MS(10),
    resizeMode: 'contain',
    marginRight: SIZE.MS(4),
  },
  locationAwayText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  currentLocationCard: {
    flex: 1,
    minHeight: SIZE.MS(38),
    borderRadius: SIZE.MS(6),
    backgroundColor: '#DCEAFF',
    borderWidth: 1,
    borderColor: '#9BBEFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SIZE.MS(8),
    paddingRight: SIZE.MS(4),
  },
  currentLocationTextWrap: {
    flex: 1,
    paddingVertical: SIZE.MS(4),
  },
  currentLocationText: {
    fontSize: SIZE.MS(9),
    lineHeight: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: '#263241',
  },
  currentLocationLabel: {
    fontFamily: FONTS.BOLD,
  },
  nearestMasterText: {
    marginTop: SIZE.MS(2),
    fontSize: SIZE.MS(9),
    lineHeight: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#7754F7',
  },
  addCurrentButton: {
    minWidth: SIZE.MS(40),
    height: SIZE.MS(28),
    borderRadius: SIZE.MS(5),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7754F7',
    marginLeft: SIZE.MS(6),
  },
  addCurrentButtonText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.WHITE,
  },
  addCurrentButtonDisabled: {
    backgroundColor: '#8F98A6',
  },
  stateBox: {
    minHeight: SIZE.MS(180),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(20),
  },
  stateTitle: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.BOLD,
    color: '#393D45',
  },
  stateText: {
    marginTop: SIZE.MS(8),
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: '#606771',
    textAlign: 'center',
  },
  mapPanel: {
    flex: 1,
    borderRadius: SIZE.MS(8),
    overflow: 'hidden',
    backgroundColor: COLORS.WHITE,
    marginBottom: SIZE.MS(10),
  },
  map: {
    flex: 1,
  },
  mapTypeControl: {
    position: 'absolute',
    right: SIZE.MS(12),
    bottom: SIZE.MS(12),
    flexDirection: 'row',
    padding: SIZE.MS(3),
    borderRadius: SIZE.MS(7),
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  mapTypeOption: {
    minHeight: SIZE.MS(30),
    paddingHorizontal: SIZE.MS(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZE.MS(5),
  },
  mapTypeOptionSelected: {
    backgroundColor: '#7754F7',
  },
  mapTypeOptionText: {
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#515762',
  },
  mapTypeOptionTextSelected: {
    color: COLORS.WHITE,
  },
  hubMapContainer: {
    height: Math.min(SIZE.MVS(185), SIZE.SCREEN_HEIGHT * 0.23),
    marginHorizontal: -SIZE.MS(14),
    marginTop: -SIZE.MS(10),
    marginBottom: SIZE.MS(10),
    overflow: 'hidden',
    backgroundColor: '#DCE7EA',
  },
  hubMapMasterIcon: {
    width: SIZE.MS(25),
    height: SIZE.MS(25),
    resizeMode: 'contain',
  },
  hubMapLoading: {
    position: 'absolute',
    top: SIZE.MS(8),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(6),
    borderRadius: SIZE.MS(16),
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: SIZE.MS(10),
    paddingVertical: SIZE.MS(6),
    elevation: 3,
  },
  hubMapLoadingText: {
    color: '#515762',
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(9),
  },
  mapUserMarker: {
    width: SIZE.MS(38),
    height: SIZE.MS(38),
    resizeMode: 'contain',
  },
  mapMasterIcon: {
    width: SIZE.MS(28),
    height: SIZE.MS(28),
    resizeMode: 'contain',
  },
  mapCalloutWrap: {
    alignItems: 'center',
    width: SIZE.MS(170),
  },
  mapCalloutCard: {
    width: SIZE.MS(170),
    borderRadius: SIZE.MS(4),
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: SIZE.MS(7),
    paddingVertical: SIZE.MS(6),
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
  },
  mapCalloutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapCalloutName: {
    flex: 1,
    fontSize: SIZE.MS(10),
    lineHeight: SIZE.MS(13),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#7754F7',
  },
  mapCalloutClose: {
    width: SIZE.MS(14),
    textAlign: 'right',
    fontSize: SIZE.MS(12),
    lineHeight: SIZE.MS(14),
    fontFamily: FONTS.BOLD,
    color: '#777D89',
  },
  mapCalloutIdText: {
    marginTop: SIZE.MS(1),
    fontSize: SIZE.MS(9),
    lineHeight: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  mapCalloutStatusRow: {
    marginTop: SIZE.MS(2),
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapCalloutLabel: {
    fontFamily: FONTS.BOLD,
    color: '#393D45',
  },
  mapCalloutStatusBadge: {
    borderRadius: SIZE.MS(4),
    paddingHorizontal: SIZE.MS(4),
    paddingVertical: SIZE.MS(1),
  },
  mapCalloutStatusText: {
    fontSize: SIZE.MS(7),
    lineHeight: SIZE.MS(9),
    fontFamily: FONTS.BOLD,
    color: COLORS.WHITE,
  },
  mapCalloutBodyText: {
    marginTop: SIZE.MS(2),
    fontSize: SIZE.MS(8),
    lineHeight: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  mapCalloutFooter: {
    marginTop: SIZE.MS(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapCalloutDistanceText: {
    flex: 1,
    fontSize: SIZE.MS(8),
    lineHeight: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  mapCalloutGoogleButton: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCalloutGoogleIcon: {
    width: SIZE.MS(19),
    height: SIZE.MS(19),
    resizeMode: 'contain',
  },
  mapCalloutArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: SIZE.MS(7),
    borderRightWidth: SIZE.MS(7),
    borderTopWidth: SIZE.MS(8),
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.WHITE,
  },
  mapLoading: {
    position: 'absolute',
    left: SIZE.MS(12),
    right: SIZE.MS(12),
    top: SIZE.MS(12),
    minHeight: SIZE.MS(44),
    borderRadius: SIZE.MS(8),
    backgroundColor: COLORS.WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingText: {
    marginLeft: SIZE.MS(8),
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  footer: {
    paddingTop: SIZE.MS(8),
    backgroundColor: '#EDF1F6',
  },
  whereButton: {
    height: SIZE.MS(42),
    borderRadius: SIZE.MS(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  whereButtonText: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.WHITE,
  },
});
