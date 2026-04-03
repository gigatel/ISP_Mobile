// // src/services/ForegroundLocationPoster.ts
// import { postOnceIfDue } from './LocationPosterCore';

// let intervalId: ReturnType<typeof setInterval> | null = null;
// const FG_INTERVAL_MS = 30_000; // 30s

// export function startForegroundPoster() {
//   if (intervalId) {
//     __DEV__ && console.log('[FG Poster] already running');
//     return;
//   }
//   __DEV__ && console.log('[FG Poster] starting…');
//   void postOnceIfDue('fg');
//   intervalId = setInterval(() => void postOnceIfDue('fg'), FG_INTERVAL_MS);
//   __DEV__ && console.log('[FG Poster] started @60s');
// }

// export function stopForegroundPoster() {
//   if (intervalId) {
//     clearInterval(intervalId);
//     intervalId = null;
//     __DEV__ && console.log('[FG Poster] stopped');
//   }
// }
// src/services/ForegroundLocationPoster.ts
import Geolocation from '@react-native-community/geolocation';
import { Preferences } from '@utils';
import { postOnceIfDue, postFromWatchUpdate } from './LocationPosterCore';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const FG_INTERVAL_MS = 30_000;   // periodic post every 30 s
const WATCH_DISTANCE_M = 10;     // trigger post after moving 10 m

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let intervalId: ReturnType<typeof setInterval> | null = null;
let watchId: number | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// watchPosition — posts on every meaningful movement while app is in foreground
// ─────────────────────────────────────────────────────────────────────────────
function startFgWatch() {
  if (watchId !== null) return;

  watchId = Geolocation.watchPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const long = pos.coords.longitude;

      // Keep Preferences up-to-date so BG service / PosterCore can use it
      const last = (Preferences.getData(Preferences.KEY.LAST_GEO_ADDRESS) ?? {}) as any;
      Preferences.setData(Preferences.KEY.LAST_GEO_ADDRESS, {
        ...last,
        lat,
        long,
      });

      __DEV__ && console.log('[FG Watch] position update', { lat, long });

      try {
        await postFromWatchUpdate(lat, long, last?.address ?? '', 'fg');
      } catch (e) {
        __DEV__ && console.warn('[FG Watch] post error', e);
      }
    },
    err => {
      __DEV__ && console.warn('[FG Watch] error', err?.message);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: WATCH_DISTANCE_M,
      interval: 10_000,
      fastestInterval: 5_000,
      timeout: 30_000,
      maximumAge: 20_000,
    } as any,
  );

  __DEV__ && console.log('[FG Watch] started (distanceFilter:', WATCH_DISTANCE_M, 'm)');
}

function stopFgWatch() {
  if (watchId !== null) {
    try { Geolocation.clearWatch(watchId); } catch {}
    watchId = null;
    __DEV__ && console.log('[FG Watch] stopped');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Start foreground poster (periodic interval + watchPosition)
// ─────────────────────────────────────────────────────────────────────────────
export function startForegroundPoster() {
  if (intervalId) {
    __DEV__ && console.log('[FG Poster] already running');
    return;
  }

  __DEV__ && console.log('[FG Poster] starting…');

  // Immediate first post
  void postOnceIfDue('fg');

  // Periodic posts
  intervalId = setInterval(() => void postOnceIfDue('fg'), FG_INTERVAL_MS);

  // Movement-triggered posts
  startFgWatch();

  __DEV__ && console.log('[FG Poster] started (interval:', FG_INTERVAL_MS, 'ms, watch:', WATCH_DISTANCE_M, 'm)');
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Stop foreground poster
// ─────────────────────────────────────────────────────────────────────────────
export function stopForegroundPoster() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    __DEV__ && console.log('[FG Poster] interval stopped');
  }
  stopFgWatch();
}
