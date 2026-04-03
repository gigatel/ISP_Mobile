// // src/services/LocationBatteryService.ts
// import { Platform } from 'react-native';
// import BackgroundActions from 'react-native-background-actions';
// import type { StoreDispatch } from '@reducers';
// import { postOnceIfDue } from './LocationPosterCore';
// import {
//   startBackgroundLocationWatcher,
//   stopBackgroundLocationWatcher,
// } from './BackgroundLocationWatcher';
// import { Preferences } from '@utils';

// let dispatchRef: StoreDispatch | null = null;
// export function attachDispatch(d: StoreDispatch) {
//   dispatchRef = d;
// }

// const TASK_NAME = 'LocationBatteryBGTask';
// const SLEEP_MS = 30_000;

// // Android-only icon/channel hints
// const ANDROID_ICON_NAME = 'ic_launcher';
// const ANDROID_ICON_TYPE = 'mipmap';

// // Build options safely per-platform (avoid unsupported fields on iOS)
// const baseOptions: any = {
//   taskName: TASK_NAME,
//   taskTitle: 'Location running',
//   taskDesc: 'Posting location & battery periodically',
//   color: '#0A84FF',
//   parameters: {}, // library expects an object
// };

// const optionsWithIcon: any =
//   Platform.select({
//     android: {
//       ...baseOptions,
//       taskIcon: { name: ANDROID_ICON_NAME, type: ANDROID_ICON_TYPE },
//     },
//     ios: { ...baseOptions },
//     default: baseOptions,
//   }) || baseOptions;

// const optionsWithoutIcon: any = { ...baseOptions };

// // ---- Fallback loop for iOS / OEMs when BackgroundActions fails ----
// // Use ReturnType<typeof setInterval> to avoid RN/Node timer mismatch
// type IntervalHandle = ReturnType<typeof setInterval>;
// let fallbackInterval: IntervalHandle | null = null;

// function startFallbackLoop() {
//   if (fallbackInterval) return;
//   try { startBackgroundLocationWatcher(); } catch {}
//   fallbackInterval = setInterval(async () => {
//     try {
//       await postOnceIfDue('bg', (dispatchRef ?? undefined) as any);
//     } catch (e) {
//       if (__DEV__) console.warn('[BG Fallback] postOnceIfDue error', e);
//     }
//   }, SLEEP_MS);
//   __DEV__ && console.log('[BG Fallback] interval started @', SLEEP_MS, 'ms');
// }

// function stopFallbackLoop() {
//   if (fallbackInterval) {
//     // Cast to any to silence mixed RN/Node typings if present
//     clearInterval(fallbackInterval as any);
//     fallbackInterval = null;
//     __DEV__ && console.log('[BG Fallback] interval stopped');
//   }
//   try { stopBackgroundLocationWatcher(); } catch {}
// }

// // ---- Helpers ----
// async function safeIsRunning(): Promise<boolean> {
//   try {
//     const maybeFn: any = (BackgroundActions as any)?.isRunning;
//     if (typeof maybeFn === 'function') {
//       const r = await maybeFn.call(BackgroundActions);
//       return !!r;
//     }
//     // Some older libs expose a boolean prop instead of a function
//     if (typeof maybeFn === 'boolean') return !!maybeFn;
//     return false;
//   } catch {
//     return false;
//   }
// }

// function sleep(ms: number) {
//   return new Promise(res => setTimeout(res, ms));
// }

// async function bgTask() {
//   __DEV__ && console.log('[BG Service] task started');
//   try { startBackgroundLocationWatcher(); } catch {}

//   try {
//     while (await safeIsRunning()) {
//       try {
//         await postOnceIfDue('bg', (dispatchRef ?? undefined) as any);
//       } catch (e) {
//         if (__DEV__) console.warn('[BG Service] postOnceIfDue error', e);
//       }
//       __DEV__ && console.log('[BG Service] tick');
//       await sleep(SLEEP_MS);
//     }
//   } catch (e) {
//     __DEV__ && console.warn('[BG Service] loop error', e);
//   } finally {
//     try { stopBackgroundLocationWatcher(); } catch {}
//     __DEV__ && console.log('[BG Service] task finished');
//   }
// }
// // Singleton guard to avoid racing multiple starts
// let starting = false;

// export async function startLocationBatteryService(
//   userId: string,
//   { companyId }: { companyId: number },
// ) {
//   try {
//     // Validate inputs early to avoid crashes inside native layer
//     const uidNum = Number(userId);
//     const cidNum = Number(companyId);
//     const hasValidUser = Number.isFinite(uidNum) && uidNum > 0;
//     const hasValidCompany = Number.isFinite(cidNum) && cidNum > 0;

//     if (hasValidUser) {
//       try { Preferences.setData(Preferences.KEY.EMPLOYEE_ID, uidNum); } catch {}
//     }
//     if (hasValidCompany) {
//       try { Preferences.setData(Preferences.KEY.COMPANY_ID, cidNum); } catch {}
//     }

//     // If userId is invalid, don't start anything. Foreground poster will still run elsewhere.
//     if (!hasValidUser) {
//       __DEV__ && console.log('[BG Service] skip start: invalid userId', { userId });
//       return;
//     }

//     // If already starting, skip
//     if (starting) {
//       __DEV__ && console.log('[BG Service] start skipped (already starting)');
//       return;
//     }

//     // iOS: prefer fallback loop (BackgroundActions limitations on iOS)
//     if (Platform.OS === 'ios') {
//       if (!(await safeIsRunning()) && !fallbackInterval) {
//         __DEV__ && console.log('[BG Service] iOS -> using fallback loop');
//         startFallbackLoop();
//       } else {
//         __DEV__ && console.log('[BG Service] iOS -> already running');
//       }
//       return;
//     }

//     // ANDROID path
//     const alreadyRunning = await safeIsRunning();
//     if (alreadyRunning) {
//       __DEV__ && console.log('[BG Service] already running');
//       try { startBackgroundLocationWatcher(); } catch {}
//       return;
//     }

//     starting = true;
//     __DEV__ && console.log('[BG Service] starting… (Android)');

//     // Try with icon first
//     try {
//       if (typeof (BackgroundActions as any)?.start === 'function') {
//         await BackgroundActions.start(bgTask, optionsWithIcon);
//         __DEV__ && console.log('[BG Service] started (with icon)');
//       } else {
//         // Library not available or API mismatch -> fallback
//         __DEV__ && console.warn('[BG Service] BackgroundActions.start not a function; using fallback');
//         startFallbackLoop();
//       }
//     } catch (e: any) {
//       const msg = String(e?.message || e || '');
//       if (/icon/i.test(msg)) {
//         __DEV__ && console.warn('[BG Service] retry w/o icon due to:', msg);
//         try {
//           await BackgroundActions.start(bgTask, optionsWithoutIcon);
//           __DEV__ && console.log('[BG Service] started (no icon fallback)');
//         } catch (e2: any) {
//           __DEV__ && console.warn('[BG Service] second start failed; using fallback', e2?.message || e2);
//           startFallbackLoop();
//         }
//       } else {
//         // If anything else fails, use the fallback interval
//         __DEV__ && console.warn('[BG Service] start failed; using fallback loop', msg);
//         startFallbackLoop();
//       }
//     } finally {
//       starting = false;
//     }
//   } catch (err) {
//     starting = false;
//     __DEV__ && console.warn('[BG Service] start failed (outer)', err);
//     // Ensure something is running even on unexpected failures
//     startFallbackLoop();
//   }
// }

// export async function stopLocationBatteryService() {
//   try {
//     const running = await safeIsRunning();
//     if (running) {
//       try {
//         if (typeof (BackgroundActions as any)?.stop === 'function') {
//           await BackgroundActions.stop();
//         }
//       } catch (e) {
//         if (__DEV__) console.warn('[BG Service] stop() error', e);
//       }
//     }
//   } catch {}
//   stopFallbackLoop();
//   __DEV__ && console.log('[BG Service] stopped');
// }

// src/services/LocationBatteryService.ts
import { Platform } from 'react-native';
import BackgroundActions from 'react-native-background-actions';
import Geolocation from '@react-native-community/geolocation';
import type { StoreDispatch } from '@reducers';
import { postOnceIfDue, postFromWatchUpdate } from './LocationPosterCore';
import { Preferences } from '@utils';

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch reference
// ─────────────────────────────────────────────────────────────────────────────
let dispatchRef: StoreDispatch | null = null;
export function attachDispatch(d: StoreDispatch) {
  dispatchRef = d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const TASK_NAME = 'LocationBatteryBGTask';
const SLEEP_MS = 30_000;         // periodic post interval
const WATCH_DISTANCE_M = 10;     // watchPosition distance filter (meters)

// ─────────────────────────────────────────────────────────────────────────────
// Notification (foreground service) options
// The notification keeps the process alive so BG posts work reliably
// ─────────────────────────────────────────────────────────────────────────────
const baseOptions: any = {
  taskName: TASK_NAME,
  taskTitle: 'Location Active',
  taskDesc: 'Tracking your location in background',
  color: '#0A84FF',
  linkingURI: 'yourapp://home',   // deep-link back into app on tap
  parameters: {},
};

const taskOptions: any =
  Platform.select({
    android: {
      ...baseOptions,
      taskIcon: { name: 'ic_launcher', type: 'mipmap' },
    },
    ios: { ...baseOptions },
    default: baseOptions,
  }) ?? baseOptions;

const taskOptionsNoIcon: any = { ...baseOptions };

// ─────────────────────────────────────────────────────────────────────────────
// watchPosition handle — used both in BG task AND fallback loop
// ─────────────────────────────────────────────────────────────────────────────
let watchId: number | null = null;

function startWatchPosition() {
  if (watchId !== null) return; // already watching

  __DEV__ && console.log('[BG Watch] starting watchPosition');

  watchId = Geolocation.watchPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const long = pos.coords.longitude;

      // Update last-known coords in Preferences so postOnceIfDue can use them
      const last = (Preferences.getData(Preferences.KEY.LAST_GEO_ADDRESS) ?? {}) as any;
      Preferences.setData(Preferences.KEY.LAST_GEO_ADDRESS, {
        ...last,
        lat,
        long,
      });

      __DEV__ && console.log('[BG Watch] position update', { lat, long });

      // Post immediately on every meaningful movement
      try {
        await postFromWatchUpdate(
          lat,
          long,
          last?.address ?? '',
          'bg',
          (dispatchRef ?? undefined) as any,
        );
      } catch (e) {
        __DEV__ && console.warn('[BG Watch] postFromWatchUpdate error', e);
      }
    },
    err => {
      __DEV__ && console.warn('[BG Watch] watchPosition error', err?.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: WATCH_DISTANCE_M,
      interval: 10_000,          // Android: request update every 10 s
      fastestInterval: 5_000,    // Android: accept if update arrives faster
      timeout: 60_000,
      maximumAge: 30_000,
      // showLocationDialog: true, // uncomment if library supports it
    } as any,
  );
}

function stopWatchPosition() {
  if (watchId !== null) {
    try { Geolocation.clearWatch(watchId); } catch {}
    watchId = null;
    __DEV__ && console.log('[BG Watch] stopped');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback interval (iOS / OEM Android when BackgroundActions unavailable)
// ─────────────────────────────────────────────────────────────────────────────
type IntervalHandle = ReturnType<typeof setInterval>;
let fallbackInterval: IntervalHandle | null = null;

function startFallbackLoop() {
  if (fallbackInterval) return;

  startWatchPosition(); // also start position watching

  fallbackInterval = setInterval(async () => {
    try {
      await postOnceIfDue('bg', (dispatchRef ?? undefined) as any);
    } catch (e) {
      __DEV__ && console.warn('[BG Fallback] postOnceIfDue error', e);
    }
  }, SLEEP_MS);

  __DEV__ && console.log('[BG Fallback] interval started @', SLEEP_MS, 'ms');
}

function stopFallbackLoop() {
  if (fallbackInterval) {
    clearInterval(fallbackInterval as any);
    fallbackInterval = null;
    __DEV__ && console.log('[BG Fallback] stopped');
  }
  stopWatchPosition();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function safeIsRunning(): Promise<boolean> {
  try {
    const maybeFn: any = (BackgroundActions as any)?.isRunning;
    if (typeof maybeFn === 'function') return !!(await maybeFn.call(BackgroundActions));
    if (typeof maybeFn === 'boolean') return !!maybeFn;
    return false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Background task body
// Runs inside the notification-driven foreground service process.
// This keeps running even when the app UI is swiped away on most Androids.
// ─────────────────────────────────────────────────────────────────────────────
async function bgTask() {
  __DEV__ && console.log('[BG Service] task started');

  // Start watching position inside the BG task so updates arrive here too
  startWatchPosition();

  try {
    while (await safeIsRunning()) {
      try {
        // Periodic timed post (watchPosition handles movement-triggered posts)
        await postOnceIfDue('bg', (dispatchRef ?? undefined) as any);
      } catch (e) {
        __DEV__ && console.warn('[BG Service] postOnceIfDue error', e);
      }
      __DEV__ && console.log('[BG Service] tick ✓');
      await sleep(SLEEP_MS);
    }
  } catch (e) {
    __DEV__ && console.warn('[BG Service] loop error', e);
  } finally {
    stopWatchPosition();
    __DEV__ && console.log('[BG Service] task finished');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton guard
// ─────────────────────────────────────────────────────────────────────────────
let starting = false;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Start the background location + battery service
// ─────────────────────────────────────────────────────────────────────────────
export async function startLocationBatteryService(
  userId: string,
  { companyId }: { companyId: number },
) {
  try {
    const uidNum = Number(userId);
    const cidNum = Number(companyId);
    const hasValidUser = Number.isFinite(uidNum) && uidNum > 0;
    const hasValidCompany = Number.isFinite(cidNum) && cidNum > 0;

    if (hasValidUser) {
      try { Preferences.setData(Preferences.KEY.EMPLOYEE_ID, uidNum); } catch {}
    }
    if (hasValidCompany) {
      try { Preferences.setData(Preferences.KEY.COMPANY_ID, cidNum); } catch {}
    }

    if (!hasValidUser) {
      __DEV__ && console.log('[BG Service] skip: invalid userId', { userId });
      return;
    }

    if (starting) {
      __DEV__ && console.log('[BG Service] start skipped (already starting)');
      return;
    }

    // ── iOS: use fallback loop (BackgroundActions has limitations on iOS) ──
    if (Platform.OS === 'ios') {
      if (!(await safeIsRunning()) && !fallbackInterval) {
        __DEV__ && console.log('[BG Service] iOS → fallback loop');
        startFallbackLoop();
      } else {
        __DEV__ && console.log('[BG Service] iOS → already running');
      }
      return;
    }

    // ── Android ───────────────────────────────────────────────────────────
    const alreadyRunning = await safeIsRunning();
    if (alreadyRunning) {
      __DEV__ && console.log('[BG Service] already running');
      startWatchPosition(); // ensure watch is active
      return;
    }

    starting = true;
    __DEV__ && console.log('[BG Service] starting… (Android)');

    try {
      if (typeof (BackgroundActions as any)?.start === 'function') {
        await BackgroundActions.start(bgTask, taskOptions);
        __DEV__ && console.log('[BG Service] started (with icon)');
      } else {
        __DEV__ && console.warn('[BG Service] BackgroundActions.start unavailable; fallback');
        startFallbackLoop();
      }
    } catch (e: any) {
      const msg = String(e?.message || e || '');
      if (/icon/i.test(msg)) {
        __DEV__ && console.warn('[BG Service] retry w/o icon:', msg);
        try {
          await BackgroundActions.start(bgTask, taskOptionsNoIcon);
          __DEV__ && console.log('[BG Service] started (no icon)');
        } catch (e2: any) {
          __DEV__ && console.warn('[BG Service] 2nd start failed; fallback', e2?.message ?? e2);
          startFallbackLoop();
        }
      } else {
        __DEV__ && console.warn('[BG Service] start failed; fallback', msg);
        startFallbackLoop();
      }
    } finally {
      starting = false;
    }
  } catch (err) {
    starting = false;
    __DEV__ && console.warn('[BG Service] outer error; fallback', err);
    startFallbackLoop();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Stop everything
// ─────────────────────────────────────────────────────────────────────────────
export async function stopLocationBatteryService() {
  try {
    if (await safeIsRunning()) {
      try {
        if (typeof (BackgroundActions as any)?.stop === 'function') {
          await BackgroundActions.stop();
        }
      } catch (e) {
        __DEV__ && console.warn('[BG Service] stop() error', e);
      }
    }
  } catch {}
  stopFallbackLoop(); // also stops watchPosition
  __DEV__ && console.log('[BG Service] stopped');
}
