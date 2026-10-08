const router  = require('express').Router();
const protect = require('../middleware/auth');
const {
  getBookings,
  getBooking,
  getMyBookings,
  getMyWatchedMovies,
  getTakenSeatsForShowtime,
  createBooking,
  cancelBooking,
  deleteBooking
} = require('../controllers/bookingController');

// All booking routes require login
router.get('/',          protect, getBookings);    // admin: all bookings
router.get('/my/watched-movies', protect, getMyWatchedMovies);
router.get('/my',        protect, getMyBookings);  // user: their own bookings
router.get('/showtime/:showtimeId/taken', protect, getTakenSeatsForShowtime);
router.get('/:id',       protect, getBooking);     // single booking
router.post('/',         protect, createBooking);  // create + deduct seats
router.put('/:id',       protect, cancelBooking);  // cancel + restore seats
router.delete('/:id',    protect, deleteBooking);  // admin: hard delete

module.exports = router;