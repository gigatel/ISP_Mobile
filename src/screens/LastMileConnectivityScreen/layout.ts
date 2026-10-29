import type {Splitter} from './types';
import type {SplitterCoordinate} from '../../services/lastMileConnectivityService';
import {hasSplitterCoordinate} from '../../services/lastMileConnectivityService';

export function getNumberedSplitterMarkers(splitters: Splitter[]) {
  const groups = new Map<
    string,
    {
      coordinate: SplitterCoordinate;
      items: {splitter: Splitter; number: number}[];
    }
  >();
  splitters.forEach((splitter, index) => {
    if (!hasSplitterCoordinate(splitter)) {
      return;
    }
    const key = `${splitter.latitude},${splitter.longitude}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        coordinate: {
          latitude: splitter.latitude,
          longitude: splitter.longitude,
        },
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push({splitter, number: index + 1});
  });
  return Array.from(groups, ([key, group]) => ({key, ...group}));
}

export function getSplitterListHeight(
  splitters: Splitter[],
  measurements: Record<string, number>,
  layoutKey: string,
): number | null {
  const visible = splitters.slice(0, 4);
  if (visible.some(splitter => !measurements[`${layoutKey}:${splitter.id}`])) {
    return null;
  }
  return visible.reduce(
    (height, splitter) =>
      height + measurements[`${layoutKey}:${splitter.id}`] + 8,
    0,
  );
}

export function getSplitterMapRegion(
  position: SplitterCoordinate,
  splitters: Splitter[],
  range: number,
  width: number,
  height: number,
  customerCoordinates: SplitterCoordinate[] = [],
) {
  const coordinates = [
    position,
    ...splitters.filter(hasSplitterCoordinate),
    ...customerCoordinates,
  ];
  const latitudes = coordinates.map(point => point.latitude);
  const longitudes = coordinates.map(point => point.longitude);
  const north = Math.max(...latitudes);
  const south = Math.min(...latitudes);
  const east = Math.max(...longitudes);
  const west = Math.min(...longitudes);
  const latitude = (north + south) / 2;
  const longitude = (east + west) / 2;
  const aspect = Math.max(0.1, width / Math.max(1, height));
  const latitudeScale = Math.max(0.1, Math.cos((latitude * Math.PI) / 180));
  const latitudeDelta = Math.min(
    180,
    Math.max(
      north - south,
      ((east - west) * latitudeScale) / aspect,
      (range * 2) / 111000,
    ) * 1.4,
  );
  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta: Math.min(360, (latitudeDelta * aspect) / latitudeScale),
  };
}
