const Movie = require('../models/Movie');

const activeMovieFilter = { deletedAt: null };

// GET all movies (catalog only — soft-deleted titles are hidden)
exports.getMovies = async (req, res) => {
  try {
    const movies = await Movie.find(activeMovieFilter);
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single movie
exports.getMovie = async (req, res) => {
  try {
    const movie = await Movie.findOne({ _id: req.params.id, ...activeMovieFilter });
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST create movie
exports.createMovie = async (req, res) => {
  try {
    const { deletedAt: _ignore, ...body } = req.body || {};
    const movie = await Movie.create({ ...body, deletedAt: null });
    res.status(201).json(movie);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update movie
exports.updateMovie = async (req, res) => {
  try {
    const { deletedAt: _ignoreDeleted, ...updates } = req.body || {};
    const movie = await Movie.findOneAndUpdate(
      { _id: req.params.id, ...activeMovieFilter },
      updates,
      { new: true, runValidators: true }
    );
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    res.json(movie);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE movie (soft — keeps row for bookings, feedback, showtime history)
exports.deleteMovie = async (req, res) => {
  try {
    const movie = await Movie.findOneAndUpdate(
      { _id: req.params.id, ...activeMovieFilter },
      { deletedAt: new Date() },
      { new: true }
    );
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    res.json({ message: 'Movie archived (removed from catalog)', id: movie._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET trending movies
exports.getTrendingMovies = async (req, res) => {
  try {
    const movies = await Movie.find({ isTrending: true, ...activeMovieFilter });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET movies by status
exports.getMoviesByStatus = async (req, res) => {
  try {
    const movies = await Movie.find({ status: req.params.status, ...activeMovieFilter });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};