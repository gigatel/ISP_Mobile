import {CustomerCard} from './CustomerConnectivityCards';
import {valueOf} from './connectivity';

// Use route mapping IDs for route-master lookups, including customer fiber mappings.
export const customerMapItemsOf = (
  cards: CustomerCard[],
  routeItems: any[] = [],
) => {
  const items: any[] = [...routeItems];
  const ids = new Set<number>();
  const routeId = (value: any) =>
    Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;
  cards.forEach(card => {
    const data = card.data;
    const incoming =
      ['routeFiberMappingId', 'RouteFiberMappingId', 'fiberMappingId']
        .map(key => routeId(data[key]))
        .find(Boolean) || 0;
    const outgoing =
      ['outRouteFiberMappingId', 'outFiberMappingId']
        .map(key => routeId(data[key]))
        .find(Boolean) || 0;
    [incoming, outgoing].filter(Boolean).forEach(id => {
      if (!ids.has(id)) {
        items.push({infraType: 'Route', routeFiberMappingId: id});
        ids.add(id);
      }
    });
    if (card.kind === 'splitter') {
      items.push({
        ...data,
        infraType: 'Splitter',
        splitterName:
          valueOf(
            data,
            'splitterName',
            'splitterLaymenCode',
            'masterName',
            'deviceName',
          ) || valueOf(data, 'splitterCode'),
        masterName:
          valueOf(
            data,
            'splitterName',
            'splitterLaymenCode',
            'masterName',
            'deviceName',
          ) || valueOf(data, 'splitterCode'),
        mastercode: valueOf(data, 'splitterCode', 'mastercode', 'masterCode'),
      });
    } else {
      items.push({
        ...data,
        infraType: 'Customer',
        latLng: valueOf(data, 'customerLatLng', 'latLng'),
        connectedSplitterId: valueOf(data, 'splitterId', 'connectedSplitterId'),
        connectionRouteFiberId: outgoing || incoming,
      });
    }
  });
  return items;
};
