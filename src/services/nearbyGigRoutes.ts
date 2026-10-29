import {APIs, URLs} from '@apis';
import type {GigTubeCore} from './gigTubeCores';
import type {SplitterCoordinate} from './lastMileConnectivityService';

export type GigRoute = {
  id: number;
  fiberCode: string;
  routeName: string;
  routeIdStr: string;
  routeId: number | null;
  sldCode: string;
  totalDistance: number | null;
  tubeNo: number | null;
  coreNo: number | null;
  drumNo: string;
  drumLength: number | null;
  otdr: number | null;
  fiberTypeName: string;
  createdOn: string;
  fiberMasterId: number | null;
  startArea: string;
  endArea: string;
  distanceMeters: number | null;
  tubeCoreOptions?: {tubeNo: number; cores: GigTubeCore[]};
  occupiedCores?: {tube: number; core: number}[];
};

export type GigCoreAssignment = {
  fiberMappingId?: number;
  fiberCode: string;
  tube: number;
  core: number;
};
const sameGig = (route: GigRoute, assignment: GigCoreAssignment) =>
  assignment.fiberMappingId === route.id ||
  Boolean(
    assignment.fiberCode.trim() &&
      assignment.fiberCode.trim().toLowerCase() ===
        route.fiberCode.trim().toLowerCase(),
  );

export function isGigCoreUnavailable(
  route: GigRoute,
  tube: number,
  core: number,
  otherCustomers: GigCoreAssignment[] = [],
  editingCustomer?: GigCoreAssignment,
): boolean {
  if (
    otherCustomers.some(
      item => sameGig(route, item) && item.tube === tube && item.core === core,
    )
  ) {
    return true;
  }
  if (route.tubeCoreOptions?.tubeNo === tube) {
    const option = route.tubeCoreOptions.cores.find(
      item => item.coreId === core,
    );
    return !option || option.isUsed;
  }
  const usedByApi = (route.occupiedCores ?? []).some(
    item => item.tube === tube && item.core === core,
  );
  const currentAssignment =
    editingCustomer &&
    sameGig(route, editingCustomer) &&
    editingCustomer.tube === tube &&
    editingCustomer.core === core;
  return usedByApi && !currentAssignment;
}
const text = (value: unknown) => String(value ?? '').trim();
const number = (value: unknown) =>
  value == null || text(value) === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value);

export const FIBER_CORE_COLORS = [
  {name: 'Blue', color: '#0000FF'},
  {name: 'Orange', color: '#FF7F00'},
  {name: 'Green', color: '#008000'},
  {name: 'Brown', color: '#A52A2A'},
  {name: 'Gray', color: '#808080'},
  {name: 'White', color: '#FFFFFF'},
  {name: 'Red', color: '#FF0000'},
  {name: 'Black', color: '#000000'},
  {name: 'Yellow', color: '#FFFF00'},
  {name: 'Violet', color: '#8F00FF'},
  {name: 'Pink', color: '#FFC0CB'},
  {name: 'Aqua', color: '#00FFFF'},
];

export async function getNearbyGigRoutes(
  coordinate: SplitterCoordinate,
  radiusMeters: number,
): Promise<GigRoute[]> {
  const response: any = await APIs.postRequestWithJson({
    path: URLs.getNearbyConnectedRoutesByLatLng,
    params: {
      latLng: `${coordinate.latitude},${coordinate.longitude}`,
      radiusMeters,
    },
    isAuth: true,
  });
  if (
    response?.success === false ||
    (response?.success !== true && Number(response?.status) !== 200)
  ) {
    throw new Error(
      response?.message || 'Could not load nearby GIG routes. Please retry.',
    );
  }
  if (!Array.isArray(response.data)) {
    throw new Error('Invalid GIG route response. Please retry.');
  }
  return response.data
    .filter((row: any) => row && number(row.id) !== null)
    .map(
      (row: any): GigRoute => ({
        id: Number(row.id),
        fiberCode: text(row.fiberCode),
        routeName: text(row.routeName),
        routeIdStr: text(row.routeIdStr),
        routeId: number(row.routeId),
        sldCode: text(row.sldCode),
        totalDistance: number(row.totalDistance),
        tubeNo: number(row.tubeNo),
        coreNo: number(row.coreNo),
        drumNo: text(row.drumNo),
        drumLength: number(row.drumLength),
        otdr: number(row.otdr),
        fiberTypeName: text(row.fiberTypeName),
        createdOn: text(row.createdOn),
        fiberMasterId: number(row.fiberMasterId),
        startArea: text(row.startArea),
        endArea: text(row.endArea),
        distanceMeters: number(row.distanceMeters),
      }),
    )
    .reduce((routes: GigRoute[], route: GigRoute) => {
      const existing = routes.find(item => item.id === route.id);
      if (existing) {
        existing.tubeNo =
          Math.max(existing.tubeNo ?? 0, route.tubeNo ?? 0) || null;
        existing.coreNo =
          Math.max(existing.coreNo ?? 0, route.coreNo ?? 0) || null;
        existing.occupiedCores = [
          ...(existing.occupiedCores ?? []),
          ...(route.occupiedCores ?? []),
        ];
      } else {
        routes.push(route);
      }
      return routes;
    }, [])
    .sort(
      (first: GigRoute, second: GigRoute) =>
        (first.distanceMeters ?? Infinity) -
        (second.distanceMeters ?? Infinity),
    );
}

export const filterGigRoutes = (routes: GigRoute[], query: string) => {
  const search = query.trim().toLowerCase();
  return routes.filter(route =>
    [
      route.fiberCode,
      route.routeName,
      route.routeIdStr,
      route.sldCode,
      route.startArea,
      route.endArea,
    ].some(value => value.toLowerCase().includes(search)),
  );
};
