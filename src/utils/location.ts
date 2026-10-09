// @utils/location.ts
import Geolocation, {
  GeolocationResponse,
} from '@react-native-community/geolocation';
import {DataType} from '@types';
import {Linking, Platform} from 'react-native';
import {
  isLocationEnabled,
  promptForEnableLocationIfNeeded,
} from 'react-native-android-location-enabler';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
} from 'react-native-permissions';
import {alert, error, log} from './common';
import {getData, setData} from './preferences';
import {postNowWithCoords} from '../../src/services/LocationPosterCore';
import {OLA_MAP_API} from '@env';

let watchId: number | null = null;
let lastFix: {lat: number; long: number; ts: number} | null = null;
let lastKnownAddress: string = '';
let reverseGeocodeCache: {
  lat: number;
  long: number;
  addressList: string[];
  ts: number;
} | null = null;
let reverseGeocodeInFlight: {
  key: string;
  promise: Promise<string[]>;
} | null = null;

const OLA_REVERSE_GEOCODE_URL =
  'https://api.olamaps.io/places/v1/reverse-geocode';
const OLA_API_KEY = OLA_MAP_API;
const REVERSE_GEOCODE_CACHE_MS = 60_000;
const CACHED_ADDRESS_RADIUS_METERS = 500;
// Infrastructure masters need the address at the GPS fix itself. A reverse
// geocoder can otherwise return a popular place from much farther away.
const EXACT_ADDRESS_RADIUS_METERS = 25;
const PRIMARY_GPS_TIMEOUT_MS = 20_000;
const RETRY_GPS_TIMEOUT_MS = 30_000;
const RECENT_FIX_MAX_AGE_MS = 2 * 60_000;

const isUsableCoordinate = (lat: unknown, long: unknown) => {
  const latitude = Number(lat);
  const longitude = Number(long);
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
};

const distanceInMeters = (
  firstLat: number,
  firstLong: number,
  secondLat: number,
  secondLong: number,
) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latDistance = radians(secondLat - firstLat);
  const longDistance = radians(secondLong - firstLong);
  const value =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(radians(firstLat)) *
      Math.cos(radians(secondLat)) *
      Math.sin(longDistance / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const nearbyCachedAddress = (lat: number, long: number) => {
  if (
    reverseGeocodeCache?.addressList.length &&
    distanceInMeters(
      lat,
      long,
      reverseGeocodeCache.lat,
      reverseGeocodeCache.long,
    ) <= CACHED_ADDRESS_RADIUS_METERS
  ) {
    return reverseGeocodeCache.addressList;
  }

  const saved = getData('LAST_GEO_ADDRESS') as DataType.GeoAddress | undefined;
  const savedLat = Number(saved?.lat);
  const savedLong = Number(saved?.long);
  const savedAddress = String(saved?.address ?? '').trim();
  return savedAddress &&
    Number.isFinite(savedLat) &&
    Number.isFinite(savedLong) &&
    distanceInMeters(lat, long, savedLat, savedLong) <=
      CACHED_ADDRESS_RADIUS_METERS
    ? [savedAddress]
    : [];
};

// ─────────────────────────────────────────────────────────────────────────────
export const initializeConfig = async () => {
  try {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'always',
      enableBackgroundLocationUpdates: true,
      // Force Android's fused provider. With `auto`, some devices select the
      // satellite-only provider for high-accuracy requests and return no fix
      // even while a fresh fused/network coordinate is available.
      locationProvider: Platform.OS === 'android' ? 'playServices' : 'auto',
    } as any);
  } catch (e) {
    __DEV__ && console.warn('initializeConfig error', e);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// XHR-based reverse geocode — more reliable than fetch() in Android 16 bg
// ─────────────────────────────────────────────────────────────────────────────
const olaReverseGeocodeRequest = (
  lat: number,
  long: number,
): Promise<string[] | null> =>
  new Promise(resolve => {
    const url = `${OLA_REVERSE_GEOCODE_URL}?latlng=${lat},${long}&api_key=${OLA_API_KEY}`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader(
      'X-Request-Id',
      `isp-mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    xhr.timeout = 10000;

    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) {
          console.error('❌ Ola API error:', xhr.status, xhr.responseText);
          return resolve(xhr.status >= 500 ? null : []);
        }
        const json = JSON.parse(xhr.responseText);
        const results = json?.results || json?.geocodingResults || [];
        const addressList: string[] = results
          .map(
            (item: any) =>
              item?.formatted_address || item?.formattedAddress || '',
          )
          .filter((a: string) => !!a)
          .slice(0, 5);
        resolve(addressList);
      } catch (e) {
        console.error('❌ Ola parse error:', e);
        resolve([]);
      }
    };

    xhr.onerror = () => resolve(null);
    xhr.ontimeout = () => resolve(null);

    xhr.send();
  });

const getResultCoordinate = (item: any) => {
  const latitude = Number(
    item?.geometry?.location?.lat ??
      item?.geometry?.location?.latitude ??
      item?.location?.lat ??
      item?.location?.latitude ??
      item?.lat ??
      item?.latitude,
  );
  const longitude = Number(
    item?.geometry?.location?.lng ??
      item?.geometry?.location?.lon ??
      item?.geometry?.location?.longitude ??
      item?.location?.lng ??
      item?.location?.lon ??
      item?.location?.longitude ??
      item?.lng ??
      item?.lon ??
      item?.longitude,
  );

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? {latitude, longitude}
    : null;
};

/** Strict lookup used for masters: never use cached or distant-place data. */
const olaExactReverseGeocodeRequest = (
  lat: number,
  long: number,
): Promise<string[]> =>
  new Promise(resolve => {
    if (!OLA_API_KEY) {
      resolve([]);
      return;
    }

    const url = `${OLA_REVERSE_GEOCODE_URL}?latlng=${lat},${long}&api_key=${OLA_API_KEY}`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader(
      'X-Request-Id',
      `isp-mobile-exact-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    );
    xhr.timeout = 10000;

    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) {
          resolve([]);
          return;
        }

        const json = JSON.parse(xhr.responseText);
        const results = json?.results || json?.geocodingResults || [];
        const addresses = results
          .filter((item: any) => {
            const coordinate = getResultCoordinate(item);
            return (
              coordinate !== null &&
              distanceInMeters(
                lat,
                long,
                coordinate.latitude,
                coordinate.longitude,
              ) <= EXACT_ADDRESS_RADIUS_METERS
            );
          })
          .map(
            (item: any) =>
              item?.formatted_address || item?.formattedAddress || '',
          )
          .filter(
            (value: string, index: number, values: string[]) =>
              Boolean(value) && values.indexOf(value) === index,
          )
          .slice(0, 5);
        resolve(addresses);
      } catch {
        resolve([]);
      }
    };

    xhr.onerror = () => resolve([]);
    xhr.ontimeout = () => resolve([]);
    xhr.send();
  });

const olaReverseGeocode = async (
  lat: number,
  long: number,
): Promise<string[]> => {
  if (!lat || !long || !Number.isFinite(lat) || !Number.isFinite(long)) {
    console.warn('❌ Invalid coordinates');
    return [];
  }
  if (!OLA_API_KEY) {
    console.error('❌ OLA_API_KEY missing');
    return nearbyCachedAddress(lat, long);
  }

  if (
    reverseGeocodeCache &&
    Date.now() - reverseGeocodeCache.ts < REVERSE_GEOCODE_CACHE_MS &&
    distanceInMeters(
      lat,
      long,
      reverseGeocodeCache.lat,
      reverseGeocodeCache.long,
    ) <= CACHED_ADDRESS_RADIUS_METERS
  ) {
    return reverseGeocodeCache.addressList;
  }

  const requestKey = `${lat.toFixed(5)},${long.toFixed(5)}`;
  if (reverseGeocodeInFlight?.key === requestKey) {
    return reverseGeocodeInFlight.promise;
  }

  const reverseGeocodePromise = (async () => {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const addressList = await olaReverseGeocodeRequest(lat, long);
      if (addressList !== null) {
        if (addressList.length) {
          reverseGeocodeCache = {lat, long, addressList, ts: Date.now()};
        }
        return addressList.length
          ? addressList
          : nearbyCachedAddress(lat, long);
      }
      if (attempt === 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.warn('Ola reverse geocode unavailable; using cached address.');
    return nearbyCachedAddress(lat, long);
  })();

  reverseGeocodeInFlight = {key: requestKey, promise: reverseGeocodePromise};
  try {
    return await reverseGeocodePromise;
  } finally {
    if (reverseGeocodeInFlight?.promise === reverseGeocodePromise) {
      reverseGeocodeInFlight = null;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Public address helpers
// ─────────────────────────────────────────────────────────────────────────────
export const getAddressFromLatLong = async (
  exactAddressOnly = false,
): Promise<DataType.GeoAddress> => {
  try {
    const info = (await getGeoLocation()) as DataType.GeoLocation;
    if (!info)
      return {address: 'Address Not Found', addressList: [], lat: 0, long: 0};
    const {latitude: lat, longitude: long} = info?.coords;
    const addressList = exactAddressOnly
      ? await olaExactReverseGeocodeRequest(lat, long)
      : await olaReverseGeocode(lat, long);
    return {
      address:
        addressList?.[0] || (exactAddressOnly ? '' : 'Address Not Found'),
      addressList: addressList || [],
      lat,
      long,
    };
  } catch (err: any) {
    return {address: 'Address Not Found', addressList: [], lat: 0, long: 0};
  }
};

export const getAddressWithLatLong = async (
  lat: number,
  long: number,
): Promise<DataType.GeoAddress> => {
  try {
    if (typeof lat !== 'number' || typeof long !== 'number') {
      return {address: '', lat: lat ?? 0, long: long ?? 0};
    }
    const addressList = await olaReverseGeocode(lat, long);
    const addressComponent: DataType.GeoAddress = {
      address: addressList[0] || '',
      addressList,
      lat,
      long,
    };
    console.info('Geo Address', {addressComponent});
    return addressComponent;
  } catch (err: any) {
    error('Error fetching address: ', err?.message ?? '');
    return {address: '', lat: lat ?? 0, long: long ?? 0};
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// startLocationWatch — Android 13 + Android 16 compatible
//
// ANDROID 16 KEY POINTS:
// 1. olaReverseGeocode now uses XHR (not fetch) — survives bg thread suspension
// 2. postNowWithCoords uses XHR internally when dispatchRef is null
// 3. watchPosition callback errors are fully isolated — one failure never
//    kills the watcher
// 4. distanceFilter=10 prevents Android 16 location rate-limiter from
//    throttling our updates
// ─────────────────────────────────────────────────────────────────────────────
export const startLocationWatch = () => {
  if (watchId !== null) {
    __DEV__ && console.log('[LocationWatch] already running — skip');
    return;
  }

  console.log('[LocationWatch] starting…');

  watchId = Geolocation.watchPosition(
    async pos => {
      const lat = pos?.coords?.latitude;
      const long = pos?.coords?.longitude;

      console.log('[LocationWatch] position received:', {lat, long});

      if (typeof lat !== 'number' || typeof long !== 'number') return;

      // Update in-memory fix
      const locationTs = Number(pos?.timestamp) || Date.now();
      lastFix = {lat, long, ts: locationTs};

      // Mirror to Preferences (best-effort)
      try {
        const prev = (getData('LAST_GEO_ADDRESS') ?? {}) as any;
        setData('LAST_GEO_ADDRESS', {
          ...prev,
          lat,
          long,
          accuracy: Number(pos?.coords?.accuracy) || undefined,
          locationTs,
        });
      } catch (e) {
        __DEV__ && console.warn('[LocationWatch] setData failed', e);
      }

      // Reverse geocode — XHR based, survives Android 16 background
      let addressList: string[] = [];
      try {
        if (OLA_API_KEY) {
          addressList = await olaReverseGeocode(lat, long);
        }
      } catch (e) {
        __DEV__ && console.warn('[LocationWatch] geocode failed', e);
      }

      const address = addressList[0] ?? '';

      if (address && address !== lastKnownAddress) {
        console.log('📍 Address changed:', address);
        lastKnownAddress = address;
        try {
          const previous = (getData('LAST_GEO_ADDRESS') ?? {}) as any;
          setData('LAST_GEO_ADDRESS', {
            ...previous,
            lat,
            long,
            address,
            locationTs,
          });
        } catch (_) {}
      }

      // Post — throttled internally by MIN_GAP_MS
      // Passes full addressList so PosterCore picks [0] cleanly
      console.log('[LocationWatch] calling postNowWithCoords…');
      try {
        await postNowWithCoords(lat, long, 'bg', undefined, addressList);
      } catch (e) {
        __DEV__ && console.warn('[LocationWatch] postNowWithCoords error', e);
      }
    },
    err => {
      // Must never throw — keeps the watcher alive
      console.warn('[LocationWatch] watchPosition error:', err?.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: 10000,
      fastestInterval: 5000,
      timeout: 20000,
      maximumAge: 0,
      useSignificantChanges: false,
    },
  );

  console.log('[LocationWatch] started, watchId:', watchId);
};

export const stopLocationWatch = () => {
  if (watchId !== null) {
    try {
      Geolocation.clearWatch(watchId);
      console.log('[LocationWatch] stopped');
    } catch (e) {
      __DEV__ && console.warn('[LocationWatch] clearWatch failed', e);
    }
    watchId = null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const requestHighAccuracyPosition = (
  timeout: number,
  maximumAge: number,
): Promise<GeolocationResponse> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      const timeoutError: any = new Error(
        'High-accuracy GPS request timed out.',
      );
      timeoutError.code = 3;
      reject(timeoutError);
    }, timeout);

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      callback();
    };

    Geolocation.getCurrentPosition(
      position => finish(() => resolve(position)),
      locationError => finish(() => reject(locationError)),
      {
        timeout,
        maximumAge,
        enableHighAccuracy: true,
      },
    );
  });

const saveLocationFix = (info: GeolocationResponse) => {
  const lat = Number(info?.coords?.latitude);
  const long = Number(info?.coords?.longitude);
  if (!isUsableCoordinate(lat, long)) {
    return;
  }

  const ts = Number(info?.timestamp) || Date.now();
  lastFix = {lat, long, ts};
  try {
    const previous = getData('LAST_GEO_ADDRESS') as DataType.GeoAddress;
    setData('LAST_GEO_ADDRESS', {
      ...previous,
      lat,
      long,
      accuracy: Number(info?.coords?.accuracy) || undefined,
      locationTs: ts,
    });
  } catch (saveError) {
    __DEV__ && console.warn('setData LAST_GEO_ADDRESS fail', saveError);
  }
};

const getRecentSavedFix = (): GeolocationResponse | null => {
  const saved = (getData('LAST_GEO_ADDRESS') ?? {}) as any;
  const memoryFix =
    lastFix && Date.now() - lastFix.ts <= RECENT_FIX_MAX_AGE_MS
      ? lastFix
      : null;
  const savedTs = Number(saved?.locationTs);
  const savedFix =
    isUsableCoordinate(saved?.lat, saved?.long) &&
    Number.isFinite(savedTs) &&
    Date.now() - savedTs <= RECENT_FIX_MAX_AGE_MS
      ? {lat: Number(saved.lat), long: Number(saved.long), ts: savedTs}
      : null;
  const fix = memoryFix ?? savedFix;

  if (!fix) {
    return null;
  }

  return {
    coords: {
      latitude: fix.lat,
      longitude: fix.long,
      accuracy: Number(saved?.accuracy) || 0,
      altitude: null,
      heading: null,
      speed: null,
    },
    timestamp: fix.ts,
  } as GeolocationResponse;
};

export const getGeoLocation = async (): Promise<GeolocationResponse> => {
  let lastError: any;
  const attempts = [
    {timeout: PRIMARY_GPS_TIMEOUT_MS, maximumAge: 0},
    {timeout: RETRY_GPS_TIMEOUT_MS, maximumAge: 30_000},
  ];

  for (const attempt of attempts) {
    try {
      const info = await requestHighAccuracyPosition(
        attempt.timeout,
        attempt.maximumAge,
      );
      if (isUsableCoordinate(info?.coords?.latitude, info?.coords?.longitude)) {
        saveLocationFix(info);
        return info;
      }
      lastError = new Error('GPS returned invalid coordinates.');
    } catch (locationError: any) {
      lastError = locationError;
      error('Error fetching location: ', locationError?.message ?? '');
    }
  }

  const recentFix = getRecentSavedFix();
  if (recentFix) {
    return recentFix;
  }

  throw lastError ?? new Error('Unable to obtain a current GPS fix.');
};

export const watchGeoLocation = (): {id: number | null; stop: () => void} => {
  let localId: number | null = null;
  try {
    localId = Geolocation.watchPosition(
      res => {
        const lat = res?.coords?.latitude;
        const long = res?.coords?.longitude;
        if (typeof lat === 'number' && typeof long === 'number') {
          const locationTs = Number(res?.timestamp) || Date.now();
          lastFix = {lat, long, ts: locationTs};
          try {
            const prev = (getData('LAST_GEO_ADDRESS') ?? {}) as any;
            setData('LAST_GEO_ADDRESS', {
              ...prev,
              lat,
              long,
              accuracy: Number(res?.coords?.accuracy) || undefined,
              locationTs,
            });
          } catch {}
        }
      },
      err => {
        if (__DEV__) console.warn('watchGeoLocation error', err?.message);
      },
      {
        interval: 10000,
        timeout: 15000,
        maximumAge: 50000,
        enableHighAccuracy: true,
        distanceFilter: 10,
        useSignificantChanges: true,
      },
    );
  } catch (e) {
    __DEV__ && console.warn('watchGeoLocation start failed', e);
  }
  return {
    id: localId,
    stop: () => {
      if (localId !== null) {
        try {
          Geolocation.clearWatch(localId);
        } catch (e) {}
      }
    },
  };
};

export const getLastFix = () => lastFix;

// ─────────────────────────────────────────────────────────────────────────────
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: 'km' | 'mi' | 'm' = 'm',
): number => {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return Number.POSITIVE_INFINITY;
  }
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = unit === 'km' ? 6371 : unit === 'mi' ? 3958.8 : 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(toRad(lat1)) * Math.cos(toRad(lat2));
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return unit === 'm' ? Math.round(distance) : Number(distance.toFixed(2));
};

export const findNearestChamber = (
  currentLat: number,
  currentLon: number,
  chambers: Array<{
    id: number;
    chamber_id: string;
    chamber_name: string;
    chamber_longitude: string;
    chamber_latitude: string;
  }>,
  minDistance: number,
): {chamber: any; distance: number} | null => {
  let nearestChamber = null;
  let minDistanceFound = Infinity;
  for (const chamber of chambers) {
    const chamberLat = parseFloat(chamber.chamber_latitude);
    const chamberLon = parseFloat(chamber.chamber_longitude);
    if (isNaN(chamberLat) || isNaN(chamberLon)) continue;
    const distance = calculateDistance(
      currentLat,
      currentLon,
      chamberLat,
      chamberLon,
    );
    if (distance < minDistanceFound) {
      minDistanceFound = distance;
      nearestChamber = {chamber, distance};
    }
    if (distance <= minDistance) return nearestChamber;
  }
  return minDistanceFound <= minDistance ? nearestChamber : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Permissions
// ─────────────────────────────────────────────────────────────────────────────
export const checkGps = async () => {
  try {
    const checkEnabled = await isLocationEnabled();
    if (!checkEnabled) {
      try {
        const enableResult = await promptForEnableLocationIfNeeded();
        log('GPS Result::', enableResult);
        return enableResult === 'already-enabled' || enableResult === 'enabled';
      } catch (err: unknown) {
        if (err instanceof Error) {
          error('Error in GPS::', err);
          return false;
        }
      }
    }
    return true;
  } catch (e) {
    __DEV__ && console.warn('checkGps error', e);
    return false;
  }
};

export const checkPermission = async () => {
  try {
    const gps = await checkGps();
    if (!gps) {
      return 'denied';
    }

    if (Platform.OS === 'android') {
      const fineLocation = await check(
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      );
      if (fineLocation === 'granted') {
        return 'granted';
      }
      if (fineLocation === 'blocked' || fineLocation === 'unavailable') {
        return fineLocation;
      }
      return requestPermission();
    }

    const always = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
    const whenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    if (always === 'granted' || whenInUse === 'granted') {
      return 'granted';
    }
    if (always === 'blocked' && whenInUse === 'blocked') {
      return 'blocked';
    }
    return requestPermission();
  } catch (err) {
    error('Location Error');
    return 'denied';
  }
};

export const requestPermission = async () => {
  if (Platform.OS === 'android') {
    const permission = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (permission !== 'granted') {
      alert({
        title: 'Location',
        msg: 'Please enable precise location permission to continue',
        onPress: () => openLocationSetting(),
      });
    }
    return permission;
  }

  if (Platform.OS === 'ios') {
    return request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
  }

  return 'unavailable';
};

const openLocationSetting = () => {
  if (Platform.OS === 'android') {
    try {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS')
        .then(() => log('Location settings opened'))
        .catch(err => {
          openSettings();
          error('Settings error', err);
        });
    } catch (e) {
      openSettings();
    }
  } else {
    openSettings();
  }
};
