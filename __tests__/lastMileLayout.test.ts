import {
  getNumberedSplitterMarkers,
  getSplitterListHeight,
  getSplitterMapRegion,
} from '../src/screens/LastMileConnectivityScreen/layout';
import type {Splitter} from '../src/screens/LastMileConnectivityScreen/types';

jest.mock('../src/apis', () => ({APIs: {}, URLs: {}}));

test('numbers every mapped splitter consistently with its list position and exposes shared locations', () => {
  const markers = getNumberedSplitterMarkers([
    splitters[0],
    {...splitters[1], latitude: null, longitude: null},
    {
      ...splitters[2],
      latitude: splitters[0].latitude,
      longitude: splitters[0].longitude,
    },
    splitters[3],
    splitters[4],
  ]);
  expect(markers[0].items.map(item => item.number)).toEqual([1, 3]);
  expect(
    markers.flatMap(group => group.items.map(item => item.number)),
  ).toEqual([1, 3, 4, 5]);
});
const splitters: Splitter[] = Array.from({length: 5}, (_, index) => ({
  id: String(index),
  name: `Splitter ${index}`,
  free: 4,
  distance: 50,
  latitude: 28.6 + index * 0.001,
  longitude: 77.2 + index * 0.001,
}));

test('reserves exactly the first four cards and keeps extra cards inside the list', () => {
  const measurements = Object.fromEntries(
    splitters.map(item => [`360:1:${item.id}`, 120]),
  );
  expect(getSplitterListHeight(splitters, measurements, '360:1')).toBe(512);
  expect(
    getSplitterListHeight(splitters.slice(0, 2), measurements, '360:1'),
  ).toBe(256);
});

test('waits for all visible rows before placing the map, including after rotation or font scaling', () => {
  expect(
    getSplitterListHeight(splitters, {'360:1:0': 120}, '360:1'),
  ).toBeNull();
  const measurements = Object.fromEntries(
    splitters.map(item => [`360:1:${item.id}`, 120]),
  );
  expect(getSplitterListHeight(splitters, measurements, '720:1')).toBeNull();
  expect(getSplitterListHeight(splitters, measurements, '360:1.4')).toBeNull();
  expect(getSplitterListHeight([], {}, '360:1')).toBe(0);
});

test('map bounds contain the device and all valid splitter positions in both map sizes', () => {
  const position = {latitude: 28.59, longitude: 77.19};
  for (const [width, height] of [
    [330, 280],
    [360, 720],
  ]) {
    const region = getSplitterMapRegion(
      position,
      splitters,
      200,
      width,
      height,
    );
    for (const point of [position, ...splitters]) {
      expect(Math.abs(point.latitude! - region.latitude)).toBeLessThan(
        region.latitudeDelta / 2,
      );
      expect(Math.abs(point.longitude! - region.longitude)).toBeLessThan(
        region.longitudeDelta / 2,
      );
    }
  }
});

test('no results still produces a usable GPS-centered map without zero zoom', () => {
  const position = {latitude: 28.6, longitude: 77.2};
  const region = getSplitterMapRegion(position, [], 200, 330, 280);
  expect(region).toMatchObject(position);
  expect(region.latitudeDelta).toBeGreaterThan(0);
  expect(region.longitudeDelta).toBeGreaterThan(0);
  expect(
    getSplitterMapRegion(
      position,
      [{...splitters[0], latitude: null, longitude: null}],
      200,
      330,
      280,
    ),
  ).toEqual(region);
});

test('map region is stable for equivalent refreshed data and expands with the selected range', () => {
  const position = {latitude: 28.6, longitude: 77.2};
  expect(getSplitterMapRegion(position, splitters, 200, 330, 280)).toEqual(
    getSplitterMapRegion(
      {...position},
      splitters.map(item => ({...item})),
      200,
      330,
      280,
    ),
  );
  expect(
    getSplitterMapRegion(position, [], 1000, 330, 280).latitudeDelta,
  ).toBeGreaterThan(
    getSplitterMapRegion(position, [], 200, 330, 280).latitudeDelta,
  );
});

test('both map sizes fit customer endpoints along with their splitters', () => {
  const position = {latitude: 28.59, longitude: 77.19};
  const customers = [{latitude: 28.72, longitude: 77.38}];
  for (const [width, height] of [
    [330, 280],
    [360, 720],
  ]) {
    const region = getSplitterMapRegion(
      position,
      splitters,
      200,
      width,
      height,
      customers,
    );
    for (const point of [position, ...splitters, ...customers]) {
      expect(Math.abs(point.latitude! - region.latitude)).toBeLessThan(
        region.latitudeDelta / 2,
      );
      expect(Math.abs(point.longitude! - region.longitude)).toBeLessThan(
        region.longitudeDelta / 2,
      );
    }
  }
});
