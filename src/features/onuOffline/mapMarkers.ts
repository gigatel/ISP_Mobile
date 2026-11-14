import {OnuCustomer, parseLatLng} from './model';
export interface OnuMapLocation {
  customer: OnuCustomer;
  coordinate: {latitude: number; longitude: number};
}
export function onuMapLocations(customers: OnuCustomer[]): OnuMapLocation[] {
  return customers.flatMap(customer => {
    const coordinate = parseLatLng(customer.LatLng);
    return coordinate ? [{customer, coordinate}] : [];
  });
}
// Reduce native marker count for large live datasets without adding a map library.
// Recompute at the current zoom; each customer belongs to exactly one grid cell.
export function groupOnuMarkers(
  locations: OnuMapLocation[],
  latitudeDelta: number,
  longitudeDelta: number,
) {
  if (locations.length < 150) {
    return locations.map(item => ({
      key: item.customer.key,
      coordinate: item.coordinate,
      items: [item],
    }));
  }
  const latStep = Math.max(latitudeDelta / 8, 0.00001);
  const lngStep = Math.max(longitudeDelta / 8, 0.00001);
  const groups = new Map<string, OnuMapLocation[]>();
  for (const item of locations) {
    const key = `${Math.floor(
      (item.coordinate.latitude + 90) / latStep,
    )}:${Math.floor((item.coordinate.longitude + 180) / lngStep)}`;
    const items = groups.get(key) ?? [];
    items.push(item);
    groups.set(key, items);
  }
  return Array.from(groups, ([key, items]) => ({
    key,
    coordinate: {
      latitude:
        items.reduce((sum, item) => sum + item.coordinate.latitude, 0) /
        items.length,
      longitude:
        items.reduce((sum, item) => sum + item.coordinate.longitude, 0) /
        items.length,
    },
    items,
  }));
}
