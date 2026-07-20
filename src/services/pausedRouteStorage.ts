import {getData, setData} from '../utils/preferences';

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
    lengthToUse: number;
  }>;
  totalDistance: number;
  status: PausedRouteStatus;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = 'PAUSED_ROUTE_DRAFTS' as const;

export const getPausedRouteSnapshots = (): PausedRouteSnapshot[] => {
  const stored = getData(STORAGE_KEY);
  if (!Array.isArray(stored)) {
    return [];
  }

  return stored
    .filter(
      (route): route is PausedRouteSnapshot =>
        Boolean(route?.id) &&
        Boolean(route?.routeName) &&
        Array.isArray(route?.routePoints),
    )
    .sort((first, second) => second.updatedAt - first.updatedAt);
};

export const savePausedRouteSnapshot = (snapshot: PausedRouteSnapshot) => {
  const current = getPausedRouteSnapshots();
  const next = [
    snapshot,
    ...current.filter(route => route.id !== snapshot.id),
  ].sort((first, second) => second.updatedAt - first.updatedAt);
  setData(STORAGE_KEY, next);
};

/** Remove a persisted draft only after the route completion API succeeds. */
export const removeCompletedRouteSnapshot = (routeId: string) => {
  setData(
    STORAGE_KEY,
    getPausedRouteSnapshots().filter(route => route.id !== routeId),
  );
};
