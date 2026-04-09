// src/services/ForegroundLocationPoster.ts
import { postOnceIfDue } from './LocationPosterCore';
import { startLocationWatch, stopLocationWatch } from '../../src/utils/location';

let started = false;

// export function startForegroundPoster() {
//   if (started) {
//     __DEV__ && console.log('[FG Poster] already running — skip');
//     return;
//   }
//   started = true;
//   __DEV__ && console.log('[FG Poster] starting…');

//   // Start watchPosition — this fires postNowWithCoords on every location update
//   // postNowWithCoords is throttled internally by MIN_GAP_MS (25s)
//   startLocationWatch();

//   __DEV__ && console.log('[FG Poster] started ✅');
// }
export function startForegroundPoster() {
  if (started) return;

  started = true;
  console.log('[FG Poster] starting…');

  // 🔥 ek baar immediate API hit
  postOnceIfDue('fg');

  startLocationWatch();

  console.log('[FG Poster] started ✅');
}
export function stopForegroundPoster() {
  stopLocationWatch();
  started = false;
  __DEV__ && console.log('[FG Poster] stopped ✅');
}
