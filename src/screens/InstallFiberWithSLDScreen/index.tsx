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
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  launchCamera,
  type CameraOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useDispatch} from 'react-redux';
import {BackHeader} from '@molecules';
import type {RootStackParamList} from '@navigation/navigator';
import {Screen} from '@organisms';
import {StoreDispatch} from '@reducers';
import {COLORS, IMAGES} from '@res';
import {
  GetISPMasterByRouteIdISPAPI,
  GetRouteFiberAllDataBySLDIdISPAPI,
  installFiberBySLDTempAPI,
} from '@slices/route.slice';
import {Common, ImageWatermark, Location} from '@utils';
import FullscreenImageViewer from '../../components/molecules/fullscreen-image-viewer';
import ConnectedFiberDetailsModal from '../../components/molecules/connected-fiber-details-modal';
import PointerSvg from '../../res/images/pointer.svg';
import {
  PausedRouteSnapshot,
  removeCompletedRouteSnapshot,
  savePausedRouteSnapshot,
} from '../../services/pausedRouteStorage';
import {getReplacementFiberLabel} from '../../services/routeFiberChangeStorage';
import styles from './styles';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'Install-Fiber-With-SLD'
>;
type Coordinate = {latitude: number; longitude: number};
type LocationFix = Coordinate & {accuracy: number};
type MapDisplayType = 'standard' | 'satellite' | 'threeDimensional';

const MAP_DISPLAY_OPTIONS: {type: MapDisplayType; label: string}[] = [
  {type: 'standard', label: 'Standard'},
  {type: 'satellite', label: 'Satellite'},
  {type: 'threeDimensional', label: '3D'},
];

type Master = {
  key: string;
  id: number;
  routeChamberMappingId: number;
  sldId: string | number;
  orderNo: number;
  name: string;
  type: string;
  address: string;
  coordinate: Coordinate | null;
  distance: number;
  loop: number;
  fiberId: string | number;
  fiberLabel: string;
  drumId: string | number;
  drumNo: string;
  drumLength: number;
  drumRemainingLength: number;
  icon: any;
};

const text = (value: any) => String(value ?? '').trim();
const coordinate = (value: any): Coordinate | null => {
  const raw = text(
    value?.latLng ??
      value?.LatLng ??
      value?.latlng ??
      value?.masterLatLng ??
      value?.MasterLatLng ??
      value?.endLatLng ??
      value?.EndLatLng ??
      value,
  );
  const parts = raw.split(',').map(part => Number.parseFloat(part.trim()));
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
    text(
      value?.latitude ??
        value?.Latitude ??
        value?.lat ??
        value?.Lat ??
        value?.endLatitude ??
        value?.EndLatitude,
    ),
  );
  const longitude = Number.parseFloat(
    text(
      value?.longitude ??
        value?.Longitude ??
        value?.lng ??
        value?.Lng ??
        value?.long ??
        value?.Long ??
        value?.endLongitude ??
        value?.EndLongitude,
    ),
  );
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
    ? {latitude, longitude}
    : null;
};
const fiberLabelFor = (value: any, fallback?: any) => {
  const fiberType = text(
    value?.fiberTypeName ??
      value?.FiberTypeName ??
      value?.fiberIdStr ??
      value?.FiberIdStr ??
      fallback?.fiberTypeName ??
      fallback?.FiberTypeName,
  );
  const specification = text(
    value?.fiberSpecificationName ??
      value?.FiberSpecificationName ??
      value?.fiberName ??
      value?.FiberName ??
      fallback?.fiberSpecificationName ??
      fallback?.fiberName,
  );
  return getReplacementFiberLabel(fiberType, specification) || '--';
};
const distanceBetween = (a: Coordinate, b: Coordinate) => {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const iconFor = (type: string) => {
  const value = type.toLowerCase();
  if (value.includes('pole')) {
    return IMAGES.PoleImage;
  }
  if (value.includes('tree')) {
    return IMAGES.treeIcon;
  }
  if (value.includes('building')) {
    return IMAGES.Building;
  }
  if (value.includes('tiffin')) {
    return IMAGES.TiffinIcon;
  }
  if (value.includes('splitter')) {
    return IMAGES.enclosureIcon;
  }
  if (value.includes('encl')) {
    return IMAGES.jointEnclosure;
  }
  if (value.includes('chamber')) {
    return IMAGES.ChamberNew;
  }
  return IMAGES.module;
};
const listFrom = (response: any) =>
  Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
    ? response.data
    : [];
const parseDetails = (value: any): any[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};
const routeChamberMappingIdFor = (master: any) => {
  const explicitId = Number(
    master?.routeChamberMappingId ??
      master?.RouteChamberMappingId ??
      master?.routeMasterMappingId ??
      master?.RouteMasterMappingId ??
      master?.mappingId ??
      master?.MappingId,
  );
  if (Number.isInteger(explicitId) && explicitId > 0) {
    return explicitId;
  }
  const recordId = Number(master?.id ?? master?.Id);
  const masterId = Number(
    master?.IspMasterId ??
      master?.ispMasterId ??
      master?.masterId ??
      master?.MasterId,
  );
  return Number.isInteger(recordId) &&
    recordId > 0 &&
    Number.isInteger(masterId) &&
    masterId > 0 &&
    recordId !== masterId
    ? recordId
    : 0;
};
const masterIdFor = (master: any) => {
  const candidates = [
    master?.IspMasterId,
    master?.ispMasterId,
    master?.masterId,
    master?.MasterId,
    master?.newMasterId,
    master?.NewMasterId,
    master?.newFiberMasterId,
    master?.NewFiberMasterId,
    master?.poleId,
    master?.PoleId,
    master?.treeId,
    master?.TreeId,
    master?.buildingId,
    master?.BuildingId,
    master?.tiffinId,
    master?.TiffinId,
    master?.enclosureId,
    master?.EnclosureId,
    master?.splitterId,
    master?.SplitterId,
    master?.chamberId,
    master?.ChamberId,
    master?.id,
    master?.Id,
  ];
  const value = candidates
    .map(candidate => Number(candidate))
    .find(candidate => Number.isInteger(candidate) && candidate > 0);
  return value ?? 0;
};
const masterCodeFor = (master: any) =>
  text(
    master?.masterCode ?? master?.MasterCode ?? master?.code ?? master?.Code,
  ).toLowerCase();
const masterNameFor = (master: any) =>
  text(
    master?.masterName ?? master?.MasterName ?? master?.name ?? master?.Name,
  ).toLowerCase();
const masterTypeFor = (master: any) =>
  text(
    master?.masterType ??
      master?.MasterType ??
      master?.masterTypeName ??
      master?.MasterTypeName ??
      master?.point ??
      master?.Point ??
      master?.type ??
      master?.Type,
  ).toLowerCase();
const routeMasterListFrom = (response: any): any[] => {
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
  return candidates.find(Array.isArray) ?? [];
};
const requestPosition = ({
  enableHighAccuracy,
  timeout,
  maximumAge,
}: {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}) =>
  new Promise<LocationFix>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      value =>
        resolve({
          latitude: value.coords.latitude,
          longitude: value.coords.longitude,
          accuracy: Number(value.coords.accuracy) || Number.MAX_VALUE,
        }),
      reject,
      {enableHighAccuracy, timeout, maximumAge},
    );
  });

const InstallFiberWithSLDScreen: FC<Props> = ({navigation, route}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const selected = route.params.selectedSld;
  const installationMode = route.params.installationMode ?? 'new-route';
  const isFiberChange = installationMode !== 'new-route';
  const installationProgress = route.params.installationProgress;
  const prefetchedRouteFiberData = route.params.routeFiberData;
  const mapRef = useRef<MapView | null>(null);
  const expandedMapRef = useRef<MapView | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const masterYRef = useRef<Record<string, number>>({});
  const locationRequestRef = useRef(0);
  const snapshotIdRef = useRef(
    installationProgress?.id ??
      `${isFiberChange ? 'fiber-change' : 'new-route-sld'}-${
        selected.routeId ?? selected.id
      }-${installationMode}`,
  );
  const snapshotCreatedAtRef = useRef(
    installationProgress?.createdAt ?? Date.now(),
  );
  const latestSnapshotRef = useRef<PausedRouteSnapshot | null>(null);
  const installationCompletedRef = useRef(false);
  const restoredProgressRef = useRef(false);
  const initializedServerStatusRef = useRef('');
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(
    installationProgress?.sldInstallation?.activeIndex ?? 0,
  );
  const [photos, setPhotos] = useState<
    Record<string, {uri: string; type: string; fileName: string}>
  >(installationProgress?.sldInstallation?.photos ?? {});
  const [previewPhoto, setPreviewPhoto] = useState<{
    masterKey: string;
    masterName: string;
    masterIndex: number;
    uri: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [position, setPosition] = useState<Coordinate | null>(
    installationProgress?.currentPosition ??
      route.params.currentPosition ??
      null,
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  // Selecting a saved installation is itself the resume action. Restore its
  // progress, but keep the active master editable so its loop/photo workflow
  // can continue immediately.
  const [paused, setPaused] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapDisplayType, setMapDisplayType] =
    useState<MapDisplayType>('standard');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [connectedFiberMasterId, setConnectedFiberMasterId] = useState<
    string | number | null
  >(null);
  const [loopValues, setLoopValues] = useState<Record<string, string>>(
    installationProgress?.sldInstallation?.loopValues ?? {},
  );
  const [confirmedLoopKeys, setConfirmedLoopKeys] = useState<Set<string>>(
    () =>
      new Set(installationProgress?.sldInstallation?.confirmedLoopKeys ?? []),
  );

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () =>
      setIsKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(hideEvent, () =>
      setIsKeyboardVisible(false),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const scrollMasterAboveKeyboard = useCallback((masterKey: string) => {
    setTimeout(
      () => {
        const rowY = masterYRef.current[masterKey];
        if (Number.isFinite(rowY)) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, rowY - 18),
            animated: true,
          });
        }
      },
      Platform.OS === 'ios' ? 280 : 180,
    );
  }, []);

  const routeId = useMemo(
    () =>
      Number(
        selected?.routeIdInt ??
          selected?.RouteIdInt ??
          selected?.routeId ??
          text(selected?.routeIdStr).replace(/\D/g, ''),
      ) || 0,
    [selected],
  );
  const zoneId = useMemo(
    () =>
      Number(
        installationProgress?.routeDraft?.zoneId ??
          route.params.fiberChangeRoute?.zoneId ??
          route.params.fiberChangeRoute?.ZoneId ??
          selected?.zoneId ??
          selected?.ZoneId,
      ) || 0,
    [installationProgress?.routeDraft?.zoneId, route.params, selected],
  );
  const fallbackMasters = useCallback(
    (): Master[] =>
      [
        {
          key: `from-${selected.id}`,
          id: Number(selected.fromMasterId) || 0,
          routeChamberMappingId: 0,
          sldId: selected.id,
          orderNo: Number(selected.firstOrderNo) || 1,
          name: text(selected.fromMasterName) || 'From Master',
          type: text(selected.fromMasterTypeName) || 'Master',
          address: text(selected.fromAddress),
          coordinate: coordinate(selected.fromLatLng),
          distance: 0,
          loop: 10,
          fiberId: selected.fiberTypeId,
          fiberLabel: fiberLabelFor(selected),
          drumId: selected.drumId ?? '',
          drumNo: text(selected.drumNo),
          drumLength: Number(selected.drumLength) || 0,
          drumRemainingLength: Number(selected.drumRemainingLength) || 0,
          icon: iconFor(text(selected.fromMasterTypeName)),
        },
        {
          key: `to-${selected.id}`,
          id: Number(selected.toMasterId) || 0,
          routeChamberMappingId: 0,
          sldId: selected.id,
          orderNo: Number(selected.lastOrderNo) || 2,
          name: text(selected.toMasterName) || 'To Master',
          type: text(selected.toMasterTypeName) || 'Master',
          address: text(selected.toAddress),
          coordinate: coordinate(selected.toLatLng),
          distance: Number(selected.totalDistance) || 0,
          loop: 10,
          fiberId: selected.fiberTypeId,
          fiberLabel: fiberLabelFor(selected),
          drumId: selected.drumId ?? '',
          drumNo: text(selected.drumNo),
          drumLength: Number(selected.drumLength) || 0,
          drumRemainingLength: Number(selected.drumRemainingLength) || 0,
          icon: iconFor(text(selected.toMasterTypeName)),
        },
      ].filter(
        (item, index, all) =>
          index === 0 ||
          item.id !== all[0].id ||
          item.orderNo !== all[0].orderNo,
      ),
    [selected],
  );

  const loadMasters = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!routeId) {
        throw new Error('This SLD does not contain a valid route ID.');
      }
      const response =
        isFiberChange && Array.isArray(prefetchedRouteFiberData)
          ? prefetchedRouteFiberData
          : await dispatch(
              GetRouteFiberAllDataBySLDIdISPAPI({routeId}),
            ).unwrap();
      const routeMasterResponse = await dispatch(
        GetISPMasterByRouteIdISPAPI({routeId}),
      )
        .unwrap()
        .catch(() => []);
      const routeMasterRecords = routeMasterListFrom(routeMasterResponse);
      const wanted = listFrom(response).filter(
        (item: any) =>
          isFiberChange ||
          !selected.id ||
          String(item?.sldId ?? item?.SLDId) === String(selected.id),
      );
      const source = wanted.length ? wanted : listFrom(response);
      const mapped: Master[] = source.flatMap((fiber: any) =>
        parseDetails(fiber?.masterDetails ?? fiber?.MasterDetails).map(
          (item: any, index: number): Master => {
            const type =
              text(
                item?.masterType ?? item?.MasterType ?? item?.masterTypeName,
              ) || 'Master';
            const orderNo = Number(item?.orderNo ?? item?.OrderNo) || index + 1;
            const itemCode = masterCodeFor(item);
            const itemName = masterNameFor(item);
            const itemType = masterTypeFor(item) || type.toLowerCase();
            const matchedRouteMaster = routeMasterRecords.find(candidate => {
              const candidateId = masterIdFor(candidate);
              if (!candidateId) {
                return false;
              }
              const candidateCode = masterCodeFor(candidate);
              if (itemCode && candidateCode && itemCode === candidateCode) {
                return true;
              }
              const candidateOrderNo = Number(
                candidate?.orderNo ?? candidate?.OrderNo,
              );
              const candidateName = masterNameFor(candidate);
              const candidateType = masterTypeFor(candidate);
              return (
                candidateName === itemName &&
                (!candidateType || candidateType === itemType) &&
                (!Number.isFinite(candidateOrderNo) ||
                  candidateOrderNo === orderNo)
              );
            });
            const boundaryMasterId =
              orderNo === Number(selected.firstOrderNo)
                ? Number(selected.fromMasterId) || 0
                : orderNo === Number(selected.lastOrderNo)
                ? Number(selected.toMasterId) || 0
                : 0;
            const resolvedMasterId =
              masterIdFor(matchedRouteMaster) ||
              masterIdFor(item) ||
              boundaryMasterId;
            return {
              key: `${orderNo}-${type}-${
                resolvedMasterId || itemCode || index
              }`,
              id: resolvedMasterId,
              routeChamberMappingId: routeChamberMappingIdFor(item),
              sldId: fiber?.sldId ?? fiber?.SLDId ?? selected.id,
              orderNo,
              name:
                text(item?.name ?? item?.Name ?? item?.masterName) ||
                `${type} ${index + 1}`,
              type,
              address: text(
                item?.selectedAddress ??
                  item?.SelectedAddress ??
                  item?.address ??
                  item?.Address,
              ),
              coordinate: coordinate(item),
              distance:
                Number(
                  item?.distance ?? item?.Distance ?? item?.totalDistance,
                ) || 0,
              loop:
                Number(
                  item?.loopMeters ?? item?.LoopMeters ?? item?.loopUsed,
                ) || 10,
              fiberId:
                (isFiberChange ? selected.fiberTypeId : undefined) ??
                item?.fiberId ??
                item?.FiberId ??
                fiber?.fiberId ??
                selected.fiberTypeId,
              fiberLabel: isFiberChange
                ? fiberLabelFor(selected)
                : fiberLabelFor(item, fiber),
              drumId:
                (isFiberChange ? selected.drumId : undefined) ??
                item?.drumId ??
                item?.DrumId ??
                fiber?.drumId ??
                fiber?.DrumId ??
                selected.drumId ??
                '',
              drumNo: text(
                (isFiberChange ? selected.drumNo : undefined) ??
                  item?.drumNo ??
                  item?.DrumNo ??
                  fiber?.drumNo ??
                  fiber?.DrumNo ??
                  selected.drumNo,
              ),
              drumLength:
                Number(
                  (isFiberChange ? selected.drumLength : undefined) ??
                    item?.drumLength ??
                    item?.DrumLength ??
                    fiber?.drumLength ??
                    fiber?.DrumLength ??
                    selected.drumLength,
                ) || 0,
              drumRemainingLength:
                Number(
                  (isFiberChange ? selected.drumRemainingLength : undefined) ??
                    item?.drumRemainingLength ??
                    item?.DrumRemainingLength ??
                    fiber?.drumRemainingLength ??
                    fiber?.DrumRemainingLength ??
                    selected.drumRemainingLength,
                ) || 0,
              icon: iconFor(type),
            };
          },
        ),
      );
      const unique = mapped
        .sort((a: Master, b: Master) => a.orderNo - b.orderNo)
        .filter(
          (item: Master, index: number, all: Master[]) =>
            all.findIndex((other: Master) => other.key === item.key) === index,
        );
      // For fiber changes, never synthesize route endpoints. The installer
      // must show only the masters returned by the route-fiber API.
      setMasters(
        unique.length ? unique : isFiberChange ? [] : fallbackMasters(),
      );
      if (isFiberChange && unique.length === 0) {
        setError('No masters were returned for this fiber change.');
      }
    } catch (e: any) {
      const fallback = isFiberChange ? [] : fallbackMasters();
      setMasters(fallback);
      if (!fallback.length) {
        setError(e?.message || 'Unable to load route masters.');
      }
    } finally {
      setLoading(false);
    }
  }, [
    dispatch,
    fallbackMasters,
    isFiberChange,
    prefetchedRouteFiberData,
    routeId,
    selected,
  ]);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);
  useEffect(() => {
    setLoopValues(previous => {
      const next: Record<string, string> = {};
      masters.forEach(master => {
        next[master.key] = previous[master.key] ?? String(master.loop || 10);
      });
      return next;
    });
    setConfirmedLoopKeys(previous => {
      const availableKeys = new Set(masters.map(master => master.key));
      return new Set([...previous].filter(key => availableKeys.has(key)));
    });
    setActiveIndex(previous =>
      masters.length > 0 ? Math.min(previous, masters.length - 1) : 0,
    );
  }, [masters]);

  useEffect(() => {
    if (
      restoredProgressRef.current ||
      !installationProgress?.sldInstallation ||
      masters.length === 0
    ) {
      return;
    }

    restoredProgressRef.current = true;
    const progress = installationProgress.sldInstallation;
    const savedPoints = installationProgress.routePoints ?? [];
    const savedConfirmedKeys = new Set(progress.confirmedLoopKeys ?? []);
    const matchedSavedPointFor = (master: Master, index: number) =>
      savedPoints.find(point => {
        const savedMaster = point?.master ?? point;
        const savedId = Number(point?.masterId ?? savedMaster?.id);
        const savedOrderNo = Number(savedMaster?.orderNo);
        return (
          (master.id > 0 && savedId === master.id) ||
          (master.orderNo > 0 && savedOrderNo === master.orderNo)
        );
      }) ?? savedPoints[index];

    const restoredPhotos: Record<
      string,
      {uri: string; type: string; fileName: string}
    > = {};
    const restoredLoops: Record<string, string> = {};
    const restoredConfirmed = new Set<string>();

    masters.forEach((master, index) => {
      const savedPoint = matchedSavedPointFor(master, index);
      const savedKey = text(savedPoint?.key);
      const savedPhoto =
        progress.photos?.[master.key] ||
        (savedKey ? progress.photos?.[savedKey] : undefined) ||
        (savedPoint?.master?.__fiberChangePhotoUri
          ? {
              uri: savedPoint.master.__fiberChangePhotoUri,
              type: savedPoint.master.__fiberChangePhotoType || 'image/jpeg',
              fileName:
                savedPoint.master.__fiberChangePhotoName ||
                `master-${master.id || index + 1}.jpg`,
            }
          : undefined);
      if (savedPhoto) {
        restoredPhotos[master.key] = savedPhoto;
      }
      const restoredLoop =
        progress.loopValues?.[master.key] ??
        (savedKey ? progress.loopValues?.[savedKey] : undefined) ??
        text(savedPoint?.loopMeters);
      restoredLoops[master.key] = restoredLoop || String(master.loop || 10);
      if (
        savedConfirmedKeys.has(master.key) ||
        (savedKey && savedConfirmedKeys.has(savedKey)) ||
        savedPoint?.isLocked
      ) {
        restoredConfirmed.add(master.key);
      }
    });

    setPhotos(restoredPhotos);
    setLoopValues(restoredLoops);
    setConfirmedLoopKeys(restoredConfirmed);
    const activeMasterIndex = installationProgress.fiberChangeActiveMasterKey
      ? masters.findIndex((master, index) => {
          const savedPoint = matchedSavedPointFor(master, index);
          return (
            master.key === installationProgress.fiberChangeActiveMasterKey ||
            savedPoint?.key === installationProgress.fiberChangeActiveMasterKey
          );
        })
      : -1;
    setActiveIndex(
      Math.min(
        Math.max(
          0,
          activeMasterIndex >= 0
            ? activeMasterIndex
            : progress.activeIndex ?? 0,
        ),
        masters.length - 1,
      ),
    );
    setPaused(false);
  }, [installationProgress, masters]);

  const persistedInstallationSnapshot = useMemo<PausedRouteSnapshot>(() => {
    const fallbackPosition = position ??
      masters[activeIndex]?.coordinate ??
      masters.find(master => master.coordinate)?.coordinate ??
      coordinate(selected.fromLatLng) ??
      coordinate(selected.toLatLng) ?? {latitude: 0, longitude: 0};
    const confirmedKeys = [...confirmedLoopKeys];
    const completedDistance = masters
      .slice(0, Math.min(activeIndex + 1, masters.length))
      .reduce(
        (total, master) =>
          total +
          Math.max(0, master.distance) +
          Math.max(0, Number(loopValues[master.key]) || 0),
        0,
      );
    const fiberChangeMode =
      installationMode === 'fiber-change-partial' ? 'partial' : 'full';

    return {
      id: snapshotIdRef.current,
      routeName:
        text(selected.routeName) ||
        text(route.params.fiberChangeRoute?.routeName) ||
        (isFiberChange ? 'Fiber Change' : 'New Route'),
      routeDraft: {
        routeId,
        routeIdStr: selected.routeIdStr,
        zoneId,
        fiberTypeId: selected.fiberTypeId,
        fiberTypeName: fiberLabelFor(selected),
        drumId: selected.drumId,
        drumNo: selected.drumNo,
        drumLength: selected.drumLength,
        remainingDrumLength: selected.drumRemainingLength,
        ...(isFiberChange ? {fiberChangeMode} : {}),
      },
      currentPosition: fallbackPosition,
      currentAddress:
        route.params.currentAddress ||
        masters[activeIndex]?.address ||
        text(selected.fromAddress),
      routePoints: masters.map(master => ({
        key: master.key,
        master,
        masterId: String(master.id),
        masterType: master.type.toLowerCase(),
        masterTypeLabel: master.type,
        name: master.name,
        address: master.address,
        coordinate: master.coordinate,
        loopMeters: loopValues[master.key] ?? String(master.loop),
        isLocked: confirmedLoopKeys.has(master.key),
        isServerSaved: false,
      })),
      routePath: masters
        .map(master => master.coordinate)
        .filter((value): value is Coordinate => value !== null),
      walkingSegments: [],
      segmentDistance: 0,
      trackingState: paused ? 'paused' : 'idle',
      drumAllocations: selected.drumId
        ? [
            {
              drumId: String(selected.drumId),
              drumNo: text(selected.drumNo),
              availableLength:
                Number(selected.drumRemainingLength) ||
                Number(selected.drumLength) ||
                0,
              fiberTypeId: String(selected.fiberTypeId ?? ''),
              fiberTypeName: fiberLabelFor(selected),
            },
          ]
        : [],
      totalDistance: completedDistance,
      status: paused ? 'paused' : 'unsaved',
      createdAt: snapshotCreatedAtRef.current,
      updatedAt: Date.now(),
      workflowType: isFiberChange ? 'fiberChange' : 'newRoute',
      resumeTarget: 'installFiberWithSld',
      ...(isFiberChange
        ? {
            fiberChangeMode,
            fiberChangeRoute: route.params.fiberChangeRoute,
            fiberChangeSelectedFibers:
              route.params.fiberChangeSelectedFibers ?? [],
            fiberChangeActiveMasterKey: masters[activeIndex]?.key,
          }
        : {}),
      sldInstallation: {
        selectedSld: selected,
        installationMode: !isFiberChange
          ? 'new-route'
          : installationMode === 'fiber-change-partial'
          ? 'fiber-change-partial'
          : 'fiber-change-full',
        routeFiberData: prefetchedRouteFiberData,
        activeIndex,
        photos,
        loopValues,
        confirmedLoopKeys: confirmedKeys,
      },
    };
  }, [
    activeIndex,
    confirmedLoopKeys,
    installationMode,
    isFiberChange,
    loopValues,
    masters,
    paused,
    photos,
    position,
    prefetchedRouteFiberData,
    route.params.currentAddress,
    route.params.fiberChangeRoute,
    route.params.fiberChangeSelectedFibers,
    routeId,
    selected,
    zoneId,
  ]);
  latestSnapshotRef.current = persistedInstallationSnapshot;

  useEffect(() => {
    if (loading || masters.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      savePausedRouteSnapshot(persistedInstallationSnapshot);
    }, 150);
    return () => clearTimeout(timer);
  }, [loading, masters.length, persistedInstallationSnapshot]);

  useEffect(
    () => () => {
      if (!installationCompletedRef.current && latestSnapshotRef.current) {
        savePausedRouteSnapshot(latestSnapshotRef.current);
      }
    },
    [],
  );
  const nearestIndex = useMemo(() => {
    if (!position || !masters.length) {
      return -1;
    }
    let result = -1;
    let best = Infinity;
    masters.forEach((master, index) => {
      if (master.coordinate) {
        const value = distanceBetween(position, master.coordinate);
        if (value < best) {
          best = value;
          result = index;
        }
      }
    });
    return result;
  }, [masters, position]);
  const visibleMapMasters = useMemo(
    () =>
      masters.filter(
        (master, index): master is Master & {coordinate: Coordinate} =>
          master.coordinate !== null && index <= activeIndex,
      ),
    [activeIndex, masters],
  );
  const visibleMapCoordinates = useMemo(
    () => visibleMapMasters.map(master => master.coordinate),
    [visibleMapMasters],
  );

  useEffect(() => {
    if (!position || nearestIndex < 0) {
      return;
    }
    const nearestMaster = masters[nearestIndex];
    const timer = setTimeout(() => {
      const rowY = masterYRef.current[nearestMaster.key];
      if (Number.isFinite(rowY)) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, rowY - 90),
          animated: true,
        });
      }
      [mapRef.current, expandedMapRef.current].forEach(map =>
        map?.animateToRegion(
          {
            latitude: position.latitude,
            longitude: position.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          },
          450,
        ),
      );
    }, 220);
    return () => clearTimeout(timer);
  }, [masters, nearestIndex, position]);

  const whereAmI = async () => {
    if (locating) {
      return;
    }
    const requestId = locationRequestRef.current + 1;
    locationRequestRef.current = requestId;
    setLocating(true);
    try {
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
          'Enable location access in Settings.',
          [
            {text: 'Cancel'},
            {
              text: 'Settings',
              onPress: () => openSettings().catch(() => Linking.openSettings()),
            },
          ],
        );
        return;
      }
      if (status !== RESULTS.GRANTED && status !== RESULTS.LIMITED) {
        return;
      }
      if (Platform.OS === 'android' && !(await Location.checkGps())) {
        throw new Error('Location services are disabled.');
      }

      let hasPosition = false;
      let bestAccuracy = Number.POSITIVE_INFINITY;
      await new Promise<void>((resolve, reject) => {
        let failures = 0;
        const handleFailure = (locationError: unknown) => {
          failures += 1;
          if (failures === 2 && !hasPosition) {
            reject(locationError);
          }
        };
        const showPosition = (fix: LocationFix) => {
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
          setPosition({latitude: fix.latitude, longitude: fix.longitude});
          if (isFirst) {
            const nearestMaster = masters.reduce<
              {master: Master; distance: number} | undefined
            >((nearest, master) => {
              if (!master.coordinate) {
                return nearest;
              }
              const masterDistance = distanceBetween(fix, master.coordinate);
              return !nearest || masterDistance < nearest.distance
                ? {master, distance: masterDistance}
                : nearest;
            }, undefined);
            if (nearestMaster) {
              Common.showToast(
                `You are near ${nearestMaster.master.type} - ${nearestMaster.master.name}`,
              );
            }
            resolve();
          }
        };

        requestPosition({
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000,
        }).then(showPosition, handleFailure);
        requestPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }).then(showPosition, handleFailure);
      });
    } catch (e: any) {
      if (position) {
        Common.showToast('Using the last available location.');
        setPosition({...position});
      } else {
        Common.showToast(
          e?.message || 'Unable to get current location. Check GPS and retry.',
        );
      }
    } finally {
      if (locationRequestRef.current === requestId) {
        setLocating(false);
      }
    }
  };

  const openCamera = async (master: Master, index: number) => {
    if (paused || processing || index !== activeIndex) {
      return;
    }
    if (!confirmedLoopKeys.has(master.key)) {
      const loop = Number(loopValues[master.key]);
      if (!Number.isFinite(loop) || loop < 0) {
        Common.showToast('Enter a valid loop length before capturing a photo.');
        return;
      }
      setConfirmedLoopKeys(previous => new Set(previous).add(master.key));
    }
    const permission =
      Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.CAMERA
        : PERMISSIONS.IOS.CAMERA;
    let status = await check(permission);
    if (status === RESULTS.DENIED) {
      status = await request(permission);
    }
    if (status !== RESULTS.GRANTED) {
      if (status === RESULTS.BLOCKED) {
        Alert.alert(
          'Camera Permission Blocked',
          'Enable camera access from App Settings to capture this master.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => openSettings().catch(() => Linking.openSettings()),
            },
          ],
        );
      } else {
        Common.showToast('Camera permission is required.');
      }
      return;
    }

    const options: CameraOptions = {
      mediaType: 'photo',
      cameraType: 'back',
      quality: 0.4,
      maxWidth: 800,
      maxHeight: 800,
      includeBase64: false,
      saveToPhotos: false,
    };

    setProcessing(true);
    launchCamera(options, async (response: ImagePickerResponse) => {
      try {
        if (response.didCancel) {
          return;
        }
        if (response.errorCode) {
          Common.showToast(
            response.errorMessage ||
              (response.errorCode === 'camera_unavailable'
                ? 'Camera is unavailable on this device.'
                : 'Unable to capture photo. Please retry.'),
          );
          return;
        }

        const asset = response.assets?.[0];
        if (!asset?.uri) {
          Common.showToast('Camera did not return a photo. Please retry.');
          return;
        }

        const watermarkedUri = await ImageWatermark.applyLocationWatermark(
          asset.uri,
          master.coordinate
            ? {
                latitude: master.coordinate.latitude,
                longitude: master.coordinate.longitude,
                address: master.address,
              }
            : undefined,
          {width: asset.width, height: asset.height},
        );
        setPhotos(previous => ({
          ...previous,
          [master.key]: {
            uri: watermarkedUri,
            type: asset.type || 'image/jpeg',
            fileName:
              asset.fileName ||
              `sld-master-${master.id || master.orderNo}-${Date.now()}.jpg`,
          },
        }));
      } catch (watermarkError: any) {
        Common.error('Unable to process SLD master image:', watermarkError);
        Common.showToast(
          watermarkError?.message ||
            'Unable to process the photo. Please retry.',
        );
      } finally {
        setProcessing(false);
      }
    });
  };
  const removePhoto = (masterKey: string, index: number) => {
    if (paused || processing || saving) {
      return;
    }
    setPhotos(previous => {
      const next = {...previous};
      delete next[masterKey];
      return next;
    });
    setActiveIndex(index);
  };
  const updateLoopValue = (masterKey: string, value: string) => {
    setLoopValues(previous => ({
      ...previous,
      [masterKey]: value.replace(/[^0-9.]/g, ''),
    }));
    setConfirmedLoopKeys(previous => {
      const next = new Set(previous);
      next.delete(masterKey);
      return next;
    });
  };
  const confirmLoop = (master: Master, index: number) => {
    if (paused || index !== activeIndex) {
      return;
    }
    const loop = Number(loopValues[master.key]);
    if (!Number.isFinite(loop) || loop < 0) {
      Common.showToast('Enter a valid loop length.');
      return;
    }
    setConfirmedLoopKeys(previous => new Set(previous).add(master.key));
    Common.showToast(`Loop confirmed: ${loop}m`);
  };
  const nextMaster = () => {
    if (paused) {
      Common.showToast('Resume the installation before continuing.');
      return;
    }
    const current = masters[activeIndex];
    if (!current || !confirmedLoopKeys.has(current.key)) {
      Common.showToast('Confirm this master loop length first.');
      return;
    }
    if (!photos[current.key]) {
      Common.showToast('Capture this master image first.');
      return;
    }
    if (activeIndex < masters.length - 1) {
      setActiveIndex(value => value + 1);
    } else {
      Common.showToast('All masters are captured. Tap End to submit.');
    }
  };

  const buildInstallations = useCallback(
    (capturedOnly: boolean) =>
      masters.flatMap((master, index) => {
        const imageFile = photos[master.key];
        if (capturedOnly && !imageFile) {
          return [];
        }

        const completedDistance = masters
          .slice(0, index + 1)
          .reduce((total, item) => total + Math.max(0, item.distance), 0);
        const completedLoops = masters
          .slice(0, index + 1)
          .reduce(
            (total, item) =>
              total + Math.max(0, Number(loopValues[item.key]) || 0),
            0,
          );
        const drumLength =
          master.drumLength || Number(selected.drumLength) || 0;

        if (!imageFile) {
          return [];
        }

        return [
          {
            sldId: master.sldId || selected.id,
            fiberId: master.fiberId || selected.fiberTypeId,
            drumLength,
            drumRemainingLength: drumLength
              ? Math.max(0, drumLength - completedDistance - completedLoops)
              : master.drumRemainingLength,
            masterType: master.type,
            orderNo: master.orderNo,
            loopUsed: Number(loopValues[master.key]) || 0,
            imageFile,
          },
        ];
      }),
    [loopValues, masters, photos, selected],
  );

  const saveInstallationStatus = useCallback(
    async (status: 'unsave' | 'pause' | 'completed', capturedOnly: boolean) => {
      if (!routeId) {
        throw new Error('Route ID is unavailable.');
      }
      return dispatch(
        installFiberBySLDTempAPI({
          routeId,
          status,
          zoneId,
          installations: buildInstallations(capturedOnly),
        }),
      ).unwrap();
    },
    [buildInstallations, dispatch, routeId, zoneId],
  );

  useEffect(() => {
    if (
      loading ||
      !routeId ||
      masters.length === 0 ||
      Object.keys(photos).length === 0
    ) {
      return;
    }
    const statusKey = `${snapshotIdRef.current}:${routeId}`;
    if (initializedServerStatusRef.current === statusKey) {
      return;
    }
    initializedServerStatusRef.current = statusKey;
    saveInstallationStatus('unsave', true).catch(() => {
      initializedServerStatusRef.current = '';
    });
  }, [loading, masters.length, photos, routeId, saveInstallationStatus]);

  const finish = async () => {
    if (paused) {
      Common.showToast('Resume the installation before ending.');
      return;
    }
    if (!routeId || masters.length === 0) {
      Common.showToast('SLD route masters are unavailable.');
      return;
    }
    if (masters.some(master => !photos[master.key])) {
      Common.showToast('Capture every master image before ending.');
      return;
    }
    if (masters.some(master => !confirmedLoopKeys.has(master.key))) {
      Common.showToast('Confirm the loop length for every master.');
      return;
    }
    setSaving(true);
    try {
      await saveInstallationStatus('completed', false);

      installationCompletedRef.current = true;
      removeCompletedRouteSnapshot(snapshotIdRef.current);

      if (isFiberChange) {
        Common.showToast('Fiber change completed successfully');
        navigation.replace('Fiber-Change', {
          selectedRoute: route.params.fiberChangeRoute as any,
          selectedFibers: route.params.fiberChangeSelectedFibers ?? [],
          installationScope:
            installationMode === 'fiber-change-partial' ? 'partial' : 'full',
        });
      } else {
        Alert.alert(
          'Fiber Installed',
          'All SLD master images were submitted successfully.',
          [{text: 'OK', onPress: () => navigation.popTo('Route-Master-Hub')}],
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Unable to finish',
        e?.message || 'The SLD installation could not be submitted.',
      );
    } finally {
      setSaving(false);
    }
  };
  const togglePaused = async () => {
    const nextPaused = !paused;
    setSaving(true);
    const statusSnapshot: PausedRouteSnapshot = {
      ...persistedInstallationSnapshot,
      trackingState: nextPaused ? 'paused' : 'idle',
      status: nextPaused ? 'paused' : 'unsaved',
      updatedAt: Date.now(),
    };
    setPaused(nextPaused);
    savePausedRouteSnapshot(statusSnapshot);
    latestSnapshotRef.current = statusSnapshot;
    try {
      if (Object.keys(photos).length > 0) {
        await saveInstallationStatus(nextPaused ? 'pause' : 'unsave', true);
      }
      Common.showToast(
        nextPaused
          ? `${
              isFiberChange ? 'Fiber change' : 'New SLD route'
            } saved to paused routes.`
          : `${isFiberChange ? 'Fiber change' : 'New SLD route'} resumed.`,
      );
    } catch (statusError: any) {
      console.warn(
        '[InstallFiberWithSLD] Route paused locally; server status sync will retry after an image is captured.',
        statusError?.message,
      );
      Common.showToast(
        nextPaused
          ? 'Route saved to paused routes.'
          : 'Route resumed. Server status will sync after image capture.',
      );
    } finally {
      setSaving(false);
    }
  };

  const activeMaster = masters[activeIndex];
  const previewPhotos = useMemo(
    () =>
      masters.flatMap((master, masterIndex) => {
        const photo = photos[master.key];
        return photo
          ? [
              {
                masterKey: master.key,
                masterName: master.name,
                masterIndex,
                uri: photo.uri,
              },
            ]
          : [];
      }),
    [masters, photos],
  );
  const previewPhotoIndex = previewPhoto
    ? Math.max(
        0,
        previewPhotos.findIndex(
          photo => photo.masterKey === previewPhoto.masterKey,
        ),
      )
    : 0;
  const canGoNext = Boolean(
    activeMaster &&
      confirmedLoopKeys.has(activeMaster.key) &&
      photos[activeMaster.key],
  );
  const allMastersComplete =
    masters.length > 0 &&
    masters.every(
      master =>
        confirmedLoopKeys.has(master.key) && Boolean(photos[master.key]),
    );
  const routeCoordinate =
    visibleMapMasters[visibleMapMasters.length - 1]?.coordinate ??
    masters[0]?.coordinate ??
    coordinate(selected.fromLatLng) ??
    coordinate(selected.toLatLng) ??
    position;
  const initialRegion = routeCoordinate
    ? {...routeCoordinate, latitudeDelta: 0.012, longitudeDelta: 0.012}
    : undefined;
  const fitExpandedMap = () => {
    if (visibleMapCoordinates.length > 1) {
      expandedMapRef.current?.fitToCoordinates(visibleMapCoordinates, {
        animated: false,
        edgePadding: {top: 100, right: 60, bottom: 100, left: 60},
      });
    } else if (routeCoordinate) {
      expandedMapRef.current?.animateToRegion(
        {...routeCoordinate, latitudeDelta: 0.008, longitudeDelta: 0.008},
        0,
      );
    }
  };

  const changeMapDisplayType = (type: MapDisplayType) => {
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

  useEffect(() => {
    const timer = setTimeout(() => {
      [mapRef.current, expandedMapRef.current].forEach(map => {
        if (visibleMapCoordinates.length > 1) {
          map?.fitToCoordinates(visibleMapCoordinates, {
            animated: true,
            edgePadding: {top: 65, right: 50, bottom: 65, left: 50},
          });
        } else if (routeCoordinate) {
          map?.animateToRegion(
            {...routeCoordinate, latitudeDelta: 0.008, longitudeDelta: 0.008},
            350,
          );
        }
      });
    }, 180);

    return () => clearTimeout(timer);
  }, [activeIndex, routeCoordinate, visibleMapCoordinates]);

  const openConnectedFiberDetails = (master: Master) => {
    if (master.id > 0) {
      setConnectedFiberMasterId(master.id);
      return;
    }
    Common.showToast(
      `Master ID is unavailable for ${master.type} - ${master.name}.`,
    );
  };

  const handleSldMapPress = (event: any) => {
    const pressedCoordinate = event?.nativeEvent?.coordinate as
      | Coordinate
      | undefined;
    if (!pressedCoordinate || visibleMapMasters.length === 0) {
      return;
    }
    const nearestMaster = visibleMapMasters.reduce<{
      master: Master;
      distance: number;
    } | null>((nearest, master) => {
      const distance = distanceBetween(pressedCoordinate, master.coordinate);
      return !nearest || distance < nearest.distance
        ? {master, distance}
        : nearest;
    }, null);
    if (nearestMaster && nearestMaster.distance <= 40) {
      openConnectedFiberDetails(nearestMaster.master);
    }
  };

  const renderSldMap = (
    reference: React.RefObject<MapView>,
    expanded = false,
  ) =>
    initialRegion ? (
      <MapView
        ref={reference}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType={mapDisplayType === 'satellite' ? 'satellite' : 'standard'}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={Boolean(position)}
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
        onPress={handleSldMapPress}
        onMapReady={expanded ? fitExpandedMap : undefined}>
        {visibleMapMasters.map(master => {
          const isCurrent = master.key === activeMaster?.key;
          return (
            <Marker
              key={`map-master-${master.key}-${isCurrent ? 'current' : 'done'}`}
              coordinate={master.coordinate}
              accessibilityLabel={`${master.type} - ${master.name}. Tap to view connected fibers.`}
              anchor={{x: 0.5, y: 0.5}}
              zIndex={isCurrent ? 20 : 10}
              onPress={() => openConnectedFiberDetails(master)}
              tracksViewChanges>
              <Image
                fadeDuration={0}
                source={master.icon}
                style={[
                  styles.mapMasterMarkerIcon,
                  isCurrent && styles.mapMasterMarkerIconActive,
                ]}
              />
            </Marker>
          );
        })}
        {visibleMapCoordinates.length > 1 ? (
          <Polyline
            coordinates={visibleMapCoordinates}
            strokeColor="#7444E5"
            strokeWidth={4}
          />
        ) : null}
      </MapView>
    ) : (
      <View style={styles.mapLoading}>
        <Text style={styles.stateText}>Route map is unavailable</Text>
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
          title={
            isFiberChange
              ? 'Fiber Change Installation'
              : 'Install Fiber With SLD'
          }
          onBackPress={() => navigation.goBack()}
          showGps={false}
        />
        <View style={styles.mapContainer}>
          {renderSldMap(mapRef)}
          <TouchableOpacity
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Expand SLD route map"
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
        <View style={styles.routeInfoCard}>
          <View style={styles.routeInfoTitleRow}>
            <Text numberOfLines={1} style={styles.routeInfoName}>
              {text(selected.routeName) || 'Unnamed Route'}
            </Text>
            <Text numberOfLines={1} style={styles.routeInfoId}>
              {text(selected.routeIdStr) ||
                (selected.id ? `SLD#${selected.id}` : `Route #${routeId}`)}
            </Text>
            <View
              style={[
                styles.routeStatus,
                selected.isActive === false && styles.routeStatusInactive,
              ]}>
              <Text style={styles.routeStatusText}>
                {selected.isActive === false ? 'Inactive' : 'Active'}
              </Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.routeAddress}>
            From: {text(selected.fromAddress) || '--'}
          </Text>
          <Text numberOfLines={2} style={styles.routeAddress}>
            To: {text(selected.toAddress) || '--'}
          </Text>
          <View style={styles.routeInfoFooter}>
            <Text style={styles.routeMeta}>
              Total Dist:{' '}
              <Text style={styles.routeMetaValue}>
                {Math.round(Number(selected.totalDistance) || 0)}m
              </Text>
            </Text>
            <Text style={styles.routeMeta}>
              Drum no.{' '}
              <Text style={styles.routeMetaValue}>
                {text(selected.drumNo) || '--'}
              </Text>
            </Text>
            <Text style={styles.routeFiberMeta}>
              Fiber Type:{' '}
              <Text style={styles.routeMetaValue}>
                {fiberLabelFor(selected)}
              </Text>
            </Text>
          </View>
        </View>
        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#7546E7" />
              <Text style={styles.stateText}>Loading SLD masters...</Text>
            </View>
          ) : error ? (
            <View style={styles.loading}>
              <Text style={styles.stateText}>{error}</Text>
              <Text onPress={loadMasters} style={styles.retry}>
                Retry
              </Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {masters.map((master, index) => {
                const enabled = index === activeIndex;
                const photo = photos[master.key];
                const loopConfirmed = confirmedLoopKeys.has(master.key);
                const rowNextMaster = masters[index + 1];
                return (
                  <View
                    key={master.key}
                    onLayout={event => {
                      masterYRef.current[master.key] =
                        event.nativeEvent.layout.y;
                    }}
                    style={styles.rowWrap}>
                    {index === nearestIndex ? (
                      <View style={styles.pointer}>
                        <PointerSvg width={25} height={25} />
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.row,
                        (!enabled || paused) && !photo && styles.rowDisabled,
                        index === nearestIndex && styles.currentRow,
                      ]}>
                      <View style={styles.iconShell}>
                        <Image source={master.icon} style={styles.masterIcon} />
                      </View>
                      <View style={styles.copy}>
                        <Text numberOfLines={1} style={styles.title}>
                          <Text style={styles.type}>{master.type}</Text> •{' '}
                          {master.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.address}>
                          {master.address}
                        </Text>
                      </View>
                      <View style={styles.loopArea}>
                        <Text style={styles.loopLabel}>Loop:</Text>
                        <View
                          style={[
                            styles.loopInputShell,
                            loopConfirmed && styles.loopInputConfirmed,
                          ]}>
                          <TextInput
                            value={loopValues[master.key] ?? ''}
                            onChangeText={value =>
                              updateLoopValue(master.key, value)
                            }
                            editable={enabled && !paused && !loopConfirmed}
                            keyboardType="decimal-pad"
                            maxLength={6}
                            onFocus={() =>
                              scrollMasterAboveKeyboard(master.key)
                            }
                            selectTextOnFocus
                            style={styles.loopInput}
                          />
                          <Text style={styles.loopUnit}>m</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.78}
                          disabled={!enabled || paused || loopConfirmed}
                          onPress={() => confirmLoop(master, index)}
                          style={[
                            styles.loopConfirmButton,
                            loopConfirmed && styles.loopConfirmButtonDone,
                          ]}>
                          <Text
                            style={[
                              styles.loopConfirmText,
                              loopConfirmed && styles.loopConfirmTextDone,
                            ]}>
                            {loopConfirmed ? '✓' : 'OK'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.cameraWrap}>
                        <TouchableOpacity
                          disabled={
                            !photo && (!enabled || paused || processing)
                          }
                          onPress={() => {
                            if (photo) {
                              setPreviewPhoto({
                                masterKey: master.key,
                                masterName: master.name,
                                masterIndex: index,
                                uri: photo.uri,
                              });
                              return;
                            }
                            openCamera(master, index);
                          }}
                          style={[
                            styles.camera,
                            !photo &&
                              (processing || !enabled || paused) &&
                              styles.cameraDisabled,
                          ]}>
                          {photo ? (
                            <Image
                              source={{uri: photo.uri}}
                              style={styles.capturedImage}
                            />
                          ) : (
                            <Image
                              source={IMAGES.camera}
                              style={styles.cameraImage}
                            />
                          )}
                        </TouchableOpacity>
                        {photo ? (
                          <TouchableOpacity
                            accessibilityLabel={`Delete photo for ${master.name}`}
                            disabled={paused || processing || saving}
                            hitSlop={{top: 8, right: 8, bottom: 8, left: 8}}
                            onPress={() => removePhoto(master.key, index)}
                            style={styles.removePhotoButton}>
                            <Text style={styles.removePhotoText}>×</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.masterDetailsRow,
                        (!enabled || paused) && !photo && styles.rowDisabled,
                      ]}>
                      <Text numberOfLines={1} style={styles.masterDetailText}>
                        Total Dist:{' '}
                        <Text style={styles.metaValue}>
                          {Math.round(
                            master.distance ||
                              Number(selected.totalDistance) ||
                              0,
                          )}
                          m
                        </Text>
                      </Text>
                      <Text
                        style={[
                          styles.masterDetailText,
                          styles.masterFiberDetailText,
                        ]}>
                        Fiber Type:{' '}
                        <Text style={styles.metaValue}>
                          {master.fiberLabel}
                        </Text>
                      </Text>
                    </View>
                    {rowNextMaster ? (
                      <View style={styles.distance}>
                        <Text style={styles.distanceText}>
                          ↕{' '}
                          {Math.round(
                            rowNextMaster.distance ||
                              (master.coordinate && rowNextMaster.coordinate
                                ? distanceBetween(
                                    master.coordinate,
                                    rowNextMaster.coordinate,
                                  )
                                : 0),
                          )}{' '}
                          meters
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
        {!isKeyboardVisible ? (
          <View style={styles.footer}>
            <TouchableOpacity
              disabled={locating}
              onPress={whereAmI}
              style={[styles.footerButton, styles.whereButton]}>
              <Text style={styles.buttonText}>
                {locating ? 'Locating...' : 'Where I am?'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={saving || paused || loading || !canGoNext}
              onPress={nextMaster}
              style={[
                styles.footerButton,
                styles.nextButton,
                (paused || loading || !canGoNext) && styles.buttonDisabled,
              ]}>
              <Text style={styles.buttonText}>Next Master</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={saving}
              onPress={togglePaused}
              style={[styles.footerButton, styles.pauseButton]}>
              <Text style={styles.buttonText}>
                {paused ? 'Resume' : 'Pause'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={saving || paused || loading || !allMastersComplete}
              onPress={finish}
              style={[
                styles.footerButton,
                styles.endButton,
                (saving || paused || loading || !allMastersComplete) &&
                  styles.buttonDisabled,
              ]}>
              {saving ? (
                <ActivityIndicator color={COLORS.WHITE} />
              ) : (
                <Text style={styles.buttonText}>End</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
        <FullscreenImageViewer
          visible={Boolean(previewPhoto)}
          images={previewPhotos.map(photo => photo.uri)}
          index={previewPhotoIndex}
          title={previewPhoto?.masterName || 'Captured Master Image'}
          onIndexChange={index => setPreviewPhoto(previewPhotos[index] ?? null)}
          onClose={() => setPreviewPhoto(null)}
        />
        <Modal
          visible={isMapExpanded}
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setIsMapExpanded(false)}>
          <View style={styles.expandedMapContainer}>
            {renderSldMap(expandedMapRef, true)}
            <ConnectedFiberDetailsModal
              masterId={isMapExpanded ? connectedFiberMasterId : null}
              expanded
              onClose={() => setConnectedFiberMasterId(null)}
            />
            <View style={styles.expandedMapHeader} pointerEvents="box-none">
              <View style={styles.expandedMapTitlePill}>
                <Text numberOfLines={1} style={styles.expandedMapTitle}>
                  {text(selected.routeName) || 'SLD Route Map'}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Close fullscreen SLD map"
                onPress={() => setIsMapExpanded(false)}
                style={styles.expandedMapCloseButton}>
                <Text style={styles.expandedMapCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.expandedMapTypeControl}>
              {MAP_DISPLAY_OPTIONS.map(({type, label}) => {
                const isSelected = mapDisplayType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${label.toLowerCase()} map`}
                    accessibilityState={{selected: isSelected}}
                    onPress={() => changeMapDisplayType(type)}
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
      </View>
    </Screen>
  );
};

export default InstallFiberWithSLDScreen;
