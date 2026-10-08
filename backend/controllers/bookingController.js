const Booking  = require('../models/Booking');
const Showtime = require('../models/Showtime');
const Movie    = require('../models/Movie');
const {
  getConfirmedSeatsSoldCount,
  remainingFromTotalAndSold,
  withComputedAvailableOne,
} = require('../utils/showtimeAvailability');
const { isShowEnded, showEndMsUtc } = require('../utils/showtimeTiming');
const {
  mergeMovieSnapshotIntoBookingPlain,
  resolveMoviesOntoPlainBookings,
} = require('../utils/bookingMovieSnapshot');

async function enrichBookingShowtime(booking) {
  if (!booking) return booking;
  const o = booking.toObject ? booking.toObject() : { ...booking };
  if (o.showtime) {
    o.showtime = await withComputedAvailableOne(o.showtime);
  }
  return o;
}

async function enrichBookingForClient(booking) {
  const o = await enrichBookingShowtime(booking);
  await resolveMoviesOntoPlainBookings([o]);
  return mergeMovieSnapshotIntoBookingPlain(o);
}

async function enrichManyBookingsForClient(bookings) {
  const plainOs = await Promise.all(bookings.map(b => enrichBookingShowtime(b)));
  await resolveMoviesOntoPlainBookings(plainOs);
  return plainOs.map(o => mergeMovieSnapshotIntoBookingPlain(o));
}

// GET all bookings (admin)
exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user', 'name email')
      .populate('showtime');
    const out = await enrichManyBookingsForClient(bookings);
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single booking
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email')
      .populate('showtime');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(await enrichBookingForClient(booking));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET bookings for logged in user
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).populate('showtime');
    const out = await enrichManyBookingsForClient(bookings);
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Unique movies from confirmed bookings whose screening has ended (for feedback / "watched")
exports.getMyWatchedMovies = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id, status: 'confirmed' }).populate(
      'showtime'
    );
    const plainOs = await enrichManyBookingsForClient(bookings);
    const bestByMovie = new Map();
    for (const o of plainOs) {
      const st = o.showtime;
      const m = st?.movie;
      if (!st || !m || !String(m.title || '').trim()) continue;
      if (!isShowEnded(st, m.duration)) continue;
      const id = String(m._id || o.movieRef || st._id);
      const endMs = showEndMsUtc(st, m.duration);
      const prev = bestByMovie.get(id);
      if (!prev || endMs > prev.endMs) {
        bestByMovie.set(id, { movie: m, lastEndedAt: new Date(endMs).toISOString(), endMs });
      }
    }
    const rows = Array.from(bestByMovie.values()).map(({ movie, lastEndedAt }) => ({
      movie,
      lastEndedAt,
    }));
    rows.sort((a, b) => (a.lastEndedAt < b.lastEndedAt ? 1 : -1));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Confirmed seat IDs already taken for a showtime (for seat map UI)
exports.getTakenSeatsForShowtime = async (req, res) => {
  try {
    const bookings = await Booking.find({
      showtime: req.params.showtimeId,
      status:   'confirmed',
    }).select('seats');
    const takenSeats = bookings.flatMap(b => b.seats);
    res.json({ takenSeats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST create booking (with seat deduction)
exports.createBooking = async (req, res) => {
  try {
    if (req.user?.role === 'admin') {
      return res.status(403).json({ message: 'Staff accounts cannot make bookings' });
    }

    const { showtimeId, seats } = req.body;

    if (!Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ message: 'Select at least one seat' });
    }

    // Step 1 — find the showtime (movie needed for snapshot on booking)
    const showtime = await Showtime.findById(showtimeId).populate('movie', 'title posterUrl duration');
    if (!showtime) return res.status(404).json({ message: 'Showtime not found' });
    const movieDoc = showtime.movie;

    // Step 2 — remaining = total capacity minus already sold (bookings are source of truth)
    const sold   = await getConfirmedSeatsSoldCount(showtime._id);
    const remaining = remainingFromTotalAndSold(showtime.totalSeats, sold);
    if (remaining < seats.length) {
      return res.status(400).json({
        message: `Only ${remaining} seat(s) available`
      });
    }

    // Step 3 — check seats are not already taken
    const existingBookings = await Booking.find({
      showtime: showtimeId,
      status:   'confirmed'
    });
    const takenSeats = existingBookings.flatMap(b => b.seats);
    const conflict   = seats.filter(s => takenSeats.includes(s));
    if (conflict.length > 0) {
      return res.status(400).json({
        message: `Seats already taken: ${conflict.join(', ')}`
      });
    }

    // Step 4 — calculate total price (example: $10 per seat)
    const pricePerSeat = 10;
    const totalPrice   = seats.length * pricePerSeat;

    // Step 5 — create the booking (snapshot keeps title in archive if movie is later archived)
    const booking = await Booking.create({
      user:       req.user.id,
      showtime:   showtime._id,
      seats,
      totalPrice,
      status:     'confirmed',
      movieRef:   movieDoc?._id || showtime.movie,
      movieTitle: movieDoc?.title,
      moviePosterUrl: movieDoc?.posterUrl || undefined,
      movieDuration: typeof movieDoc?.duration === 'number' ? movieDoc.duration : undefined,
    });

    // availableSeats is derived in API responses from totalSeats & bookings (no counter drift)

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT cancel booking (with seat restoration)
exports.cancelBooking = async (req, res) => {
  try {
    // Step 1 — find the booking
    const booking = await Booking.findById(req.params.id).populate('showtime');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Step 2 — make sure it belongs to the logged in user
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Step 3 — check it is not already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking already cancelled' });
    }

    const mid = booking.showtime?.movie;
    const m = mid ? await Movie.findById(mid).select('duration').lean() : null;
    const endDuration = m?.duration ?? booking.movieDuration;
    if (booking.showtime && isShowEnded(booking.showtime, endDuration)) {
      return res.status(400).json({ message: 'This screening has ended; the booking cannot be cancelled' });
    }

    // Step 4 — cancel the booking (display capacity is recomputed from confirmed bookings)
    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE booking (admin only)
exports.deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};