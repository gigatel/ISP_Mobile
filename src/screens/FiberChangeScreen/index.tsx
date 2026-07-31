import React, {FC, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
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
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {useDispatch} from 'react-redux';
import {BackHeader} from '@molecules';
import type {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {StoreDispatch} from '@reducers';
import {COLORS, IMAGES, SIZE} from '@res';
import {GetRouteFiberAllDataBySLDIdISPAPI} from '@slices/route.slice';
import {Location} from '@utils';
import {
  getCompletedAppRoute,
  StoredRouteFiberSelection,
} from '../../services/routeFiberChangeStorage';
import PointerSvg from '../../res/images/pointer.svg';
import GoogleMapsIconSvg from '../../res/images/Google_Maps_icon.svg';
import styles from './styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Fiber-Change'>;

type Coordinate = {latitude: number; longitude: number};

type RouteMaster = {
  key: string;
  raw: any;
  masterId: string;
  masterType: string;
  masterTypeLabel: string;
  name: string;
  address: string;
  latLngText: string;
  coordinate: Coordinate | null;
  orderNo: number;
  distance: number;
  fiberLabel: string;
  placedType: string;
  active: boolean;
  images: string[];
  icon: any;
  loopMeters: string;
};

type RouteFiberSegment = {
  fromOrderNo: number;
  toOrderNo: number;
  fiberLabel: string;
};

const MASTER_META: Record<string, {label: string; icon: any}> = {
  pole: {label: 'Pole', icon: IMAGES.PoleImage},
  tree: {label: 'Tree', icon: IMAGES.treeIcon},
  building: {label: 'Building', icon: IMAGES.Building},
  pop: {label: 'POP', icon: IMAGES.FiberEnclosur},
  splitter: {label: 'Splitter', icon: IMAGES.enclosureIcon},
  tiffin: {label: 'Tiffin', icon: IMAGES.TiffinIcon},
  enclosure: {label: 'Enclosure', icon: IMAGES.jointEnclosure},
  start: {label: 'Start Point', icon: IMAGES.mapPin},
  end: {label: 'End Point', icon: IMAGES.mapPin},
  master: {label: 'Master', icon: IMAGES.module},
};

const asText = (value: unknown) => String(value ?? '').trim();

const readField = (value: any, ...keys: string[]) => {
  const key = keys.find(item => value?.[item] !== undefined);
  return key ? value?.[key] : undefined;
};

const parseCoordinateText = (value: unknown): Coordinate | null => {
  const parts = asText(value)
    .split(',')
    .map(item => Number(item.trim()));
  if (
    parts.length < 2 ||
    !Number.isFinite(parts[0]) ||
    !Number.isFinite(parts[1])
  ) {
    return null;
  }
  return {latitude: parts[0], longitude: parts[1]};
};

const getCoordinate = (value: any): Coordinate | null => {
  const direct = value?.coordinate;
  if (Number.isFinite(direct?.latitude) && Number.isFinite(direct?.longitude)) {
    return direct;
  }
  const textCoordinate = parseCoordinateText(
    readField(value, 'latLng', 'LatLng', 'latlng', 'endLatLng', 'startLatLng'),
  );
  if (textCoordinate) {
    return textCoordinate;
  }
  const latitude = Number(readField(value, 'latitude', 'Latitude', 'lat'));
  const longitude = Number(
    readField(value, 'longitude', 'Longitude', 'lng', 'long'),
  );
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? {latitude, longitude}
    : null;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceBetween = (first: Coordinate, second: Coordinate) => {
  const radius = 6371000;
  const dLat = toRadians(second.latitude - first.latitude);
  const dLng = toRadians(second.longitude - first.longitude);
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const safeValue = Math.min(1, Math.max(0, value));
  return (
    radius * 2 * Math.atan2(Math.sqrt(safeValue), Math.sqrt(1 - safeValue))
  );
};

const requestCurrentPosition = (
  enableHighAccuracy: boolean,
  timeout: number,
  maximumAge: number,
) =>
  new Promise<Coordinate>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      value =>
        resolve({
          latitude: value.coords.latitude,
          longitude: value.coords.longitude,
        }),
      reject,
      {enableHighAccuracy, timeout, maximumAge},
    );
  });

const getMasterArrays = (route: any): any[] => {
  const sources = [route, route?.data, route?.routeDetails].filter(Boolean);
  const candidates = sources.flatMap(source => [
    source?.routeChamberMappingVM,
    source?.RouteChamberMappingVM,
    source?.routeChamberMappingVMs,
    source?.routeChamberMappings,
    source?.routeMasterMappingVM,
    source?.routeMasterMappingVMs,
    source?.routeMasterDetails,
    source?.routeMasters,
    source?.masterDetails,
    source?.masters,
    source?.masterList,
    source?.routePoints,
    source?.points,
  ]);

  return (
    candidates
      .filter((candidate): candidate is any[] => Array.isArray(candidate))
      .sort((first, second) => second.length - first.length)[0] ?? []
  );
};

const parseMasterDetails = (value: unknown): any[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getMastersFromRouteFiberData = (fiberData: any[]) =>
  fiberData.flatMap(fiber =>
    parseMasterDetails(fiber?.masterDetails ?? fiber?.MasterDetails).map(
      master => ({
        ...master,
        fiberId:
          master?.fiberId ??
          master?.FiberId ??
          master?.fiberTypeId ??
          master?.FiberTypeId ??
          fiber?.fiberId ??
          fiber?.FiberId,
        fiberTypeName:
          master?.fiberTypeName ?? fiber?.fiberName ?? fiber?.FiberName,
        loopMeters:
          master?.loopMeters ??
          master?.LoopMeters ??
          master?.Loop ??
          master?.loop ??
          master?.LoopUsed ??
          fiber?.loopMeters ??
          fiber?.LoopMeters ??
          fiber?.LoopUsed,
      }),
    ),
  );

const getFibersFromRouteFiberData = (
  fiberData: any[],
): StoredRouteFiberSelection[] =>
  fiberData.map((fiber, index) => {
    const totalDrumLength = Number(
      fiber?.totalDrumLength ?? fiber?.TotalDrumLength,
    );
    const remainingDrumLength = Number(
      fiber?.remainingDrumLength ?? fiber?.RemainingDrumLength,
    );
    const safeTotalDrumLength = Number.isFinite(totalDrumLength)
      ? totalDrumLength
      : 0;
    const safeRemainingDrumLength = Number.isFinite(remainingDrumLength)
      ? remainingDrumLength
      : 0;
    const sldId = Number(fiber?.sldId ?? fiber?.SLDId);
    const fiberId = asText(fiber?.fiberId ?? fiber?.FiberId);
    const fiberCode = asText(fiber?.fiberCode ?? fiber?.FiberCode);
    const masterDetails = parseMasterDetails(
      fiber?.masterDetails ?? fiber?.MasterDetails,
    ).sort(
      (first, second) =>
        Number(first?.orderNo ?? first?.OrderNo) -
        Number(second?.orderNo ?? second?.OrderNo),
    );
    const firstMaster = masterDetails[0];
    const lastMaster = masterDetails[masterDetails.length - 1];
    const fromOrderNo = Number(
      fiber?.fromOrderNo ??
        fiber?.FromOrderNo ??
        firstMaster?.orderNo ??
        firstMaster?.OrderNo,
    );
    const toOrderNo = Number(
      fiber?.toOrderNo ??
        fiber?.ToOrderNo ??
        lastMaster?.orderNo ??
        lastMaster?.OrderNo,
    );
    const segmentDistance = Math.round(
      masterDetails.slice(1).reduce((total, master, masterIndex) => {
        const fromCoordinate = parseCoordinateText(
          masterDetails[masterIndex]?.latLng ??
            masterDetails[masterIndex]?.LatLng,
        );
        const toCoordinate = parseCoordinateText(
          master?.latLng ?? master?.LatLng,
        );
        return fromCoordinate && toCoordinate
          ? total + distanceBetween(fromCoordinate, toCoordinate)
          : total;
      }, 0),
    );
    const fromAddress = asText(
      fiber?.fromAddress ??
        fiber?.FromAddress ??
        firstMaster?.selectedAddress ??
        firstMaster?.SelectedAddress ??
        firstMaster?.address ??
        firstMaster?.Address,
    );
    const toAddress = asText(
      fiber?.toAddress ??
        fiber?.ToAddress ??
        lastMaster?.selectedAddress ??
        lastMaster?.SelectedAddress ??
        lastMaster?.address ??
        lastMaster?.Address,
    );

    return {
      id: `server-sld-${sldId || index}-${fiberId || fiberCode || index}-${
        fromOrderNo || 'start'
      }-${toOrderNo || 'end'}`,
      fiberId,
      fiberLabel:
        asText(fiber?.fiberName ?? fiber?.FiberName) || 'Fiber unavailable',
      armourLabel: '',
      tubeCount: '',
      coreCount: '',
      drumId: '',
      drumLabel: '',
      drumLength: safeTotalDrumLength,
      lengthToUse: Math.max(0, safeTotalDrumLength - safeRemainingDrumLength),
      sldId: Number.isFinite(sldId) ? sldId : undefined,
      sldCode: asText(fiber?.sldCode ?? fiber?.SLDCode),
      fiberCode,
      totalDrumLength: safeTotalDrumLength,
      remainingDrumLength: safeRemainingDrumLength,
      masterCount: Number(fiber?.masterCount ?? fiber?.MasterCount) || 0,
      totalDistance: segmentDistance,
      changeScope:
        asText(fiber?.changeScope ?? fiber?.ChangeScope).toLowerCase() ===
          'partial' || fiber?.isPartialChange === true
          ? 'Partial'
          : 'Full',
      fromOrderNo: Number.isFinite(fromOrderNo) ? fromOrderNo : undefined,
      toOrderNo: Number.isFinite(toOrderNo) ? toOrderNo : undefined,
      fromMasterName: asText(
        fiber?.fromMasterName ??
          fiber?.FromMasterName ??
          firstMaster?.name ??
          firstMaster?.Name,
      ),
      toMasterName: asText(
        fiber?.toMasterName ??
          fiber?.ToMasterName ??
          lastMaster?.name ??
          lastMaster?.Name,
      ),
      fromAddress,
      toAddress,
      addedAt: 0,
    };
  });

const getFiberSegmentsFromRouteFiberData = (
  fiberData: any[],
): RouteFiberSegment[] =>
  getFibersFromRouteFiberData(fiberData)
    .filter(
      fiber => fiber.fromOrderNo !== undefined && fiber.toOrderNo !== undefined,
    )
    .map(fiber => ({
      fromOrderNo: fiber.fromOrderNo as number,
      toOrderNo: fiber.toOrderNo as number,
      fiberLabel: fiber.fiberLabel,
    }));

const getFiberSegmentsFromSelections = (
  selections: StoredRouteFiberSelection[],
): RouteFiberSegment[] =>
  selections
    .filter(selection => {
      const fromOrderNo = Number(selection.fromOrderNo);
      const toOrderNo = Number(selection.toOrderNo);
      return (
        selection.changeScope === 'Partial' &&
        Number.isFinite(fromOrderNo) &&
        Number.isFinite(toOrderNo) &&
        fromOrderNo < toOrderNo &&
        Boolean(asText(selection.fiberLabel))
      );
    })
    .map(selection => ({
      fromOrderNo: Number(selection.fromOrderNo),
      toOrderNo: Number(selection.toOrderNo),
      fiberLabel: selection.fiberLabel,
    }))
    .reverse();

const getRouteRecordId = (value: any) => {
  const directId = Number(value?.routeId ?? value?.RouteId);
  if (Number.isFinite(directId) && directId > 0) {
    return directId;
  }
  const routeCodeId = asText(value?.routeIdStr ?? value?.RouteIdStr).match(
    /\d+/,
  )?.[0];
  return Number(routeCodeId || value?.id || value?.Id) || 0;
};

const getImages = (value: any): string[] => {
  const source = value?.master ?? value;
  const candidates = [
    value?.__fiberChangePhotoUri,
    value?.imageUrls,
    source?.__fiberChangePhotoUri,
    source?.images,
    source?.Images,
    source?.imageUrl1,
    source?.ImageUrl1,
    source?.image1,
    source?.Image1,
    source?.imageUrl2,
    source?.ImageUrl2,
    source?.image2,
    source?.Image2,
  ].flatMap(item => (Array.isArray(item) ? item : [item]));
  return Array.from(
    new Set(
      candidates
        .map(item =>
          typeof item === 'object'
            ? asText(item?.uri ?? item?.url ?? item?.imageUrl)
            : asText(item),
        )
        .filter(item => /^(https?:|file:|content:|data:image)/i.test(item)),
    ),
  ).slice(0, 2);
};

const normalizeMaster = (
  item: any,
  index: number,
  defaultFiber: string,
): RouteMaster => {
  const source =
    item?.master ?? item?.masterData ?? item?.ispMaster ?? item?.Master ?? item;
  const masterType = asText(
    item?.masterType ??
      item?.MasterType ??
      item?.masterTypeName ??
      item?.MasterTypeName ??
      source?.__masterType ??
      source?.masterType ??
      source?.MasterType ??
      source?.masterTypeName ??
      source?.type,
  ).toLowerCase();
  const meta = MASTER_META[masterType] ?? {
    label:
      asText(item?.masterTypeLabel ?? source?.__masterTypeLabel) || 'Master',
    icon: IMAGES.module,
  };
  const coordinate = getCoordinate(item) ?? getCoordinate(source);
  const orderNoValue = Number(
    item?.orderNo ?? item?.OrderNo ?? source?.orderNo ?? source?.OrderNo,
  );
  const masterId = asText(
    item?.ispMasterId ??
      item?.masterId ??
      item?.MasterId ??
      item?.code ??
      item?.Code ??
      source?.ispMasterId ??
      source?.id ??
      source?.Id ??
      source?.masterId ??
      source?.code ??
      source?.Code,
  );
  const address =
    asText(
      item?.address ??
        item?.Address ??
        item?.selectedAddress ??
        item?.SelectedAddress ??
        source?.address ??
        source?.Address ??
        source?.selectedAddress ??
        source?.SelectedAddress,
    ) || 'Address unavailable';
  const name =
    asText(
      item?.name ??
        item?.masterName ??
        item?.MasterName ??
        source?.name ??
        source?.Name ??
        source?.masterName ??
        source?.MasterName,
    ) || meta.label;
  const latLngText = coordinate
    ? `${coordinate.latitude}, ${coordinate.longitude}`
    : 'Location unavailable';
  const distance = Number(
    item?.distance ??
      item?.Distance ??
      item?.segmentDistance ??
      item?.routeDistance ??
      source?.distance ??
      0,
  );
  const masterKey =
    asText(item?.key) ||
    `${masterType || 'master'}-${
      masterId || `${name}-${coordinate?.latitude}-${coordinate?.longitude}`
    }`;

  return {
    key: masterKey || `${masterType || 'master'}-${index}`,
    raw: {
      ...source,
      masterType,
      masterId,
      name,
      address,
      orderNo: Number.isFinite(orderNoValue) ? orderNoValue : index + 1,
      latLng: coordinate
        ? `${coordinate.latitude}, ${coordinate.longitude}`
        : '',
    },
    masterId,
    masterType,
    masterTypeLabel: meta.label,
    name,
    address,
    latLngText,
    coordinate,
    orderNo: Number.isFinite(orderNoValue) ? orderNoValue : index + 1,
    distance: Number.isFinite(distance) ? distance : 0,
    fiberLabel:
      asText(
        item?.fiberTypeName ?? item?.fiberIdStr ?? source?.fiberTypeName,
      ) || defaultFiber,
    placedType: asText(
      item?.placedType ?? item?.PlacedType ?? source?.placedType,
    ),
    active: readField(source, 'isActive', 'IsActive', 'status') !== false,
    images: getImages(item),
    icon: item?.icon ?? meta.icon,
    loopMeters: asText(
      item?.loopMeters ??
        item?.LoopMeters ??
        item?.Loop ??
        item?.loop ??
        item?.LoopUsed ??
        source?.loopMeters ??
        source?.LoopMeters ??
        source?.Loop ??
        source?.loop ??
        source?.LoopUsed,
    ).replace(/\s*m$/i, ''),
  };
};

const getMasterOrder = (value: any, fallbackIndex: number) => {
  const order = Number(
    value?.orderNo ??
      value?.OrderNo ??
      value?.sequenceNo ??
      value?.SequenceNo ??
      value?.sortOrder,
  );
  return Number.isFinite(order) ? order : fallbackIndex;
};

const normalizeMasters = (source: any[], defaultFiber: string) => {
  const normalized = source
    .map((item, index) => ({item, index, order: getMasterOrder(item, index)}))
    .sort((first, second) =>
      first.order === second.order
        ? first.index - second.index
        : first.order - second.order,
    )
    .map(({item}, index) => normalizeMaster(item, index, defaultFiber))
    .filter(
      (master, index, values) =>
        values.findIndex(candidate => {
          if (master.masterId && candidate.masterId) {
            return (
              candidate.masterId === master.masterId &&
              candidate.masterType === master.masterType
            );
          }
          return candidate.key === master.key;
        }) === index,
    );

  return normalized.map((master, index) => {
    if (index === 0 || master.distance > 0) {
      return master;
    }
    const previousMaster = normalized[index - 1];
    if (!previousMaster.coordinate || !master.coordinate) {
      return master;
    }
    return {
      ...master,
      distance: distanceBetween(previousMaster.coordinate, master.coordinate),
    };
  });
};

const getSegmentDistance = (
  currentMaster: RouteMaster,
  nextMaster: RouteMaster,
) => {
  if (nextMaster.distance > 0) {
    return nextMaster.distance;
  }
  if (currentMaster.coordinate && nextMaster.coordinate) {
    return distanceBetween(currentMaster.coordinate, nextMaster.coordinate);
  }
  return 0;
};

const buildFallbackMasters = (route: any, defaultFiber: string) => {
  const start = parseCoordinateText(route?.startLatLng);
  const end = parseCoordinateText(route?.endLatLng);
  const startAddress = asText(route?.startAddress);
  const endAddress = asText(route?.endAddress);
  const startName =
    asText(
      route?.startMasterName ?? route?.StartMasterName ?? route?.fromMasterName,
    ) ||
    startAddress.split(',')[0]?.trim() ||
    'Route Start';
  const endName =
    asText(
      route?.endMasterName ?? route?.EndMasterName ?? route?.toMasterName,
    ) ||
    endAddress.split(',')[0]?.trim() ||
    'Route End';
  const values = [
    start
      ? {
          key: 'route-start',
          masterType: asText(
            route?.startMasterType ??
              route?.StartMasterType ??
              route?.fromMasterType ??
              'master',
          ),
          masterId:
            route?.startMasterId ?? route?.StartMasterId ?? route?.fromMasterId,
          name: startName,
          address: startAddress,
          latLng: route?.startLatLng,
          distance: 0,
        }
      : null,
    end
      ? {
          key: 'route-end',
          masterType: asText(
            route?.endMasterType ??
              route?.EndMasterType ??
              route?.toMasterType ??
              'master',
          ),
          masterId:
            route?.endMasterId ?? route?.EndMasterId ?? route?.toMasterId,
          name: endName,
          address: endAddress,
          latLng: route?.endLatLng,
          distance: Number(route?.totalDistance) || 0,
        }
      : null,
  ].filter(Boolean);
  return values.map((item, index) =>
    normalizeMaster(item, index, defaultFiber),
  );
};

const getServerFibers = (route: any): StoredRouteFiberSelection[] => {
  const candidates = [
    route?.fiberDetails,
    route?.routeFiberDetails,
    route?.fibers,
    route?.fiberTypes,
  ];
  const list = candidates.find(Array.isArray) ?? [];
  const normalized = list.map((item: any, index: number) => ({
    id: `server-fiber-${index}-${asText(item?.id ?? item?.fiberTypeId)}`,
    fiberId: asText(item?.fiberTypeId ?? item?.id),
    fiberLabel:
      asText(item?.fiberLabel ?? item?.fiberIdStr ?? item?.fiberTypeName) ||
      'Fiber',
    armourLabel: asText(item?.armourLabel ?? item?.fiberSpecificationName),
    tubeCount: asText(item?.tubeCount ?? item?.noOfTubes),
    coreCount: asText(item?.coreCount ?? item?.noOfCores),
    drumId: asText(item?.drumId),
    drumLabel: asText(item?.drumNo),
    drumLength: Number(item?.drumLength) || 0,
    lengthToUse: Number(item?.lengthToUse) || 0,
    totalDistance: Number(item?.totalDistance ?? item?.routeLength) || 0,
    addedAt: 0,
  }));
  if (normalized.length > 0) {
    return normalized;
  }
  const scalarFiber = asText(
    route?.fiberIdStr ?? route?.fiberTypeName ?? route?.fiberType,
  );
  return scalarFiber
    ? [
        {
          id: 'server-fiber-current',
          fiberId: asText(route?.fiberTypeId),
          fiberLabel: scalarFiber,
          armourLabel: asText(route?.fiberSpecificationName),
          tubeCount: asText(route?.noOfTubes),
          coreCount: asText(route?.noOfCores),
          drumId: asText(route?.drumId),
          drumLabel: asText(route?.drumNo),
          drumLength: Number(route?.drumLength) || 0,
          lengthToUse: Number(route?.lengthToUse) || 0,
          totalDistance:
            Number(route?.totalDistance ?? route?.routeLength) || 0,
          addedAt: 0,
        },
      ]
    : [];
};

const FiberChangeScreen: FC<Props> = ({navigation, route}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const selectedRoute = route.params.selectedRoute;
  const installationMode = route.params.installationScope;
  const canAddNewMaster = installationMode === 'withoutSld';
  const selectedFibers = useMemo(
    () => route.params.selectedFibers ?? [],
    [route.params.selectedFibers],
  );
  const scrollRef = useRef<ScrollView>(null);
  const timelineYRef = useRef(0);
  const masterYRef = useRef<Record<string, number>>({});
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(
    route.params.currentPosition ??
      route.params.installationProgress?.currentPosition ??
      null,
  );
  const [currentAddress, setCurrentAddress] = useState(
    route.params.currentAddress ??
      route.params.installationProgress?.currentAddress ??
      '',
  );
  const [isLocating, setIsLocating] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [serverRouteFiberData, setServerRouteFiberData] = useState<any[]>([]);
  const [isLoadingMasters, setIsLoadingMasters] = useState(true);
  const [masterLoadError, setMasterLoadError] = useState('');

  useEffect(() => {
    Keyboard.dismiss();
    const unsubscribe = navigation.addListener('focus', Keyboard.dismiss);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    let isActive = true;
    const routeId = getRouteRecordId(selectedRoute);
    const loadRouteFiberData = async () => {
      if (!routeId) {
        setIsLoadingMasters(false);
        setMasterLoadError('Route ID is unavailable.');
        return;
      }
      try {
        setServerRouteFiberData([]);
        setIsLoadingMasters(true);
        setMasterLoadError('');
        const fiberDataResponse = await dispatch(
          GetRouteFiberAllDataBySLDIdISPAPI({routeId}),
        ).unwrap();
        if (isActive) {
          setServerRouteFiberData(
            Array.isArray(fiberDataResponse) ? fiberDataResponse : [],
          );
        }
      } catch (error: any) {
        if (isActive) {
          setMasterLoadError(
            error?.message || 'Unable to load fiber details for this route.',
          );
        }
      } finally {
        if (isActive) {
          setIsLoadingMasters(false);
        }
      }
    };
    loadRouteFiberData();
    return () => {
      isActive = false;
    };
  }, [dispatch, selectedRoute]);

  const completedRoute = useMemo(
    () => getCompletedAppRoute(selectedRoute.routeId, selectedRoute.routeName),
    [selectedRoute.routeId, selectedRoute.routeName],
  );
  const allFibers = useMemo(() => {
    const apiFibers = getFibersFromRouteFiberData(serverRouteFiberData);
    const serverFibers =
      apiFibers.length > 0 ? apiFibers : getServerFibers(selectedRoute);
    const localFibers = apiFibers.length > 0 ? [] : selectedFibers;
    const combined = [...serverFibers, ...localFibers];
    return combined.filter(
      (fiber, index, values) =>
        values.findIndex(item => item.id === fiber.id) === index,
    );
  }, [selectedFibers, selectedRoute, serverRouteFiberData]);
  const latestServerFiber = allFibers[allFibers.length - 1] ?? null;
  const latestFiber =
    selectedFibers[selectedFibers.length - 1] ?? latestServerFiber;
  const defaultFiber =
    latestServerFiber?.fiberLabel ?? allFibers[0]?.fiberLabel ?? '--';
  const masters = useMemo(() => {
    const storedMasters = completedRoute?.routePoints ?? [];
    const selectedRouteMasters = getMasterArrays(selectedRoute);
    const apiMasters = getMastersFromRouteFiberData(serverRouteFiberData);
    const routeMasters =
      apiMasters.length > 0
        ? apiMasters
        : storedMasters.length > 0
        ? storedMasters
        : selectedRouteMasters;
    const source = route.params.addedMaster
      ? [
          ...routeMasters,
          {
            ...route.params.addedMaster,
            key: route.params.addedMasterKey ?? `fiber-added-${Date.now()}`,
          },
        ]
      : routeMasters;
    const normalizedMasters =
      source.length > 0
        ? normalizeMasters(source, defaultFiber)
        : buildFallbackMasters(selectedRoute, defaultFiber);
    const progressPoints = route.params.installationProgress?.routePoints ?? [];

    return normalizedMasters.map(master => {
      const savedPoint = progressPoints.find(point => {
        const savedOrderNo = Number(
          point?.master?.orderNo ?? point?.master?.OrderNo,
        );
        if (Number.isFinite(savedOrderNo) && savedOrderNo === master.orderNo) {
          return true;
        }
        return (
          asText(point?.masterId) === asText(master.masterId) &&
          asText(point?.masterType).toLowerCase() === master.masterType
        );
      });
      const capturedPhotoUri = asText(
        savedPoint?.master?.__fiberChangePhotoUri,
      );
      if (!savedPoint || !capturedPhotoUri) {
        return master;
      }
      return {
        ...master,
        raw: {...master.raw, ...savedPoint.master},
        images: Array.from(new Set([capturedPhotoUri, ...master.images])).slice(
          0,
          2,
        ),
      };
    });
  }, [
    completedRoute?.routePoints,
    defaultFiber,
    route.params.addedMaster,
    route.params.addedMasterKey,
    route.params.installationProgress?.routePoints,
    selectedRoute,
    serverRouteFiberData,
  ]);
  const fiberSegments = useMemo(() => {
    const savedPartialSegments = getFiberSegmentsFromSelections(selectedFibers);
    const serverSegments =
      getFiberSegmentsFromRouteFiberData(serverRouteFiberData);
    return [...savedPartialSegments, ...serverSegments];
  }, [selectedFibers, serverRouteFiberData]);
  const installedFiberSections = useMemo<StoredRouteFiberSelection[]>(() => {
    if (masters.length < 2 || fiberSegments.length === 0) {
      return allFibers;
    }

    const sections: Array<{
      fiberLabel: string;
      startIndex: number;
      endIndex: number;
      totalDistance: number;
    }> = [];

    masters.slice(0, -1).forEach((master, index) => {
      const nextMaster = masters[index + 1];
      const fiberLabel =
        fiberSegments.find(
          segment =>
            master.orderNo >= segment.fromOrderNo &&
            nextMaster.orderNo <= segment.toOrderNo,
        )?.fiberLabel ||
        master.fiberLabel ||
        defaultFiber;
      const segmentDistance = getSegmentDistance(master, nextMaster);
      const previousSection = sections[sections.length - 1];

      if (
        previousSection &&
        previousSection.fiberLabel === fiberLabel &&
        previousSection.endIndex === index
      ) {
        previousSection.endIndex = index + 1;
        previousSection.totalDistance += segmentDistance;
        return;
      }

      sections.push({
        fiberLabel,
        startIndex: index,
        endIndex: index + 1,
        totalDistance: segmentDistance,
      });
    });

    const metadataSources = [...selectedFibers].reverse().concat(allFibers);

    return sections.map((section, index) => {
      const fromMaster = masters[section.startIndex];
      const toMaster = masters[section.endIndex];
      const exactMetadata = metadataSources.find(
        fiber =>
          asText(fiber.fiberLabel) === asText(section.fiberLabel) &&
          Number(fiber.fromOrderNo) === fromMaster.orderNo &&
          Number(fiber.toOrderNo) === toMaster.orderNo,
      );
      const metadata =
        exactMetadata ??
        metadataSources.find(
          fiber => asText(fiber.fiberLabel) === asText(section.fiberLabel),
        );

      return {
        fiberId: '',
        armourLabel: '',
        tubeCount: '',
        coreCount: '',
        drumId: '',
        drumLabel: '',
        drumLength: 0,
        lengthToUse: 0,
        addedAt: 0,
        ...metadata,
        id: `installed-section-${index}-${fromMaster.orderNo}-${toMaster.orderNo}-${section.fiberLabel}`,
        fiberLabel: section.fiberLabel,
        totalDistance: Math.round(section.totalDistance),
        masterCount: section.endIndex - section.startIndex + 1,
        changeScope:
          section.startIndex === 0 && section.endIndex === masters.length - 1
            ? 'Full'
            : 'Partial',
        fromOrderNo: fromMaster.orderNo,
        toOrderNo: toMaster.orderNo,
        fromMasterName: fromMaster.name,
        toMasterName: toMaster.name,
        fromAddress: fromMaster.address,
        toAddress: toMaster.address,
      };
    });
  }, [allFibers, defaultFiber, fiberSegments, masters, selectedFibers]);
  const routeMasterDistance = useMemo(
    () =>
      masters
        .slice(1)
        .reduce(
          (total, master, index) =>
            total + getSegmentDistance(masters[index], master),
          0,
        ),
    [masters],
  );
  const routeFromAddress =
    asText(selectedRoute.startAddress) ||
    masters[0]?.address ||
    'Address unavailable';
  const routeToAddress =
    asText(selectedRoute.endAddress) ||
    masters[masters.length - 1]?.address ||
    'Address unavailable';
  const mapCoordinate = currentPosition ??
    masters.find(master => master.coordinate)?.coordinate ??
    parseCoordinateText(selectedRoute.startLatLng) ?? {
      latitude: 28.6139,
      longitude: 77.209,
    };

  const nearestMasterIndex = useMemo(() => {
    if (!currentPosition) {
      return -1;
    }
    let index = -1;
    let minimum = Number.POSITIVE_INFINITY;
    masters.forEach((master, masterIndex) => {
      if (!master.coordinate) {
        return;
      }
      const distance = distanceBetween(currentPosition, master.coordinate);
      if (distance < minimum) {
        minimum = distance;
        index = masterIndex;
      }
    });
    return index;
  }, [currentPosition, masters]);

  useEffect(() => {
    if (!currentPosition || nearestMasterIndex < 0) {
      return;
    }

    const nearest = masters[nearestMasterIndex];
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(
          0,
          timelineYRef.current +
            (masterYRef.current[nearest.key] ?? 0) -
            SIZE.MVS(110),
        ),
        animated: true,
      });
    }, 180);

    return () => clearTimeout(timer);
  }, [currentPosition, masters, nearestMasterIndex]);

  const requestLocationPermission = async () => {
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
        'Enable location access in Settings to show your current position on this fiber route.',
        [
          {text: 'Not Now', style: 'cancel'},
          {
            text: 'Open Settings',
            onPress: () => openSettings().catch(() => Linking.openSettings()),
          },
        ],
      );
      return false;
    }

    if (status !== RESULTS.GRANTED && status !== RESULTS.LIMITED) {
      Alert.alert(
        'Location Permission Required',
        'Location access is required to show your current position.',
      );
      return false;
    }

    return true;
  };

  const showCurrentLocation = async () => {
    if (isLocating) {
      return;
    }
    try {
      setIsLocating(true);
      if (!(await requestLocationPermission())) {
        return;
      }
      if (Platform.OS === 'android' && !(await Location.checkGps())) {
        throw new Error('Location services are disabled.');
      }
      const position = await new Promise<Coordinate>((resolve, reject) => {
        let failures = 0;
        let resolved = false;
        const onSuccess = (value: Coordinate) => {
          if (!resolved) {
            resolved = true;
            resolve(value);
          }
        };
        const onFailure = (error: unknown) => {
          failures += 1;
          if (failures === 2 && !resolved) {
            reject(error);
          }
        };
        requestCurrentPosition(false, 8000, 60000).then(onSuccess, onFailure);
        requestCurrentPosition(true, 20000, 0).then(onSuccess, onFailure);
      });
      setCurrentPosition(position);
      try {
        const locationDetails = await Location.getAddressWithLatLong(
          position.latitude,
          position.longitude,
        );
        setCurrentAddress(
          asText(locationDetails?.address) ||
            `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`,
        );
      } catch {
        setCurrentAddress(
          `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`,
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Current Location',
        error?.message || 'Unable to get your current location.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  const addMasterAtCurrentLocation = () => {
    if (!canAddNewMaster) {
      return;
    }
    if (!currentPosition) {
      Alert.alert(
        'Current Location',
        'Tap Where I am? before adding a master at your current location.',
      );
      return;
    }
    navigation.navigate('Add-Master-Form', {
      routeMasterSelectionMode: true,
      routeName: asText(selectedRoute.routeName) || 'Fiber Change',
      routeDraft: {
        routeId: getRouteRecordId(selectedRoute),
        fiberChangeMode: installationMode ?? 'partial',
        fiberTypeId: latestFiber?.fiberId,
        fiberTypeLabel: latestFiber?.fiberLabel,
      },
      routeInitialMasters: masters.map(master => master.raw),
      returnToFiberChange: true,
      fiberChangeRoute: selectedRoute,
      fiberChangeSelectedFibers: selectedFibers,
      fiberChangeInstallationProgress: route.params.installationProgress,
      fiberChangeInstallationScope: installationMode ?? 'partial',
      currentPosition,
      currentAddress:
        currentAddress ||
        `${currentPosition.latitude}, ${currentPosition.longitude}`,
    });
  };

  const openMap = (master: RouteMaster) => {
    if (!master.coordinate) {
      Alert.alert('Google Maps', 'Location is unavailable for this master.');
      return;
    }
    Linking.openURL(
      `https://maps.google.com/?q=${master.coordinate.latitude},${master.coordinate.longitude}`,
    ).catch(() => Alert.alert('Google Maps', 'Unable to open Google Maps.'));
  };

  const openRoutePage = (selectedMaster?: RouteMaster) => {
    if (masters.length === 0) {
      return;
    }
    if (Boolean(installationMode) && selectedMaster?.coordinate) {
      const now = Date.now();
      const progress = route.params.installationProgress;
      const savedPartialStartOrderNo = Number(
        progress?.routeDraft?.partialStartOrderNo,
      );
      const routeDraft = {
        ...(progress?.routeDraft ?? {}),
        routeId: getRouteRecordId(selectedRoute),
        fiberChangeMode: installationMode ?? 'partial',
        fiberTypeId: latestFiber?.fiberId,
        fiberTypeLabel: latestFiber?.fiberLabel,
        drumId: latestFiber?.drumId,
        drumNo: latestFiber?.drumLabel,
        drumLength: latestFiber?.drumLength,
        lengthToUse: latestFiber?.lengthToUse,
        ...(installationMode === 'partial'
          ? {
              partialStartOrderNo:
                Number.isFinite(savedPartialStartOrderNo) &&
                savedPartialStartOrderNo > 0
                  ? savedPartialStartOrderNo
                  : selectedMaster.orderNo,
            }
          : {}),
      };
      const existingPointIndex =
        progress?.routePoints.findIndex(point => {
          const pointOrderNo = Number(
            point?.master?.orderNo ?? point?.master?.OrderNo,
          );
          if (
            Number.isFinite(pointOrderNo) &&
            pointOrderNo === selectedMaster.orderNo
          ) {
            return true;
          }
          return (
            asText(point?.masterId) === asText(selectedMaster.masterId) &&
            asText(point?.masterType).toLowerCase() ===
              selectedMaster.masterType
          );
        }) ?? -1;
      const existingPoint =
        existingPointIndex >= 0
          ? progress?.routePoints[existingPointIndex]
          : undefined;
      const routePoint = {
        key: existingPoint?.key ?? `partial-fiber-${selectedMaster.key}-${now}`,
        master: {
          ...(existingPoint?.master ?? {}),
          ...selectedMaster.raw,
          orderNo: selectedMaster.orderNo,
        },
        masterId: selectedMaster.masterId,
        masterType: selectedMaster.masterType,
        masterTypeLabel: selectedMaster.masterTypeLabel,
        name: selectedMaster.name,
        address: selectedMaster.address,
        coordinate: selectedMaster.coordinate,
        loopMeters: existingPoint?.loopMeters ?? selectedMaster.loopMeters,
        isLocked: false,
        isServerSaved: false,
      };
      const nextRoutePoints =
        existingPointIndex >= 0
          ? (progress?.routePoints ?? []).map((point, index) =>
              index === existingPointIndex ? routePoint : point,
            )
          : [...(progress?.routePoints ?? []), routePoint];
      nextRoutePoints.sort(
        (first, second) =>
          Number(first?.master?.orderNo ?? first?.master?.OrderNo ?? 0) -
          Number(second?.master?.orderNo ?? second?.master?.OrderNo ?? 0),
      );
      navigation.navigate('Make-Route', {
        routeName: asText(selectedRoute.routeName) || 'Fiber Change',
        routeDraft,
        currentPosition: selectedMaster.coordinate,
        currentAddress: selectedMaster.address,
        fiberChangeMode: installationMode ?? 'partial',
        fiberChangeRoute: selectedRoute,
        fiberChangeSelectedFibers: selectedFibers,
        fiberChangeActiveMasterKey: routePoint.key,
        resumeSnapshot: {
          id:
            progress?.id ??
            `partial-fiber-${selectedRoute.routeId}-${selectedMaster.key}-${now}`,
          routeName: asText(selectedRoute.routeName) || 'Fiber Change',
          routeDraft,
          currentPosition: selectedMaster.coordinate,
          currentAddress: selectedMaster.address,
          routePoints: nextRoutePoints,
          routePath: progress?.routePath?.length
            ? progress.routePath
            : [selectedMaster.coordinate],
          walkingSegments: progress?.walkingSegments ?? [],
          segmentDistance: 0,
          trackingState: 'idle',
          drumAllocations: progress?.drumAllocations ?? [],
          totalDistance: progress?.totalDistance ?? 0,
          status: 'stopped',
          createdAt: progress?.createdAt ?? now,
          updatedAt: now,
        },
      });
      return;
    }

    const firstCoordinate =
      masters.find(item => item.coordinate)?.coordinate ??
      parseCoordinateText(selectedRoute.startLatLng);
    if (!firstCoordinate) {
      Alert.alert('Route Details', 'Route coordinates are unavailable.');
      return;
    }
    const routePoints = masters.map(master => ({
      key: master.key,
      master: master.raw,
      masterId: master.masterId,
      masterType: master.masterType,
      masterTypeLabel: master.masterTypeLabel,
      name: master.name,
      address: master.address,
      coordinate: master.coordinate,
      loopMeters: master.loopMeters,
      isLocked: true,
    }));
    const routePath = completedRoute?.routePath?.length
      ? completedRoute.routePath
      : masters
          .map(item => item.coordinate)
          .filter((item): item is Coordinate => item !== null);
    const walkingSegments = completedRoute?.walkingSegments?.length
      ? completedRoute.walkingSegments
      : masters.slice(1).map((master, index) => ({
          id: `view-segment-${index}`,
          afterPointKey: master.key,
          distance: master.distance,
        }));
    const now = Date.now();
    navigation.navigate('Make-Route', {
      routeName: asText(selectedRoute.routeName) || 'Route Details',
      routeDraft: {
        fiberTypeId: latestFiber?.fiberId,
        fiberTypeLabel: latestFiber?.fiberLabel,
      },
      currentPosition: firstCoordinate,
      currentAddress:
        completedRoute?.currentAddress ||
        asText(selectedRoute.startAddress) ||
        'Route location',
      selectedMaster: masters[0].raw,
      selectedMasterVersion: `view-${selectedRoute.routeId}-${now}`,
      readOnly: true,
      resumeSnapshot: {
        id: `completed-view-${selectedRoute.routeId}`,
        routeName: asText(selectedRoute.routeName) || 'Route Details',
        routeDraft: {},
        currentPosition: firstCoordinate,
        currentAddress:
          completedRoute?.currentAddress ||
          asText(selectedRoute.startAddress) ||
          'Route location',
        routePoints,
        routePath,
        walkingSegments,
        segmentDistance: 0,
        trackingState: 'idle',
        drumAllocations: [],
        totalDistance:
          completedRoute?.totalDistance ||
          Number(selectedRoute.totalDistance) ||
          0,
        status: 'stopped',
        createdAt: completedRoute?.createdAt ?? now,
        updatedAt: completedRoute?.updatedAt ?? now,
      },
    });
  };

  return (
    <Screen
      preset="fixed"
      keyboardAvoidingEnabled={false}
      statusBgColor={COLORS.PRIMARY}
      navBarColor={COLORS.WHITE}>
      <View style={styles.screen}>
        <BackHeader
          title="Fiber Change"
          showGps={false}
          onBackPress={() => navigation.goBack()}
        />

        <View style={styles.mapContainer}>
          <MapView
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            region={{
              ...mapCoordinate,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            showsCompass
            showsMyLocationButton={false}
            toolbarEnabled={false}>
            {currentPosition ? (
              <Marker coordinate={currentPosition} title="You are here">
                <PointerSvg width={SIZE.MS(34)} height={SIZE.MS(34)} />
              </Marker>
            ) : null}
          </MapView>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.routeHeader}>
            <Text numberOfLines={1} style={styles.routeName}>
              {asText(selectedRoute.routeName) || 'Unnamed Route'}
            </Text>
            <Text style={styles.routeId}>
              Route#
              {asText(selectedRoute.routeIdStr).replace(/^route/i, '') ||
                selectedRoute.routeId}
            </Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>Active</Text>
            </View>
            <TouchableOpacity
              onPress={() => openMap(masters[masters.length - 1] ?? masters[0])}
              style={styles.headerMapButton}>
              <GoogleMapsIconSvg width={SIZE.MS(27)} height={SIZE.MS(27)} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>
            Current Fiber Types Installed:
          </Text>
          {installedFiberSections.length === 0 ? (
            <View style={styles.emptyFiberCard}>
              <Text style={styles.emptyFiberTitle}>No fiber added yet</Text>
              <Text style={styles.emptyFiberText}>
                Go back and tap the route card to add its first fiber.
              </Text>
            </View>
          ) : null}
          {installedFiberSections.map((fiber, index) => (
            <View key={fiber.id || `fiber-${index}`} style={styles.fiberCard}>
              <View style={styles.fiberLine}>
                <Text style={styles.fiberMeta}>
                  Fiber Type:{' '}
                  <Text style={styles.valueText}>{fiber.fiberLabel}</Text>
                </Text>
                <Text style={styles.fiberMeta}>
                  Total Distance:{' '}
                  <Text style={styles.valueText}>
                    {Math.round(
                      fiber.totalDistance ||
                        routeMasterDistance ||
                        Number(selectedRoute.totalDistance) ||
                        0,
                    )}{' '}
                    meters
                  </Text>
                </Text>
                <Text style={styles.fiberMeta}>
                  Total Masters:{' '}
                  <Text style={styles.valueText}>
                    {fiber.masterCount || masters.length}
                  </Text>
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.fiberAddress}>
                From: {fiber.fromAddress || routeFromAddress}
              </Text>
              <Text numberOfLines={1} style={styles.fiberAddress}>
                To: {fiber.toAddress || routeToAddress}
              </Text>
              {fiber.sldCode || fiber.fiberCode ? (
                <>
                  <Text style={styles.fiberSpecification}>
                    {fiber.sldCode ? `SLD: ${fiber.sldCode}` : ''}
                    {fiber.sldCode && fiber.fiberCode ? ' • ' : ''}
                    {fiber.fiberCode ? `Fiber Code: ${fiber.fiberCode}` : ''}
                  </Text>
                  <Text style={styles.fiberDrumSpecification}>
                    Total Drum: {fiber.totalDrumLength || 0}m • Remaining:{' '}
                    {fiber.remainingDrumLength || 0}m
                  </Text>
                </>
              ) : (
                <Text style={styles.fiberSpecification}>
                  {fiber.armourLabel || 'Cable specification unavailable'}
                  {fiber.drumLabel ? ` • Drum ${fiber.drumLabel}` : ''}
                </Text>
              )}
              {fiber.fromOrderNo !== undefined &&
              fiber.toOrderNo !== undefined ? (
                <Text style={styles.fiberRangeSpecification}>
                  {fiber.changeScope === 'Partial'
                    ? 'Installed section'
                    : 'Route range'}
                  : Order {fiber.fromOrderNo} → Order {fiber.toOrderNo}
                </Text>
              ) : null}
            </View>
          ))}

          <View style={styles.selectedFiberBar}>
            <Text style={styles.selectedFiberLabel}>
              Fiber Type to be changed:{' '}
            </Text>
            <Text numberOfLines={1} style={styles.selectedFiberValue}>
              {latestFiber
                ? [latestFiber.fiberLabel, latestFiber.fiberCode]
                    .filter(Boolean)
                    .join(' • ')
                : '--'}
            </Text>
          </View>

          {isLoadingMasters ? (
            <View style={styles.masterLoadState}>
              <ActivityIndicator size="small" color="#7546E7" />
              <Text style={styles.masterLoadText}>
                Loading route fiber details...
              </Text>
            </View>
          ) : null}
          {!isLoadingMasters && masterLoadError ? (
            <View style={styles.masterErrorState}>
              <Text style={styles.masterErrorText}>{masterLoadError}</Text>
            </View>
          ) : null}

          <View
            onLayout={event => {
              timelineYRef.current = event.nativeEvent.layout.y;
            }}
            style={styles.masterTimeline}>
            <View style={styles.timelineLine} />
            {masters.map((master, index) => {
              const showPointer =
                Boolean(currentPosition) && index === nearestMasterIndex;
              const currentDistance =
                showPointer && currentPosition && master.coordinate
                  ? distanceBetween(currentPosition, master.coordinate)
                  : null;
              const nextMaster = masters[index + 1];
              const segmentDistance = nextMaster
                ? getSegmentDistance(master, nextMaster)
                : 0;
              const outgoingFiber = nextMaster
                ? fiberSegments.find(
                    segment =>
                      master.orderNo >= segment.fromOrderNo &&
                      nextMaster.orderNo <= segment.toOrderNo,
                  )?.fiberLabel
                : undefined;
              const incomingFiber =
                index > 0
                  ? fiberSegments.find(
                      segment =>
                        masters[index - 1].orderNo >= segment.fromOrderNo &&
                        master.orderNo <= segment.toOrderNo,
                    )?.fiberLabel
                  : undefined;
              const displayedFiber =
                incomingFiber &&
                outgoingFiber &&
                incomingFiber !== outgoingFiber
                  ? `${incomingFiber} → ${outgoingFiber}`
                  : outgoingFiber || incomingFiber || master.fiberLabel;
              return (
                <View
                  key={master.key}
                  onLayout={event => {
                    masterYRef.current[master.key] = event.nativeEvent.layout.y;
                  }}
                  style={styles.masterRow}>
                  {showPointer ? (
                    <View
                      accessibilityLabel={`Your current location is nearest to ${master.name}`}
                      style={styles.currentLocationMarker}>
                      <PointerSvg width={SIZE.MS(25)} height={SIZE.MS(25)} />
                    </View>
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.82}
                    accessibilityState={{selected: showPointer}}
                    onPress={() => openRoutePage(master)}
                    style={[
                      styles.masterCard,
                      showPointer && styles.currentMasterCard,
                    ]}>
                    {showPointer && currentPosition && !installationMode ? (
                      <View style={styles.currentLocationBanner}>
                        <Text style={styles.currentLocationTitle}>
                          You are here
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={styles.currentLocationText}>
                          {currentPosition.latitude.toFixed(6)},{' '}
                          {currentPosition.longitude.toFixed(6)}
                          {currentDistance !== null
                            ? ` • ${Math.round(
                                currentDistance,
                              )}m from this master`
                            : ''}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.masterTitleRow}>
                      <Text numberOfLines={1} style={styles.masterName}>
                        {master.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.masterId}>
                        {master.masterTypeLabel}#{master.masterId || 'ID'}
                      </Text>
                      {master.placedType ? (
                        <Text numberOfLines={1} style={styles.placedTypeText}>
                          {/^on\s/i.test(master.placedType)
                            ? master.placedType
                            : `On ${master.placedType}`}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.masterStatus,
                          !master.active && styles.inactiveBadge,
                        ]}>
                        <Text style={styles.masterStatusText}>
                          {master.active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    <Text numberOfLines={2} style={styles.masterAddress}>
                      <Text style={styles.boldText}>Address: </Text>
                      {master.address}
                    </Text>
                    <Text numberOfLines={1} style={styles.masterLatLng}>
                      <Text style={styles.boldText}>Lat/Lng: </Text>
                      {master.latLngText}
                    </Text>
                    <View style={styles.masterFooter}>
                      <Text style={styles.masterMeta}>
                        Distance:{' '}
                        <Text style={styles.valueText}>
                          {Math.round(master.distance)}m
                        </Text>
                      </Text>
                      <Text style={styles.masterMeta}>
                        Fiber Type:{' '}
                        <Text style={styles.valueText}>{displayedFiber}</Text>
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={event => {
                          event.stopPropagation();
                          if (master.images.length === 0) {
                            Alert.alert(
                              'View Images',
                              'No images are available for this master.',
                            );
                            return;
                          }
                          setPreviewImages(master.images);
                          setPreviewIndex(0);
                        }}
                        style={styles.imageButton}>
                        <Text style={styles.imageButtonText}>View Images</Text>
                        <Image
                          source={IMAGES.camera}
                          style={styles.cameraIcon}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={event => {
                          event.stopPropagation();
                          openMap(master);
                        }}
                        style={styles.mapButton}>
                        <GoogleMapsIconSvg
                          width={SIZE.MS(24)}
                          height={SIZE.MS(24)}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                  {showPointer && currentPosition && canAddNewMaster ? (
                    <View style={styles.currentAddRow}>
                      <Text numberOfLines={2} style={styles.currentAddAddress}>
                        Current Address:{' '}
                        {currentAddress ||
                          `${currentPosition.latitude.toFixed(
                            6,
                          )}, ${currentPosition.longitude.toFixed(6)}`}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={addMasterAtCurrentLocation}
                        style={styles.currentAddButton}>
                        <Text style={styles.currentAddButtonText}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {nextMaster ? (
                    <View style={styles.segmentDistanceRow}>
                      <Text style={styles.segmentArrow}>↕</Text>
                      <Text style={styles.segmentDistanceText}>
                        {Math.round(segmentDistance)} meters
                        {outgoingFiber ? ` • ${outgoingFiber}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.86}
          disabled={isLocating}
          onPress={showCurrentLocation}
          style={styles.whereTouchable}>
          <LinearGradient
            colors={['#8B59F8', '#6036C4']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.whereButton}>
            <Text style={styles.whereText}>
              {isLocating ? 'Locating...' : 'Where I am?'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Modal
          visible={previewImages.length > 0}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setPreviewImages([])}>
          <Pressable
            onPress={() => setPreviewImages([])}
            style={styles.previewOverlay}>
            <Pressable style={styles.previewCard}>
              <Image
                source={{uri: previewImages[previewIndex]}}
                style={styles.previewImage}
              />
              <View style={styles.previewActions}>
                {previewImages.map((_, index) => (
                  <TouchableOpacity
                    key={`preview-${index}`}
                    onPress={() => setPreviewIndex(index)}
                    style={[
                      styles.previewDot,
                      previewIndex === index && styles.previewDotActive,
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity
                onPress={() => setPreviewImages([])}
                style={styles.previewClose}>
                <Text style={styles.previewCloseText}>×</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </Screen>
  );
};

export default FiberChangeScreen;
