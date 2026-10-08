const Showtime = require('../models/Showtime');
const Movie = require('../models/Movie');
const {
  withComputedAvailableOne,
  withComputedAvailableMany,
} = require('../utils/showtimeAvailability');

/** Calendar YYYY-MM-DD in UTC (matches dates stored as UTC noon on that day). */
function utcYmd(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, '0');
  const day = String(x.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// GET all showtimes
exports.getShowtimes = async (req, res) => {
  try {
    const showtimes = await Showtime.find().populate('movie', 'title genre duration posterUrl status');
    const out = await withComputedAvailableMany(showtimes);
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single showtime
exports.getShowtime = async (req, res) => {
  try {
    const showtime = await Showtime.findById(req.params.id).populate('movie', 'title genre duration posterUrl status');
    if (!showtime) return res.status(404).json({ message: 'Showtime not found' });
    const out = await withComputedAvailableOne(showtime);
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET showtimes by movie
exports.getShowtimesByMovie = async (req, res) => {
  try {
    const showtimes = await Showtime.find({ movie: req.params.movieId }).populate('movie', 'title genre duration posterUrl');
    const out = await withComputedAvailableMany(showtimes);
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET showtimes by date (YYYY-MM-DD interpreted as UTC calendar day — matches how clients store date)
exports.getShowtimesByDate = async (req, res) => {
  try {
    const raw = String(req.params.date || '').trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      return res.status(400).json({ message: 'Invalid date; use YYYY-MM-DD' });
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));

    const showtimes = await Showtime.find({
      date: { $gte: start, $lt: end }
    }).populate('movie', 'title genre duration posterUrl');
    const out = await withComputedAvailableMany(showtimes);
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST create showtime
exports.createShowtime = async (req, res) => {
  try {
    if (req.body?.movie) {
      const m = await Movie.findOne({ _id: req.body.movie, deletedAt: null });
      if (!m) {
        return res.status(400).json({ message: 'Movie not found or removed from catalog' });
      }
    }
    const showtime = await Showtime.create(req.body);
    const out = await withComputedAvailableOne(showtime);
    res.status(201).json(out);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update showtime
exports.updateShowtime = async (req, res) => {
  try {
    if (req.body?.movie) {
      const m = await Movie.findOne({ _id: req.body.movie, deletedAt: null });
      if (!m) {
        return res.status(400).json({ message: 'Movie not found or removed from catalog' });
      }
    }
    const showtime = await Showtime.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!showtime) return res.status(404).json({ message: 'Showtime not found' });
    const out = await withComputedAvailableOne(showtime);
    res.json(out);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE showtime
exports.deleteShowtime = async (req, res) => {
  try {
    const showtime = await Showtime.findById(req.params.id);
    if (!showtime) return res.status(404).json({ message: 'Showtime not found' });
    const showYmd = utcYmd(showtime.date);
    const todayYmd = utcYmd(new Date());
    if (showYmd < todayYmd) {
      return res.status(400).json({
        message: 'Cannot delete showtimes for dates that have already passed.',
      });
    }
    await Showtime.deleteOne({ _id: showtime._id });
    res.json({ message: 'Showtime deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};