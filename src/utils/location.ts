// import { OLA_MAP_API } from '@env';
// import Geolocation, { GeolocationResponse } from '@react-native-community/geolocation';
// import { DataType } from '@types';
// import { Linking, Platform, PermissionsAndroid } from 'react-native';
// import { isLocationEnabled, promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
// import { check, checkMultiple, openSettings, PERMISSIONS, request, requestMultiple, RESULTS, PermissionStatus } from 'react-native-permissions';
// import { alert, error, log } from './common';
// import { getData, setData } from './preferences';
// import { Preferences } from '@utils';

// const OLA_BASE = "https://api.olamaps.io/places/v1";
// const USER_AGENT = 'TopSchoolApp/1.0 (support@topschool.app)';
// const OLA_MAPS_API_KEY: string = OLA_MAP_API;

// type PreciseOpts = {
//   desiredAccuracy?: number;
//   maxWaitMs?: number;
//   allowCache?: boolean;
// };

// export type CoordsFix = { lat: number; lon: number; quality: 'precise' | 'coarse' | 'watch' | 'cached' };
// type Coords = { lat: number; lon: number; quality: 'precise' | 'coarse' | 'cached' };

// /* ======================================================
//   HELPERS
// ========================================================= */
// const isAndroidFineGranted = (m: Record<string, PermissionStatus>) =>
//   m['android.permission.ACCESS_FINE_LOCATION'] === 'granted';

// const tooOldOrCoarse = (pos: GeolocationResponse) => {
//   const acc = pos.coords.accuracy ?? 99999;
//   const ageMs = Date.now() - (pos.timestamp || Date.now());
//   return ageMs > 60_000 || acc > 5000;
// };

// const fetchWithTimeout = async (url: string, opts: RequestInit = {}, ms = 9000) => {
//   const ctrl = new AbortController();
//   const id = setTimeout(() => ctrl.abort(), ms);
//   try {
//     const res = await fetch(url, {
//       ...opts,
//       signal: ctrl.signal,
//       headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(opts.headers || {}) },
//     });
//     return res;
//   } finally {
//     clearTimeout(id);
//   }
// };

// const composeFromOla = (root: any): string => {
//   const first =
//     root?.results?.[0] ||
//     root?.data?.[0] ||
//     root?.result ||
//     root;

//   const formatted =
//     first?.formatted_address ||
//     first?.display_address ||
//     first?.display_name;

//   if (formatted && String(formatted).trim()) return String(formatted).trim();

//   const comps: Array<any> =
//     first?.address_components ||
//     first?.components ||
//     first?.address ||
//     [];

//   if (Array.isArray(comps) && comps.length) {
//     const pick = (types: string[]) =>
//       comps.find((c: any) => Array.isArray(c?.types) && types.some(t => c.types.includes(t)))?.long_name;

//     const parts = [
//       pick(['route']) || pick(['neighborhood']) || pick(['sublocality']) || pick(['premise']),
//       pick(['locality']) || pick(['postal_town']) || pick(['administrative_area_level_3']),
//       pick(['administrative_area_level_2']),
//       pick(['administrative_area_level_1']),
//       pick(['postal_code']),
//       pick(['country']),
//     ].filter(Boolean);

//     if (parts.length) return parts.join(', ');
//   }

//   const fallback =
//     first?.name ||
//     first?.vicinity ||
//     first?.address ||
//     root?.status;

//   return (fallback && String(fallback)) || '';
// };

// const reverseGeocodeOla = async (lat: number, lon: number): Promise<string> => {
//    console.log('latlng');
//   if (!OLA_MAPS_API_KEY) return '';
//   try {
//     const url = `${OLA_BASE}/reverse-geocode?latlng=${lat},${lon}&api_key=${encodeURIComponent(OLA_MAPS_API_KEY)}`;
//     const res = await fetchWithTimeout(url, {}, 10000);
//     console.log('responseData:',res);
    
//     if (!res.ok) return '';
//     const json = await res.json();
//     return composeFromOla(json) || '';
//   } catch {
//     console.log('log');
    
//     return '';
//   }
// };

// const openLocationSetting = () => {
//   openSettings().catch(() => {});
// };

// function raceForFirstFix(): Promise<CoordsFix | null> {
//   return new Promise(resolve => {
//     let resolved = false;
//     let watchId: number | null = null;

//     const done = (val: CoordsFix | null) => {
//       if (resolved) return;
//       resolved = true;
//       if (watchId != null) {
//         try { Geolocation.clearWatch(watchId); } catch {}
//       }
//       resolve(val);
//     };

//     Geolocation.getCurrentPosition(
//       p => done({ lat: p.coords.latitude, lon: p.coords.longitude, quality: 'precise' }),
//       _ => done(null),
//       { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } as any
//     );

//     try {
//       watchId = Geolocation.watchPosition(
//         p => done({ lat: p.coords.latitude, lon: p.coords.longitude, quality: 'watch' }),
//         _ => {},
//         { enableHighAccuracy: true, distanceFilter: 0, interval: 2000, fastestInterval: 1000 } as any
//       );
//       setTimeout(() => done(null), 6000);
//     } catch {
//       // ignore
//     }
//   });
// }

// const getPrecisePosition = async (opts: PreciseOpts = {}): Promise<GeolocationResponse> => {
//   const {
//     desiredAccuracy = 25,
//     maxWaitMs = 35_000,
//     allowCache = true,
//   } = opts;

//   const perm = await checkPermission();
//   if (perm !== 'granted' && perm !== 'limited') {
//     throw new Error('perm_denied');
//   }

//   const gpsOn = await checkGps();
//   if (!gpsOn) throw new Error('gps_off');

//   const T1 = Math.floor(maxWaitMs / 3);
//   const T2 = Math.floor((maxWaitMs * 2) / 3);
//   const target1 = Math.min(desiredAccuracy, 25);
//   const target2 = Math.max(50, desiredAccuracy);
//   const target3 = Math.max(100, target2);

//   const t0 = Date.now();
//   const pickTarget = () => {
//     const now = Date.now();
//     if (now - t0 < T1) return target1;
//     if (now - t0 < T2) return target2;
//     return target3;
//   };

//   let best: GeolocationResponse | null = null;
//   let settled = false;

//   const consider = (pos: GeolocationResponse) => {
//     if (tooOldOrCoarse(pos)) return;
//     const acc = pos.coords.accuracy ?? 99999;
//     if (!best || acc < (best.coords.accuracy ?? 99999)) best = pos;
//     if (acc <= pickTarget()) settle(pos);
//   };

//   const settle = (pos: GeolocationResponse) => {
//     if (settled) return;
//     settled = true;
//     if (watchId != null) Geolocation.clearWatch(watchId);
//     clearTimeout(finalTimer);
//     clearTimeout(oneShot1);
//     clearTimeout(oneShot2);
//     resolveFn(pos);
//   };

//   let resolveFn!: (p: GeolocationResponse) => void;
//   let rejectFn!: (e: Error) => void;
//   const p = new Promise<GeolocationResponse>((resolve, reject) => {
//     resolveFn = resolve;
//     rejectFn = reject;
//   });

//   Geolocation.getCurrentPosition(
//     (pos) => consider(pos),
//     () => {},
//     { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 },
//   );

//   const watchId = Geolocation.watchPosition(
//     (pos) => consider(pos),
//     () => {},
//     {
//       enableHighAccuracy: true,
//       distanceFilter: 0,
//       interval: 2500,
//       fastestInterval: 1200,
//       timeout: maxWaitMs,
//       maximumAge: 0,
//     },
//   );

//   const oneShot1 = setTimeout(() => {
//     Geolocation.getCurrentPosition(
//       (pos) => !settled && consider(pos),
//       () => {},
//       { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 },
//     );
//   }, Math.floor(maxWaitMs / 3));

//   const oneShot2 = setTimeout(() => {
//     Geolocation.getCurrentPosition(
//       (pos) => !settled && consider(pos),
//       () => {},
//       { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
//     );
//   }, Math.floor((maxWaitMs * 2) / 3));

//   const finalTimer = setTimeout(() => {
//     if (watchId != null) Geolocation.clearWatch(watchId);

//     if (best) return settle(best);

//     if (allowCache) {
//       const last = (getData('LAST_GEO_ADDRESS') || {}) as DataType.GeoAddress;
//       if (typeof last?.lat === 'number' && typeof last?.long === 'number') {
//         return settle({
//           coords: {
//             latitude: last.lat,
//             longitude: last.long,
//             altitude: 0,
//             accuracy: 0,
//             altitudeAccuracy: null as any,
//             heading: 0,
//             speed: 0,
//           },
//           timestamp: Date.now(),
//         } as unknown as GeolocationResponse);
//       }
//     }

//     if (perm !== 'granted' && perm !== 'limited') return rejectFn(new Error('perm_denied'));
//     if (!gpsOn) return rejectFn(new Error('gps_off'));
//     rejectFn(new Error('timeout_no_precise_fix'));
//   }, maxWaitMs);

//   return p;
// };

// /* ======================================================
//   INIT GEO
// ========================================================= */
// export const initializeConfig = async () => {
//   Geolocation.setRNConfiguration({
//     skipPermissionRequests: false,
//     authorizationLevel: Platform.OS === 'ios' ? 'whenInUse' : 'always',
//     enableBackgroundLocationUpdates: true,
//     locationProvider: 'auto',
//   });
// };

// /* ======================================================
//   OLA MAPS - REVERSE GEOCODE (PUBLIC)
// ========================================================= */
// export const fetchOlaReverseGeocode = async (lat: number, lon: number) => {
//   try {
//     if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
//       return { address: "Invalid coordinates", lat: 0, long: 0 };
//     }
//     const url = `${OLA_BASE}/reverse-geocode?latlng=${lat},${lon}&api_key=${encodeURIComponent(OLA_MAPS_API_KEY)}`;
//     const res = await fetch(url);
//     const json = await res.json();
//     const results = json?.results || json?.geocodingResults || [];
//     if (!results.length) {
//       return { address: "Address Not Found", lat, long: lon };
//     }
//     const formattedList = results.map((item: any) => ({
//       formatted_address:
//         item.formatted_address ||
//         item.display_name ||
//         item.displayName ||
//         "Address Not Found",
//     }));
//     const firstAddress = formattedList[0]?.formatted_address || "";
//     return {
//       address: firstAddress,
//       suggestions: formattedList,
//       lat,
//       long: lon,
//     };
//   } catch (e: any) {
//     return { address: "Error fetching address", lat, long: lon };
//   }
// };

// /* ======================================================
//   OLA MAPS - FORWARD GEOCODE (PUBLIC)
// ========================================================= */
// export const fetchOlaForwardGeocode = async (query: string) => {
//   try {
//     if (!query || query.trim() === '') {
//       console.warn('⚠️ Empty search query');
//       return [];
//     }
//     if (!OLA_MAP_API) {
//       console.error('❌ OLA_MAP_API key missing');
//       return [];
//     }
//     const url = `${OLA_BASE}/geocode?address=${encodeURIComponent(query)}&api_key=${encodeURIComponent(OLA_MAPS_API_KEY)}`;
//     console.log('🔍 Searching address with Ola Maps (FREE):', query);
//     const response = await fetch(url, {
//       method: 'GET',
//       headers: {
//         'Accept': 'application/json',
//         'Content-Type': 'application/json',
//       },
//     });
//     if (!response.ok) {
//       console.error('❌ Forward geocode error:', response.status);
//       return [];
//     }
//     const json = await response.json();
//     console.log('✅ Found locations:', json?.results?.length || 0);
//     return json?.results || json?.geocodingResults || [];
//   } catch (err: any) {
//     console.error('❌ fetchOlaForwardGeocode error:', err);
//     error("Forward geocode error: " + err?.message);
//     return [];
//   }
// };

// /* ======================================================
//   GET CURRENT GEOLOCATION (RAW)
// ========================================================= */
// export const getGeoLocation = async (): Promise<GeolocationResponse | null> => {
//   return new Promise((resolve) => {
//     Geolocation.getCurrentPosition(
//       (info) => {
//         if (!tooOldOrCoarse(info)) {
//           const last = (getData('LAST_GEO_ADDRESS') || {}) as DataType.GeoAddress;
//           setData('LAST_GEO_ADDRESS', {
//             ...last,
//             lat: info.coords.latitude,
//             long: info.coords.longitude,
//             address: last?.address,
//           });
//           return resolve(info);
//         }
//         getPrecisePosition({ desiredAccuracy: 50, maxWaitMs: 12_000, allowCache: true })
//           .then(resolve)
//           .catch(() => resolve(info));
//       },
//       (err) => {
//         error('getGeoLocation error', err?.message ?? '');
//         resolve(null);
//       },
//       { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
//     );
//   });
// };

// /* ======================================================
//   GET ADDRESS FROM CURRENT LOCATION
// ========================================================= */
// export const getAddressFromLatLong = (): Promise<DataType.GeoAddress> =>
//   getCurrentGeoAddress({ allowCache: false });

// /* ======================================================
//   GET ADDRESS FROM SPECIFIC LAT/LONG
// ========================================================= */
// export const getAddressWithLatLong = async (lat: number, long: number): Promise<DataType.GeoAddress> => {
//   try {
//     const address = await reverseGeocodeOla(lat, long);
//     const payload = { address: address || 'Address Not Found', lat, long };
//     setData('LAST_GEO_ADDRESS', payload);
//     return payload;
//   } catch (e: any) {
//     error('getAddressWithLatLong error', e?.message ?? '');
//     return { address: 'Address Not Found', lat: lat ?? 0, long: long ?? 0 };
//   }
// };

// /* ======================================================
//   WATCH LOCATION
// ========================================================= */
// export const watchGeoLocation = async (callback: (res: GeolocationResponse) => void) => {
//   console.log('👀 Starting location watch...');
//   return Geolocation.watchPosition(
//     res => {
//       console.log('📍 Watch position update:', res.coords);
//       setData("LAST_GEO_ADDRESS", {
//         lat: res.coords.latitude,
//         long: res.coords.longitude,
//       });
//       callback(res);
//     },
//     err => {
//       console.error('❌ Watch position error:', err);
//       error("Watch Error: " + err?.message);
//     },
//     {
//       enableHighAccuracy: true,
//       distanceFilter: 10,
//       interval: 8000,
//       fastestInterval: 5000,
//       timeout: 20000,
//       maximumAge: 10000,
//     }
//   );
// };

// /* ======================================================
//   DISTANCE CALCULATION
// ========================================================= */
// export const calculateDistance = (
//   lat1: number,
//   lon1: number,
//   lat2: number,
//   lon2: number,
//   unit: 'km' | 'mi' | 'm' = 'm'
// ): number => {
//   if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
//     return Number.POSITIVE_INFINITY;
//   }

//   const toRad = (v: number) => (v * Math.PI) / 180;
//   const R = unit === 'km' ? 6371 : unit === 'mi' ? 3958.8 : 6371000;

//   const dLat = toRad(lat2 - lat1);
//   const dLon = toRad(lon2 - lon1);

//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(toRad(lat1)) *
//     Math.cos(toRad(lat2)) *
//     Math.sin(dLon / 2) ** 2;

//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   const dist = R * c;

//   return unit === 'm' ? Math.round(dist) : Number(dist.toFixed(2));
// };

// /* ======================================================
//   FIND NEAREST CHAMBER
// ========================================================= */
// export const findNearestChamber = (
//   currentLat: number,
//   currentLon: number,
//   chambers: Array<any>,
//   minDistance: number
// ) => {
//   let nearest = null;
//   let minDist = Infinity;

//   for (const c of chambers) {
//     const lat = parseFloat(c.chamber_latitude);
//     const lon = parseFloat(c.chamber_longitude);

//     if (isNaN(lat) || isNaN(lon)) continue;

//     const dist = calculateDistance(currentLat, currentLon, lat, lon);

//     if (dist < minDist) {
//       minDist = dist;
//       nearest = { chamber: c, distance: dist };
//     }

//     if (dist <= minDistance) return nearest;
//   }

//   return minDist <= minDistance ? nearest : null;
// };

// /* ======================================================
//   CHECK GPS
// ========================================================= */
// export const checkGps = async () => {
//   try {
//     if (Platform.OS !== 'android') {
//       return true;
//     }
//     const enabled = await isLocationEnabled();
//     console.log('📍 GPS enabled:', enabled);
//     if (!enabled) {
//       console.log('⚠️ GPS disabled, prompting user...');
//       try {
//         const res = await promptForEnableLocationIfNeeded();
//         console.log('✅ GPS prompt result:', res);
//         return res === "enabled" || res === "already-enabled";
//       } catch (e) {
//         console.error('❌ GPS prompt error:', e);
//         return false;
//       }
//     }
//     return true;
//   } catch (e) {
//     console.error('❌ checkGps error:', e);
//     return Platform.OS === 'ios';
//   }
// };

// /* ======================================================
//   CHECK PERMISSION
// ========================================================= */
// export const checkPermission = async () => {
//   try {
//     const gps = await checkGps();
//     if (!gps) {
//       console.log('❌ GPS not enabled');
//       return 'denied';
//     }

//     if (Platform.OS === 'android') {
//       const perm = await checkMultiple([
//         PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
//         PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
//       ]);
//       console.log('📱 Android permissions:', perm);
//       const fineLocation = perm["android.permission.ACCESS_FINE_LOCATION"];
//       if (fineLocation === RESULTS.GRANTED) {
//         return "granted";
//       } else if (fineLocation === RESULTS.DENIED) {
//         return await requestPermission();
//       } else if (fineLocation === RESULTS.BLOCKED) {
//         console.warn('⚠️ Location permission blocked, need to open settings');
//         return "blocked";
//       }
//       return fineLocation;
//     }

//     // iOS
//     const iosPermission = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
//     console.log('📱 iOS permission:', iosPermission);
//     if (iosPermission === RESULTS.DENIED) {
//       return await requestPermission();
//     }
//     return iosPermission;
//   } catch (e) {
//     console.error('❌ checkPermission error:', e);
//     return "denied";
//   }
// };

// /* ======================================================
//   REQUEST PERMISSION
// ========================================================= */
// export const requestPermission = async (): Promise<PermissionStatus | 'denied'> => {
//   try {
//     if (Platform.OS === 'android') {
//       const perm = await requestMultiple([
//         PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
//         PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
//         PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
//       ]);
//       if (!isAndroidFineGranted(perm)) {
//         alert({
//           title: 'Enable Precise Location',
//           msg: 'Turn on "Precise location" for accurate address.\nSettings → Location → App → Precise',
//           onPress: () => openLocationSetting(),
//         });
//         return 'denied';
//       }
//       return 'granted';
//     } else {
//       const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
//       if (whenInUse === 'granted' || whenInUse === 'limited') return whenInUse;
//       return 'denied';
//     }
//   } catch (e) {
//     error('requestPermission error', e);
//     return 'denied';
//   }
// };

// /* ======================================================
//   ENSURE LOCATION PERMISSION
// ========================================================= */
// export async function ensureLocationPermission(): Promise<boolean> {
//   if (Platform.OS === 'ios') {
//     try {
//       const auth = await (Geolocation.requestAuthorization
//         ? Geolocation.requestAuthorization('whenInUse')
//         : Promise.resolve<'granted' | 'denied' | 'restricted' | 'limited'>('granted'));
//       return auth === 'granted' || auth === 'restricted' || auth === 'limited';
//     } catch {
//       return true;
//     }
//   }
//   const fine = await PermissionsAndroid.request(
//     PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
//   );
//   const coarse =
//     Platform.Version >= 31
//       ? await PermissionsAndroid.request(
//           PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
//         )
//       : PermissionsAndroid.RESULTS.GRANTED;

//   return (
//     fine === PermissionsAndroid.RESULTS.GRANTED ||
//     coarse === PermissionsAndroid.RESULTS.GRANTED
//   );
// }

// /* ======================================================
//   GET FRESH COORDS WITH FALLBACK
// ========================================================= */
// export async function getFreshCoordsWithFallback(): Promise<CoordsFix | null> {
//   const hasPerm = await ensureLocationPermission();
//   if (!hasPerm) return null;

//   if (Platform.OS === 'android') {
//     const enabled = await isLocationEnabled().catch(() => true);
//     if (!enabled) {
//       try {
//         await promptForEnableLocationIfNeeded({
//           interval: 10000,
//           fastInterval: 5000,
//           title: 'Enable Location',
//           message: 'Please enable GPS to fetch your current address.',
//           ok: 'Enable',
//           cancel: 'Cancel',
//         });
//       } catch {
//         // user canceled -> continue to coarse/cache
//       }
//     }
//   }

//   const raced = await raceForFirstFix();
//   if (raced) return raced;

//   const coarse = await new Promise<CoordsFix | null>(resolve => {
//     Geolocation.getCurrentPosition(
//       p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, quality: 'coarse' }),
//       _ => resolve(null),
//       { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 } as any
//     );
//   });
//   if (coarse) return coarse;

//   const cached = (Preferences.getData('LAST_COORDS') ?? {}) as { lat?: number; lon?: number; ts?: number };
//   if (typeof cached.lat === 'number' && typeof cached.lon === 'number') {
//     return { lat: cached.lat, lon: cached.lon, quality: 'cached' };
//   }

//   return null;
// }

// /* ======================================================
//   GET CURRENT GEO ADDRESS
// ========================================================= */
// export const getCurrentGeoAddress = async (
//   opts: PreciseOpts = {},
// ): Promise<DataType.GeoAddress> => {
//   try {
//     const info = await getPrecisePosition(opts);
//     const { latitude: lat, longitude: long, accuracy } = info.coords;

//     if (Platform.OS === 'android' && (accuracy ?? 99999) > 100) {
//       log('Approximate location detected — advise enabling "Use precise location".');
//     }
//     const address = await reverseGeocodeOla(lat, long);
//     const payload = { address: address || 'Address Not Found', lat, long };
//     setData('LAST_GEO_ADDRESS', payload);
//     return payload;
//   } catch (e: any) {
//     const code = String(e?.message || e);
//     log('getCurrentGeoAddress failed code =', code);
//     try {
//       const fix = await getFreshCoordsWithFallback();
//       if (fix) {
//         const addr = await reverseGeocodeOla(fix.lat, fix.lon);
//         const payload = { address: addr || 'Address Not Found', lat: fix.lat, long: fix.lon };
//         setData('LAST_GEO_ADDRESS', payload);
//         return payload;
//       }
//     } catch {}

//     if (code === 'perm_denied') {
//       alert({
//         title: 'Location Permission Needed',
//         msg: 'Please allow location access (Precise) to fetch your current address.',
//         onPress: () => {},
//       });
//     } else if (code === 'gps_off') {
//       alert({
//         title: 'Turn On Location',
//         msg: 'Location is off. Please enable GPS/Location to get your address.',
//         onPress: () => {},
//       });
//     }

//     const last = (getData('LAST_GEO_ADDRESS') || {}) as DataType.GeoAddress;
//     if (last?.lat && last?.long) {
//       return { address: last.address || 'Address Not Found', lat: last.lat, long: last.long };
//     }
//     return { address: 'Address Not Found', lat: 0, long: 0 };
//   }
// };
import { OLA_MAP_API } from '@env';
import Geolocation, { GeolocationResponse } from '@react-native-community/geolocation';
import { DataType } from '@types';
import { Linking, Platform } from 'react-native';
import { isLocationEnabled, promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import { check, checkMultiple, openSettings, PERMISSIONS, request, requestMultiple, RESULTS } from 'react-native-permissions';
import { alert, error, log } from './common';
import { getData, setData } from './preferences';
const OLA_BASE = "https://api.olamaps.io/places/v1";
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

      console.warn('❌ Invalid coordinates:', { lat, lon });
      return { address: "Invalid coordinates", lat: 0, long: 0 };
    }
    console.log('olaMapAPI11',OLA_MAP_API)
    // Step 2: API Key check करें (.env file में होनी चाहिए)
    if (!OLA_MAP_API) {
      console.error('❌ OLA_MAP_API key missing in .env file');
      return { address: "API key missing", lat, long: lon };
    }
      console.log('fetchOlaReverseGeocode12',OLA_MAP_API);

    // Step 3: Ola Maps API call (FREE - 5 Million calls/month तक)
    const url = `${OLA_BASE}/reverse-geocode?latlng=${lat},${lon}&api_key=${OLA_MAP_API}`;
    console.log('🔍 Fetching address from Ola Maps (FREE)...');
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
      console.log('fetchOlaReverseGeocode13',res);
    // Step 4: Response check करें
    if (!res.ok) {
      console.error('❌ Ola API Error:', res.status, res.statusText);
      const errorText = await res.text();
      console.error('Error details:', errorText);
      return { address: "API request failed", lat, long: lon };
    }
    console.log('fetchOlaReverseGeocode16',res);

    const json = await res.json();
    console.log('✅ Ola Maps response received:', JSON.stringify(json, null, 2));
    // Handle different response structures
  const results = json?.results || json?.geocodingResults || [];
  if (!results.length) {
    return { addressList: [], lat, long: lon };
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
    return { address: "Error fetching address", lat, long: lon };
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
    const url = `${OLA_BASE}/geocode?address=${encodeURIComponent(query)}&api_key=${OLA_MAP_API}`;

    console.log('🔍 Searching address with Ola Maps (FREE):', query);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
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
    error("Forward geocode error: " + err?.message);
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
export const getGeoLocation = async (useLastKnown: boolean = true): Promise<GeolocationResponse> => {
  return new Promise((resolve, reject) => {
    console.log('📍 Getting current location from device GPS (FREE)...');

    // Strategy 1: Try to get last known position first (fast fallback)
    if (useLastKnown) {
      Geolocation.getCurrentPosition(
        info => {
          console.log('✅ Got last known position:', info.coords.latitude, info.coords.longitude);

          // Save it
          setData("LAST_GEO_ADDRESS", {
            lat: info.coords.latitude,
            long: info.coords.longitude,
          });

          resolve(info);
        },
        err => {
          console.warn('⚠️ Last known position failed, trying fresh location...');
          // If last known fails, try fresh location
          getFreshLocation(resolve, reject);
        },
        {
          enableHighAccuracy: false,  // Fast but less accurate (uses network/wifi)
          timeout: 5000,              // Quick timeout for cached location
          maximumAge: 300000,         // Accept location up to 5 minutes old
        }
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
      console.log('✅ Fresh location obtained:', info.coords.latitude, info.coords.longitude);

      // Save fresh location
      setData("LAST_GEO_ADDRESS", {
        lat: info.coords.latitude,
        long: info.coords.longitude,
      });

      resolve(info);
    },
    err => {
      console.error('❌ Fresh location error:', err.message);

      // Final fallback: use last saved location
      const last = getData("LAST_GEO_ADDRESS");

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
      enableHighAccuracy: true,   // Use GPS for accuracy
      timeout: 30000,             // Increased to 30 seconds for GPS cold start
      maximumAge: 10000,          // Accept location up to 10 seconds old
    }
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
    if (permStatus !== 'granted' && permStatus["android.permission.ACCESS_FINE_LOCATION"] !== "granted") {
      console.error('❌ Location permission not granted');
      return {
        address: "Location permission denied. Please enable in settings.",
        lat: 0,
        long: 0
      };
    }

    // Check if GPS is enabled
    const gpsEnabled = await checkGps();
    if (!gpsEnabled) {
      console.error('❌ GPS not enabled');
      return {
        address: "GPS is disabled. Please enable location services.",
        lat: 0,
        long: 0
      };
    }

    // Get location (will use last known if GPS is slow)
    const info = await getGeoLocation(!forceRefresh);

    if (!info || !info.coords) {
      console.warn('⚠️ No location info available');
      return { address: "Location unavailable", lat: 0, long: 0 };
    }

    console.log('✅ Got location:', info.coords.latitude, info.coords.longitude);

    //Get address from coordinates
    const addressData = await fetchOlaReverseGeocode(
      info.coords.latitude,
      info.coords.longitude
    );

    // Save the full address data
    if (addressData && addressData.address !== "Address Not Found") {
      setData("LAST_FULL_ADDRESS", addressData);
    }

    return addressData;
  } catch (e: any) {
    console.error('❌ getAddressFromLatLong error:', e);

    // Try to return last saved address
    const lastAddress = getData("LAST_FULL_ADDRESS");
    if (lastAddress) {
      console.log('⚠️ Returning last saved address');
      return lastAddress;
    }

    return {
      address: "Error: " + (e?.message || "Unable to get location"),
      lat: 0,
      long: 0
    };
  }
};

/* ======================================================
   GET ADDRESS FROM SPECIFIC LAT/LONG
========================================================= */
export const getAddressWithLatLong = async (lat: number, lon: number) => {
  try {
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      console.warn('❌ Invalid coordinates provided:', { lat, lon });
      return {
        address: "Invalid coordinates",
        lat: 0,
        long: 0,
      };
    }

    console.log('🔍 Getting address for coordinates:', lat, lon);
    // return await fetchOlaReverseGeocode(lat, lon);
  } catch (e: any) {
    console.error('❌ getAddressWithLatLong error:', e);
    return {
      address: "Error fetching address",
      lat,
      long: lon,
    };
  }
};

/* ======================================================
   WATCH LOCATION
========================================================= */
export const watchGeoLocation = async (callback: (res: GeolocationResponse) => void) => {
  console.log('👀 Starting location watch...');

  return Geolocation.watchPosition(
    res => {
      console.log('📍 Watch position update:', res.coords);
      setData("LAST_GEO_ADDRESS", {
        lat: res.coords.latitude,
        long: res.coords.longitude,
      });
      callback(res);
    },
    err => {
      console.error('❌ Watch position error:', err);
      error("Watch Error: " + err?.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: 8000,
      fastestInterval: 5000,
      timeout: 20000,          // Added timeout
      maximumAge: 10000,       // Added maximumAge
    }
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
  unit: 'km' | 'mi' | 'm' = 'm'
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
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

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
  minDistance: number
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
      nearest = { chamber: c, distance: dist };
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
        return res === "enabled" || res === "already-enabled";
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

      const fineLocation = perm["android.permission.ACCESS_FINE_LOCATION"];

      if (fineLocation === RESULTS.GRANTED) {
        return "granted";
      } else if (fineLocation === RESULTS.DENIED) {
        // Permission not asked yet, request it
        return await requestPermission();
      } else if (fineLocation === RESULTS.BLOCKED) {
        // User denied permanently
        console.warn('⚠️ Location permission blocked, need to open settings');
        return "blocked";
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
    return "denied";
  }
};

export const requestPermission = async () => {
  try {
    if (Platform.OS === "android") {
      const result = await requestMultiple([
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ]);
      console.log('📱 Android permission request result:', result);

      const fineLocation = result["android.permission.ACCESS_FINE_LOCATION"];
      return fineLocation === RESULTS.GRANTED ? "granted" : fineLocation;
    }

    const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    console.log('📱 iOS permission request result:', result);
    return result;
  } catch (e) {
    console.error('❌ requestPermission error:', e);
    return "denied";
  }
};

/* ======================================================
   LOCATION SETTINGS
========================================================= */
export const openLocationSetting = () => {
  if (Platform.OS === 'android') {
    Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS")
      .catch(() => openSettings());
  } else {
    openSettings();
  }
};