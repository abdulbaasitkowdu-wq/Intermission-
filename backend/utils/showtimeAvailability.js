const Booking = require('../models/Booking');

/**
 * How many individual seat slots are in confirmed (non-cancelled) bookings
 * for this showtime. This is the source of truth for "how many seats are sold".
 */
async function getConfirmedSeatsSoldCount(showtimeId) {
  if (!showtimeId) return 0;
  const list = await Booking.find({ showtime: showtimeId, status: 'confirmed' })
    .select('seats')
    .lean();
  return list.reduce(
    (n, b) => n + (Array.isArray(b.seats) ? b.seats.length : 0),
    0
  );
}

/**
 * Remaining seats = total capacity minus sold (from booking rows).
 * Ignores the stored availableSeats field, which can drift.
 */
function remainingFromTotalAndSold(totalSeats, sold) {
  return Math.max(0, (totalSeats || 0) - (sold || 0));
}

/** Single showtime document (Mongoose doc or plain object) → response shape */
async function withComputedAvailableOne(st) {
  if (!st) return st;
  const id = st._id;
  const sold = await getConfirmedSeatsSoldCount(id);
  const o = st.toObject ? st.toObject() : { ...st };
  o.availableSeats = remainingFromTotalAndSold(o.totalSeats, sold);
  return o;
}

/** Array of showtimes (same showtimeId order not required) */
async function withComputedAvailableMany(showtimes) {
  if (!showtimes?.length) return showtimes;
  const ids = showtimes.map(s => s._id);
  const usedRows = await Booking.aggregate([
    { $match: { showtime: { $in: ids }, status: 'confirmed' } },
    { $project: { showtime: 1, c: { $size: { $ifNull: ['$seats', []] } } } },
    { $group: { _id: '$showtime', used: { $sum: '$c' } } },
  ]);
  const map = new Map(usedRows.map(r => [r._id.toString(), r.used]));
  return showtimes.map((st) => {
    const o = st.toObject ? st.toObject() : { ...st };
    const sold = map.get(st._id.toString()) || 0;
    o.availableSeats = remainingFromTotalAndSold(o.totalSeats, sold);
    return o;
  });
}

module.exports = {
  getConfirmedSeatsSoldCount,
  remainingFromTotalAndSold,
  withComputedAvailableOne,
  withComputedAvailableMany,
};
