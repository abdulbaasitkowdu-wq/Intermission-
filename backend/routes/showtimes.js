const router  = require('express').Router();
const protect = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const {
  getShowtimes,
  getShowtime,
  getShowtimesByMovie,
  getShowtimesByDate,
  createShowtime,
  updateShowtime,
  deleteShowtime
} = require('../controllers/showtimeController');

// Public routes
router.get('/',                        getShowtimes);
router.get('/movie/:movieId',          getShowtimesByMovie);
router.get('/date/:date',              getShowtimesByDate);
router.get('/:id',                     getShowtime);

// Admin-only mutations
router.post('/',       protect, adminOnly, createShowtime);
router.put('/:id',     protect, adminOnly, updateShowtime);
router.delete('/:id',  protect, adminOnly, deleteShowtime);

module.exports = router;