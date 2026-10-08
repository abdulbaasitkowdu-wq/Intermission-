const router     = require('express').Router();
const protect    = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const {
  getMovies,
  getMovie,
  createMovie,
  updateMovie,
  deleteMovie,
  getTrendingMovies,
  getMoviesByStatus
} = require('../controllers/movieController');

// Public routes (anyone can view)
router.get('/',                    getMovies);
router.get('/trending',            getTrendingMovies);
router.get('/status/:status',      getMoviesByStatus);
router.get('/:id',                 getMovie);

// Protected routes (admin only)
router.post('/',      protect, adminOnly, createMovie);
router.put('/:id',    protect, adminOnly, updateMovie);
router.delete('/:id', protect, adminOnly, deleteMovie);

module.exports = router;