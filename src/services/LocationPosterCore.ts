// // src/services/LocationPosterCore.ts
// import NetInfo from '@react-native-community/netinfo';
// import Geolocation from '@react-native-community/geolocation';
// import DeviceInfo from 'react-native-device-info';
// import { Preferences, Common } from '@utils';
// import { PostLocationApi } from '@slices/attendance.slice';
// import type { StoreDispatch } from '@reducers';


// let dispatchRef: StoreDispatch | null = null;

// export function attachPosterDispatch(d: StoreDispatch) {
//   dispatchRef = d;
// }

// export function formatServerDateTimeIST(d: Date = new Date()) {
//   const pad = (n: number) => String(n).padStart(2, '0');
//   const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
//   const ist = new Date(utcMs + 330 * 60000);
//   const YYYY = ist.getFullYear();
//   const MM = pad(ist.getMonth() + 1);
//   const DD = pad(ist.getDate());0
//   const HH = pad(ist.getHours());
//   const mm = pad(ist.getMinutes());
//   const ss = pad(ist.getSeconds());
//   return `${DD}-${MM}-${YYYY} ${HH}:${mm}:${ss}`;
// }
// const MIN_GAP_MS = 30_000;
// let posting = false;
// export async function postOnceIfDue(
//   source: 'fg' | 'bg' = 'fg',
//   forceDispatch?: StoreDispatch,
// ) {
//   if (posting) return;

//   const lastTs: number = Number(
//     Preferences.getData(Preferences.KEY.LAST_POST_TS) ?? 0,
//   );
//   const now = Date.now();
//   if (now - lastTs < MIN_GAP_MS) return;

//   try {
//     posting = true;

//     const net = await NetInfo.fetch();
//     const online =
//       (net.isConnected ?? false) && (net.isInternetReachable ?? true);
//     if (!online) {
//       __DEV__ && console.log(`[Poster:${source}] skipped (offline)`);
//       return;
//     }

//     const last = (Preferences.getData(Preferences.KEY.LAST_GEO_ADDRESS) ??
//       {}) as { address?: string; lat?: number; long?: number };

//     let lat = last?.lat;
//     let long = last?.long;
//     let address: string = typeof last?.address === 'string' ? last.address : '';

//     if (!lat || !long) {
//       await new Promise<void>(resolve => {
//         Geolocation.getCurrentPosition(
//           pos => {
//             lat = pos?.coords?.latitude;
//             long = pos?.coords?.longitude;
//             resolve();
//           },
//           _err => resolve(),
//           { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
//         );
//       });
//     }
//     if (!lat || !long) {
//       __DEV__ && console.log(`[Poster:${source}] no lat/long; skip`);
//       return;
//     }

//     const power = await DeviceInfo.getPowerState().catch(() => null as any);
//     const batteryNum = Math.round(((power?.batteryLevel ?? 0) as number) * 100);
//     const batteryStatus = `${batteryNum}%`;

//     const token: string = String(
//       Preferences.getData(Preferences.KEY.API_AUTH_TOKEN) ?? '',
//     );
//     const employeeID = Number(
//       Preferences.getData(Preferences.KEY.EMPLOYEE_ID) ?? 0,
//     );
//     const companyId =
//       Number(Preferences.getData(Preferences.KEY.COMPANY_ID) ?? 11) || 11;

//     if (!token || !employeeID || !companyId) {
//       __DEV__ &&
//         console.warn(
//           `[Poster:${source}] Missing token/employeeID/companyId; skip`,
//         );
//       return;
//     }

//     const body = {
//       token,
//       employeeID,
//       address: address ?? '',
//       batteryStatus,
//       delay: '0',
//       dateTime: formatServerDateTimeIST(),
//       distance: 0,
//       dutyStatus: '',
//       latitude: String(lat),
//       longitude: String(long),
//       companyId,
//     };

//     __DEV__ &&
//       console.log(`[Poster:${source}] sending @ ${body.dateTime}`, {
//         lat,
//         long,
//         batteryStatus,
//       });

//     const dispatchToUse = forceDispatch ?? dispatchRef;
//     if (!dispatchToUse) {
//       __DEV__ && console.warn(`[Poster:${source}] No dispatch; skip`);
//       return;
//     }

//     const action = PostLocationApi({ body });
//     const result: any = dispatchToUse(action);

//     if (result && typeof result.unwrap === 'function') {
//       await result.unwrap();
//     } else {
//       await result;
//     }

//     Preferences.setData(Preferences.KEY.LAST_POST_TS, Date.now());
//     __DEV__ && console.log(`[Poster:${source}] ✅ success @ ${body.dateTime}`);
//   } catch (e) {
//     Common?.warn?.(`[Poster:${source}] ❌ failed`, e);
//   } finally {
//     posting = false;
//   }
// }

// export default { attachPosterDispatch, postOnceIfDue, formatServerDateTimeIST };
// src/services/LocationPosterCore.ts
// src/services/LocationPosterCore.ts
import NetInfo from '@react-native-community/netinfo';
import Geolocation from '@react-native-community/geolocation';
import DeviceInfo from 'react-native-device-info';
import { Preferences, Common } from '@utils';
import { PostLocationApi } from '@slices/attendance.slice';
import type { StoreDispatch } from '@reducers';
import { URLs } from '@apis';

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch reference (optional — falls back to direct HTTP when null)
// ─────────────────────────────────────────────────────────────────────────────
let dispatchRef: StoreDispatch | null = null;

export function attachPosterDispatch(d: StoreDispatch) {
  dispatchRef = d;
}

// ─────────────────────────────────────────────────────────────────────────────
// THROTTLE — ONE shared gate for ALL post paths (interval + watchPosition)
// This is the single source of truth. Neither postOnceIfDue nor
// postFromWatchUpdate can fire more often than MIN_GAP_MS.
// ─────────────────────────────────────────────────────────────────────────────
const MIN_GAP_MS = 30_000; // 30 seconds between any two posts
let posting = false;        // mutex — prevents concurrent calls

function isDue(): boolean {
  const lastTs = Number(Preferences.getData(Preferences.KEY.LAST_POST_TS) ?? 0);
  return Date.now() - lastTs >= MIN_GAP_MS;
}

function stampNow() {
  Preferences.setData(Preferences.KEY.LAST_POST_TS, Date.now());
}

// ─────────────────────────────────────────────────────────────────────────────
// Date/time helper (IST)
// ─────────────────────────────────────────────────────────────────────────────
export function formatServerDateTimeIST(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 330 * 60000);
  return (
    `${pad(ist.getDate())}-${pad(ist.getMonth() + 1)}-${ist.getFullYear()} ` +
    `${pad(ist.getHours())}:${pad(ist.getMinutes())}:${pad(ist.getSeconds())}`
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Direct HTTP fallback (used when Redux dispatch is unavailable in BG)
// ─────────────────────────────────────────────────────────────────────────────
async function postViaHttp(body: Record<string, any>): Promise<void> {
  const path = URLs.postLocationAPI ?? '/api/postLocation';
  const url = path;
  const token = String(Preferences.getData(Preferences.KEY.API_AUTH_TOKEN) ?? '');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Get last-known coords from Preferences (fast — no GPS call needed)
// ─────────────────────────────────────────────────────────────────────────────
function getLastCoords(): { lat: number; long: number; address: string } | null {
  const last = (Preferences.getData(Preferences.KEY.LAST_GEO_ADDRESS) ?? {}) as {
    address?: string;
    lat?: number;
    long?: number;
  };
  if (!last?.lat || !last?.long) return null;
  return { lat: last.lat, long: last.long, address: last.address ?? '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: build payload and send via Redux dispatch or HTTP
// ─────────────────────────────────────────────────────────────────────────────
async function sendPayload(
  lat: number,
  long: number,
  address: string,
  source: 'fg' | 'bg',
  forceDispatch?: StoreDispatch,
): Promise<void> {
  // Network check
  const net = await NetInfo.fetch();
  const online = (net.isConnected ?? false) && (net.isInternetReachable ?? true);
  if (!online) {
    __DEV__ && console.log(`[Poster:${source}] offline — skip`);
    return;
  }

  // Battery
  const power = await DeviceInfo.getPowerState().catch(() => null as any);
  const batteryNum = Math.round(((power?.batteryLevel ?? 0) as number) * 100);
  const batteryStatus = `${batteryNum}%`;

  // Auth
  const token = String(Preferences.getData(Preferences.KEY.API_AUTH_TOKEN) ?? '');
  const employeeID = Number(Preferences.getData(Preferences.KEY.EMPLOYEE_ID) ?? 0);
  const companyId = Number(Preferences.getData(Preferences.KEY.COMPANY_ID) ?? 11) || 11;

  if (!token || !employeeID || !companyId) {
    __DEV__ && console.warn(`[Poster:${source}] missing creds — skip`);
    return;
  }

  const body = {
    token,
    employeeID,
    address,
    batteryStatus,
    delay: '0',
    dateTime: formatServerDateTimeIST(),
    distance: 0,
    dutyStatus: '',
    latitude: String(lat),
    longitude: String(long),
    companyId,
  };

  __DEV__ &&
    console.log(`[Poster:${source}] → ${body.dateTime}`, { lat, long, batteryStatus });

  // Send — prefer dispatch, fall back to HTTP
  const dispatchToUse = forceDispatch ?? dispatchRef;
  if (dispatchToUse) {
    try {
      const action = PostLocationApi({ body });
      const result: any = dispatchToUse(action);
      if (result && typeof result.unwrap === 'function') await result.unwrap();
      else await result;
    } catch {
      // dispatch failed — last resort HTTP
      await postViaHttp(body);
    }
  } else {
    // No dispatch (BG / killed) — direct HTTP
    await postViaHttp(body);
  }

  stampNow(); // ← update timestamp AFTER successful send
  __DEV__ && console.log(`[Poster:${source}] ✅ sent`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Periodic / on-demand post
// Checks throttle before doing anything.
// ─────────────────────────────────────────────────────────────────────────────
export async function postOnceIfDue(
  source: 'fg' | 'bg' = 'fg',
  forceDispatch?: StoreDispatch,
): Promise<void> {
  // Hard gate — both mutex and time check
  if (posting || !isDue()) {
    __DEV__ && console.log(`[Poster:${source}] throttled — skip`);
    return;
  }

  try {
    posting = true;

    let coords = getLastCoords();

    if (!coords) {
      // No cached coords — do a one-off GPS fix
      const fix = await new Promise<{ lat: number; long: number } | null>(resolve => {
        Geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, long: p.coords.longitude }),
          _ => resolve(null),
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
        );
      });
      if (!fix) {
        __DEV__ && console.log(`[Poster:${source}] no coords — skip`);
        return;
      }
      coords = { ...fix, address: '' };
    }

    await sendPayload(coords.lat, coords.long, coords.address, source, forceDispatch);
  } catch (e) {
    Common?.warn?.(`[Poster:${source}] ❌`, e);
  } finally {
    posting = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Called by watchPosition on movement
//
// KEY FIX: Uses the SAME isDue() / stampNow() throttle as postOnceIfDue.
// Even if the user moves every 2 seconds, this fires at most once per 30 s.
// ─────────────────────────────────────────────────────────────────────────────
export async function postFromWatchUpdate(
  lat: number,
  long: number,
  address: string,
  source: 'fg' | 'bg' = 'bg',
  forceDispatch?: StoreDispatch,
): Promise<void> {
  // Same hard gate — prevents the 2-second spam
  if (posting || !isDue()) {
    __DEV__ && console.log(`[Poster:${source}:watch] throttled — skip`);
    return;
  }

  try {
    posting = true;
    await sendPayload(lat, long, address, source, forceDispatch);
  } catch (e) {
    __DEV__ && console.warn(`[Poster:${source}:watch] ❌`, e);
  } finally {
    posting = false;
  }
}

export default {
  attachPosterDispatch,
  postOnceIfDue,
  postFromWatchUpdate,
  formatServerDateTimeIST,
};
