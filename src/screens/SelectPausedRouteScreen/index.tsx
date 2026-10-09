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
  Linking,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Geolocation from '@react-native-community/geolocation';
import {useDispatch} from 'react-redux';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';
import LinearGradient from 'react-native-linear-gradient';
import type {RootStackParamList} from '@navigation/navigator';
import {BackHeader} from '@molecules';
import {Screen} from '@organisms';
import {COLORS, IMAGES, SIZE} from '@res';
import {StoreDispatch} from '@reducers';
import {GetISPMasterByRouteIdISPAPI} from '@slices/route.slice';
import {
  getPausedRouteSnapshots,
  getPausedRouteSnapshotsWithBackup,
  PausedRouteCoordinate,
  PausedRouteSnapshot,
} from '../../services/pausedRouteStorage';
import {getReplacementFiberLabel} from '../../services/routeFiberChangeStorage';
import {Location} from '@utils';
import PointerSvg from '../../res/images/pointer.svg';
import GoogleMapsIconSvg from '../../res/images/Google_Maps_icon.svg';
import styles from './styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Select-Paused-Route'>;

type RouteTab = 'newRoutes' | 'fiberChangeRoutes';

type PausedRouteListRow = {
  key: string;
  route: PausedRouteSnapshot;
  isNearest?: boolean;
};

type CurrentPositionFix = PausedRouteCoordinate & {
  accuracy: number;
};

const asText = (value: unknown) => String(value ?? '').trim();

const listFromResponse = (response: any): any[] => {
  if (Array.isArray(response)) {
    return response;
  }
  const candidates = [
    response?.data?.data,
    response?.data?.items,
    response?.data?.masters,
    response?.data?.routeMasters,
    response?.data?.masterDetails,
    response?.data,
    response?.items,
    response?.masters,
    response?.routeMasters,
    response?.masterDetails,
    response?.records,
    ...Object.values(
      response?.data && typeof response.data === 'object' ? response.data : {},
    ),
    ...Object.values(response && typeof response === 'object' ? response : {}),
  ];
  const lists = candidates.filter(Array.isArray) as any[][];
  if (lists.length > 0) {
    const seen = new Set<any>();
    return lists.flatMap(list =>
      list.filter(item => {
        if (seen.has(item)) {
          return false;
        }
        seen.add(item);
        return true;
      }),
    );
  }
  return response && typeof response === 'object' ? [response] : [];
};

const serverMasterStatus = (master: any) =>
  asText(
    master?.status ??
      master?.Status ??
      master?.masterStatus ??
      master?.MasterStatus ??
      master?.mappingStatus ??
      master?.MappingStatus ??
      master?.routeMasterStatus ??
      master?.RouteMasterStatus ??
      master?.routeStatus ??
      master?.RouteStatus ??
      master?.statusName ??
      master?.StatusName,
  )
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const isResumableServerStatus = (status: string) =>
  status === 'pause' ||
  status === 'paused' ||
  status === 'unsave' ||
  status === 'unsaved';

const isFiberChangeSnapshot = (route: PausedRouteSnapshot) =>
  route.workflowType === 'fiberChange' ||
  Boolean(route.fiberChangeMode ?? route.routeDraft?.fiberChangeMode) ||
  route.sldInstallation?.installationMode === 'fiber-change-full' ||
  route.sldInstallation?.installationMode === 'fiber-change-partial';

const numericRouteId = (value: unknown) => {
  const directId = Number(value);
  if (Number.isInteger(directId) && directId > 0) {
    return directId;
  }

  const matchedId = asText(value).match(/\d+/)?.[0];
  const parsedId = Number(matchedId);
  return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : 0;
};

const getSnapshotRouteId = (snapshot: PausedRouteSnapshot) => {
  const candidates = [
    snapshot.routeDraft?.routeIdInt ?? snapshot.routeDraft?.RouteIdInt,
    snapshot.fiberChangeRoute?.routeIdInt ??
      snapshot.fiberChangeRoute?.RouteIdInt,
    snapshot.sldInstallation?.selectedSld?.routeIdInt ??
      snapshot.sldInstallation?.selectedSld?.RouteIdInt,
    snapshot.routeDraft?.routeId ?? snapshot.routeDraft?.RouteId,
    snapshot.fiberChangeRoute?.routeId ?? snapshot.fiberChangeRoute?.RouteId,
    snapshot.sldInstallation?.selectedSld?.routeId ??
      snapshot.sldInstallation?.selectedSld?.RouteId,
  ];

  return candidates.map(numericRouteId).find(Boolean) ?? 0;
};

const fiberChangeModeLabel = (route: PausedRouteSnapshot) => {
  const mode =
    route.fiberChangeMode ??
    route.routeDraft?.fiberChangeMode ??
    (route.sldInstallation?.installationMode === 'fiber-change-partial'
      ? 'partial'
      : route.sldInstallation?.installationMode === 'fiber-change-full'
      ? 'full'
      : 'withoutSld');
  if (mode === 'full') {
    return 'Full Route';
  }
  if (mode === 'partial') {
    return 'Partial Route';
  }
  return 'Without SLD';
};

const fiberTypeLabel = (route: PausedRouteSnapshot) => {
  const selectedFiber = (route.fiberChangeSelectedFibers ?? []).slice(-1)[0];
  const selectedFiberLabel = getReplacementFiberLabel(
    selectedFiber?.fiberLabel,
    selectedFiber?.fiberTypeName,
    selectedFiber?.fiberTypeLabel,
    selectedFiber?.FiberName,
    selectedFiber?.name,
  );

  if (selectedFiberLabel) {
    return selectedFiberLabel;
  }

  return (
    getReplacementFiberLabel(
      route.routeDraft?.fiberTypeName,
      route.routeDraft?.fiberTypeLabel,
      route.routeDraft?.fiberType,
      route.routeDraft?.fibreSpecification,
      route.drumAllocations?.slice(-1)[0]?.fiberTypeName,
    ) || '--'
  );
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceBetween = (
  from: PausedRouteCoordinate,
  to: PausedRouteCoordinate,
) => {
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

const statusLabel = (route: PausedRouteSnapshot) => {
  if (route.status === 'unsaved') {
    return 'Unsaved';
  }
  if (route.status === 'stopped') {
    return 'Stopped';
  }
  return 'Paused';
};

const getCurrentPosition = ({
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
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number(position.coords.accuracy) || Number.MAX_VALUE,
        });
      },
      reject,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      },
    );
  });

const isValidPosition = (position: PausedRouteCoordinate) =>
  Number.isFinite(Number(position?.latitude)) &&
  Number.isFinite(Number(position?.longitude)) &&
  Math.abs(Number(position.latitude)) <= 90 &&
  Math.abs(Number(position.longitude)) <= 180;

const parseSnapshotCoordinate = (
  value: unknown,
): PausedRouteCoordinate | null => {
  if (value && typeof value === 'object') {
    const position = value as PausedRouteCoordinate;
    if (isValidPosition(position)) {
      return {
        latitude: Number(position.latitude),
        longitude: Number(position.longitude),
      };
    }
  }

  const parts = asText(value)
    .split(',')
    .map(part => Number.parseFloat(part.trim()));
  const position = {latitude: parts[0], longitude: parts[1]};
  return parts.length >= 2 && isValidPosition(position) ? position : null;
};

const getSnapshotPosition = (
  route: PausedRouteSnapshot,
): PausedRouteCoordinate | null => {
  const routePoints = Array.isArray(route.routePoints) ? route.routePoints : [];
  const firstPoint = routePoints[0];
  const lastPoint = routePoints[routePoints.length - 1];
  const candidates = [
    lastPoint?.coordinate,
    lastPoint?.master?.coordinate,
    route.routeDraft?.toLatLng,
    route.routeDraft?.endLatLng,
    route.fiberChangeRoute?.toLatLng,
    route.fiberChangeRoute?.endLatLng,
    route.sldInstallation?.selectedSld?.toLatLng,
    route.currentPosition,
    firstPoint?.coordinate,
    firstPoint?.master?.coordinate,
  ];
  return candidates.map(parseSnapshotCoordinate).find(Boolean) ?? null;
};

const sanitizeSnapshotForResume = (
  snapshot: PausedRouteSnapshot,
): PausedRouteSnapshot => {
  const safeCurrentPosition = getSnapshotPosition(snapshot) ?? {
    latitude: 0,
    longitude: 0,
  };
  const routePoints = (
    Array.isArray(snapshot.routePoints) ? snapshot.routePoints : []
  )
    .filter(point => point && typeof point === 'object')
    .map((point, index) => {
      const sourceMaster =
        point.master && typeof point.master === 'object' ? point.master : point;
      const coordinate =
        parseSnapshotCoordinate(point.coordinate) ??
        parseSnapshotCoordinate(sourceMaster.coordinate) ??
        parseSnapshotCoordinate(
          sourceMaster.latLng ??
            sourceMaster.LatLng ??
            point.latLng ??
            point.LatLng,
        ) ??
        safeCurrentPosition;
      const key =
        asText(point.key) ||
        `resume-${asText(snapshot.id) || 'route'}-${index + 1}`;

      return {
        ...point,
        key,
        coordinate,
        master: {
          ...sourceMaster,
          coordinate,
          latLng: `${coordinate.latitude}, ${coordinate.longitude}`,
        },
      };
    });
  const routePath = (
    Array.isArray(snapshot.routePath) ? snapshot.routePath : []
  )
    .map(parseSnapshotCoordinate)
    .filter(
      (coordinate): coordinate is PausedRouteCoordinate => coordinate !== null,
    );

  return {
    ...snapshot,
    id: asText(snapshot.id) || `paused-route-${Date.now()}`,
    routeName: asText(snapshot.routeName) || 'Unsaved Route',
    routeDraft:
      snapshot.routeDraft && typeof snapshot.routeDraft === 'object'
        ? snapshot.routeDraft
        : {},
    currentPosition: safeCurrentPosition,
    currentAddress: asText(snapshot.currentAddress),
    routePoints,
    routePath: routePath.length > 0 ? routePath : [safeCurrentPosition],
    walkingSegments: Array.isArray(snapshot.walkingSegments)
      ? snapshot.walkingSegments
      : [],
    drumAllocations: Array.isArray(snapshot.drumAllocations)
      ? snapshot.drumAllocations
      : [],
    fiberChangeSelectedFibers: Array.isArray(snapshot.fiberChangeSelectedFibers)
      ? snapshot.fiberChangeSelectedFibers
      : [],
  };
};

const SelectPausedRouteScreen: FC<Props> = ({navigation}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const listRef = useRef<FlatList<PausedRouteListRow>>(null);
  const locationRequestRef = useRef(0);
  const routeLoadRequestRef = useRef(0);
  const tabSelectedByUserRef = useRef(false);
  const resumeInProgressRef = useRef(false);
  const [routes, setRoutes] = useState<PausedRouteSnapshot[]>([]);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(200);
  const [activeTab, setActiveTab] = useState<RouteTab>('newRoutes');
  const [currentPosition, setCurrentPosition] =
    useState<PausedRouteCoordinate | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);

  const refreshRouteStatuses = useCallback(
    async (snapshots: PausedRouteSnapshot[]) => {
      const routeIds = [
        ...new Set(snapshots.map(getSnapshotRouteId).filter(Boolean)),
      ];
      console.log('[SelectPausedRoute] Refreshing route statuses', {
        snapshotCount: snapshots.length,
        routeIds,
      });
      if (snapshots.length > 0 && routeIds.length === 0) {
        console.warn(
          '[SelectPausedRoute] No API request: saved snapshots have no valid routeId.',
        );
      }
      const serverMastersByRouteId = new Map<number, any[] | null>();

      await Promise.all(
        routeIds.map(async routeId => {
          try {
            const response = await dispatch(
              GetISPMasterByRouteIdISPAPI({routeId}),
            ).unwrap();
            serverMastersByRouteId.set(routeId, listFromResponse(response));
          } catch (error) {
            console.error('[SelectPausedRoute] Route refresh failed', {
              routeId,
              error,
            });
            serverMastersByRouteId.set(routeId, null);
          }
        }),
      );

      const refreshedRoutes = snapshots.map<PausedRouteSnapshot | null>(
        snapshot => {
          const routeId = getSnapshotRouteId(snapshot);
          if (!routeId) {
            return null;
          }

          const serverMasters = serverMastersByRouteId.get(routeId);
          // The API is the source of truth for both tabs. Do not show a locally
          // recovered route when the server returns no master data.
          if (!serverMasters || serverMasters.length === 0) {
            return null;
          }

          const statuses = serverMasters
            .map(serverMasterStatus)
            .filter(Boolean);
          // Some versions of GetISPMasterByRouteIdISP return the route's
          // masters without a Status field. A non-empty response still proves
          // that the local paused/unsaved draft belongs to a server route, so
          // retain its locally persisted status in that case. Explicit server
          // statuses remain authoritative (for example, completed is hidden).
          if (statuses.length === 0) {
            const isEarlySldPause =
              snapshot.resumeTarget === 'installFiberWithSld' &&
              (snapshot.status === 'paused' || snapshot.status === 'unsaved');
            return isEarlySldPause ? snapshot : null;
          }

          const resumableStatuses = statuses.filter(isResumableServerStatus);
          if (resumableStatuses.length === 0) {
            // Early SLD pauses are stored before any image exists. The image
            // endpoint cannot update Status until a capture is available, but
            // this non-empty API response confirms the server route exists.
            return snapshot.status === 'paused' || snapshot.status === 'unsaved'
              ? snapshot
              : null;
          }

          return {
            ...snapshot,
            status: resumableStatuses.some(
              status => status === 'pause' || status === 'paused',
            )
              ? ('paused' as const)
              : ('unsaved' as const),
          };
        },
      );

      return refreshedRoutes.filter(
        (route): route is PausedRouteSnapshot => route !== null,
      );
    },
    [dispatch],
  );

  const loadRoutes = useCallback(async () => {
    const requestId = routeLoadRequestRef.current + 1;
    routeLoadRequestRef.current = requestId;
    setIsLoadingRoutes(true);
    setRoutes([]);
    const storedRoutes = getPausedRouteSnapshots();

    let recoveredRoutes: PausedRouteSnapshot[] = [];
    try {
      recoveredRoutes = await getPausedRouteSnapshotsWithBackup();
    } catch {
      recoveredRoutes = [];
    }

    const merged = new Map<string, PausedRouteSnapshot>();
    [...storedRoutes, ...recoveredRoutes].forEach(route => {
      const existing = merged.get(route.id);
      if (!existing || route.updatedAt >= existing.updatedAt) {
        merged.set(route.id, route);
      }
    });
    const mergedRoutes = [...merged.values()].sort(
      (first, second) => second.updatedAt - first.updatedAt,
    );
    const refreshedRoutes = await refreshRouteStatuses(mergedRoutes);
    if (routeLoadRequestRef.current === requestId) {
      setRoutes(refreshedRoutes);
      setIsLoadingRoutes(false);
    }
  }, [refreshRouteStatuses]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadRoutes();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRoutes]);

  useFocusEffect(
    useCallback(() => {
      console.log('[SelectPausedRoute] Screen focused; loading routes');
      loadRoutes();

      return () => {
        locationRequestRef.current += 1;
        routeLoadRequestRef.current += 1;
      };
    }, [loadRoutes]),
  );

  const newRouteCount = useMemo(
    () => routes.filter(route => !isFiberChangeSnapshot(route)).length,
    [routes],
  );
  const fiberChangeRouteCount = routes.length - newRouteCount;

  useEffect(() => {
    if (tabSelectedByUserRef.current || routes.length === 0) {
      return;
    }
    if (newRouteCount === 0 && fiberChangeRouteCount > 0) {
      setActiveTab('fiberChangeRoutes');
    } else if (fiberChangeRouteCount === 0 && newRouteCount > 0) {
      setActiveTab('newRoutes');
    }
  }, [fiberChangeRouteCount, newRouteCount, routes.length]);

  const filteredRoutes = useMemo(() => {
    const tabRoutes = routes.filter(route =>
      activeTab === 'fiberChangeRoutes'
        ? isFiberChangeSnapshot(route)
        : !isFiberChangeSnapshot(route),
    );
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return tabRoutes;
    }

    return tabRoutes.filter(route => {
      const routePoints = Array.isArray(route.routePoints)
        ? route.routePoints
        : [];
      const firstPoint = routePoints[0];
      const lastPoint = routePoints[routePoints.length - 1];
      return [
        route.routeName,
        firstPoint?.address,
        lastPoint?.address,
        route.currentAddress,
        route.routeDraft?.fiberTypeName,
        route.routeDraft?.fibreSpecification,
        isFiberChangeSnapshot(route) ? 'fiber change' : 'new route',
        fiberChangeModeLabel(route),
      ].some(value => asText(value).toLowerCase().includes(normalized));
    });
  }, [activeTab, query, routes]);

  const nearestRouteId = useMemo(() => {
    if (!currentPosition || filteredRoutes.length === 0) {
      return null;
    }

    let closestRouteId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    filteredRoutes.forEach(route => {
      const savedPosition = getSnapshotPosition(route);
      if (!savedPosition) {
        return;
      }
      const routeDistance = distanceBetween(currentPosition, savedPosition);
      if (routeDistance < closestDistance) {
        closestDistance = routeDistance;
        closestRouteId = asText(route.id) || null;
      }
    });

    return closestRouteId ?? (asText(filteredRoutes[0]?.id) || null);
  }, [currentPosition, filteredRoutes]);

  const listRows = useMemo<PausedRouteListRow[]>(() => {
    return filteredRoutes.map(route => ({
      key: `route-${route.id}`,
      route,
      isNearest: Boolean(
        currentPosition && asText(route.id) === nearestRouteId,
      ),
    }));
  }, [currentPosition, filteredRoutes, nearestRouteId]);

  useEffect(() => {
    if (!currentPosition || !nearestRouteId) {
      return;
    }

    const nearestIndex = listRows.findIndex(item => item.isNearest);
    if (nearestIndex < 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: nearestIndex,
        animated: true,
        viewPosition: 0.45,
      });
    }, 120);

    return () => clearTimeout(timeoutId);
  }, [currentPosition, listRows, nearestRouteId]);

  const selectTab = (tab: RouteTab) => {
    tabSelectedByUserRef.current = true;
    setActiveTab(tab);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({offset: 0, animated: false});
    });
  };

  const resumeRoute = (storedSnapshot: PausedRouteSnapshot) => {
    const snapshot = sanitizeSnapshotForResume(storedSnapshot);
    const savedInstallationMode = snapshot.sldInstallation?.installationMode;
    const isFiberChange = isFiberChangeSnapshot(snapshot);
    const fiberChangeMode =
      snapshot.fiberChangeMode ??
      snapshot.routeDraft?.fiberChangeMode ??
      (savedInstallationMode === 'fiber-change-partial'
        ? 'partial'
        : savedInstallationMode === 'fiber-change-full'
        ? 'full'
        : 'withoutSld');
    const resumeInstallationMode =
      savedInstallationMode ??
      (!isFiberChange
        ? 'new-route'
        : fiberChangeMode === 'partial'
        ? 'fiber-change-partial'
        : 'fiber-change-full');
    const savedActivePoint = snapshot.fiberChangeActiveMasterKey
      ? snapshot.routePoints.find(
          point => point?.key === snapshot.fiberChangeActiveMasterKey,
        )
      : undefined;
    const selectedPoint =
      savedActivePoint ??
      snapshot.routePoints[snapshot.routePoints.length - 1] ??
      snapshot.routePoints[0];

    const isSldInstallation =
      snapshot.resumeTarget === 'installFiberWithSld' ||
      Boolean(snapshot.sldInstallation);

    if (!isSldInstallation && !selectedPoint) {
      Alert.alert(
        'Unable to Resume Route',
        'This paused route does not contain a valid saved master. Refresh the list and try again.',
      );
      return;
    }
    if (resumeInProgressRef.current) {
      return;
    }
    resumeInProgressRef.current = true;
    setTimeout(() => {
      resumeInProgressRef.current = false;
    }, 1000);

    // The saved mode is the source of truth. New-route and fiber-change SLD
    // installations both resume on their installation screen.
    if (
      isSldInstallation &&
      (!isFiberChange ||
        fiberChangeMode === 'full' ||
        fiberChangeMode === 'partial')
    ) {
      const firstPoint = snapshot.routePoints[0];
      const lastPoint = snapshot.routePoints[snapshot.routePoints.length - 1];
      const selectedSld = snapshot.sldInstallation?.selectedSld ?? {
        ...(snapshot.fiberChangeRoute ?? {}),
        ...snapshot.routeDraft,
        routeName: snapshot.routeName,
        fromMasterId: firstPoint?.masterId ?? firstPoint?.master?.id,
        fromMasterName: firstPoint?.name ?? firstPoint?.master?.name,
        fromMasterTypeName:
          firstPoint?.masterTypeLabel ?? firstPoint?.master?.type,
        fromAddress: firstPoint?.address ?? firstPoint?.master?.address,
        fromLatLng: firstPoint?.coordinate ?? firstPoint?.master?.coordinate,
        toMasterId: lastPoint?.masterId ?? lastPoint?.master?.id,
        toMasterName: lastPoint?.name ?? lastPoint?.master?.name,
        toMasterTypeName: lastPoint?.masterTypeLabel ?? lastPoint?.master?.type,
        toAddress: lastPoint?.address ?? lastPoint?.master?.address,
        toLatLng: lastPoint?.coordinate ?? lastPoint?.master?.coordinate,
        firstOrderNo: firstPoint?.master?.orderNo ?? 1,
        lastOrderNo: lastPoint?.master?.orderNo ?? snapshot.routePoints.length,
        fiberTypeName:
          snapshot.routeDraft?.fiberTypeName ??
          snapshot.routeDraft?.fiberTypeLabel,
      };
      const savedActiveIndex = snapshot.fiberChangeActiveMasterKey
        ? snapshot.routePoints.findIndex(
            point => point?.key === snapshot.fiberChangeActiveMasterKey,
          )
        : -1;
      const legacyRouteFiberData = [
        {
          sldId: selectedSld?.id,
          masterDetails: snapshot.routePoints.map((point, index) => ({
            ...(point?.master ?? point),
            IspMasterId: point?.masterId ?? point?.master?.id,
            orderNo: point?.master?.orderNo ?? index + 1,
            masterType:
              point?.masterTypeLabel ??
              point?.masterType ??
              point?.master?.type,
            selectedAddress: point?.address ?? point?.master?.address,
            ...(point?.coordinate ?? point?.master?.coordinate ?? {}),
          })),
        },
      ];
      const installationProgress: PausedRouteSnapshot = snapshot.sldInstallation
        ? snapshot
        : {
            ...snapshot,
            resumeTarget: 'installFiberWithSld',
            sldInstallation: {
              selectedSld,
              installationMode: resumeInstallationMode,
              routeFiberData: legacyRouteFiberData,
              activeIndex: Math.max(0, savedActiveIndex),
              photos: {},
              loopValues: {},
              confirmedLoopKeys: [],
            },
          };

      navigation.navigate('Install-Fiber-With-SLD', {
        selectedSld,
        currentPosition: snapshot.currentPosition,
        currentAddress: snapshot.currentAddress,
        installationMode: resumeInstallationMode,
        fiberChangeRoute: snapshot.fiberChangeRoute,
        fiberChangeSelectedFibers: snapshot.fiberChangeSelectedFibers ?? [],
        routeFiberData:
          snapshot.sldInstallation?.routeFiberData ?? legacyRouteFiberData,
        installationProgress,
      });
      return;
    }

    const resumedSnapshot: PausedRouteSnapshot =
      isFiberChange && fiberChangeMode === 'withoutSld'
        ? {
            ...snapshot,
            // The route page enables Stop & Save/Next Master while paused.
            // An idle snapshot with an active master would disable that action.
            trackingState: snapshot.routePoints.length > 0 ? 'paused' : 'idle',
            status:
              snapshot.routePoints.length > 0 ? 'paused' : snapshot.status,
            workflowType: 'fiberChange' as const,
            resumeTarget: 'makeRoute' as const,
            fiberChangeMode: 'withoutSld' as const,
            fiberChangeActiveMasterKey: selectedPoint?.key,
          }
        : snapshot;

    navigation.navigate('Make-Route', {
      routeName: snapshot.routeName,
      routeDraft: snapshot.routeDraft,
      currentPosition: snapshot.currentPosition,
      currentAddress: snapshot.currentAddress,
      selectedMaster: selectedPoint?.master ?? selectedPoint,
      selectedMasterVersion:
        selectedPoint?.key ?? `resume-${snapshot.id}-${Date.now()}`,
      resumeSnapshot: resumedSnapshot,
      ...(isFiberChange
        ? {
            fiberChangeMode,
            fiberChangeRoute: snapshot.fiberChangeRoute,
            fiberChangeSelectedFibers: snapshot.fiberChangeSelectedFibers ?? [],
            fiberChangeActiveMasterKey:
              snapshot.fiberChangeActiveMasterKey ?? selectedPoint?.key,
          }
        : {}),
    });
  };

  const openRouteMap = (snapshot: PausedRouteSnapshot) => {
    const routePosition = getSnapshotPosition(snapshot);
    if (!routePosition) {
      Alert.alert('Google Maps', 'This route does not have a saved location.');
      return;
    }
    const {latitude, longitude} = routePosition;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Google Maps', 'Unable to open this route location.');
    });
  };

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
        'Enable location access in Settings to find the nearest paused route.',
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

      if (Platform.OS === 'android') {
        const isGpsEnabled = await Location.checkGps();
        if (!isGpsEnabled) {
          throw new Error('Location services are disabled.');
        }
      }

      let bestAccuracy = Number.POSITIVE_INFINITY;
      let hasPosition = false;

      await new Promise<void>((resolve, reject) => {
        let failedRequests = 0;

        const handleFailure = (error: unknown) => {
          failedRequests += 1;
          if (failedRequests === 2 && !hasPosition) {
            reject(error);
          }
        };

        const showPosition = (fix: CurrentPositionFix) => {
          if (locationRequestRef.current !== requestId) {
            resolve();
            return;
          }

          if (!isValidPosition(fix)) {
            handleFailure(
              new Error('The device returned an invalid location.'),
            );
            return;
          }

          const isFirstPosition = !hasPosition;
          if (!isFirstPosition && fix.accuracy >= bestAccuracy) {
            return;
          }

          hasPosition = true;
          bestAccuracy = fix.accuracy;
          const position = {
            latitude: fix.latitude,
            longitude: fix.longitude,
          };
          setCurrentPosition(position);

          if (isFirstPosition) {
            resolve();
          }
        };

        getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        }).then(showPosition, handleFailure);

        getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0,
        }).then(showPosition, handleFailure);
      });
    } catch (error: any) {
      Alert.alert(
        'Current Location',
        error?.message ||
          'Unable to get your current location. Check GPS and location permission, then try again.',
      );
    } finally {
      if (locationRequestRef.current === requestId) {
        setIsLocating(false);
      }
    }
  };

  const renderRouteCard = (
    route: PausedRouteSnapshot,
    isCurrentLocationRoute: boolean,
  ) => {
    const routePoints = Array.isArray(route.routePoints)
      ? route.routePoints
      : [];
    const firstPoint = routePoints[0];
    const lastPoint = routePoints[routePoints.length - 1];
    const routeId =
      asText(
        getSnapshotRouteId(route) ||
          route.routeDraft?.routeIdStr ||
          route.fiberChangeRoute?.routeIdStr,
      ) || asText(route.id).slice(-8).toUpperCase();
    const fiberType = fiberTypeLabel(route);
    const isFiberChange = isFiberChangeSnapshot(route);

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={`Resume ${route.routeName}`}
        accessibilityState={{selected: isCurrentLocationRoute}}
        onPress={() => resumeRoute(route)}
        style={[
          styles.routeCard,
          isCurrentLocationRoute && styles.currentRouteCard,
        ]}>
        <View style={styles.cardTitleRow}>
          <Text numberOfLines={1} style={styles.routeName}>
            {route.routeName}
          </Text>
          <Text numberOfLines={1} style={styles.routeId}>
            Route#{routeId}
          </Text>
          <View
            style={[
              styles.statusBadge,
              route.status === 'unsaved' && styles.unsavedBadge,
              route.status === 'stopped' && styles.stoppedBadge,
            ]}>
            <Text style={styles.statusText}>{statusLabel(route)}</Text>
          </View>
        </View>

        {isFiberChange ? (
          <View style={styles.fiberChangeBadge}>
            <Text style={styles.fiberChangeBadgeText}>
              FIBER CHANGE • {fiberChangeModeLabel(route)}
            </Text>
          </View>
        ) : null}

        <Text numberOfLines={2} style={styles.addressText}>
          <Text style={styles.addressLabel}>From: </Text>
          {firstPoint?.address || route.currentAddress || 'Address unavailable'}
        </Text>
        <Text numberOfLines={2} style={styles.addressText}>
          <Text style={styles.addressLabel}>To: </Text>
          {lastPoint?.address || route.currentAddress || 'Address unavailable'}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.metaText}>
            Total Distance:{' '}
            <Text style={styles.metaValue}>
              {Math.round(route.totalDistance)} meters
            </Text>
          </Text>
          <Text style={styles.fiberText}>
            Fiber Type: <Text style={styles.metaValue}>{fiberType}</Text>
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Open ${route.routeName} in Google Maps`}
            onPress={event => {
              event.stopPropagation();
              openRouteMap(route);
            }}
            style={styles.mapButton}>
            <GoogleMapsIconSvg width={SIZE.MS(28)} height={SIZE.MS(28)} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListRow = ({item}: {item: PausedRouteListRow}) => {
    return (
      <View style={styles.routeCardRow}>
        <View style={styles.locationMarkerColumn}>
          {item.isNearest ? (
            <View
              accessibilityLabel="Route nearest to your current location"
              style={styles.currentLocationMarker}>
              <PointerSvg width={SIZE.MS(25)} height={SIZE.MS(25)} />
            </View>
          ) : null}
        </View>
        {renderRouteCard(item.route, Boolean(item.isNearest))}
      </View>
    );
  };

  return (
    <Screen
      preset="fixed"
      keyboardAvoidingEnabled={false}
      statusBgColor={COLORS.PRIMARY}
      navBarColor={COLORS.WHITE}>
      <View style={styles.screen}>
        <BackHeader
          title="Select Paused Route"
          onBackPress={() => navigation.goBack()}
        />

        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Image source={IMAGES.search} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor="#858B95"
              returnKeyType="search"
              style={styles.searchInput}
            />
            {query ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setQuery('')}
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

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{selected: activeTab === 'newRoutes'}}
            onPress={() => selectTab('newRoutes')}
            style={[
              styles.tabButton,
              activeTab === 'newRoutes' && styles.activeTabButton,
            ]}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'newRoutes' && styles.activeTabText,
              ]}>
              New Routes
            </Text>
            <View
              style={[
                styles.tabCountBadge,
                activeTab === 'newRoutes' && styles.activeTabCountBadge,
              ]}>
              <Text
                style={[
                  styles.tabCountText,
                  activeTab === 'newRoutes' && styles.activeTabCountText,
                ]}>
                {newRouteCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{
              selected: activeTab === 'fiberChangeRoutes',
            }}
            onPress={() => selectTab('fiberChangeRoutes')}
            style={[
              styles.tabButton,
              activeTab === 'fiberChangeRoutes' && styles.activeTabButton,
            ]}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'fiberChangeRoutes' && styles.activeTabText,
              ]}>
              Fiber Change Routes
            </Text>
            <View
              style={[
                styles.tabCountBadge,
                activeTab === 'fiberChangeRoutes' && styles.activeTabCountBadge,
              ]}>
              <Text
                style={[
                  styles.tabCountText,
                  activeTab === 'fiberChangeRoutes' &&
                    styles.activeTabCountText,
                ]}>
                {fiberChangeRouteCount}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.listArea}>
          <View style={styles.timeline} />

          <FlatList
            key={activeTab}
            ref={listRef}
            data={listRows}
            extraData={{currentPosition, nearestRouteId}}
            keyExtractor={item => item.key}
            renderItem={renderListRow}
            initialNumToRender={50}
            maxToRenderPerBatch={50}
            windowSize={51}
            contentContainerStyle={[
              styles.listContent,
              filteredRoutes.length === 0 && styles.emptyListContent,
            ]}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[COLORS.colorMediumslateblue]}
                tintColor={COLORS.colorMediumslateblue}
              />
            }
            onScrollToIndexFailed={({averageItemLength, index}) => {
              listRef.current?.scrollToOffset({
                offset: Math.max(0, averageItemLength * (index - 1)),
                animated: true,
              });
              setTimeout(() => {
                listRef.current?.scrollToIndex({
                  index,
                  animated: true,
                  viewPosition: 0.45,
                });
              }, 250);
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                {isLoadingRoutes ? (
                  <>
                    <ActivityIndicator color={COLORS.colorMediumslateblue} />
                    <Text style={styles.emptyText}>
                      Loading paused routes...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>No paused routes</Text>
                    <Text style={styles.emptyText}>
                      No {activeTab === 'newRoutes' ? 'new' : 'fiber change'}{' '}
                      route drafts are available in this tab.
                    </Text>
                  </>
                )}
              </View>
            }
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.86}
          disabled={isLocating}
          onPress={showCurrentLocation}
          style={[
            styles.whereButtonTouchable,
            isLocating && styles.whereButtonDisabled,
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
    </Screen>
  );
};

export default SelectPausedRouteScreen;
