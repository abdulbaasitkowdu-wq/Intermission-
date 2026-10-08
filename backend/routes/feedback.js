const router  = require('express').Router();
const protect = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const {
  getFeedbacks,
  getFeedback,
  getFeedbackByMovie,
  getAverageRating,
  getMyFeedback,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  replyToFeedback
} = require('../controllers/feedbackController');

// Public routes
router.get('/movie/:movieId',         getFeedbackByMovie);
router.get('/movie/:movieId/average', getAverageRating);

// Protected routes
router.get('/',        protect, adminOnly, getFeedbacks);
router.get('/my',      protect, getMyFeedback);
router.get('/:id',     protect, getFeedback);
router.post('/',       protect, createFeedback);
router.put('/:id',       protect, updateFeedback);
router.put('/:id/reply', protect, adminOnly, replyToFeedback);
router.delete('/:id',    protect, deleteFeedback);

module.exports = router;