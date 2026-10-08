const Movie = require('../models/Movie');

/**
 * Load movies by id (includes catalog-archived rows) and attach to each plain booking's `showtime.movie`.
 * Use after `populate('showtime')` **without** nested `populate('movie')`, so the ref id is never lost.
 */
async function resolveMoviesOntoPlainBookings(plainOs) {
  if (!Array.isArray(plainOs) || plainOs.length === 0) return plainOs;
  const ids = [];
  for (const o of plainOs) {
    const st = o.showtime;
    if (!st?.movie) continue;
    const mid = st.movie;
    const id =
      typeof mid === 'object' && mid._id != null ? String(mid._id) : String(mid);
    if (id && id !== 'undefined' && id !== 'null') ids.push(id);
  }
  const unique = [...new Set(ids)];
  if (unique.length === 0) return plainOs;

  const movies = await Movie.find({ _id: { $in: unique } })
    .select('title genre posterUrl duration')
    .lean();
  const map = new Map(movies.map(m => [String(m._id), m]));

  for (const o of plainOs) {
    const st = o.showtime;
    if (!st?.movie) continue;
    const mid = st.movie;
    const key =
      typeof mid === 'object' && mid._id != null ? String(mid._id) : String(mid);
    if (map.has(key)) {
      st.movie = map.get(key);
    }
  }
  return plainOs;
}

/**
 * If movie doc is still missing (hard-deleted), rebuild `showtime.movie` from fields stored on the booking.
 */
function mergeMovieSnapshotIntoBookingPlain(o) {
  if (!o?.showtime) return o;
  const st = o.showtime;
  const m = st.movie;
  const hasTitle = m && typeof m.title === 'string' && m.title.trim().length > 0;
  if (hasTitle) return o;
  const snap = o.movieTitle && String(o.movieTitle).trim();
  if (snap) {
    const mid = o.movieRef || st.movie;
    st.movie = {
      _id: mid,
      title: o.movieTitle,
      posterUrl: o.moviePosterUrl || undefined,
      duration:
        typeof o.movieDuration === 'number' && o.movieDuration > 0 ? o.movieDuration : undefined,
    };
  }
  return o;
}

module.exports = {
  mergeMovieSnapshotIntoBookingPlain,
  resolveMoviesOntoPlainBookings,
};
