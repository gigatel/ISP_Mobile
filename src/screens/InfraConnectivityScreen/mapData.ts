import {
  Coordinate,
  coordinateOf,
  nodeIdOf,
  pathOf,
  typeOf,
  valueOf,
} from './connectivity';

export type RouteMasters = {routeFiberId: number; masters: any[]};
export type MapNode = {
  key: string;
  coordinate: Coordinate;
  type: string;
  title: string;
  description: string;
  data: Record<string, any>;
  routeFiberIds: number[];
};
export const flattenMapItems = (items: any[]): any[] => {
  const result: any[] = [];
  const seen = new Set<any>();
  const visit = (item: any) => {
    if (!item || typeof item !== 'object' || seen.has(item)) {
      return;
    }
    seen.add(item);
    result.push(item);
    [
      'routeList',
      'RouteList',
      'routes',
      'Routes',
      'connectivityList',
      'ConnectivityList',
      'details',
    ].forEach(key => {
      if (Array.isArray(item[key])) {
        item[key].forEach(visit);
      }
    });
  };
  items.forEach(visit);
  return result;
};
export const routeMappingIdOf = (item: any) =>
  Number(valueOf(item, 'routeFiberMappingId', 'RouteFiberMappingId'));

export const routeFiberIdsOf = (items: any[]) => [
  ...new Set(
    flattenMapItems(items)
      .map(item => routeMappingIdOf(item))
      .filter(id => Number.isInteger(id) && id > 0),
  ),
];

export const buildConnectivityMapData = (
  items: any[],
  groups: RouteMasters[],
) => {
  const nodes: MapNode[] = [];
  const paths: {key: string; coordinates: Coordinate[]}[] = [];
  const anchors = new Map<string, Coordinate>();
  const addNode = (
    item: any,
    coordinate: Coordinate,
    fallbackKey: string,
    fallbackType = 'master',
    routeFiberId?: number,
    identityItem = item,
  ) => {
    const type = typeOf(identityItem) || typeOf(item) || fallbackType;
    const id = type.includes('switch')
      ? String(valueOf(item, 'deviceId', 'DeviceId') || nodeIdOf(item))
      : type.includes('customer')
      ? String(valueOf(item, 'customerId', 'id', 'customerName') || fallbackKey)
      : nodeIdOf(item);
    const key = `${type}-${id || fallbackKey}-${coordinate.latitude},${
      coordinate.longitude
    }`;
    const existing = nodes.find(node => node.key === key);
    if (existing) {
      existing.data = {
        ...existing.data,
        ...Object.fromEntries(
          Object.entries(item).filter(
            ([, value]) => value != null && value !== '',
          ),
        ),
      };
      if (routeFiberId && !existing.routeFiberIds.includes(routeFiberId)) {
        existing.routeFiberIds.push(routeFiberId);
      }
      return existing;
    }
    const code = valueOf(
      identityItem,
      'mastercode',
      'masterCode',
      'MasterCode',
      'deviceCode',
    );
    const name =
      valueOf(
        identityItem,
        'switchName',
        'splitterName',
        'customerName',
        'masterName',
        'name',
      ) || type;
    const node: MapNode = {
      key,
      coordinate,
      type,
      title: `${code ? `(${code}) ` : ''}${name}`,
      data: {...item},
      routeFiberIds: routeFiberId ? [routeFiberId] : [],
      description: String(
        valueOf(item, 'selectedAddress', 'address', 'area') || type,
      ),
    };
    nodes.push(node);
    return node;
  };
  // Each route has its own ordered path; never join unrelated route arrays.
  groups.forEach(group => {
    const masters = [...group.masters].sort(
      (a, b) => Number(a.orderNo ?? 0) - Number(b.orderNo ?? 0),
    );
    let segment: Coordinate[] = [];
    let segmentIndex = 0;
    const finishSegment = () => {
      if (segment.length > 1) {
        paths.push({
          key: `fiber-${group.routeFiberId}-${segmentIndex++}`,
          coordinates: segment,
        });
      }
      segment = [];
    };
    masters.forEach((master, index) => {
      const coordinate = coordinateOf(master);
      if (!coordinate) {
        finishSegment();
        return;
      }
      segment.push(coordinate);
      addNode(
        master,
        coordinate,
        `fiber-${group.routeFiberId}-${index}`,
        'point',
        group.routeFiberId,
      );
      [
        nodeIdOf(master),
        valueOf(master, 'placedTypeId'),
        valueOf(master, 'placedEnclosureId'),
      ].forEach(id => {
        if (id !== '' && id != null) {
          anchors.set(String(id), coordinate);
        }
      });
      if (master.placedTypeId && master.placedMasterType) {
        addNode(
          {
            ...master,
            id: master.placedTypeId,
            masterType: master.placedMasterType,
            masterName: master.placedTypeName || master.placedMasterType,
            mastercode: master.placedOnMasterCode,
          },
          coordinate,
          `placement-${group.routeFiberId}-${index}`,
          'master',
          group.routeFiberId,
        );
      }
      if (master.placedEnclosureId) {
        addNode(
          {
            ...master,
            id: master.placedEnclosureId,
            masterType: master.placedEnclosureType || 'Enclosure',
            mastercode: master.placedEnclosureCode,
            masterName: master.placedEnclosureType || 'Enclosure',
          },
          coordinate,
          `enclosure-${group.routeFiberId}-${index}`,
          'enclosure',
          group.routeFiberId,
        );
      }
    });
    finishSegment();
  });
  // Circuit device records provide endpoint switches even when their master
  // IDs differ from the Point IDs returned by the route-master endpoint.
  const endpointOf = (routeFiberId: number, end: 'first' | 'last') => {
    const group = groups.find(route => route.routeFiberId === routeFiberId);
    if (!group?.masters.length) {
      return null;
    }
    const ordered = [...group.masters].sort(
      (a, b) => Number(a.orderNo ?? 0) - Number(b.orderNo ?? 0),
    );
    const master = end === 'first' ? ordered[0] : ordered[ordered.length - 1];
    const coordinate = coordinateOf(master);
    return coordinate ? {master, coordinate} : null;
  };
  const addEndpointSwitch = (
    device: any,
    routeFiberId: number,
    end: 'first' | 'last',
    key: string,
  ) => {
    const endpoint = endpointOf(routeFiberId, end);
    if (!endpoint) {
      return;
    }
    addNode(
      {
        ...endpoint.master,
        ...device,
        infraType: 'Switch',
        endpoint: end === 'first' ? 'Route start' : 'Route end',
      },
      endpoint.coordinate,
      key,
      'switch',
      routeFiberId,
      {...device, infraType: 'Switch'},
    );
  };
  items.forEach((circuit, circuitIndex) => {
    const local = flattenMapItems([circuit]);
    const routes = local.filter(
      item => routeMappingIdOf(item) > 0 && !typeOf(item).includes('switch'),
    );
    if (!routes.length) {
      return;
    }
    local.forEach((device, deviceIndex) => {
      if (!typeOf(device).includes('switch')) {
        return;
      }
      // A switch between route blocks terminates one block and starts the next.
      const neighborRoute = (direction: number) => {
        for (
          let index = deviceIndex + direction;
          index >= 0 && index < local.length;
          index += direction
        ) {
          if (typeOf(local[index]).includes('switch')) {
            return undefined;
          }
          if (routes.includes(local[index])) {
            return local[index];
          }
        }
        return undefined;
      };
      const before = neighborRoute(-1);
      const after = neighborRoute(1);
      if (before) {
        addEndpointSwitch(
          device,
          routeMappingIdOf(before),
          'last',
          `switch-before-${circuitIndex}-${deviceIndex}`,
        );
      }
      if (after) {
        addEndpointSwitch(
          device,
          routeMappingIdOf(after),
          'first',
          `switch-after-${circuitIndex}-${deviceIndex}`,
        );
      }
    });
    (['from', 'to'] as const).forEach(prefix => {
      const cap = prefix === 'from' ? 'From' : 'To';
      const deviceId = valueOf(circuit, `${prefix}DeviceId`, `${cap}DeviceId`);
      const deviceName = valueOf(
        circuit,
        `${prefix}DeviceName`,
        `${cap}DeviceName`,
      );
      if (!deviceId && !deviceName) {
        return;
      }
      const detail =
        local.find(
          item =>
            deviceId &&
            String(valueOf(item, 'deviceId', 'DeviceId')) === String(deviceId),
        ) || {};
      const deviceCode = valueOf(
        circuit,
        `${prefix}DeviceCode`,
        `${cap}DeviceCode`,
      );
      const port = valueOf(
        circuit,
        `${prefix}PortName`,
        `${prefix}PortAlias`,
        `${prefix}PortDescription`,
      );
      const route = prefix === 'from' ? routes[0] : routes[routes.length - 1];
      const endpoint = prefix === 'from' ? 'first' : 'last';
      addEndpointSwitch(
        {
          ...detail,
          deviceId: deviceId || valueOf(detail, 'deviceId'),
          deviceCode: deviceCode || valueOf(detail, 'deviceCode'),
          switchName: deviceName || valueOf(detail, 'switchName', 'deviceName'),
          port: port || valueOf(detail, 'port', 'portName'),
        },
        routeMappingIdOf(route),
        endpoint,
        `circuit-${circuitIndex}-${prefix}`,
      );
    });
  });
  flattenMapItems(items).forEach((item, index) => {
    const own =
      coordinateOf(item) ||
      coordinateOf(item.location) ||
      coordinateOf(item.deviceMaster);
    const routeFiberId = routeMappingIdOf(item);
    const anchor =
      routeFiberId > 0 ||
      typeOf(item).includes('route') ||
      typeOf(item).includes('customer')
        ? undefined
        : anchors.get(nodeIdOf(item));
    const coordinate = own || anchor;
    if (coordinate) {
      const itemNodeId = nodeIdOf(item);
      const matches = (master: any) =>
        !!itemNodeId &&
        !typeOf(item).includes('customer') &&
        [
          nodeIdOf(master),
          String(master.placedTypeId ?? ''),
          String(master.placedEnclosureId ?? ''),
        ].includes(itemNodeId);
      const linkedMaster = groups.flatMap(group => group.masters).find(matches);
      const linkedGroups = groups.filter(group => group.masters.some(matches));
      const added = addNode(
        {...linkedMaster, ...item},
        coordinate,
        `item-${index}`,
        'master',
        linkedGroups[0]?.routeFiberId,
        item,
      );
      if (added) {
        linkedGroups.forEach(group => {
          if (!added.routeFiberIds.includes(group.routeFiberId)) {
            added.routeFiberIds.push(group.routeFiberId);
          }
        });
      }
      if (
        own &&
        anchor &&
        (own.latitude !== anchor.latitude || own.longitude !== anchor.longitude)
      ) {
        paths.push({key: `device-${index}`, coordinates: [own, anchor]});
      }
    }
    const id = routeMappingIdOf(item);
    // Ordered masters replace the old endpoint-only route line when available.
    if (
      !groups.some(
        group =>
          group.routeFiberId === id &&
          group.masters.some(master => coordinateOf(master)),
      )
    ) {
      const path = pathOf(item);
      if (path.length > 1) {
        paths.push({key: `route-${index}`, coordinates: path});
      }
      if (path.length) {
        addNode(
          {
            masterId: valueOf(item, 'fromMasterId', 'FromMasterId'),
            masterName:
              valueOf(item, 'fromMasterName', 'FromMasterName') ||
              'Route start',
            masterType:
              valueOf(item, 'fromMasterType', 'FromMasterType') || 'Point',
          },
          path[0],
          `start-${index}`,
        );
        if (path.length > 1) {
          addNode(
            {
              masterId: valueOf(item, 'toMasterId', 'ToMasterId'),
              masterName:
                valueOf(item, 'toMasterName', 'ToMasterName') || 'Route end',
              masterType:
                valueOf(item, 'toMasterType', 'ToMasterType') || 'Point',
            },
            path[path.length - 1],
            `end-${index}`,
          );
        }
      }
    }
  });
  // Attach customer connections to their own route, not to a different
  // nearby fiber. Orient the geometry using the customer's actual GPS fix.
  const flat = flattenMapItems(items);
  flat
    .filter(
      item =>
        typeOf(item).includes('customer') &&
        valueOf(item, 'connectedSplitterId') !== '',
    )
    .forEach((connection, index) => {
      const customerCoordinate = coordinateOf(connection);
      const splitterId = String(connection.connectedSplitterId);
      const splitter = flat.find(
        item =>
          typeOf(item).includes('split') &&
          String(valueOf(item, 'splitterId', 'deviceId', 'masterId', 'id')) ===
            splitterId,
      );
      const group = groups.find(
        route =>
          route.routeFiberId === Number(connection.connectionRouteFiberId),
      );
      if (customerCoordinate) {
        addNode(
          connection,
          customerCoordinate,
          `customer-${index}`,
          'customer',
          group?.routeFiberId,
        );
      }
      const ordered = [...(group?.masters || [])].sort(
        (a, b) => Number(a.orderNo ?? 0) - Number(b.orderNo ?? 0),
      );
      const first = coordinateOf(ordered[0]),
        last = coordinateOf(ordered[ordered.length - 1]);
      const distance = (a: Coordinate, b: Coordinate) =>
        Math.hypot(
          a.latitude - b.latitude,
          (a.longitude - b.longitude) * Math.cos((a.latitude * Math.PI) / 180),
        );
      const nearFirst = !!(
        customerCoordinate &&
        first &&
        last &&
        distance(customerCoordinate, first) < distance(customerCoordinate, last)
      );
      const customerEnd = nearFirst ? first : last;
      const splitterEnd = nearFirst ? last : first;
      const splitterCoordinate = splitter
        ? coordinateOf(splitter) ||
          anchors.get(splitterId) ||
          anchors.get(String(valueOf(splitter, 'masterSiteId'))) ||
          (customerCoordinate ? splitterEnd : null)
        : null;
      if (splitter && splitterCoordinate) {
        addNode(
          splitter,
          splitterCoordinate,
          `customer-splitter-${index}`,
          'splitter',
          group?.routeFiberId,
        );
        if (splitterEnd && distance(splitterCoordinate, splitterEnd) > 0) {
          paths.push({
            key: `splitter-route-${index}`,
            coordinates: [splitterCoordinate, splitterEnd],
          });
        }
      }
      if (
        customerCoordinate &&
        customerEnd &&
        distance(customerCoordinate, customerEnd) > 0
      ) {
        paths.push({
          key: `customer-route-${index}`,
          coordinates: [customerEnd, customerCoordinate],
        });
      } else if (!group && customerCoordinate && splitterCoordinate) {
        paths.push({
          key: `splitter-customer-${index}`,
          coordinates: [splitterCoordinate, customerCoordinate],
        });
      }
    });
  return {nodes, paths};
};
