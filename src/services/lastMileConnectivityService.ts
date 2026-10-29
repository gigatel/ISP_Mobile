import {APIs, URLs} from '@apis';
import type {Splitter} from '../screens/LastMileConnectivityScreen/types';

export type SplitterCoordinate = {latitude: number; longitude: number};
const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const text = (value: unknown) => String(value ?? '').trim();

export function parseSplitterCoordinate(
  value: unknown,
): SplitterCoordinate | null {
  const parts = text(value).split(',');
  if (parts.length !== 2) {
    return null;
  }
  const latitude = numberOrNull(parts[0]);
  const longitude = numberOrNull(parts[1]);
  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return {latitude, longitude};
}

export function normalizeNearbySplitter(
  row: Record<string, unknown>,
): Splitter | null {
  const id = text(row.id ?? row.splitterId);
  if (!id) {
    return null;
  }
  const coordinate = parseSplitterCoordinate(row.masterLatLng);
  const splitterType = text(row.splitterType);
  const portMatch = splitterType.match(/^1\s*[:/]\s*(\d+)$/);
  return {
    id,
    source: 'api',
    name:
      text(row.laymenCode) ||
      text(row.parentSplitterCode) ||
      text(row.splitterCode) ||
      `Splitter ${id}`,
    code: text(row.splitterCode),
    displayCode: text(row.parentSplitterCode),
    splitterId: numberOrNull(row.splitterId) ?? undefined,
    splitterDetailId: numberOrNull(row.splitterDetailId ?? row.id) ?? undefined,
    free: Math.max(0, numberOrNull(row.freePorts) ?? 0),
    distance: numberOrNull(row.distanceMeters),
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
    splitterType,
    totalPorts: portMatch ? Number(portMatch[1]) : undefined,
    connectedCustomers: numberOrNull(row.totalConnectedCustomers) ?? undefined,
    address: text(row.masterAdd),
    landmark: text(row.masterLandmark),
    opticalPowerIn: numberOrNull(row.opticalPowerIn),
    opticalPowerOut: numberOrNull(row.opticalPowerOut),
    rxPower: numberOrNull(row.rxPower),
    txPower: numberOrNull(row.txPower),
    masterSiteId: numberOrNull(row.masterSiteId) ?? undefined,
    deviceId: numberOrNull(row.deviceId) ?? undefined,
    portId: numberOrNull(row.portId) ?? undefined,
  };
}

export function hasSplitterCoordinate(
  splitter: Splitter,
): splitter is Splitter & SplitterCoordinate {
  return splitter.latitude !== null && splitter.longitude !== null;
}

export function splitterRatio(splitter: Splitter): string {
  const type = splitter.splitterType?.trim() || '';
  const ratio = type.match(/(\d+)\s*[:/]\s*(\d+)/);
  if (ratio) {
    return `${ratio[1]}:${ratio[2]}`;
  }
  if (/^\d+$/.test(type) && Number(type) > 0) {
    return `1:${Number(type)}`;
  }
  if (type) {
    return type;
  }
  if (splitter.totalPorts) {
    return `1:${splitter.totalPorts}`;
  }
  // Display fallback requested for API rows with no splitterType. This does
  // not infer or change the splitter's physical totalPorts from freePorts.
  if (splitter.source === 'api') {
    return splitter.free > 0 ? `1:${splitter.free}` : '—';
  }
  return '1:8';
}

export const splitterTitle = (splitter: Splitter) =>
  `${splitter.name}${
    splitter.displayCode
      ? ` (${splitter.displayCode})`
      : splitter.source === 'api'
      ? ''
      : ` (${splitter.id})`
  }`;
export const powerLabel = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value} dBm`;
export const distanceLabel = (value: number | null) =>
  value === null ? '—' : `${Number(value.toFixed(2))}m`;

export const sortSplittersByDistance = (splitters: Splitter[]) =>
  [...splitters].sort(
    (first, second) =>
      (first.distance ?? Number.POSITIVE_INFINITY) -
      (second.distance ?? Number.POSITIVE_INFINITY),
  );

export async function getNearbyCustomerSplitters(
  range: number,
  coordinate: SplitterCoordinate,
): Promise<Splitter[]> {
  const response = await APIs.getRequestWithQuery({
    path: URLs.getNearbyCustomerSplitters,
    params: `?Range=${encodeURIComponent(range)}&LatLng=${encodeURIComponent(
      `${coordinate.latitude},${coordinate.longitude}`,
    )}`,
    isAuth: true,
  });
  if (
    response?.success === false ||
    (response?.success !== true && Number(response?.status) !== 200)
  ) {
    throw new Error(
      response?.message || 'Could not load nearby splitters. Please retry.',
    );
  }
  if (!Array.isArray(response.data)) {
    throw new Error('Invalid splitter list response. Please retry.');
  }
  return sortSplittersByDistance(
    response.data
      .filter((row: unknown) => row && typeof row === 'object')
      .map(normalizeNearbySplitter)
      .filter(
        (splitter: Splitter | null): splitter is Splitter => splitter !== null,
      ),
  );
}
