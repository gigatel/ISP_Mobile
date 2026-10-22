export type Coordinate = {latitude: number; longitude: number};
export const valueOf = (item: any, ...keys: string[]) => {
  for (const key of keys) {
    if (item?.[key] != null && item[key] !== '') {
      return item[key];
    }
  }
  return '';
};
export const coordinateOf = (item: any, prefix = ''): Coordinate | null => {
  if (!item) {
    return null;
  }
  const lat = valueOf(
    item,
    `${prefix}Latitude`,
    `${prefix}latitude`,
    `${prefix}Lat`,
    'latitude',
    'Latitude',
    'lat',
  );
  const lng = valueOf(
    item,
    `${prefix}Longitude`,
    `${prefix}longitude`,
    `${prefix}Lng`,
    'longitude',
    'Longitude',
    'lng',
    'long',
    'lon',
  );
  if (lat === '' || lng === '') {
    const combined = valueOf(item, 'latLng', 'LatLng', 'latlng');
    if (typeof combined === 'string' && combined.split(',').length === 2) {
      const [latitude, longitude] = combined
        .split(',')
        .map(part => part.trim());
      return coordinateOf({latitude, longitude});
    }
    return null;
  }
  const latitude = Number(lat),
    longitude = Number(lng);
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
    ? {latitude, longitude}
    : null;
};
const latLng = (value: any): Coordinate | null => {
  if (typeof value === 'string') {
    const [latitude, longitude] = value.split(',');
    return coordinateOf({latitude, longitude});
  }
  return coordinateOf(value);
};
export const pathOf = (item: any): Coordinate[] => {
  let path = valueOf(
    item,
    'coordinates',
    'routeCoordinates',
    'path',
    'routePath',
    'geometry',
  );
  if (typeof path === 'string') {
    try {
      path = JSON.parse(path);
    } catch {
      const match = path.match(/LINESTRING\s*\(([^)]+)\)/i);
      path = match
        ? {
            type: 'LineString',
            coordinates: match[1]
              .split(',')
              .map((point: string) => point.trim().split(/\s+/).map(Number)),
          }
        : [];
    }
  }
  if (path?.type === 'Feature') {
    path = path.geometry;
  }
  if (path?.type === 'LineString') {
    return path.coordinates
      .map((point: number[]) =>
        coordinateOf({longitude: point[0], latitude: point[1]}),
      )
      .filter((point: Coordinate | null): point is Coordinate => !!point);
  }
  if (Array.isArray(path) && path.length) {
    return path
      .map((point: any) =>
        Array.isArray(point)
          ? coordinateOf({latitude: point[0], longitude: point[1]})
          : latLng(point),
      )
      .filter((point: Coordinate | null): point is Coordinate => !!point);
  }
  const from =
    latLng(valueOf(item, 'startLatLng', 'fromLatLng', 'fromCoordinate')) ||
    coordinateOf(item?.fromMaster) ||
    coordinateOf({
      latitude: valueOf(item, 'fromLatitude', 'FromLatitude', 'startLatitude'),
      longitude: valueOf(
        item,
        'fromLongitude',
        'FromLongitude',
        'startLongitude',
      ),
    });
  const to =
    latLng(valueOf(item, 'endLatLng', 'toLatLng', 'toCoordinate')) ||
    coordinateOf(item?.toMaster) ||
    coordinateOf({
      latitude: valueOf(item, 'toLatitude', 'ToLatitude', 'endLatitude'),
      longitude: valueOf(item, 'toLongitude', 'ToLongitude', 'endLongitude'),
    });
  return [from, to].filter((point): point is Coordinate => !!point);
};
export const distanceToItem = (origin: Coordinate, item: any): number => {
  const points = pathOf(item);
  const own =
    coordinateOf(item) ||
    coordinateOf(item?.location) ||
    coordinateOf(item?.deviceMaster);
  if (own) {
    points.push(own);
  }
  if (!points.length) {
    return Infinity;
  }
  const rad = Math.PI / 180;
  const xy = (p: Coordinate) => ({
    x:
      (p.longitude - origin.longitude) *
      rad *
      6371000 *
      Math.cos(origin.latitude * rad),
    y: (p.latitude - origin.latitude) * rad * 6371000,
  });
  let distance = Math.min(
    ...points.map(p => {
      const v = xy(p);
      return Math.hypot(v.x, v.y);
    }),
  );
  for (let i = 1; i < points.length; i++) {
    const a = xy(points[i - 1]),
      b = xy(points[i]);
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy || 1)),
    );
    distance = Math.min(distance, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return distance;
};
export const typeOf = (item: any) =>
  String(
    valueOf(
      item,
      'infraType',
      'InfraType',
      'deviceMasterType',
      'DeviceMasterType',
      'masterType',
      'MasterType',
      'type',
      'Type',
    ),
  ).toLowerCase();
export const nodeIdOf = (item: any) =>
  String(
    valueOf(
      item,
      'deviceMasterId',
      'DeviceMasterId',
      'masterId',
      'MasterId',
      'splitterId',
      'customerId',
      'id',
      'Id',
    ),
  );
export const previousSplitterOf = (items: any[], target: any): any | null => {
  const directId = String(
    valueOf(
      target,
      'previousSplitterId',
      'PreviousSplitterId',
      'parentSplitterId',
      'fromMasterId',
      'FromMasterId',
    ),
  );
  let cursor = directId || nodeIdOf(target);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = items.find(
      item =>
        nodeIdOf(item) === cursor &&
        item !== target &&
        typeOf(item).includes('split'),
    );
    if (node) {
      return node;
    }
    const edge = items.find(
      item => String(valueOf(item, 'toMasterId', 'ToMasterId')) === cursor,
    );
    if (!edge) {
      return null;
    }
    cursor = String(valueOf(edge, 'fromMasterId', 'FromMasterId'));
  }
  return null;
};

// Route endpoints can describe a master even when the API omits a device card.
export const withEndpointNodes = (items: any[]): any[] => {
  const result = [...items];
  items.forEach(item => {
    (['from', 'to'] as const).forEach(prefix => {
      const id = valueOf(
        item,
        `${prefix}MasterId`,
        `${prefix === 'from' ? 'From' : 'To'}MasterId`,
      );
      if (!id || result.some(node => nodeIdOf(node) === String(id))) {
        return;
      }
      const path = pathOf(item);
      const coordinate = prefix === 'from' ? path[0] : path[path.length - 1];
      result.push({
        masterId: id,
        infraType: valueOf(item, `${prefix}MasterType`),
        masterName: valueOf(item, `${prefix}MasterName`),
        ...coordinate,
      });
    });
  });
  return result;
};

export const circuitModeOf = (item: any): 'infra' | 'customer' | null => {
  const mode = String(
    valueOf(
      item,
      'connectivityType',
      'ConnectivityType',
      'circuitType',
      'CircuitType',
    ),
  ).toLowerCase();
  const code = String(
    valueOf(item, 'circuitCode', 'CircuitCode', 'circuitId', 'CircuitId'),
  ).toLowerCase();
  if (
    mode.includes('customer') ||
    /\/(customer|cust|customerend)\//.test(code)
  ) {
    return 'customer';
  }
  if (mode.includes('infra') || /\/infra\//.test(code)) {
    return 'infra';
  }
  return null;
};
