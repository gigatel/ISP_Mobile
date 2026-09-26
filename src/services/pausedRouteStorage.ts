import RNFS from 'react-native-fs';
import {
  getData,
  getKeysByPrefix,
  PAUSED_ROUTE_DRAFT_PREFIX,
  removeData,
  setData,
} from '../utils/preferences';

export type PausedRouteStatus = 'unsaved' | 'walking' | 'paused' | 'stopped';

export type PausedRouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type PausedRouteSnapshot = {
  id: string;
  routeName: string;
  routeDraft: Record<string, any>;
  currentPosition: PausedRouteCoordinate;
  currentAddress: string;
  routePoints: any[];
  routePath: PausedRouteCoordinate[];
  walkingSegments: Array<{
    id: string;
    afterPointKey: string;
    distance: number;
  }>;
  segmentDistance: number;
  trackingState: 'idle' | 'walking' | 'paused';
  drumAllocations: Array<{
    drumId: string;
    drumNo: string;
    availableLength: number;
    fiberTypeId?: string;
    fiberTypeName?: string;
  }>;
  totalDistance: number;
  status: PausedRouteStatus;
  createdAt: number;
  updatedAt: number;
  workflowType?: 'newRoute' | 'fiberChange';
  resumeTarget?: 'makeRoute' | 'installFiberWithSld';
  fiberChangeMode?: 'full' | 'partial' | 'withoutSld';
  fiberChangeRoute?: Record<string, any>;
  fiberChangeSelectedFibers?: any[];
  fiberChangeActiveMasterKey?: string;
  sldInstallation?: {
    selectedSld: Record<string, any>;
    installationMode:
      | 'new-route'
      | 'fiber-change-full'
      | 'fiber-change-partial';
    routeFiberData?: any[];
    activeIndex: number;
    photos: Record<string, {uri: string; type: string; fileName: string}>;
    loopValues: Record<string, string>;
    confirmedLoopKeys: string[];
  };
};

const STORAGE_KEY = 'PAUSED_ROUTE_DRAFTS' as const;
const STORAGE_INDEX_KEY = `${PAUSED_ROUTE_DRAFT_PREFIX}INDEX` as const;
const COMPLETED_ROUTE_IDS_KEY =
  `${PAUSED_ROUTE_DRAFT_PREFIX}COMPLETED` as const;
const BACKUP_FILE_PATH = `${RNFS.DocumentDirectoryPath}/paused-route-drafts.json`;

let backupWriteQueue: Promise<void> = Promise.resolve();

const storageKeyForRoute = (routeId: string) =>
  `${PAUSED_ROUTE_DRAFT_PREFIX}${encodeURIComponent(routeId)}` as const;

const sortSnapshots = (snapshots: PausedRouteSnapshot[]) =>
  [...snapshots].sort((first, second) => second.updatedAt - first.updatedAt);

const mergeSnapshots = (candidates: any[]) => {
  const unique = new Map<string, PausedRouteSnapshot>();
  candidates.forEach(candidate => {
    const route = normalizeStoredSnapshot(candidate);
    if (!route) {
      return;
    }
    const existing = unique.get(route.id);
    if (!existing || route.updatedAt >= existing.updatedAt) {
      unique.set(route.id, route);
    }
  });
  return sortSnapshots([...unique.values()]);
};

const persistSnapshotCollection = (snapshots: PausedRouteSnapshot[]) => {
  snapshots.forEach(snapshot => {
    setData(storageKeyForRoute(snapshot.id), snapshot);
  });
  setData(
    STORAGE_INDEX_KEY,
    snapshots.map(snapshot => snapshot.id),
  );
  setData(STORAGE_KEY, snapshots);
};

const scheduleBackupWrite = (snapshots: PausedRouteSnapshot[]) => {
  const payload = JSON.stringify(snapshots);
  backupWriteQueue = backupWriteQueue
    .catch(() => undefined)
    .then(() => RNFS.writeFile(BACKUP_FILE_PATH, payload, 'utf8'));
};

/** Strip functions and circular native/navigation values before MMKV JSON. */
const toSerializableSnapshot = (
  snapshot: PausedRouteSnapshot,
): PausedRouteSnapshot | null => {
  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(snapshot, (_key, value) => {
      if (typeof value === 'function' || typeof value === 'symbol') {
        return undefined;
      }
      if (value && typeof value === 'object') {
        if (seen.has(value)) {
          return undefined;
        }
        seen.add(value);
      }
      return value;
    });
    return json ? (JSON.parse(json) as PausedRouteSnapshot) : null;
  } catch {
    return null;
  }
};

const normalizeStoredSnapshot = (value: any): PausedRouteSnapshot | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const routePoints = Array.isArray(value.routePoints) ? value.routePoints : [];
  const routePath = Array.isArray(value.routePath) ? value.routePath : [];
  const fallbackPosition =
    value.currentPosition ??
    routePath[routePath.length - 1] ??
    routePoints[routePoints.length - 1]?.coordinate ??
    routePoints[routePoints.length - 1]?.master?.coordinate;
  const id = String(
    value.id ?? value.routeDraft?.routeId ?? value.routeDraft?.routeIdStr ?? '',
  ).trim();
  if (!id) {
    return null;
  }
  const now = Date.now();
  return {
    ...value,
    id,
    routeName:
      String(value.routeName ?? value.routeDraft?.routeName ?? '').trim() ||
      'Unsaved Route',
    routeDraft:
      value.routeDraft && typeof value.routeDraft === 'object'
        ? value.routeDraft
        : {},
    currentPosition: fallbackPosition ?? {latitude: 0, longitude: 0},
    currentAddress: String(value.currentAddress ?? ''),
    routePoints,
    routePath,
    walkingSegments: Array.isArray(value.walkingSegments)
      ? value.walkingSegments
      : [],
    segmentDistance: Number(value.segmentDistance) || 0,
    trackingState:
      value.trackingState === 'walking' || value.trackingState === 'paused'
        ? value.trackingState
        : 'idle',
    drumAllocations: Array.isArray(value.drumAllocations)
      ? value.drumAllocations
      : [],
    totalDistance: Number(value.totalDistance) || 0,
    status: ['unsaved', 'walking', 'paused', 'stopped'].includes(value.status)
      ? value.status
      : 'unsaved',
    createdAt: Number(value.createdAt) || now,
    updatedAt: Number(value.updatedAt) || Number(value.createdAt) || now,
  };
};

export const getPausedRouteSnapshots = (): PausedRouteSnapshot[] => {
  const legacyStored = getData(STORAGE_KEY);
  const indexedIds = getData(STORAGE_INDEX_KEY);
  const completedRouteIds = new Set(
    Array.isArray(getData(COMPLETED_ROUTE_IDS_KEY))
      ? getData(COMPLETED_ROUTE_IDS_KEY).map(String)
      : [],
  );
  const discoveredRouteKeys = getKeysByPrefix(PAUSED_ROUTE_DRAFT_PREFIX).filter(
    key => key !== STORAGE_INDEX_KEY && key !== COMPLETED_ROUTE_IDS_KEY,
  );
  const independentlyStoredSnapshots = mergeSnapshots([
    ...(Array.isArray(indexedIds)
      ? indexedIds.map(id => getData(storageKeyForRoute(String(id))))
      : []),
    ...discoveredRouteKeys.map(key => getData(key as any)),
  ]);
  const independentlyStoredIds = new Set(
    independentlyStoredSnapshots.map(snapshot => snapshot.id),
  );
  const candidates = [
    ...independentlyStoredSnapshots,
    ...(Array.isArray(legacyStored) ? legacyStored : []),
  ];
  const snapshots = mergeSnapshots(candidates).filter(
    snapshot =>
      independentlyStoredIds.has(snapshot.id) ||
      !completedRouteIds.has(snapshot.id),
  );

  // Repair a lost/stale index from independently stored route records.
  if (
    snapshots.length > 0 &&
    (!Array.isArray(indexedIds) || indexedIds.length !== snapshots.length)
  ) {
    persistSnapshotCollection(snapshots);
  }

  return snapshots;
};

/** Recover drafts from the documents backup if MMKV was reset or corrupted. */
export const getPausedRouteSnapshotsWithBackup = async () => {
  const storedSnapshots = getPausedRouteSnapshots();
  const independentlyStoredIds = new Set(
    storedSnapshots.map(snapshot => snapshot.id),
  );
  const completedRouteIds = new Set(
    Array.isArray(getData(COMPLETED_ROUTE_IDS_KEY))
      ? getData(COMPLETED_ROUTE_IDS_KEY).map(String)
      : [],
  );
  try {
    await backupWriteQueue.catch(() => undefined);
    if (!(await RNFS.exists(BACKUP_FILE_PATH))) {
      if (storedSnapshots.length > 0) {
        scheduleBackupWrite(storedSnapshots);
      }
      return storedSnapshots;
    }
    const backupValue = JSON.parse(
      await RNFS.readFile(BACKUP_FILE_PATH, 'utf8'),
    );
    const recovered = mergeSnapshots([
      ...storedSnapshots,
      ...(Array.isArray(backupValue) ? backupValue : []),
    ]).filter(
      snapshot =>
        independentlyStoredIds.has(snapshot.id) ||
        !completedRouteIds.has(snapshot.id),
    );
    if (recovered.length > 0) {
      persistSnapshotCollection(recovered);
      scheduleBackupWrite(recovered);
    }
    return recovered;
  } catch {
    return storedSnapshots;
  }
};

export const savePausedRouteSnapshot = (snapshot: PausedRouteSnapshot) => {
  const serializableSnapshot = toSerializableSnapshot(snapshot);
  if (!serializableSnapshot) {
    return false;
  }
  const current = getPausedRouteSnapshots();
  const completedRouteIds: string[] = Array.isArray(
    getData(COMPLETED_ROUTE_IDS_KEY),
  )
    ? getData(COMPLETED_ROUTE_IDS_KEY).map(String)
    : [];
  if (completedRouteIds.includes(serializableSnapshot.id)) {
    setData(
      COMPLETED_ROUTE_IDS_KEY,
      completedRouteIds.filter(id => id !== serializableSnapshot.id),
    );
  }
  const next = [
    serializableSnapshot,
    ...current.filter(route => route.id !== serializableSnapshot.id),
  ].sort((first, second) => second.updatedAt - first.updatedAt);

  // Each route is persisted independently so one large/corrupt record cannot
  // make both paused-route tabs appear empty in a release APK.
  const itemSaved = setData(
    storageKeyForRoute(serializableSnapshot.id),
    serializableSnapshot,
  );
  setData(
    STORAGE_INDEX_KEY,
    next.map(route => route.id),
  );
  // Keep the aggregate during migration for already-installed app versions.
  setData(STORAGE_KEY, next);
  scheduleBackupWrite(next);
  return itemSaved;
};

/** Remove a persisted draft only after the route completion API succeeds. */
export const removeCompletedRouteSnapshot = (routeId: string) => {
  const next = getPausedRouteSnapshots().filter(route => route.id !== routeId);
  const completedRouteIds = Array.isArray(getData(COMPLETED_ROUTE_IDS_KEY))
    ? getData(COMPLETED_ROUTE_IDS_KEY).map(String)
    : [];
  setData(COMPLETED_ROUTE_IDS_KEY, [
    ...new Set([...completedRouteIds, routeId]),
  ]);
  removeData(storageKeyForRoute(routeId));
  setData(
    STORAGE_INDEX_KEY,
    next.map(route => route.id),
  );
  setData(STORAGE_KEY, next);
  scheduleBackupWrite(next);
};
