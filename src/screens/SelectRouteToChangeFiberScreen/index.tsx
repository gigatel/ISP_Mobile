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
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import LinearGradient from 'react-native-linear-gradient';
import MapView, {Marker, PROVIDER_GOOGLE, Region} from 'react-native-maps';
import {useDispatch} from 'react-redux';
import {BackHeader} from '@molecules';
import type {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {StoreDispatch} from '@reducers';
import {COLORS, IMAGES, SIZE} from '@res';
import {
  GetDrumNumbersByFiberTypeAPI,
  GetFiberMasterListAPI,
  GetRouteFiberAllDataBySLDIdISPAPI,
  GetRouteFiberMappingPaggiISPAPI,
  insertUpdateRouteChamberMappingAPI,
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

const DEFAULT_DELHI_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

type RouteDetails = {
  id?: number;
  routeFiberMappingId?: number;
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
  fiberNameStr?: string;
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

type ChangeScope = 'sld' | 'full' | 'partial';

type PickerMode =
  | 'fiber'
  | 'armour'
  | 'drum'
  | 'fromMaster'
  | 'toMaster'
  | null;

type PickerItem = {
  label: string;
  value: string;
  meta?: string;
};

type RouteMasterBoundary = {
  key: string;
  fiberId: string;
  masterId: string;
  routeChamberMappingId?: number;
  orderNo: number;
  name: string;
  code: string;
  masterType: string;
  address: string;
  latLng: string;
  loopMeters: number;
};

type SldMaster = {
  key: string;
  fiberId: string;
  masterId: string;
  orderNo: number;
  name: string;
  masterType: string;
  address: string;
  latLng: string;
  loopMeters: number;
  totalDistance: number;
  cumulativeDistance: number;
  fiberType: string;
  icon: any;
};

type SldGroup = {
  key: string;
  sldId: string;
  sldCode: string;
  fiberId: string;
  fiberCode: string;
  fiberType: string;
  armourType: string;
  totalDistance: number;
  drumId: string;
  drumNo: string;
  totalDrumLength: number;
  remainingDrumLength: number;
  masters: SldMaster[];
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

const getRouteChamberMappingId = (master: any) => {
  const explicitId = Number(
    master?.routeChamberMappingId ??
      master?.RouteChamberMappingId ??
      master?.routeMasterMappingId ??
      master?.RouteMasterMappingId ??
      master?.routeFiberMappingId ??
      master?.RouteFiberMappingId ??
      master?.mappingId ??
      master?.MappingId,
  );
  if (Number.isInteger(explicitId) && explicitId > 0) {
    return explicitId;
  }

  // Some route responses use the record Id as the chamber-mapping key and
  // expose the actual master separately as MasterId.
  const recordId = Number(master?.id ?? master?.Id);
  const recordMasterId = Number(
    master?.IspMasterId ??
      master?.ispMasterId ??
      master?.masterId ??
      master?.MasterId,
  );
  return Number.isInteger(recordId) &&
    recordId > 0 &&
    Number.isInteger(recordMasterId) &&
    recordMasterId > 0 &&
    recordId !== recordMasterId
    ? recordId
    : 0;
};

const readDistance = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number.parseFloat(asText(value).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 0;
};

const getMasterCoordinate = (master: any): Coordinate | null => {
  const coordinateText = asText(
    master?.latLng ??
      master?.LatLng ??
      master?.latlng ??
      master?.masterLatLng ??
      master?.MasterLatLng ??
      master?.endLatLng ??
      master?.EndLatLng,
  );
  const parts = coordinateText
    .split(',')
    .map(value => Number.parseFloat(value.trim()));
  if (
    parts.length >= 2 &&
    Number.isFinite(parts[0]) &&
    Number.isFinite(parts[1]) &&
    Math.abs(parts[0]) <= 90 &&
    Math.abs(parts[1]) <= 180
  ) {
    return {latitude: parts[0], longitude: parts[1]};
  }

  const latitude = Number.parseFloat(
    asText(
      master?.latitude ??
        master?.Latitude ??
        master?.lat ??
        master?.Lat ??
        master?.endLatitude ??
        master?.EndLatitude,
    ),
  );
  const longitude = Number.parseFloat(
    asText(
      master?.longitude ??
        master?.Longitude ??
        master?.lng ??
        master?.Lng ??
        master?.long ??
        master?.Long ??
        master?.endLongitude ??
        master?.EndLongitude,
    ),
  );
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
    ? {latitude, longitude}
    : null;
};

const getMasterIcon = (masterType: string) => {
  const normalized = masterType.toLowerCase();
  if (normalized.includes('tree')) {
    return IMAGES.treeIcon;
  }
  if (normalized.includes('building')) {
    return IMAGES.Building;
  }
  if (normalized.includes('tiffin')) {
    return IMAGES.TiffinIcon;
  }
  if (normalized.includes('encl')) {
    return IMAGES.jointEnclosure;
  }
  if (normalized.includes('splitter')) {
    return IMAGES.enclosureIcon;
  }
  if (normalized.includes('pole')) {
    return IMAGES.PoleImage;
  }
  return IMAGES.module;
};

const joinedFiberLabel = (...values: unknown[]) =>
  Array.from(
    new Set(
      values
        .map(asText)
        .filter(Boolean)
        .map(value => value.trim()),
    ),
  ).join(' • ');

const sldTypeFor = (value: any) =>
  asText(value?.sldType ?? value?.SLDType).toLowerCase();

const buildSldGroups = (response: any): SldGroup[] =>
  getListFromResponse(response)
    .map((fiber, fiberIndex) => {
      const sldId =
        asText(fiber?.sldId ?? fiber?.SLDId) || String(fiberIndex + 1);
      const sldCode = asText(fiber?.sldCode ?? fiber?.SLDCode);
      const fiberId = asText(fiber?.fiberId ?? fiber?.FiberId);
      const fiberCode = asText(fiber?.fiberCode ?? fiber?.FiberCode);
      const fiberType =
        joinedFiberLabel(
          fiber?.fiberTypeName ?? fiber?.FiberTypeName ?? fiber?.fiberType,
          fiber?.fiberName ?? fiber?.FiberName,
        ) || '--';
      const armourType =
        asText(
          fiber?.fiberSpecificationName ??
            fiber?.FiberSpecificationName ??
            fiber?.armourType ??
            fiber?.ArmourType,
        ) || '';
      const rawMasters = parseMasterDetails(
        fiber?.masterDetails ?? fiber?.MasterDetails,
      ).sort(
        (first, second) =>
          Number(first?.orderNo ?? first?.OrderNo) -
          Number(second?.orderNo ?? second?.OrderNo),
      );
      const masters = rawMasters
        .map((master, masterIndex): SldMaster => {
          const orderNo = Number(master?.orderNo ?? master?.OrderNo);
          const masterType =
            asText(
              master?.masterType ??
                master?.MasterType ??
                master?.masterTypeName ??
                master?.MasterTypeName,
            ) || 'Master';
          const name =
            asText(master?.name ?? master?.Name ?? master?.masterName) ||
            `${masterType} ${masterIndex + 1}`;
          const masterId = asText(
            master?.IspMasterId ??
              master?.ispMasterId ??
              master?.masterId ??
              master?.MasterId ??
              master?.code ??
              master?.Code,
          );
          const segmentDistance = readDistance(
            master?.distance,
            master?.Distance,
            master?.segmentDistance,
            master?.SegmentDistance,
            master?.distanceBetweenMasters,
            master?.DistanceBetweenMasters,
            master?.masterDistance,
            master?.MasterDistance,
            master?.routeDistance,
            master?.RouteDistance,
            master?.walkingDistance,
            master?.WalkingDistance,
            master?.totalDistance,
            master?.TotalDistance,
          );
          const cumulativeDistance = readDistance(
            master?.routeLength,
            master?.RouteLength,
            master?.totalLength,
            master?.TotalLength,
            master?.cumulativeDistance,
            master?.CumulativeDistance,
          );
          const loopMeters = Number.parseFloat(
            asText(
              master?.loopMeters ??
                master?.LoopMeters ??
                master?.loop ??
                master?.Loop ??
                master?.LoopUsed ??
                0,
            ),
          );
          const coordinate = getMasterCoordinate(master);
          return {
            key: `${sldId}-${masterType}-${masterId || orderNo || masterIndex}`,
            fiberId: asText(
              master?.fiberId ??
                master?.FiberId ??
                master?.fiberTypeId ??
                master?.FiberTypeId ??
                fiberId,
            ),
            masterId,
            orderNo: Number.isFinite(orderNo) ? orderNo : masterIndex + 1,
            name,
            masterType,
            address: asText(
              master?.selectedAddress ??
                master?.SelectedAddress ??
                master?.address ??
                master?.Address,
            ),
            latLng: coordinate
              ? `${coordinate.latitude}, ${coordinate.longitude}`
              : '',
            loopMeters: Number.isFinite(loopMeters) ? loopMeters : 0,
            totalDistance: segmentDistance,
            cumulativeDistance,
            fiberType:
              asText(master?.fiberTypeName ?? master?.FiberTypeName) ||
              fiberType,
            icon: getMasterIcon(masterType),
          };
        })
        .map((master, masterIndex, orderedMasters) => {
          if (masterIndex === 0 || master.totalDistance > 0) {
            return master;
          }
          const previousMaster = orderedMasters[masterIndex - 1];
          const cumulativeSegment =
            master.cumulativeDistance > previousMaster.cumulativeDistance
              ? master.cumulativeDistance - previousMaster.cumulativeDistance
              : 0;
          if (cumulativeSegment > 0) {
            return {...master, totalDistance: cumulativeSegment};
          }
          const previousCoordinate = getMasterCoordinate(previousMaster);
          const currentCoordinate = getMasterCoordinate(master);
          return previousCoordinate && currentCoordinate
            ? {
                ...master,
                totalDistance: distanceBetween(
                  previousCoordinate,
                  currentCoordinate,
                ),
              }
            : master;
        });
      const apiDistance = Number(
        fiber?.totalDistance ?? fiber?.TotalDistance ?? fiber?.routeLength,
      );
      const masterDistance = masters.reduce(
        (total, master) => total + master.totalDistance,
        0,
      );
      const totalDrumLength = Number(
        fiber?.totalDrumLength ??
          fiber?.TotalDrumLength ??
          fiber?.drumLength ??
          fiber?.DrumLength ??
          0,
      );
      const remainingDrumLength = Number(
        fiber?.remainingDrumLength ??
          fiber?.RemainingDrumLength ??
          fiber?.drumRemainingLength ??
          0,
      );
      return {
        key: `sld-${sldId}-${fiberIndex}`,
        sldId,
        sldCode,
        fiberId,
        fiberCode,
        fiberType,
        armourType,
        totalDistance:
          Number.isFinite(apiDistance) && apiDistance > 0
            ? apiDistance
            : masterDistance,
        drumId: asText(fiber?.drumId ?? fiber?.DrumId),
        drumNo: asText(fiber?.drumNo ?? fiber?.DrumNo),
        totalDrumLength: Number.isFinite(totalDrumLength) ? totalDrumLength : 0,
        remainingDrumLength: Number.isFinite(remainingDrumLength)
          ? remainingDrumLength
          : 0,
        masters,
      };
    })
    .reduce<SldGroup[]>((groups, group) => {
      const existingIndex = groups.findIndex(
        item => item.sldId === group.sldId,
      );
      if (existingIndex < 0) {
        return [...groups, group];
      }
      const existing = groups[existingIndex];
      const next = [...groups];
      next[existingIndex] = {
        ...existing,
        sldCode: existing.sldCode || group.sldCode,
        fiberId: existing.fiberId || group.fiberId,
        fiberCode: existing.fiberCode || group.fiberCode,
        fiberType: Array.from(
          new Set([existing.fiberType, group.fiberType].filter(Boolean)),
        ).join(', '),
        armourType: Array.from(
          new Set([existing.armourType, group.armourType].filter(Boolean)),
        ).join(', '),
        totalDistance: Math.max(existing.totalDistance, group.totalDistance),
        drumId: existing.drumId || group.drumId,
        drumNo: existing.drumNo || group.drumNo,
        totalDrumLength: Math.max(
          existing.totalDrumLength,
          group.totalDrumLength,
        ),
        remainingDrumLength: Math.max(
          existing.remainingDrumLength,
          group.remainingDrumLength,
        ),
        masters: [...existing.masters, ...group.masters].filter(
          (master, index, masters) =>
            masters.findIndex(item => item.key === master.key) === index,
        ),
      };
      return next;
    }, []);

const buildRouteMasterBoundaries = (response: any): RouteMasterBoundary[] =>
  getListFromResponse(response)
    .flatMap(fiber =>
      parseMasterDetails(fiber?.masterDetails ?? fiber?.MasterDetails).map(
        master => ({
          ...master,
          __routeFiberId:
            master?.fiberId ??
            master?.FiberId ??
            master?.fiberTypeId ??
            master?.FiberTypeId ??
            fiber?.fiberId ??
            fiber?.FiberId,
        }),
      ),
    )
    .map((master, index): RouteMasterBoundary | null => {
      const orderNo = Number(master?.orderNo ?? master?.OrderNo);
      if (!Number.isFinite(orderNo)) {
        return null;
      }
      const name = asText(master?.name ?? master?.Name) || `Master ${orderNo}`;
      const code = asText(master?.code ?? master?.Code);
      const masterType =
        asText(master?.masterType ?? master?.MasterType) || 'Master';
      const address = asText(
        master?.selectedAddress ??
          master?.SelectedAddress ??
          master?.address ??
          master?.Address,
      );
      const latLng = asText(master?.latLng ?? master?.LatLng);
      const routeChamberMappingId = getRouteChamberMappingId(master);
      return {
        key: `${orderNo}-${masterType}-${code || name || index}`,
        fiberId: asText(master?.__routeFiberId),
        masterId: asText(
          master?.IspMasterId ??
            master?.ispMasterId ??
            master?.masterId ??
            master?.MasterId ??
            master?.id ??
            master?.Id ??
            code,
        ),
        ...(routeChamberMappingId ? {routeChamberMappingId} : {}),
        orderNo,
        name,
        code,
        masterType,
        address,
        latLng,
        loopMeters:
          Number.parseFloat(
            asText(
              master?.loopMeters ??
                master?.LoopMeters ??
                master?.loop ??
                master?.Loop ??
                master?.LoopUsed ??
                0,
            ),
          ) || 0,
      };
    })
    .filter((master): master is RouteMasterBoundary => master !== null)
    .sort((first, second) => first.orderNo - second.orderNo)
    .filter(
      (master, index, masters) =>
        masters.findIndex(item => item.orderNo === master.orderNo) === index,
    );

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

const getRouteId = (route: any) => {
  const directRouteId = Number(route?.routeId ?? route?.RouteId);
  if (Number.isFinite(directRouteId) && directRouteId > 0) {
    return directRouteId;
  }

  const routeIdFromCode = asText(route?.routeIdStr ?? route?.RouteIdStr).match(
    /\d+/,
  )?.[0];
  const parsedRouteId = Number(routeIdFromCode);
  if (Number.isFinite(parsedRouteId) && parsedRouteId > 0) {
    return parsedRouteId;
  }

  return Number(route?.id ?? route?.Id) || 0;
};

const normalizeRouteFiberMapping = (item: any): RouteDetails => {
  const fiberNameStr = asText(
    item?.fiberNameStr ?? item?.fiberTypeName ?? item?.fiberIdStr,
  );
  const fiberTypeName = asText(
    item?.fiberTypeName ?? item?.fiberIdStr ?? item?.fiberNameStr,
  );
  const fiberSpecificationName = asText(
    item?.fiberName ?? item?.fiberSpecificationName,
  );
  const routeLength = Number(item?.routeLength ?? item?.totalDistance);
  const fiberDetail = {
    id: item?.id ?? item?.Id,
    fiberTypeId: item?.fiberTypeId,
    fiberTypeName,
    fiberIdStr: fiberTypeName,
    fiberSpecificationName,
    noOfTubes: item?.tubeNo ?? item?.noOfTubes,
    noOfCores: item?.coreNo ?? item?.noOfCores,
    drumId: item?.drumId,
    drumNo: item?.drumNo,
    drumLength: Number(item?.drumLength) || 0,
    lengthToUse: Number(item?.lengthToUse) || 0,
    totalDistance: Number(item?.totalDistance ?? item?.routeLength) || 0,
  };

  return {
    ...item,
    routeFiberMappingId: Number(item?.id ?? item?.Id) || undefined,
    routeId: getRouteId(item),
    startLatLng: asText(item?.fromLatLng ?? item?.startLatLng),
    startAddress: asText(item?.fromAddress ?? item?.startAddress),
    endLatLng: asText(item?.toLatLng ?? item?.endLatLng),
    endAddress: asText(item?.toAddress ?? item?.endAddress),
    routeLength: Number.isFinite(routeLength) ? routeLength : 0,
    totalDistance: Number(item?.totalDistance ?? item?.routeLength) || 0,
    fiberNameStr,
    fiberTypeName,
    fiberIdStr: fiberTypeName,
    fiberSpecificationName,
    fiberDetails: [fiberDetail],
    noOfTubes: item?.tubeNo ?? item?.noOfTubes,
    noOfCores: item?.coreNo ?? item?.noOfCores,
    startMasterId: item?.fromMasterId ?? item?.startMasterId,
    startMasterType: item?.fromMasterTypeName ?? item?.startMasterType,
    startMasterName: item?.fromMasterName ?? item?.startMasterName,
    endMasterId: item?.toMasterId ?? item?.endMasterId,
    endMasterType: item?.toMasterTypeName ?? item?.endMasterType,
    endMasterName: item?.toMasterName ?? item?.endMasterName,
    isActive: item?.isActive ?? item?.fiberStatus ?? true,
  };
};

const mergeRouteFiberMappings = (routes: RouteDetails[]) =>
  routes.reduce<RouteDetails[]>((grouped, route) => {
    const existingIndex = grouped.findIndex(
      item => item.routeId === route.routeId,
    );
    if (existingIndex < 0) {
      return [...grouped, route];
    }

    const existing = grouped[existingIndex];
    const fiberDetails = [
      ...(Array.isArray(existing.fiberDetails) ? existing.fiberDetails : []),
      ...(Array.isArray(route.fiberDetails) ? route.fiberDetails : []),
    ].filter(
      (fiber, index, values) =>
        values.findIndex(
          candidate =>
            asText(candidate?.id ?? candidate?.fiberTypeId) ===
            asText(fiber?.id ?? fiber?.fiberTypeId),
        ) === index,
    );

    const next = [...grouped];
    next[existingIndex] = {
      ...existing,
      ...route,
      routeFiberMappingId:
        existing.routeFiberMappingId ?? route.routeFiberMappingId,
      startAddress: existing.startAddress || route.startAddress,
      startLatLng: existing.startLatLng || route.startLatLng,
      endAddress: existing.endAddress || route.endAddress,
      endLatLng: existing.endLatLng || route.endLatLng,
      fiberDetails,
    };
    return next;
  }, []);

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
  const mapRef = useRef<MapView | null>(null);
  const routeRequestRef = useRef(0);
  const locationRequestRef = useRef(0);
  const fiberSavePendingRef = useRef(false);
  const masterBoundaryRequestRef = useRef(0);
  const scopeManuallySelectedRef = useRef(false);

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
  const [changeScope, setChangeScope] = useState<ChangeScope>('sld');
  const [routeFiberData, setRouteFiberData] = useState<any[]>([]);
  const [fromOrderNo, setFromOrderNo] = useState<number | null>(null);
  const [toOrderNo, setToOrderNo] = useState<number | null>(null);
  const [isLoadingRouteMasters, setIsLoadingRouteMasters] = useState(false);
  const [routeMasterLoadError, setRouteMasterLoadError] = useState('');
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
  const [isSavingFiber, setIsSavingFiber] = useState(false);
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
          GetRouteFiberMappingPaggiISPAPI({
            page: nextPage,
            size: PAGE_SIZE,
            search,
          }),
        ).unwrap();

        if (requestId !== routeRequestRef.current) {
          return;
        }

        const activeRoutes = mergeRouteFiberMappings(
          (Array.isArray(response?.data) ? response.data : [])
            .map(normalizeRouteFiberMapping)
            .filter((route: RouteDetails) => route.isActive !== false),
        );

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
          return mergeRouteFiberMappings(combined);
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
        masterBoundaryRequestRef.current += 1;
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
      key: `route-${route.routeFiberMappingId ?? route.routeId}-${index}`,
      route,
      isNearest: Boolean(currentPosition && index === nearestRouteIndex),
    }));
  }, [currentPosition, nearestRouteIndex, routes]);

  const mapRoutes = useMemo(
    () =>
      routes
        .slice(0, 12)
        .map(route => {
          const start = parseCoordinate(route.startLatLng);
          const end = parseCoordinate(route.endLatLng);
          return {
            start,
            end,
            coordinates: [start, end].filter(
              (coordinate): coordinate is Coordinate => coordinate !== null,
            ),
          };
        })
        .filter(item => item.coordinates.length > 0),
    [routes],
  );

  const mapRegion = useMemo<Region>(() => {
    const coordinate =
      currentPosition ?? mapRoutes[0]?.end ?? mapRoutes[0]?.start;
    return coordinate
      ? {
          ...coordinate,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }
      : DEFAULT_DELHI_REGION;
  }, [currentPosition, mapRoutes]);

  useEffect(() => {
    const coordinate =
      currentPosition ?? mapRoutes[0]?.end ?? mapRoutes[0]?.start;
    if (!coordinate) {
      return;
    }

    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          ...coordinate,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        450,
      );
    }, 120);

    return () => clearTimeout(timer);
  }, [currentPosition, mapRoutes]);

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
        'Enable location access in Settings to show your current position in the route list.',
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

    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;

    try {
      setIsLocating(true);
      if (!(await requestLocationPermission())) {
        return;
      }
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
          mapRef.current?.animateToRegion(
            {
              ...position,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            450,
          );
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

  const loadRouteMasterBoundaries = useCallback(
    async (routeDetails: RouteDetails) => {
      const requestId = ++masterBoundaryRequestRef.current;
      try {
        setIsLoadingRouteMasters(true);
        setRouteMasterLoadError('');
        const response = await dispatch(
          GetRouteFiberAllDataBySLDIdISPAPI({
            routeId: routeDetails.routeId,
          }),
        ).unwrap();
        if (requestId !== masterBoundaryRequestRef.current) {
          return;
        }
        const responseData = getListFromResponse(response);
        setRouteFiberData(responseData);

        if (!scopeManuallySelectedRef.current) {
          const routeSldType = sldTypeFor(routeDetails);
          const hasFullSld = responseData.some(
            item => sldTypeFor(item) === 'full',
          );
          const hasPartialSld = responseData.some(
            item => sldTypeFor(item) === 'partial',
          );
          const firstSldType = sldTypeFor(responseData[0]);
          const automaticScope: ChangeScope =
            routeSldType === 'partial' && hasPartialSld
              ? 'partial'
              : routeSldType === 'full' && hasFullSld
              ? 'sld'
              : hasPartialSld && !hasFullSld
              ? 'partial'
              : hasFullSld && !hasPartialSld
              ? 'sld'
              : firstSldType === 'partial'
              ? 'partial'
              : 'sld';
          setChangeScope(automaticScope);
        }
      } catch (error: any) {
        if (requestId === masterBoundaryRequestRef.current) {
          setRouteFiberData([]);
          setRouteMasterLoadError(
            error?.message || 'Unable to load the ordered route masters.',
          );
        }
      } finally {
        if (requestId === masterBoundaryRequestRef.current) {
          setIsLoadingRouteMasters(false);
        }
      }
    },
    [dispatch],
  );

  const openFiberSheet = (route: RouteDetails) => {
    scopeManuallySelectedRef.current = false;
    setSelectedRoute(route);
    setChangeScope(sldTypeFor(route) === 'partial' ? 'partial' : 'sld');
    setRouteFiberData([]);
    setFromOrderNo(null);
    setToOrderNo(null);
    setRouteMasterLoadError('');
    setFiberId('');
    setArmourValue('');
    setTubeCount('');
    setCoreCount('');
    setDrumId('');
    setDrumOptions([]);
    setLengthToUse('300');
    setSheetError('');
    loadFiberOptions();
    loadRouteMasterBoundaries(route);
  };

  const scopedRouteFiberData = useMemo(() => {
    if (changeScope === 'full') {
      return routeFiberData;
    }
    const expectedSldType = changeScope === 'partial' ? 'partial' : 'full';
    return routeFiberData.filter(item => sldTypeFor(item) === expectedSldType);
  }, [changeScope, routeFiberData]);
  const scopedSldGroups = useMemo(
    () => buildSldGroups(scopedRouteFiberData),
    [scopedRouteFiberData],
  );
  const scopedRouteMasterBoundaries = useMemo(
    () => buildRouteMasterBoundaries(scopedRouteFiberData),
    [scopedRouteFiberData],
  );

  const existingFiberLabel = useMemo(() => {
    const apiLabels = scopedSldGroups.map(group =>
      [group.fiberType, group.armourType].filter(Boolean).join(', '),
    );
    const routeFiberDetails = selectedRoute?.fiberDetails;
    const routeLabels = Array.isArray(routeFiberDetails)
      ? routeFiberDetails.map((fiber: any) =>
          [
            asText(
              fiber?.fiberTypeName ?? fiber?.fiberIdStr ?? fiber?.fiberNameStr,
            ),
            asText(
              fiber?.fiberSpecificationName ??
                fiber?.armourType ??
                fiber?.fiberName,
            ),
          ]
            .filter(Boolean)
            .join(', '),
        )
      : [];
    return Array.from(
      new Set([...apiLabels, ...routeLabels].filter(Boolean)),
    ).join(' • ');
  }, [scopedSldGroups, selectedRoute]);

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
  const selectedFromMaster = useMemo(
    () =>
      scopedRouteMasterBoundaries.find(
        master => master.orderNo === fromOrderNo,
      ) ?? null,
    [fromOrderNo, scopedRouteMasterBoundaries],
  );
  const selectedToMaster = useMemo(
    () =>
      scopedRouteMasterBoundaries.find(
        master => master.orderNo === toOrderNo,
      ) ?? null,
    [scopedRouteMasterBoundaries, toOrderNo],
  );
  const partialSegmentDistance = useMemo(() => {
    if (!selectedFromMaster || !selectedToMaster) {
      return 0;
    }
    const segmentMasters = scopedRouteMasterBoundaries.filter(
      master =>
        master.orderNo >= selectedFromMaster.orderNo &&
        master.orderNo <= selectedToMaster.orderNo,
    );
    return Math.round(
      segmentMasters.slice(1).reduce((total, master, index) => {
        const fromCoordinate = parseCoordinate(segmentMasters[index].latLng);
        const toCoordinate = parseCoordinate(master.latLng);
        return fromCoordinate && toCoordinate
          ? total + distanceBetween(fromCoordinate, toCoordinate)
          : total;
      }, 0),
    );
  }, [scopedRouteMasterBoundaries, selectedFromMaster, selectedToMaster]);

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
    } else if (pickerMode === 'fromMaster') {
      const nextFromOrder = Number(item.value);
      setFromOrderNo(nextFromOrder);
      if (toOrderNo !== null && toOrderNo <= nextFromOrder) {
        setToOrderNo(null);
      }
    } else if (pickerMode === 'toMaster') {
      setToOrderNo(Number(item.value));
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
    if (pickerMode === 'fromMaster') {
      return scopedRouteMasterBoundaries.slice(0, -1).map(master => ({
        label: master.code ? `${master.name} (${master.code})` : master.name,
        value: String(master.orderNo),
        meta: `Order ${master.orderNo} • ${master.masterType}`,
      }));
    }
    if (pickerMode === 'toMaster') {
      return scopedRouteMasterBoundaries
        .filter(master => fromOrderNo !== null && master.orderNo > fromOrderNo)
        .map(master => ({
          label: master.code ? `${master.name} (${master.code})` : master.name,
          value: String(master.orderNo),
          meta: `Order ${master.orderNo} • ${master.masterType}`,
        }));
    }
    return [];
  }, [
    drumOptions,
    fiberOptions,
    fromOrderNo,
    pickerMode,
    scopedRouteMasterBoundaries,
  ]);

  const pickerTitle =
    pickerMode === 'fiber'
      ? 'Select Fiber Type'
      : pickerMode === 'armour'
      ? 'Select Cable Type'
      : pickerMode === 'drum'
      ? 'Select Drum'
      : pickerMode === 'fromMaster'
      ? 'Select From Master'
      : 'Select To Master';

  const startFiberInstallation = () => {
    if (!selectedRoute) {
      setSheetError('The selected route is unavailable.');
      return;
    }
    const requestedLength = Number(lengthToUse);
    if (isLoadingRouteMasters) {
      setSheetError('Wait for the SLD details to finish loading.');
      return;
    }
    if (scopedRouteMasterBoundaries.length === 0) {
      setSheetError(
        routeMasterLoadError ||
          `No ${
            changeScope === 'partial' ? 'Partial' : 'Full'
          } SLD route masters were returned.`,
      );
      return;
    }
    const firstSld = scopedSldGroups[0];
    const firstMaster = scopedRouteMasterBoundaries[0];
    const lastMaster =
      scopedRouteMasterBoundaries[scopedRouteMasterBoundaries.length - 1];
    const routeForChange = selectedRoute;
    const selections =
      fiberSelections[selectedRoute.routeId] ??
      getRouteFiberSelections(selectedRoute.routeId, selectedRoute.routeName);
    const selectedSld = {
      ...(firstSld ?? {}),
      routeId: selectedRoute.routeId,
      routeName: selectedRoute.routeName,
      // Fiber-change full/partial installations must use every master returned
      // for the route. Leaving `id` empty prevents a single-SLD filter.
      id: '',
      fromMasterId: firstMaster.masterId,
      fromMasterName: firstMaster.name,
      fromMasterTypeName: firstMaster.masterType,
      fromAddress:
        changeScope === 'partial'
          ? firstMaster.address
          : selectedRoute.startAddress || firstMaster.address,
      fromLatLng:
        changeScope === 'partial'
          ? firstMaster.latLng
          : selectedRoute.startLatLng || firstMaster.latLng,
      toMasterId: lastMaster.masterId,
      toMasterName: lastMaster.name,
      toMasterTypeName: lastMaster.masterType,
      toAddress:
        changeScope === 'partial'
          ? lastMaster.address
          : selectedRoute.endAddress || lastMaster.address,
      toLatLng:
        changeScope === 'partial'
          ? lastMaster.latLng
          : selectedRoute.endLatLng || lastMaster.latLng,
      firstOrderNo: firstMaster.orderNo,
      lastOrderNo: lastMaster.orderNo,
      fiberTypeId: selectedFiber
        ? Number(selectedFiber.value)
        : firstSld?.fiberId,
      fiberTypeName:
        selectedFiber?.label ||
        firstSld?.fiberType ||
        selectedRoute.fiberTypeName,
      fiberTypeLabel:
        selectedFiber?.label ||
        firstSld?.fiberType ||
        selectedRoute.fiberTypeName,
      fiberSpecificationName: selectedArmour?.label || firstSld?.armourType,
      drumId: selectedDrum?.value || firstSld?.drumId,
      drumNo: selectedDrum?.label || firstSld?.drumNo,
      drumLength: selectedDrum?.availableLength ?? firstSld?.totalDrumLength,
      drumRemainingLength: selectedDrum
        ? Math.max(
            0,
            selectedDrum.availableLength -
              (Number.isFinite(requestedLength) && requestedLength > 0
                ? requestedLength
                : 0),
          )
        : firstSld?.remainingDrumLength,
      totalDistance:
        changeScope === 'partial'
          ? firstSld?.totalDistance || 0
          : Number(selectedRoute.routeLength ?? selectedRoute.totalDistance) ||
            firstSld?.totalDistance ||
            0,
    };

    setSheetError('');
    setSelectedRoute(null);
    setTimeout(() => {
      navigation.navigate('Install-Fiber-With-SLD', {
        selectedSld,
        installationMode:
          changeScope === 'partial'
            ? 'fiber-change-partial'
            : 'fiber-change-full',
        fiberChangeRoute: routeForChange,
        fiberChangeSelectedFibers: selections,
        routeFiberData: scopedRouteFiberData,
        ...(currentPosition ? {currentPosition} : {}),
        currentAddress: currentPosition
          ? `${currentPosition.latitude.toFixed(
              6,
            )}, ${currentPosition.longitude.toFixed(6)}`
          : '',
      });
    }, 80);
  };

  const selectChangeScope = (scope: ChangeScope) => {
    scopeManuallySelectedRef.current = true;
    setChangeScope(scope);
    setSheetError('');
    if (scope !== 'partial') {
      setFromOrderNo(null);
      setToOrderNo(null);
    }
    if (
      selectedRoute &&
      routeFiberData.length === 0 &&
      !isLoadingRouteMasters
    ) {
      loadRouteMasterBoundaries(selectedRoute);
    }
  };

  const confirmFiberSelection = async () => {
    if (fiberSavePendingRef.current) {
      return;
    }

    const requestedLength = Number(lengthToUse);
    if (!selectedRoute || !selectedFiber) {
      setSheetError('Select a fiber type.');
      return;
    }
    if (changeScope === 'partial') {
      if (isLoadingRouteMasters) {
        setSheetError('Wait for the ordered route masters to finish loading.');
        return;
      }
      if (scopedRouteMasterBoundaries.length < 2) {
        setSheetError(
          routeMasterLoadError ||
            'Ordered route masters are unavailable for a partial change.',
        );
        return;
      }
      if (!selectedFromMaster || !selectedToMaster) {
        setSheetError('Select both From Master and To Master.');
        return;
      }
      if (selectedFromMaster.orderNo >= selectedToMaster.orderNo) {
        setSheetError('To Master must come after From Master on the route.');
        return;
      }
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
      changeScope === 'partial' &&
      partialSegmentDistance > 0 &&
      requestedLength < partialSegmentDistance
    ) {
      setSheetError(
        `The selected segment is approximately ${partialSegmentDistance}m. Increase the length to use.`,
      );
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

    const numericFiberId = Number(selectedFiber.value);
    if (!Number.isInteger(numericFiberId) || numericFiberId <= 0) {
      setSheetError('A single valid fiber ID is required.');
      return;
    }
    const routeLength = Number(
      selectedRoute.routeLength ?? selectedRoute.totalDistance,
    );
    const fiberUsedBy = asText(selectedRoute.fiberUsedBy);

    try {
      fiberSavePendingRef.current = true;
      setIsSavingFiber(true);
      setSheetError('');

      // Without SLD is a discrete, user-selected master workflow. Do not
      // create a placeholder mapping here: its default order/master values can
      // collide with an existing route chamber and can make the backend infer
      // a continuous range. Each selected master is saved later from the route
      // builder with its exact order number.
      if (changeScope !== 'full') {
        await dispatch(
          insertUpdateRouteChamberMappingAPI({
            routeId: selectedRoute.routeId,
            routeLength: Number.isFinite(routeLength)
              ? Math.round(routeLength)
              : 0,
            totalLength: requestedLength,
            drumLength: selectedDrum.availableLength,
            drumRemainingLength: Math.max(
              0,
              selectedDrum.availableLength - requestedLength,
            ),
            loopUsed: 0,
            fiberId: numericFiberId,
            fiberType: selectedFiber.fiberCount
              ? `${selectedFiber.fiberCount}F`
              : selectedFiber.label,
            fiberChangeScope:
              changeScope === 'partial' ? 'PartialRoute' : 'FullRoute',
            ...(fiberUsedBy ? {fiberUsedBy} : {}),
            drumNo: selectedDrum.label,
            ...(changeScope === 'partial' &&
            selectedFromMaster &&
            selectedToMaster
              ? {
                  changeScope: 'Partial' as const,
                  isPartialChange: true,
                  fromOrderNo: selectedFromMaster.orderNo,
                  toOrderNo: selectedToMaster.orderNo,
                  fromMasterName: selectedFromMaster.name,
                  toMasterName: selectedToMaster.name,
                  fromMasterType: selectedFromMaster.masterType,
                  toMasterType: selectedToMaster.masterType,
                  fromAddress: selectedFromMaster.address,
                  toAddress: selectedToMaster.address,
                  fromLatLng: selectedFromMaster.latLng,
                  toLatLng: selectedToMaster.latLng,
                  segmentLength: partialSegmentDistance,
                  masterType: selectedToMaster.masterType,
                  orderNo: selectedToMaster.orderNo,
                  endLatLng: selectedToMaster.latLng,
                  endSelectedAddress: selectedToMaster.address,
                  endAddress: selectedToMaster.address,
                }
              : {}),
          }),
        ).unwrap();
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
          changeScope:
            changeScope === 'partial'
              ? 'Partial'
              : changeScope === 'full'
              ? 'Discrete'
              : 'Full',
          ...(changeScope === 'partial' &&
          selectedFromMaster &&
          selectedToMaster
            ? {
                fromOrderNo: selectedFromMaster.orderNo,
                toOrderNo: selectedToMaster.orderNo,
                fromMasterName: selectedFromMaster.name,
                toMasterName: selectedToMaster.name,
                fromAddress: selectedFromMaster.address,
                toAddress: selectedToMaster.address,
              }
            : {}),
        },
      );
      setFiberSelections(previous => ({
        ...previous,
        [selectedRoute.routeId]: nextFibers,
      }));
      const routeForChange = selectedRoute;
      Common.showToast(
        changeScope === 'partial'
          ? 'Partial fiber segment updated successfully'
          : changeScope === 'full'
          ? 'Fiber selected. Add only the masters you want to update.'
          : 'Fiber type updated successfully',
      );
      setSelectedRoute(null);
      navigation.navigate('Fiber-Change', {
        selectedRoute: routeForChange,
        selectedFibers: nextFibers,
        installationScope: 'withoutSld',
        ...(currentPosition
          ? {
              currentPosition,
              currentAddress: `${currentPosition.latitude.toFixed(
                6,
              )}, ${currentPosition.longitude.toFixed(6)}`,
            }
          : {}),
      });
    } catch (error: any) {
      setSheetError(error?.message || 'Unable to update the fiber type.');
    } finally {
      fiberSavePendingRef.current = false;
      setIsSavingFiber(false);
    }
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
    const serverFiberLabels = Array.isArray(route.fiberDetails)
      ? route.fiberDetails.map((fiber: any) =>
          asText(
            fiber?.fiberTypeName ?? fiber?.fiberIdStr ?? fiber?.fiberNameStr,
          ),
        )
      : [
          asText(
            route.fiberTypeName ??
              route.fiberIdStr ??
              route.fiberNameStr ??
              route.fibreType ??
              route.fiberType,
          ),
        ];
    const fiberLabel =
      Array.from(
        new Set([...serverFiberLabels, ...selectedFiberLabels].filter(Boolean)),
      ).join(', ') || '--';
    const totalDistance = Number(route.totalDistance ?? route.routeLength) || 0;
    const currentDistance =
      showLocationPointer && currentPosition
        ? distanceToRoute(currentPosition, route)
        : null;

    return (
      <View style={styles.routeCardRow}>
        {showLocationPointer ? (
          <View
            accessibilityLabel={`Your current location is nearest to ${
              asText(route.routeName) || 'this route'
            }`}
            style={styles.currentLocationMarker}>
            <PointerSvg width={SIZE.MS(25)} height={SIZE.MS(25)} />
          </View>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => openFiberSheet(route)}
          style={[
            styles.routeCard,
            showLocationPointer && styles.currentRouteCard,
          ]}>
          {showLocationPointer && currentPosition ? (
            <View style={styles.currentLocationBanner}>
              <Text style={styles.currentLocationTitle}>You are here</Text>
              <Text numberOfLines={1} style={styles.currentLocationText}>
                {currentPosition.latitude.toFixed(6)},{' '}
                {currentPosition.longitude.toFixed(6)}
                {currentDistance !== null && Number.isFinite(currentDistance)
                  ? ` • ${Math.round(currentDistance)}m from this route`
                  : ''}
              </Text>
            </View>
          ) : null}
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
      keyboardAvoidingEnabled={false}
      statusBgColor={COLORS.PRIMARY}
      navBarColor={COLORS.WHITE}>
      <View style={styles.screen}>
        <BackHeader
          title="Select Route to Change Fiber"
          showGps={false}
          onBackPress={() => navigation.goBack()}
        />

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            initialRegion={mapRegion}
            showsCompass
            showsMyLocationButton={false}
            toolbarEnabled={false}>
            {currentPosition ? (
              <Marker coordinate={currentPosition} title="You are here">
                <PointerSvg width={SIZE.MS(34)} height={SIZE.MS(34)} />
              </Marker>
            ) : null}
          </MapView>

          {isLocating || isLoading ? (
            <View style={styles.mapLoading} pointerEvents="none">
              <ActivityIndicator size="small" color={COLORS.PRIMARY} />
              <Text style={styles.mapLoadingText}>
                {isLocating ? 'Finding your location...' : 'Loading routes...'}
              </Text>
            </View>
          ) : null}
        </View>

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

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={isLocating}
            onPress={showCurrentLocation}
            style={[
              styles.whereButtonTouchable,
              isLocating && styles.buttonDisabled,
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
      </View>

      <Modal
        visible={selectedRoute !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isSavingFiber) {
            setSelectedRoute(null);
          }
        }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (!isSavingFiber) {
                setSelectedRoute(null);
              }
            }}>
            <Pressable style={styles.fiberSheet} onPress={() => undefined}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Select Fiber Type to Change</Text>

              <View style={styles.scopeToggle}>
                {(['sld', 'partial', 'full'] as ChangeScope[]).map(scope => {
                  const isSelected = changeScope === scope;
                  const title =
                    scope === 'sld'
                      ? 'Full Route'
                      : scope === 'full'
                      ? 'Without SLD'
                      : 'Partial Route';
                  const subtitle = scope === 'partial' ? 'With SLD' : '';
                  return (
                    <TouchableOpacity
                      key={scope}
                      activeOpacity={0.78}
                      onPress={() => selectChangeScope(scope)}
                      style={[
                        styles.scopeOption,
                        isSelected && styles.scopeOptionSelected,
                      ]}>
                      <Text
                        style={[
                          styles.scopeOptionText,
                          isSelected && styles.scopeOptionTextSelected,
                        ]}>
                        {title}
                      </Text>
                      {subtitle ? (
                        <Text
                          style={[
                            styles.scopeOptionSubtitle,
                            isSelected && styles.scopeOptionTextSelected,
                          ]}>
                          {subtitle}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.existingFiberText}>
                Existing Fiber Type:{' '}
                <Text style={styles.existingFiberValue}>
                  {existingFiberLabel || '--'}
                </Text>
              </Text>

              {changeScope !== 'full' ? (
                <ScrollView
                  style={styles.sldScroll}
                  contentContainerStyle={styles.sldScrollContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}>
                  {isLoadingRouteMasters ? (
                    <View style={styles.sldLoading}>
                      <ActivityIndicator size="small" color="#7546E7" />
                      <Text style={styles.sldLoadingText}>
                        Loading SLD details...
                      </Text>
                    </View>
                  ) : null}
                  {!isLoadingRouteMasters && routeMasterLoadError ? (
                    <View style={styles.masterLoadErrorRow}>
                      <Text style={styles.masterLoadErrorText}>
                        {routeMasterLoadError}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          selectedRoute &&
                          loadRouteMasterBoundaries(selectedRoute)
                        }>
                        <Text style={styles.masterRetryText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {!isLoadingRouteMasters &&
                  !routeMasterLoadError &&
                  scopedSldGroups.length === 0 ? (
                    <View style={styles.sldLoading}>
                      <Text style={styles.sldLoadingText}>
                        No {changeScope === 'partial' ? 'Partial' : 'Full'} SLD
                        is available for this route.
                      </Text>
                    </View>
                  ) : null}
                  {scopedSldGroups.map((group, groupIndex) => (
                    <View key={group.key} style={styles.sldCard}>
                      <Text style={styles.sldTitle}>
                        SLD Details{' '}
                        {group.sldCode || group.sldId || groupIndex + 1}:-
                      </Text>
                      <View style={styles.sldSummaryRow}>
                        <Text style={styles.sldSummaryText}>
                          Fiber Type:{' '}
                          <Text style={styles.sldValue}>{group.fiberType}</Text>
                          {group.armourType ? (
                            <Text style={styles.sldValue}>
                              {'  '}
                              {group.armourType}
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                      <View style={styles.sldSummaryRow}>
                        <Text style={styles.sldSummaryText}>
                          Total Distance:{' '}
                          <Text style={styles.sldValue}>
                            {Math.round(group.totalDistance)}m
                          </Text>
                        </Text>
                        <Text style={styles.sldSummaryText}>
                          Total Drum:{' '}
                          <Text style={styles.sldValue}>
                            {Math.round(group.totalDrumLength)}m
                          </Text>
                        </Text>
                      </View>

                      {group.masters.map((master, masterIndex) => {
                        return (
                          <React.Fragment key={master.key}>
                            <View style={styles.sldMasterRow}>
                              <Image
                                source={master.icon}
                                style={styles.sldMasterIcon}
                              />
                              <View style={styles.sldMasterMain}>
                                <Text
                                  numberOfLines={1}
                                  style={styles.sldMasterName}>
                                  {master.masterType}{' '}
                                  <Text style={styles.sldMasterAddress}>
                                    • {master.name}
                                    {master.address
                                      ? `, ${master.address}`
                                      : ''}
                                  </Text>
                                </Text>
                                <Text style={styles.sldMasterFiberText}>
                                  Fiber Type:{' '}
                                  <Text style={styles.sldValue}>
                                    {master.fiberType || group.fiberType}
                                  </Text>
                                </Text>
                              </View>
                              <View style={styles.sldMasterMeta}>
                                <Text style={styles.sldMetaText}>
                                  Loop:{' '}
                                  <Text style={styles.sldValue}>
                                    {Math.round(master.loopMeters)}m
                                  </Text>
                                </Text>
                                <Text style={styles.sldMetaText}>
                                  Total Dis:{' '}
                                  <Text style={styles.sldValue}>
                                    {Math.round(master.totalDistance)}m
                                  </Text>
                                </Text>
                              </View>
                            </View>
                            {masterIndex < group.masters.length - 1 ? (
                              <Text style={styles.sldDistanceConnector}>
                                ↕{' '}
                                {Math.round(
                                  group.masters[masterIndex + 1].totalDistance,
                                )}{' '}
                                meters
                              </Text>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </View>
                  ))}
                  {sheetError ? (
                    <Text style={styles.sheetError}>{sheetError}</Text>
                  ) : null}
                </ScrollView>
              ) : (
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
              )}

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={isSavingFiber}
                  onPress={() => setSelectedRoute(null)}
                  style={[
                    styles.sheetActionButton,
                    isSavingFiber && styles.buttonDisabled,
                  ]}>
                  <LinearGradient
                    colors={['#73777A', '#4D5053']}
                    style={styles.sheetActionGradient}>
                    <Text style={styles.sheetActionText}>Close</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={isSavingFiber}
                  onPress={
                    changeScope === 'full'
                      ? confirmFiberSelection
                      : startFiberInstallation
                  }
                  style={[
                    styles.sheetActionButton,
                    isSavingFiber && styles.buttonDisabled,
                  ]}>
                  <LinearGradient
                    colors={['#8B59F8', '#6036C4']}
                    style={styles.sheetActionGradient}>
                    {isSavingFiber ? (
                      <>
                        <ActivityIndicator size="small" color={COLORS.WHITE} />
                        <Text style={styles.sheetActionText}>Saving...</Text>
                      </>
                    ) : (
                      <Text style={styles.sheetActionText}>
                        {changeScope === 'full' ? 'Select' : 'Start Installing'}
                      </Text>
                    )}
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
                  {isLoadingFibers ||
                  isLoadingDrums ||
                  isLoadingRouteMasters ? (
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
