import { isShowEnded, showEndMsUtc } from './showtimeTiming';

/**
 * Unique movies from confirmed bookings whose screening has ended (newest end first).
 * @param {Array} bookings – populated `showtime.movie` like `/bookings/my`
 * @returns {{ movie: object, lastEndedAt: number }[]}
 */
export function buildWatchedMovieRowsFromBookings(bookings) {
  if (!Array.isArray(bookings)) return [];
  const best = new Map();
  for (const b of bookings) {
    if (b.status !== 'confirmed') continue;
    const st = b.showtime;
    if (!st) continue;
    const m = st?.movie;
    const duration = m?.duration ?? b.movieDuration;
    const title = String(m?.title || b.movieTitle || '').trim();
    if (!title) continue;
    if (!isShowEnded(st, duration)) continue;
    const mid = m?._id || b.movieRef || st.movie;
    const synthetic = {
      _id: mid,
      title,
      posterUrl: m?.posterUrl || b.moviePosterUrl,
      duration,
    };
    const id = mid != null ? String(mid) : `st:${String(st._id)}`;
    const endMs = showEndMsUtc(st, duration);
    const prev = best.get(id);
    if (!prev || endMs > prev.endMs) {
      best.set(id, { movie: synthetic, endMs });
    }
  }
  return Array.from(best.values())
    .sort((a, b) => b.endMs - a.endMs)
    .map(({ movie, endMs }) => ({
      movie,
      lastEndedAt: endMs,
      lastEndedLabel: new Date(endMs).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    }));
}
