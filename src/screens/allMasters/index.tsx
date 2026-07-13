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
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {
  Callout,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useDispatch} from 'react-redux';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {StoreDispatch} from '@reducers';
import {GetNearestPoleTreeDDAPI} from '@slices/route.slice';
import {DataType} from '@types';
import {Location} from '@utils';
import {URLs} from '@apis';
import PointerSvg from '../../res/images/pointer.svg';
import PolygonSvg from '../../res/images/Polygon.svg';
import VectorSvg from '../../res/images/Vector.svg';
import type {RootStackParamList} from '@navigation/navigator';

type AllMastersProps = NativeStackScreenProps<
  RootStackParamList,
  'All-Masters'
>;

type TabKey = 'list' | 'map';

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

const DEFAULT_DELHI_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

const DEFAULT_SEARCH_RANGE = 200;
const MIN_SEARCH_RANGE = 100;
const MAX_SEARCH_RANGE = 1000;
const SEARCH_RANGE_STEP = 100;
const LOCATION_MATCH_THRESHOLD_METERS = 5;
const ATTACHED_MASTER_MATCH_THRESHOLD_METERS = 8;

const MASTER_TYPES: MasterType[] = [
  {label: 'Pole', value: 'pole', icon: IMAGES.PoleImage},
  {label: 'Tree', value: 'tree', icon: IMAGES.treeIcon},
  {label: 'Building', value: 'building', icon: IMAGES.Building},
  {label: 'POP', value: 'pop', icon: IMAGES.FiberEnclosur},
  {label: 'Splitter', value: 'splitter', icon: IMAGES.enclosureIcon},
  {label: 'Tiffin', value: 'tiffin', icon: IMAGES.TiffinIcon},
  {label: 'Enclosure', value: 'enclosure', icon: IMAGES.jointEnclosure},
];

const AIR_PLACED_MASTER_TYPES = new Set(['pop', 'tiffin', 'enclosure']);
const SUPPORT_DETAIL_MASTER_TYPES = new Set(['tiffin', 'enclosure']);
const CLICKABLE_AIR_SUPPORT_TYPES = new Set(['pole', 'tree']);
const AIR_SUPPORT_TYPES = MASTER_TYPES.filter(type =>
  ['pole', 'tree', 'building'].includes(type.value),
);

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
      const coordinate = getMasterCoordinate(master);
      const distance = getDistanceMeters(supportCoordinate, coordinate);

      return (
        Number.isFinite(distance) &&
        (distance as number) <= ATTACHED_MASTER_MATCH_THRESHOLD_METERS
      );
    });
    const uniqueMatchingMasters = matchingMasters.filter(
      (master, index, list) =>
        list.findIndex(
          item => getMasterUniqueKey(item) === getMasterUniqueKey(master),
        ) === index,
    );

    return {
      ...support,
      __airMasterCount: uniqueMatchingMasters.length,
      __attachedAirMasters: uniqueMatchingMasters,
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
  const didInitialLoadRef = useRef(false);
  const lastAddedMasterKeyRef = useRef<string | null>(null);
  const lastUpdatedSupportVersionRef = useRef<string | null>(null);
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
  const isAirPlacementFlow = AIR_PLACED_MASTER_TYPES.has(
    initialSelectedMasterType,
  );

  const [activeTab, setActiveTab] = useState<TabKey>('list');
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
  const [selectedAirSupportType, setSelectedAirSupportType] = useState('');
  const [showAirSupportDropdown, setShowAirSupportDropdown] = useState(false);
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
      setSelectedAirSupportType('');
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
    setMasters(previous =>
      previous.map(master =>
        getMasterUniqueKey(master) === supportKey
          ? {
              ...master,
              __airMasterCount: Math.max(0, Math.floor(count)),
              __attachedAirMasters: addedMaster
                ? [
                    ...(Array.isArray(master?.__attachedAirMasters)
                      ? master.__attachedAirMasters
                      : []),
                    addedMaster,
                  ]
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
            Alert.alert('Location', 'Unable to fetch your current location.');
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
          Alert.alert(
            'Location',
            error?.message || 'Unable to fetch your current location.',
          );
        }
        return null;
      } finally {
        setIsLocating(false);
      }
    },
    [],
  );

  const loadMasters = useCallback(
    async ({
      refreshing = false,
      masterTypes = selectedMasterTypes,
      position = currentPosition,
      refreshLocation = false,
      range = searchRange,
    }: {
      refreshing?: boolean;
      masterTypes?: string[];
      position?: Coordinate | null;
      refreshLocation?: boolean;
      range?: number;
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
        }

        setMasters(nextMasters);
      } catch (error: any) {
        Alert.alert(
          'All Masters',
          error?.message || 'Unable to load nearest masters.',
        );
        setMasters([]);
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
    ],
  );

  const filteredMasters = masters;

  const mapRegion = useMemo(
    () => getMapRegion(currentPosition, filteredMasters),
    [currentPosition, filteredMasters],
  );

  const routeCoordinates = useMemo(
    () =>
      [
        currentPosition,
        ...filteredMasters.map(getMasterCoordinate).filter(isValidCoordinate),
      ].filter(isValidCoordinate),
    [currentPosition, filteredMasters],
  );

  const currentLocationPlacement = useMemo(
    () => getCurrentLocationPlacement(currentPosition, filteredMasters),
    [currentPosition, filteredMasters],
  );

  const currentLocationAddress =
    currentAddress || getCoordinateAddressText(currentPosition);

  const screenTitle = route.params?.selectedMasterLabel
    ? `Add ${route.params.selectedMasterLabel}`
    : 'All Masters';

  useEffect(() => {
    if (didInitialLoadRef.current) {
      return;
    }

    didInitialLoadRef.current = true;

    if (!isAirPlacementFlow && initialMasters.length === 0) {
      loadMasters();
    }
  }, [initialMasters.length, isAirPlacementFlow, loadMasters]);

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
  };

  const handleAddCurrentLocation = () => {
    if (!currentPosition) {
      Alert.alert('Location', 'Unable to find your current location.');
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
      Alert.alert(
        'Where to Add',
        `Please select where you want to add ${
          route.params?.selectedMasterLabel || 'this master'
        }.`,
      );
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
      Alert.alert('Google Maps', 'Location is not available for this master.');
      return;
    }

    const url = `https://maps.google.com/?q=${coordinate.latitude},${coordinate.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Google Maps', 'Unable to open map.');
    });
  };

  const openMasterImages = (master: MasterItem) => {
    const images = getMasterImages(master);
    if (images.length === 0) {
      Alert.alert('View Images', 'No images are available for this master.');
      return;
    }

    setPreviewImages(images);
    setPreviewImageIndex(0);
  };

  const canOpenSupportDetails = (master: MasterItem) =>
    isAirPlacementFlow &&
    SUPPORT_DETAIL_MASTER_TYPES.has(initialSelectedMasterType) &&
    CLICKABLE_AIR_SUPPORT_TYPES.has(master.__masterType);

  const openSupportDetails = (master: MasterItem) => {
    if (!canOpenSupportDetails(master)) {
      return;
    }

    navigation.navigate('Add-Air-Master-On-Support', {
      selectedMasterType: initialSelectedMasterType as 'tiffin' | 'enclosure',
      selectedMasterLabel:
        asCleanText(route.params?.selectedMasterLabel) ||
        (initialSelectedMasterType === 'tiffin' ? 'Tiffin' : 'Enclosure'),
      supportMaster: master,
      supportKey: getMasterUniqueKey(master),
      currentPosition: currentPosition ?? undefined,
      currentAddress: currentLocationAddress,
      localAttachedMasters: Array.isArray(master?.__attachedAirMasters)
        ? master.__attachedAirMasters
        : [],
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
      onPress={() =>
        loadMasters({
          range: searchRange,
          masterTypes: isAirPlacementFlow
            ? [selectedAirSupportType]
            : selectedMasterTypes,
        })
      }
      disabled={
        isLoading ||
        (isAirPlacementFlow &&
          (!selectedAirSupportType || !hasLoadedAirSupports))
      }
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
    const selectedSupport = AIR_SUPPORT_TYPES.find(
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
            {AIR_SUPPORT_TYPES.map(type => (
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
      <View key="current-location" style={styles.currentLocationRow}>
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
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAddCurrentLocation}
            style={styles.addCurrentButton}>
            <Text style={styles.addCurrentButtonText}>Add</Text>
          </TouchableOpacity>
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

    return (
      <View key={`${master.__masterType}-${masterId || index}`}>
        <TouchableOpacity
          activeOpacity={showSupportDetails ? 0.82 : 1}
          disabled={!showSupportDetails}
          onPress={() => openSupportDetails(master)}
          style={styles.masterCard}>
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
                Choose Pole, Tree, or Building above and tap Submit.
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
                  You can still add{' '}
                  {route.params?.selectedMasterLabel || 'this master'} at your
                  current address using the Add button above.
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
        style={styles.map}
        initialRegion={mapRegion}
        region={mapRegion}>
        {routeCoordinates.length > 1 ? (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#7754F7"
            strokeWidth={4}
            geodesic
          />
        ) : null}

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

      {isLoading ? (
        <View style={styles.mapLoading}>
          <ActivityIndicator color={COLORS.colorMediumslateblue} />
          <Text style={styles.mapLoadingText}>Loading masters...</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen
      preset="fixed"
      isSafeArea={false}
      isNavSafeArea={false}
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
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.topControls}>
            <View style={styles.tabsWrap}>{renderTabs()}</View>
            {activeTab === 'list' ? renderRangeControl() : renderFilterButton()}
          </View>

          {isAirPlacementFlow && activeTab === 'list'
            ? renderAirSupportSelector()
            : null}

          <View style={styles.contentArea}>
            {activeTab === 'list' ? renderListView() : renderMapView()}
          </View>

          <View
            style={[
              styles.footer,
              {paddingBottom: Math.max(insets.bottom, SIZE.MS(10))},
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
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.WHITE,
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
    paddingVertical: SIZE.MS(9),
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
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
    color: '#7754F7',
    marginRight: SIZE.MS(8),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.MEDIUM,
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
    fontSize: SIZE.MS(8),
    fontFamily: FONTS.BOLD,
    color: COLORS.WHITE,
  },
  masterIdText: {
    marginTop: SIZE.MS(4),
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
  },
  addressText: {
    marginTop: SIZE.MS(4),
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: '#393D45',
    lineHeight: SIZE.MS(14),
  },
  latLngText: {
    marginTop: SIZE.MS(2),
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
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
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
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
    fontSize: SIZE.MS(8),
    fontFamily: FONTS.MEDIUM,
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
