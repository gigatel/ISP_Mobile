import {getData, setData} from '../utils/preferences';

export type StoredRouteFiberSelection = {
  id: string;
  fiberId: string;
  fiberLabel: string;
  armourLabel: string;
  tubeCount: string;
  coreCount: string;
  drumId: string;
  drumLabel: string;
  drumLength: number;
  lengthToUse: number;
  addedAt: number;
};

export type CompletedAppRouteSnapshot = {
  serverRouteId?: string;
  routeName: string;
  currentPosition: {latitude: number; longitude: number};
  currentAddress: string;
  routePoints: any[];
  routePath: Array<{latitude: number; longitude: number}>;
  walkingSegments: Array<{
    id: string;
    afterPointKey: string;
    distance: number;
  }>;
  totalDistance: number;
  createdAt: number;
  updatedAt: number;
};

type StoredRouteFibers = {
  routeId: string;
  routeName: string;
  fibers: StoredRouteFiberSelection[];
  updatedAt: number;
};

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const getCompletedRoutes = (): CompletedAppRouteSnapshot[] => {
  const value = getData('COMPLETED_APP_ROUTES');
  return Array.isArray(value) ? value : [];
};

const getStoredRouteFibers = (): StoredRouteFibers[] => {
  const value = getData('ROUTE_FIBER_SELECTIONS');
  return Array.isArray(value) ? value : [];
};

const matchesRoute = (
  record: {routeId?: string; serverRouteId?: string; routeName?: string},
  routeId: unknown,
  routeName: unknown,
) => {
  const expectedId = normalize(routeId);
  const recordId = normalize(record.routeId ?? record.serverRouteId);
  if (expectedId && recordId && expectedId === recordId) {
    return true;
  }
  const expectedName = normalize(routeName);
  return Boolean(expectedName && normalize(record.routeName) === expectedName);
};

export const saveCompletedAppRoute = (snapshot: CompletedAppRouteSnapshot) => {
  const existing = getCompletedRoutes();
  const next = [
    snapshot,
    ...existing.filter(
      item => !matchesRoute(item, snapshot.serverRouteId, snapshot.routeName),
    ),
  ]
    .sort((first, second) => second.updatedAt - first.updatedAt)
    .slice(0, 100);
  setData('COMPLETED_APP_ROUTES', next);
};

export const getCompletedAppRoute = (
  routeId: unknown,
  routeName: unknown,
): CompletedAppRouteSnapshot | null =>
  getCompletedRoutes().find(item => matchesRoute(item, routeId, routeName)) ??
  null;

export const getRouteFiberSelections = (
  routeId: unknown,
  routeName: unknown,
): StoredRouteFiberSelection[] =>
  getStoredRouteFibers().find(item => matchesRoute(item, routeId, routeName))
    ?.fibers ?? [];

export const appendRouteFiberSelection = (
  routeId: unknown,
  routeName: unknown,
  selection: Omit<StoredRouteFiberSelection, 'id' | 'addedAt'>,
): StoredRouteFiberSelection[] => {
  const records = getStoredRouteFibers();
  const index = records.findIndex(item =>
    matchesRoute(item, routeId, routeName),
  );
  const nextSelection: StoredRouteFiberSelection = {
    ...selection,
    id: `fiber-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    addedAt: Date.now(),
  };
  const previous = index >= 0 ? records[index] : null;
  const nextRecord: StoredRouteFibers = {
    routeId: String(routeId ?? ''),
    routeName: String(routeName ?? ''),
    fibers: [...(previous?.fibers ?? []), nextSelection],
    updatedAt: Date.now(),
  };
  const nextRecords =
    index >= 0
      ? records.map((record, itemIndex) =>
          itemIndex === index ? nextRecord : record,
        )
      : [nextRecord, ...records];
  setData('ROUTE_FIBER_SELECTIONS', nextRecords.slice(0, 100));
  return nextRecord.fibers;
};
