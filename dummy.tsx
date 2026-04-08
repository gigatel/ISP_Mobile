//latest giga isp working code

import {OLA_MAP_API} from '@env';
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
  checkMultiple,
  openSettings,
  PERMISSIONS,
  request,
  requestMultiple,
  RESULTS,
} from 'react-native-permissions';
import {alert, error, log} from './common';
import {getData, setData} from './preferences';
import {Preferences} from '@utils';
const OLA_BASE = 'https://api.olamaps.io/places/v1';
/* ======================================================
    🆓 केवल OLA MAPS - 100% FREE (5 Million calls/month)
    ⚡ Reverse Geocode: Lat/Long → Address में convert करता है
    📍 Ola Maps India के लिए बेस्ट है और बिल्कुल मुफ्त!
  ========================================================= */
export const fetchOlaReverseGeocode = async (lat: number, lon: number) => {
  console.log('fetchOlaReverseGeocode11');
  try {
    console.log('fetchOlaReverseGeocode12');
    // Step 1: Coordinates को validate करें
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      console.log('fetchOlaReverseGeocode13');

      console.warn('❌ Invalid coordinates:', {lat, lon});
      return {address: 'Invalid coordinates', lat: 0, long: 0};
    }
    console.log('olaMapAPI11', OLA_MAP_API);
    // Step 2: API Key check करें (.env file में होनी चाहिए)
    if (!OLA_MAP_API) {
      console.error('❌ OLA_MAP_API key missing in .env file');
      return {address: 'API key missing', lat, long: lon};
    }
    console.log('fetchOlaReverseGeocode12', OLA_MAP_API);

    // Step 3: Ola Maps API call (FREE - 5 Million calls/month तक)
    const url = `${OLA_BASE}/reverse-geocode?latlng=${lat},${lon}&api_key=${OLA_MAP_API}`;
    console.log('🔍 Fetching address from Ola Maps (FREE)...');
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    console.log('fetchOlaReverseGeocode13', res);
    // Step 4: Response check करें
    if (!res.ok) {
      console.error('❌ Ola API Error:', res.status, res.statusText);
      const errorText = await res.text();
      console.error('Error details:', errorText);
      return {address: 'API request failed', lat, long: lon};
    }
    console.log('fetchOlaReverseGeocode16', res);

    const json = await res.json();
    console.log(
      '✅ Ola Maps response received:',
      JSON.stringify(json, null, 2),
    );
    // Handle different response structures
    const results = json?.results || json?.geocodingResults || [];
    if (!results.length) {
      return {addressList: [], lat, long: lon};
    }

    // ✅ Sirf formatted_address nikaal ke array bana
    const addressList = results
      .map((item: any) => item?.formatted_address)
      .filter((addr: string) => !!addr); // empty/null remove

    console.log('✅ Saved Address List:', addressList);

    // Build formatted address from components
    // const components = [
    //   addr.house_number || addr.houseNumber,
    //   addr.road || addr.street,
    //   addr.neighbourhood || addr.neighborhood,
    //   addr.suburb,
    //   addr.city || addr.locality,
    //   addr.state || addr.state_district,
    //   addr.postcode || addr.postalCode,
    //   addr.country,
    // ].filter(Boolean);
    // console.log('components:',components);
    // const formattedAddress = components.join(", ");

    // const result = {
    //   address: formattedAddress ||
    //     raw.formatted_address ||
    //     raw.formattedAddress ||
    //     raw.display_name ||
    //     raw.displayName ||
    //     "Address Not Found",

    //   houseNumber: addr.house_number || addr.houseNumber || "",
    //   street: addr.road || addr.street || "",
    //   area: addr.neighbourhood || addr.neighborhood || addr.suburb || "",
    //   city: addr.city || addr.locality || "",
    //   district: addr.county || addr.district || "",
    //   state: addr.state || addr.state_district || "",
    //   pincode: addr.postcode || addr.postalCode || "",
    //   country: addr.country || "",
    //   lat,
    //   long: lon,
    // };

    // console.log('✅ Parsed address:', raw2);
    // return raw2;
    return {
      addressList,
      lat,
      long: lon,
    };
  } catch (e: any) {
    console.error('❌ fetchOlaReverseGeocode error:', e);
    error('Reverse geocode error: ' + e?.message);
    return {address: 'Error fetching address', lat, long: lon};
  }
};

/* ======================================================
   🆓 OLA FORWARD GEOCODE - 100% FREE
   🔍 Address Search: Address → Lat/Long में convert करता है
   💡 Use Case: User जो address type करे, उसका location ढूंढना
========================================================= */
export const fetchOlaForwardGeocode = async (query: string) => {
  try {
    if (!query || query.trim() === '') {
      console.warn('⚠️ Empty search query');
      return [];
    }

    if (!OLA_MAP_API) {
      console.error('❌ OLA_MAP_API key missing');
      return [];
    }

    // Ola Maps FREE Geocode API
    const url = `${OLA_BASE}/geocode?address=${encodeURIComponent(
      query,
    )}&api_key=${OLA_MAP_API}`;

    console.log('🔍 Searching address with Ola Maps (FREE):', query);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Forward geocode error:', response.status);
      return [];
    }

    const json = await response.json();
    console.log('✅ Found locations:', json?.results?.length || 0);

    return json?.results || json?.geocodingResults || [];
  } catch (err: any) {
    console.error('❌ fetchOlaForwardGeocode error:', err);
    error('Forward geocode error: ' + err?.message);
    return [];
  }
};

/* ======================================================
   INIT GEO
========================================================= */
export const initializeConfig = async () => {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'always',
    enableBackgroundLocationUpdates: true,
    locationProvider: 'auto',
  });
  console.log('✅ Geolocation configuration initialized');
};

/* ======================================================
   📱 IMPROVED GEOLOCATION - बिल्कुल FREE
   🎯 Phone के GPS से current location लेता है
   🔧 FIXES: Timeout, Cold Start, Indoor issues
   💰 Cost: ₹0 (Device feature है, कोई API नहीं)
========================================================= */
export const getGeoLocation = async (
  useLastKnown: boolean = true,
): Promise<GeolocationResponse> => {
  return new Promise((resolve, reject) => {
    console.log('📍 Getting current location from device GPS (FREE)...');

    // Strategy 1: Try to get last known position first (fast fallback)
    if (useLastKnown) {
      Geolocation.getCurrentPosition(
        info => {
          console.log(
            '✅ Got last known position:',
            info.coords.latitude,
            info.coords.longitude,
          );

          // Save it
          setData('LAST_GEO_ADDRESS', {
            lat: info.coords.latitude,
            long: info.coords.longitude,
          });

          resolve(info);
        },
        err => {
          console.warn(
            '⚠️ Last known position failed, trying fresh location...',
          );
          // If last known fails, try fresh location
          getFreshLocation(resolve, reject);
        },
        {
          enableHighAccuracy: false, // Fast but less accurate (uses network/wifi)
          timeout: 5000, // Quick timeout for cached location
          maximumAge: 300000, // Accept location up to 5 minutes old
        },
      );
    } else {
      // Strategy 2: Get fresh high-accuracy location
      getFreshLocation(resolve, reject);
    }
  });
};

// Helper function for fresh GPS location
const getFreshLocation = (resolve: any, reject: any) => {
  console.log('🎯 Getting fresh GPS location...');

  Geolocation.getCurrentPosition(
    info => {
      console.log(
        '✅ Fresh location obtained:',
        info.coords.latitude,
        info.coords.longitude,
      );

      // Save fresh location
      setData('LAST_GEO_ADDRESS', {
        lat: info.coords.latitude,
        long: info.coords.longitude,
      });

      resolve(info);
    },
    err => {
      console.error('❌ Fresh location error:', err.message);

      // Final fallback: use last saved location
      const last = getData('LAST_GEO_ADDRESS');

      if (last && last.lat && last.long) {
        console.log('⚠️ Using last saved location:', last);
        resolve({
          coords: {
            latitude: last.lat,
            longitude: last.long,
            accuracy: 1,
            altitude: 0,
            heading: 0,
            speed: 0,
            altitudeAccuracy: 0,
          },
          timestamp: Date.now(),
        } as GeolocationResponse);
      } else {
        // Absolutely no location available
        console.error('❌ No location available at all');
        reject(new Error('Unable to get location. Please check GPS settings.'));
      }
    },
    {
      enableHighAccuracy: true, // Use GPS for accuracy
      timeout: 30000, // Increased to 30 seconds for GPS cold start
      maximumAge: 10000, // Accept location up to 10 seconds old
    },
  );
};

/* ======================================================
   GET ADDRESS FROM CURRENT LOCATION - IMPROVED VERSION
========================================================= */
export const getAddressFromLatLong = async (forceRefresh: boolean = false) => {
  try {
    console.log('🔄 Getting current location and address...');

    // Check permissions first
    const permStatus = await checkPermission();
    if (
      permStatus !== 'granted' &&
      permStatus['android.permission.ACCESS_FINE_LOCATION'] !== 'granted'
    ) {
      console.error('❌ Location permission not granted');
      return {
        address: 'Location permission denied. Please enable in settings.',
        lat: 0,
        long: 0,
      };
    }

    // Check if GPS is enabled
    const gpsEnabled = await checkGps();
    if (!gpsEnabled) {
      console.error('❌ GPS not enabled');
      return {
        address: 'GPS is disabled. Please enable location services.',
        lat: 0,
        long: 0,
      };
    }

    // Get location (will use last known if GPS is slow)
    const info = await getGeoLocation(!forceRefresh);

    if (!info || !info.coords) {
      console.warn('⚠️ No location info available');
      return {address: 'Location unavailable', lat: 0, long: 0};
    }

    console.log(
      '✅ Got location:',
      info.coords.latitude,
      info.coords.longitude,
    );

    //Get address from coordinates
    const addressData = await fetchOlaReverseGeocode(
      info.coords.latitude,
      info.coords.longitude,
    );

    // Save the full address data
    // if (addressData && addressData.address !== "Address Not Found") {
    //   setData("LAST_FULL_ADDRESS", addressData);
    // }
    // Save the full address data (FIXED)
    if (addressData) {
      let finalAddress = '';

      if (addressData.addressList && addressData.addressList.length > 0) {
        finalAddress = addressData.addressList[0];
      } else if (addressData.address) {
        finalAddress = addressData.address;
      }

      if (finalAddress) {
        const payload = {
          address: finalAddress,
          lat: addressData.lat,
          long: addressData.long,
        };
        // ✅ FIX
        Preferences.setData(
          Preferences.KEY.LAST_GEO_ADDRESS,
          JSON.stringify(payload),
        );

        Preferences.setData(
          Preferences.KEY.LAST_FULL_ADDRESS,
          JSON.stringify(payload),
        );
        console.log('✅ Saved LAST_GEO_ADDRESS:', payload);
      }
    }
    return addressData;
  } catch (e: any) {
    console.error('❌ getAddressFromLatLong error:', e);

    // Try to return last saved address
    const lastAddress = getData('LAST_FULL_ADDRESS');
    if (lastAddress) {
      console.log('⚠️ Returning last saved address');
      return lastAddress;
    }

    return {
      address: 'Error: ' + (e?.message || 'Unable to get location'),
      lat: 0,
      long: 0,
    };
  }
};

/* ======================================================
   GET ADDRESS FROM SPECIFIC LAT/LONG
========================================================= */
export const getAddressWithLatLong = async (lat: number, lon: number) => {
  try {
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      console.warn('❌ Invalid coordinates provided:', {lat, lon});
      return {
        address: 'Invalid coordinates',
        lat: 0,
        long: 0,
      };
    }

    console.log('🔍 Getting address for coordinates:', lat, lon);
    // return await fetchOlaReverseGeocode(lat, lon);
  } catch (e: any) {
    console.error('❌ getAddressWithLatLong error:', e);
    return {
      address: 'Error fetching address',
      lat,
      long: lon,
    };
  }
};

/* ======================================================
   WATCH LOCATION
========================================================= */
export const watchGeoLocation = async (
  callback: (res: GeolocationResponse) => void,
) => {
  console.log('👀 Starting location watch...');

  return Geolocation.watchPosition(
    res => {
      console.log('📍 Watch position update:', res.coords);
      setData('LAST_GEO_ADDRESS', {
        lat: res.coords.latitude,
        long: res.coords.longitude,
      });
      callback(res);
    },
    err => {
      console.error('❌ Watch position error:', err);
      error('Watch Error: ' + err?.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: 8000,
      fastestInterval: 5000,
      timeout: 20000, // Added timeout
      maximumAge: 10000, // Added maximumAge
    },
  );
};

/* ======================================================
   DISTANCE CALCULATION
========================================================= */
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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  return unit === 'm' ? Math.round(dist) : Number(dist.toFixed(2));
};

/* ======================================================
   FIND NEAREST CHAMBER
========================================================= */
export const findNearestChamber = (
  currentLat: number,
  currentLon: number,
  chambers: Array<any>,
  minDistance: number,
) => {
  let nearest = null;
  let minDist = Infinity;

  for (const c of chambers) {
    const lat = parseFloat(c.chamber_latitude);
    const lon = parseFloat(c.chamber_longitude);

    if (isNaN(lat) || isNaN(lon)) continue;

    const dist = calculateDistance(currentLat, currentLon, lat, lon);

    if (dist < minDist) {
      minDist = dist;
      nearest = {chamber: c, distance: dist};
    }

    if (dist <= minDistance) return nearest;
  }

  return minDist <= minDistance ? nearest : null;
};

/* ======================================================
   PERMISSION HANDLING - IMPROVED
========================================================= */
export const checkGps = async () => {
  try {
    // Android only - iOS doesn't have this API
    if (Platform.OS !== 'android') {
      return true;
    }

    const enabled = await isLocationEnabled();
    console.log('📍 GPS enabled:', enabled);

    if (!enabled) {
      console.log('⚠️ GPS disabled, prompting user...');
      try {
        const res = await promptForEnableLocationIfNeeded();
        console.log('✅ GPS prompt result:', res);
        return res === 'enabled' || res === 'already-enabled';
      } catch (e) {
        console.error('❌ GPS prompt error:', e);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('❌ checkGps error:', e);
    return Platform.OS === 'ios'; // iOS doesn't need this check
  }
};

export const checkPermission = async () => {
  try {
    // First check GPS
    const gps = await checkGps();
    if (!gps) {
      console.log('❌ GPS not enabled');
      return 'denied';
    }

    if (Platform.OS === 'android') {
      const perm = await checkMultiple([
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ]);

      console.log('📱 Android permissions:', perm);

      const fineLocation = perm['android.permission.ACCESS_FINE_LOCATION'];

      if (fineLocation === RESULTS.GRANTED) {
        return 'granted';
      } else if (fineLocation === RESULTS.DENIED) {
        // Permission not asked yet, request it
        return await requestPermission();
      } else if (fineLocation === RESULTS.BLOCKED) {
        // User denied permanently
        console.warn('⚠️ Location permission blocked, need to open settings');
        return 'blocked';
      }

      return fineLocation;
    }

    // iOS
    const iosPermission = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    console.log('📱 iOS permission:', iosPermission);

    if (iosPermission === RESULTS.DENIED) {
      return await requestPermission();
    }

    return iosPermission;
  } catch (e) {
    console.error('❌ checkPermission error:', e);
    return 'denied';
  }
};

export const requestPermission = async () => {
  try {
    if (Platform.OS === 'android') {
      const result = await requestMultiple([
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ]);
      console.log('📱 Android permission request result:', result);

      const fineLocation = result['android.permission.ACCESS_FINE_LOCATION'];
      return fineLocation === RESULTS.GRANTED ? 'granted' : fineLocation;
    }

    const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    console.log('📱 iOS permission request result:', result);
    return result;
  } catch (e) {
    console.error('❌ requestPermission error:', e);
    return 'denied';
  }
};

/* ======================================================
   LOCATION SETTINGS
========================================================= */
export const openLocationSetting = () => {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() =>
      openSettings(),
    );
  } else {
    openSettings();
  }
};

//
import {OLA_MAP_API} from '@env';
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
  checkMultiple,
  openSettings,
  PERMISSIONS,
  request,
  requestMultiple,
  RESULTS,
} from 'react-native-permissions';
import {alert, error, log} from './common';
import {getData, setData} from './preferences';
import {Preferences} from '@utils';
const OLA_BASE = 'https://api.olamaps.io/places/v1';
/* ======================================================
    🆓 केवल OLA MAPS - 100% FREE (5 Million calls/month)
    ⚡ Reverse Geocode: Lat/Long → Address में convert करता है
    📍 Ola Maps India के लिए बेस्ट है और बिल्कुल मुफ्त!
  ========================================================= */
export const fetchOlaReverseGeocode = async (lat: number, lon: number) => {
  console.log('fetchOlaReverseGeocode11');
  try {
    console.log('fetchOlaReverseGeocode12');
    // Step 1: Coordinates को validate करें
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      console.log('fetchOlaReverseGeocode13');

      console.warn('❌ Invalid coordinates:', {lat, lon});
      return {address: 'Invalid coordinates', lat: 0, long: 0};
    }
    console.log('olaMapAPI11', OLA_MAP_API);
    // Step 2: API Key check करें (.env file में होनी चाहिए)
    if (!OLA_MAP_API) {
      console.error('❌ OLA_MAP_API key missing in .env file');
      return {address: 'API key missing', lat, long: lon};
    }
    console.log('fetchOlaReverseGeocode12', OLA_MAP_API);

    // Step 3: Ola Maps API call (FREE - 5 Million calls/month तक)
    const url = `${OLA_BASE}/reverse-geocode?latlng=${lat},${lon}&api_key=${OLA_MAP_API}`;
    console.log('🔍 Fetching address from Ola Maps (FREE)...');
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    console.log('fetchOlaReverseGeocode13', res);
    // Step 4: Response check करें
    if (!res.ok) {
      console.error('❌ Ola API Error:', res.status, res.statusText);
      const errorText = await res.text();
      console.error('Error details:', errorText);
      return {address: 'API request failed', lat, long: lon};
    }
    console.log('fetchOlaReverseGeocode16', res);

    const json = await res.json();
    console.log(
      '✅ Ola Maps response received:',
      JSON.stringify(json, null, 2),
    );
    // Handle different response structures
    const results = json?.results || json?.geocodingResults || [];
    if (!results.length) {
      return {addressList: [], lat, long: lon};
    }

    // ✅ Sirf formatted_address nikaal ke array bana
    const addressList = results
      .map((item: any) => item?.formatted_address)
      .filter((addr: string) => !!addr); // empty/null remove

    console.log('✅ Saved Address List:', addressList);

    // Build formatted address from components
    // const components = [
    //   addr.house_number || addr.houseNumber,
    //   addr.road || addr.street,
    //   addr.neighbourhood || addr.neighborhood,
    //   addr.suburb,
    //   addr.city || addr.locality,
    //   addr.state || addr.state_district,
    //   addr.postcode || addr.postalCode,
    //   addr.country,
    // ].filter(Boolean);
    // console.log('components:',components);
    // const formattedAddress = components.join(", ");

    // const result = {
    //   address: formattedAddress ||
    //     raw.formatted_address ||
    //     raw.formattedAddress ||
    //     raw.display_name ||
    //     raw.displayName ||
    //     "Address Not Found",

    //   houseNumber: addr.house_number || addr.houseNumber || "",
    //   street: addr.road || addr.street || "",
    //   area: addr.neighbourhood || addr.neighborhood || addr.suburb || "",
    //   city: addr.city || addr.locality || "",
    //   district: addr.county || addr.district || "",
    //   state: addr.state || addr.state_district || "",
    //   pincode: addr.postcode || addr.postalCode || "",
    //   country: addr.country || "",
    //   lat,
    //   long: lon,
    // };

    // console.log('✅ Parsed address:', raw2);
    // return raw2;
    return {
      addressList,
      lat,
      long: lon,
    };
  } catch (e: any) {
    console.error('❌ fetchOlaReverseGeocode error:', e);
    error('Reverse geocode error: ' + e?.message);
    return {address: 'Error fetching address', lat, long: lon};
  }
};

/* ======================================================
   🆓 OLA FORWARD GEOCODE - 100% FREE
   🔍 Address Search: Address → Lat/Long में convert करता है
   💡 Use Case: User जो address type करे, उसका location ढूंढना
========================================================= */
export const fetchOlaForwardGeocode = async (query: string) => {
  try {
    if (!query || query.trim() === '') {
      console.warn('⚠️ Empty search query');
      return [];
    }

    if (!OLA_MAP_API) {
      console.error('❌ OLA_MAP_API key missing');
      return [];
    }

    // Ola Maps FREE Geocode API
    const url = `${OLA_BASE}/geocode?address=${encodeURIComponent(
      query,
    )}&api_key=${OLA_MAP_API}`;

    console.log('🔍 Searching address with Ola Maps (FREE):', query);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Forward geocode error:', response.status);
      return [];
    }

    const json = await response.json();
    console.log('✅ Found locations:', json?.results?.length || 0);

    return json?.results || json?.geocodingResults || [];
  } catch (err: any) {
    console.error('❌ fetchOlaForwardGeocode error:', err);
    error('Forward geocode error: ' + err?.message);
    return [];
  }
};

/* ======================================================
   INIT GEO
========================================================= */
export const initializeConfig = async () => {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: false,
    authorizationLevel: 'always',
    enableBackgroundLocationUpdates: true,
    locationProvider: 'auto',
  });
  console.log('✅ Geolocation configuration initialized');
};

/* ======================================================
   📱 IMPROVED GEOLOCATION - बिल्कुल FREE
   🎯 Phone के GPS से current location लेता है
   🔧 FIXES: Timeout, Cold Start, Indoor issues
   💰 Cost: ₹0 (Device feature है, कोई API नहीं)
========================================================= */
export const getGeoLocation = async (
  useLastKnown: boolean = true,
): Promise<GeolocationResponse> => {
  return new Promise((resolve, reject) => {
    console.log('📍 Getting current location from device GPS (FREE)...');

    // Strategy 1: Try to get last known position first (fast fallback)
    if (useLastKnown) {
      Geolocation.getCurrentPosition(
        info => {
          console.log(
            '✅ Got last known position:',
            info.coords.latitude,
            info.coords.longitude,
          );

          // Save it
          setData('LAST_GEO_ADDRESS', {
            lat: info.coords.latitude,
            long: info.coords.longitude,
          });

          resolve(info);
        },
        err => {
          console.warn(
            '⚠️ Last known position failed, trying fresh location...',
          );
          // If last known fails, try fresh location
          getFreshLocation(resolve, reject);
        },
        {
          enableHighAccuracy: false, // Fast but less accurate (uses network/wifi)
          timeout: 5000, // Quick timeout for cached location
          maximumAge: 300000, // Accept location up to 5 minutes old
        },
      );
    } else {
      // Strategy 2: Get fresh high-accuracy location
      getFreshLocation(resolve, reject);
    }
  });
};

// Helper function for fresh GPS location
const getFreshLocation = (resolve: any, reject: any) => {
  console.log('🎯 Getting fresh GPS location...');

  Geolocation.getCurrentPosition(
    info => {
      console.log(
        '✅ Fresh location obtained:',
        info.coords.latitude,
        info.coords.longitude,
      );

      // Save fresh location
      setData('LAST_GEO_ADDRESS', {
        lat: info.coords.latitude,
        long: info.coords.longitude,
      });

      resolve(info);
    },
    err => {
      console.error('❌ Fresh location error:', err.message);

      // Final fallback: use last saved location
      const last = getData('LAST_GEO_ADDRESS');

      if (last && last.lat && last.long) {
        console.log('⚠️ Using last saved location:', last);
        resolve({
          coords: {
            latitude: last.lat,
            longitude: last.long,
            accuracy: 1,
            altitude: 0,
            heading: 0,
            speed: 0,
            altitudeAccuracy: 0,
          },
          timestamp: Date.now(),
        } as GeolocationResponse);
      } else {
        // Absolutely no location available
        console.error('❌ No location available at all');
        reject(new Error('Unable to get location. Please check GPS settings.'));
      }
    },
    {
      enableHighAccuracy: true, // Use GPS for accuracy
      timeout: 30000, // Increased to 30 seconds for GPS cold start
      maximumAge: 10000, // Accept location up to 10 seconds old
    },
  );
};

/* ======================================================
   GET ADDRESS FROM CURRENT LOCATION - IMPROVED VERSION
========================================================= */
export const getAddressFromLatLong = async (forceRefresh: boolean = false) => {
  try {
    console.log('🔄 Getting current location and address...');

    // Check permissions first
    const permStatus = await checkPermission();
    if (
      permStatus !== 'granted' &&
      permStatus['android.permission.ACCESS_FINE_LOCATION'] !== 'granted'
    ) {
      console.error('❌ Location permission not granted');
      return {
        address: 'Location permission denied. Please enable in settings.',
        lat: 0,
        long: 0,
      };
    }

    // Check if GPS is enabled
    const gpsEnabled = await checkGps();
    if (!gpsEnabled) {
      console.error('❌ GPS not enabled');
      return {
        address: 'GPS is disabled. Please enable location services.',
        lat: 0,
        long: 0,
      };
    }

    // Get location (will use last known if GPS is slow)
    const info = await getGeoLocation(!forceRefresh);

    if (!info || !info.coords) {
      console.warn('⚠️ No location info available');
      return {address: 'Location unavailable', lat: 0, long: 0};
    }

    console.log(
      '✅ Got location:',
      info.coords.latitude,
      info.coords.longitude,
    );

    //Get address from coordinates
    const addressData = await fetchOlaReverseGeocode(
      info.coords.latitude,
      info.coords.longitude,
    );

    // Save the full address data
    // if (addressData && addressData.address !== "Address Not Found") {
    //   setData("LAST_FULL_ADDRESS", addressData);
    // }
    // Save the full address data (FIXED)
    if (addressData) {
      let finalAddress = '';

      if (addressData.addressList && addressData.addressList.length > 0) {
        finalAddress = addressData.addressList[0];
      } else if (addressData.address) {
        finalAddress = addressData.address;
      }

      if (finalAddress) {
        const payload = {
          address: finalAddress,
          lat: addressData.lat,
          long: addressData.long,
        };
        // ✅ FIX
        Preferences.setData(
          Preferences.KEY.LAST_GEO_ADDRESS,
          JSON.stringify(payload),
        );

        Preferences.setData(
          Preferences.KEY.LAST_FULL_ADDRESS,
          JSON.stringify(payload),
        );
        console.log('✅ Saved LAST_GEO_ADDRESS:', payload);
      }
    }
    return addressData;
  } catch (e: any) {
    console.error('❌ getAddressFromLatLong error:', e);

    // Try to return last saved address
    const lastAddress = getData('LAST_FULL_ADDRESS');
    if (lastAddress) {
      console.log('⚠️ Returning last saved address');
      return lastAddress;
    }

    return {
      address: 'Error: ' + (e?.message || 'Unable to get location'),
      lat: 0,
      long: 0,
    };
  }
};

/* ======================================================
   GET ADDRESS FROM SPECIFIC LAT/LONG
========================================================= */
export const getAddressWithLatLong = async (lat: number, lon: number) => {
  try {
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      console.warn('❌ Invalid coordinates provided:', {lat, lon});
      return {
        address: 'Invalid coordinates',
        lat: 0,
        long: 0,
      };
    }

    console.log('🔍 Getting address for coordinates:', lat, lon);
    // return await fetchOlaReverseGeocode(lat, lon);
  } catch (e: any) {
    console.error('❌ getAddressWithLatLong error:', e);
    return {
      address: 'Error fetching address',
      lat,
      long: lon,
    };
  }
};

/* ======================================================
   WATCH LOCATION
========================================================= */
export const watchGeoLocation = async (
  callback: (res: GeolocationResponse) => void,
) => {
  console.log('👀 Starting location watch...');

  return Geolocation.watchPosition(
    res => {
      console.log('📍 Watch position update:', res.coords);
      setData('LAST_GEO_ADDRESS', {
        lat: res.coords.latitude,
        long: res.coords.longitude,
      });
      callback(res);
    },
    err => {
      console.error('❌ Watch position error:', err);
      error('Watch Error: ' + err?.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: 8000,
      fastestInterval: 5000,
      timeout: 20000, // Added timeout
      maximumAge: 10000, // Added maximumAge
    },
  );
};

/* ======================================================
   DISTANCE CALCULATION
========================================================= */
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
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;

  return unit === 'm' ? Math.round(dist) : Number(dist.toFixed(2));
};

/* ======================================================
   FIND NEAREST CHAMBER
========================================================= */
export const findNearestChamber = (
  currentLat: number,
  currentLon: number,
  chambers: Array<any>,
  minDistance: number,
) => {
  let nearest = null;
  let minDist = Infinity;

  for (const c of chambers) {
    const lat = parseFloat(c.chamber_latitude);
    const lon = parseFloat(c.chamber_longitude);

    if (isNaN(lat) || isNaN(lon)) continue;

    const dist = calculateDistance(currentLat, currentLon, lat, lon);

    if (dist < minDist) {
      minDist = dist;
      nearest = {chamber: c, distance: dist};
    }

    if (dist <= minDistance) return nearest;
  }

  return minDist <= minDistance ? nearest : null;
};

/* ======================================================
   PERMISSION HANDLING - IMPROVED
========================================================= */
export const checkGps = async () => {
  try {
    // Android only - iOS doesn't have this API
    if (Platform.OS !== 'android') {
      return true;
    }

    const enabled = await isLocationEnabled();
    console.log('📍 GPS enabled:', enabled);

    if (!enabled) {
      console.log('⚠️ GPS disabled, prompting user...');
      try {
        const res = await promptForEnableLocationIfNeeded();
        console.log('✅ GPS prompt result:', res);
        return res === 'enabled' || res === 'already-enabled';
      } catch (e) {
        console.error('❌ GPS prompt error:', e);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('❌ checkGps error:', e);
    return Platform.OS === 'ios'; // iOS doesn't need this check
  }
};

export const checkPermission = async () => {
  try {
    // First check GPS
    const gps = await checkGps();
    if (!gps) {
      console.log('❌ GPS not enabled');
      return 'denied';
    }

    if (Platform.OS === 'android') {
      const perm = await checkMultiple([
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ]);

      console.log('📱 Android permissions:', perm);

      const fineLocation = perm['android.permission.ACCESS_FINE_LOCATION'];

      if (fineLocation === RESULTS.GRANTED) {
        return 'granted';
      } else if (fineLocation === RESULTS.DENIED) {
        // Permission not asked yet, request it
        return await requestPermission();
      } else if (fineLocation === RESULTS.BLOCKED) {
        // User denied permanently
        console.warn('⚠️ Location permission blocked, need to open settings');
        return 'blocked';
      }

      return fineLocation;
    }

    // iOS
    const iosPermission = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    console.log('📱 iOS permission:', iosPermission);

    if (iosPermission === RESULTS.DENIED) {
      return await requestPermission();
    }

    return iosPermission;
  } catch (e) {
    console.error('❌ checkPermission error:', e);
    return 'denied';
  }
};

export const requestPermission = async () => {
  try {
    if (Platform.OS === 'android') {
      const result = await requestMultiple([
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ]);
      console.log('📱 Android permission request result:', result);

      const fineLocation = result['android.permission.ACCESS_FINE_LOCATION'];
      return fineLocation === RESULTS.GRANTED ? 'granted' : fineLocation;
    }

    const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    console.log('📱 iOS permission request result:', result);
    return result;
  } catch (e) {
    console.error('❌ requestPermission error:', e);
    return 'denied';
  }
};

/* ======================================================
   LOCATION SETTINGS
========================================================= */
export const openLocationSetting = () => {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() =>
      openSettings(),
    );
  } else {
    openSettings();
  }
};
