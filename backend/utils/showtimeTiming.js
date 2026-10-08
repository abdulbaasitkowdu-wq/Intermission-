/**
 * Treats showtime.date (UTC instant from DB) calendar day in UTC + time string as UTC wall-clock.
 * Matches JSON round-trips and keeps server behaviour deterministic.
 */

function parseTimeToParts(timeStr) {
  const m = String(timeStr || '12:00')
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hh: 12, mm: 0 };
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hh, mm };
}

function showStartMsUtc(showtime) {
  if (!showtime?.date) return 0;
  const d = new Date(showtime.date);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const dd = d.getUTCDate();
  const { hh, mm } = parseTimeToParts(showtime.time);
  return Date.UTC(y, mo, dd, hh, mm, 0, 0);
}

const DEFAULT_RUNTIME_MIN = 120;

function showEndMsUtc(showtime, durationMinutes) {
  const dur = Number(durationMinutes);
  const mins = Number.isFinite(dur) && dur > 0 ? dur : DEFAULT_RUNTIME_MIN;
  return showStartMsUtc(showtime) + mins * 60 * 1000;
}

function isShowEnded(showtime, movieDurationMinutes) {
  if (!showtime?.date) return false;
  return showEndMsUtc(showtime, movieDurationMinutes) < Date.now();
}

module.exports = {
  showStartMsUtc,
  showEndMsUtc,
  isShowEnded,
};
