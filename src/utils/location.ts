//geocoding versosn
// @utils/location.ts  (UPDATED)
import Geolocation, { GeolocationResponse } from '@react-native-community/geolocation';
import { DataType } from '@types';
import { Linking, Platform } from 'react-native';
import { isLocationEnabled, promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import { useState,useEffect } from 'react';
import {
  check,
  checkMultiple,
  openSettings,
  PERMISSIONS,
  request,
  requestMultiple,
} from 'react-native-permissions';
import { alert, error, log } from './common';
import { getData, setData } from './preferences';
import { postNowWithCoords } from '../../src/services/LocationPosterCore';
import { OLA_MAP_API } from '@env';
// init geocoder once
let watchId: number | null = null;
// ✅ added missing lastFix declaration
let lastFix: { lat: number; long: number; ts: number } | null = null;
let lastKnownAddress: string = ''; // ✅ Track previous address
const OLA_REVERSE_GEOCODE_URL = 'https://api.olamaps.io/places/v1/reverse-geocode';
const OLA_API_KEY = OLA_MAP_API; // same env use kar raha tu
export const initializeConfig = async () => {
  try {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'always',
      enableBackgroundLocationUpdates: true,
      locationProvider: 'auto',
    } as any);
  } catch (e) {
    __DEV__ && console.warn('initializeConfig error', e);
  }
};
const olaReverseGeocode = async (
  lat: number,
  long: number,
): Promise<string[]> => {
  console.log('📍 olaReverseGeocode called with:', { lat, long });

  try {
    // ✅ Step 1: Validate coordinates
    if (!lat || !long || isNaN(lat) || isNaN(long)) {
      console.warn('❌ Invalid coordinates:', { lat, long });
      return [];
    }

    // ✅ Step 2: API Key check
    if (!OLA_API_KEY) {
      console.error('❌ OLA_API_KEY missing');
      return [];
    }

    // ✅ Step 3: Prepare URL
    const url = `${OLA_REVERSE_GEOCODE_URL}?latlng=${lat},${long}&api_key=${OLA_API_KEY}`;
    console.log('🌐 API URL:', url);

    // ✅ Step 4: API call
    console.log('🚀 Calling Ola Reverse Geocode API...');
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    console.log('📡 Response Status:', res.status, res.statusText);

    // ✅ Step 5: Response check
    if (!res.ok) {
      console.error('❌ Ola API Error:', res.status, res.statusText);
      const errorText = await res.text();
      console.error('❌ Error Body:', errorText);
      return [];
    }

    // ✅ Step 6: Parse JSON
    const json = await res.json();
    console.log('📦 Raw API Response:', JSON.stringify(json, null, 2));

    // ✅ Step 7: Extract results safely
    const results = json?.results || json?.geocodingResults || [];
    console.log('📊 Results length:', results.length);

    if (!results.length) {
      console.warn('⚠️ No results found');
      return [];
    }

    // ✅ Step 8: Extract multiple formatted_address (max 5)
    const addressList = results
      .map((item: any, index: number) => {
        const addr =
          item?.formatted_address ||
          item?.formattedAddress ||
          '';

        console.log(`📌 Address ${index + 1}:`, addr);
        return addr;
      })
      .filter((addr: string) => !!addr)
      .slice(0, 5);

    console.log('✅ Final Address List:', addressList);

    return addressList;

  } catch (e: any) {
    console.error('❌ olaReverseGeocode Exception:', e?.message || e);
    return [];
  }
};
export const getAddressFromLatLong = async (): Promise<DataType.GeoAddress> => {
  try {
    const info = (await getGeoLocation()) as DataType.GeoLocation;

    if (!info) {
      return { address: 'Address Not Found', addressList: [], lat: 0, long: 0 };
    }

    const { latitude: lat, longitude: long } = info?.coords;

    const addressList = await olaReverseGeocode(lat, long);

    return {
      address: addressList?.[0] || 'Address Not Found',
      addressList: addressList || [], // ⭐ MAIN FIX
      lat,
      long,
    };
  } catch (err: any) {
    return { address: 'Address Not Found', addressList: [], lat: 0, long: 0 };
  }
};
export const getAddressWithLatLong = async (lat: number, long: number): Promise<DataType.GeoAddress> => {
  try {
    if (typeof lat !== 'number' || typeof long !== 'number') {
      return { address: '', lat: lat ?? 0, long: long ?? 0 };
    }
    const address = await olaReverseGeocode(lat, long);
    const addressComponent = {
      address: address || '',
      lat,
      long,
    };
    console.info('Geo Address', { addressComponent });
    return addressComponent;
  } catch (err: any) {
    error('Error fetching address: ', err?.message ?? '');
    return { address: '', lat: lat ?? 0, long: long ?? 0 };
  }
};

export const startLocationWatch = () => {
  if (watchId !== null) return;
  console.log('startLocationWatch');
  watchId = Geolocation.watchPosition(
    async pos => {
      const lat = pos?.coords?.latitude;
      const long = pos?.coords?.longitude;
      if (typeof lat !== 'number' || typeof long !== 'number') return;
      // Keep a fresh in-memory fix
      lastFix = { lat, long, ts: Date.now() };

      // Mirror to Preferences for backward compatibility
      try {
        const prev = (getData('LAST_GEO_ADDRESS') ?? {}) as any;
        setData('LAST_GEO_ADDRESS', { ...prev, lat, long });
      } catch (e) {
        __DEV__ && console.warn('setData LAST_GEO_ADDRESS failed', e);
      }
      // Reverse geocode (best-effort; tolerate failures)
      let address = '';
      try {
      if (OLA_API_KEY) {
        address = await olaReverseGeocode(lat, long);
      }
      } catch (e) {
        // ignore geocode failures, still post lat/long
        __DEV__ && console.warn('reverse geocode failed', e);
      }
      // ✅ NEW: Log when address changes
      if (address && address !== lastKnownAddress) {
        console.log('📍 Address changed:', address);
        lastKnownAddress = address;
      }

      // Immediately post (throttled in PosterCore)
      try {
        void postNowWithCoords(lat, long, 'bg', undefined, address);
      } catch (e) {
        __DEV__ && console.warn('postNowWithCoords error', e);
      }
    },
    err => {
      if (__DEV__) console.warn('[watchPosition] error:', err?.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10, // post on real movement; tune as needed
      interval: 10000, // Android polling interval
      fastestInterval: 5000, // Android min interval
      timeout: 20000,
      maximumAge: 0,
      useSignificantChanges: false,
      // showsBackgroundLocationIndicator exists only on iOS. cast to any to avoid TS error on android builds.
      // showsBackgroundLocationIndicator: true as any,
    },
  );
};

export const stopLocationWatch = () => {
  if (watchId !== null) {
    try {
      Geolocation.clearWatch(watchId);
    } catch (e) {
      __DEV__ && console.warn('clearWatch failed', e);
    }
    watchId = null;
  }
};

export const getGeoLocation = async (): Promise<GeolocationResponse> => {
  return new Promise((resolve, reject) => {
    try {
      Geolocation.getCurrentPosition(
        info => {
          try {
            const add = getData('LAST_GEO_ADDRESS') as DataType.GeoAddress;
            setData('LAST_GEO_ADDRESS', {
              ...add,
              lat: info.coords.latitude,
              long: info.coords.longitude,
            });
          } catch (e) {
            __DEV__ && console.warn('setData LAST_GEO_ADDRESS fail in getCurrentPosition', e);
          }
          resolve(info);
        },
        err => {
          error('Error fetching address: ', err?.message ?? '');
          const loc = getData('LAST_GEO_ADDRESS');
          // Reject with an object shaped like a GeolocationResponse coords fallback
          reject({
            coords: {
              latitude: loc?.lat ?? 0,
              longitude: loc?.long ?? 0,
            },
          });
        },
        {
          timeout: 10000,
          maximumAge: 0,
          enableHighAccuracy: false,
        },
      );
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * watchGeoLocation: returns an active watchId and a function to unsubscribe.
 * Previous implementation returned a Promise that resolved on first fix (not very useful).
 */
export const watchGeoLocation = (): { id: number | null; stop: () => void } => {
  let localId: number | null = null;
  try {
    localId = Geolocation.watchPosition(
      res => {
        // update lastFix mirror
        const lat = res?.coords?.latitude;
        const long = res?.coords?.longitude;
        if (typeof lat === 'number' && typeof long === 'number') {
          lastFix = { lat, long, ts: Date.now() };
          try {
            const prev = (getData('LAST_GEO_ADDRESS') ?? {}) as any;
            setData('LAST_GEO_ADDRESS', { ...prev, lat, long });
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
        } catch (e) {
          __DEV__ && console.warn('watchGeoLocation clear failed', e);
        }
      }
    },
  };
};

export const getLastFix = () => lastFix;

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: 'km' | 'mi' | 'm' = 'm',
): number => {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    console.warn('Invalid coordinates:', { lat1, lon1, lat2, lon2 });
    return Number.POSITIVE_INFINITY;
  }
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const R = unit === 'km' ? 6371 : unit === 'mi' ? 3958.8 : 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
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
): { chamber: any; distance: number } | null => {
  let nearestChamber = null;
  let minDistanceFound = Infinity;
  for (const chamber of chambers) {
    const chamberLat = parseFloat(chamber.chamber_latitude);
    const chamberLon = parseFloat(chamber.chamber_longitude);
    if (isNaN(chamberLat) || isNaN(chamberLon)) {
      console.warn(`Invalid coordinates for chamber ${chamber.chamber_id}`);
      continue;
    }
    const distance = calculateDistance(currentLat, currentLon, chamberLat, chamberLon);
    if (distance < minDistanceFound) {
      minDistanceFound = distance;
      nearestChamber = { chamber, distance };
    }
    if (distance <= minDistance) {
      return nearestChamber;
    }
  }
  return minDistanceFound <= minDistance ? nearestChamber : null;
};

export const checkGps = async () => {
  try {
    const checkEnabled: boolean = await isLocationEnabled();
    if (!checkEnabled) {
      try {
        const enableResult = await promptForEnableLocationIfNeeded();
        log('GPS Result::', enableResult);
        return enableResult === 'already-enabled' || enableResult === 'enabled';
      } catch (err: unknown) {
        if (err instanceof Error) {
          error('Error in on GPS::', err);
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
    let permission;
    const gps = await checkGps();
    permission = gps ? permission : 'denied';
    if (Platform.OS === 'android') {
      const perm = await checkMultiple([
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
      ]);
      if (
        perm['android.permission.ACCESS_BACKGROUND_LOCATION'] === 'granted' &&
        perm['android.permission.ACCESS_FINE_LOCATION'] === 'granted'
      ) {
        permission = 'granted';
      } else {
        permission = await requestPermission();
      }
    } else {
      permission = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
      if (permission === 'denied') {
        permission = await requestPermission();
      }
    }
    return permission;
  } catch (err) {
    error('Location Error');
    return 'denied';
  }
};

export const requestPermission = async () => {
  let permission;
  if (Platform.OS === 'android') {
    const perm = await requestMultiple([
      PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ]);
    if (perm['android.permission.ACCESS_BACKGROUND_LOCATION'] !== 'granted') {
      alert({
        title: 'Background Location',
        msg:
          'Please enable background location to navigating\nPermissions > Location > "Allow all the time" to continue',
        onPress: () => {
          openLocationSetting();
        },
      });
    } else if (perm['android.permission.ACCESS_FINE_LOCATION'] !== 'granted') {
      alert({
        title: 'Location',
        msg: 'Please enable location permission to continue',
        onPress: () => {
          openLocationSetting();
        },
      });
    }
    permission = perm;
  } else if (Platform.OS === 'ios') {
    permission = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
  }
  return permission;
};

const openLocationSetting = () => {
  if (Platform.OS === 'android') {
    // Prefer using sendIntent on Android if available
    try {
      Linking.sendIntent('android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS')
        .then(() => log('Location settings opened successfully'))
        .catch((err) => {
          openSettings();
          error('An error occurred', err);
        });
    } catch (e) {
      // fallback
      openSettings();
    }
  } else {
    // iOS fallback: open app settings
    openSettings();
  }
};