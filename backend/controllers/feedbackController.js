const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const Movie    = require('../models/Movie');
const Booking  = require('../models/Booking');
const { isShowEnded } = require('../utils/showtimeTiming');
const {
  mergeMovieSnapshotIntoBookingPlain,
  resolveMoviesOntoPlainBookings,
} = require('../utils/bookingMovieSnapshot');

// GET all feedback (admin)
exports.getFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('user',  'name email')
      .populate('movie', 'title genre')
      .populate('adminReply.repliedBy', 'name email');
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single feedback
exports.getFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('user',  'name email')
      .populate('movie', 'title genre')
      .populate('adminReply.repliedBy', 'name email');
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });
    res.json(feedback);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET all feedback for a specific movie
exports.getFeedbackByMovie = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ movie: req.params.movieId })
      .populate('user', 'name')
      .populate('adminReply.repliedBy', 'name');
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET average rating for a specific movie
exports.getAverageRating = async (req, res) => {
  try {
    const { movieId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.json({ averageRating: 0, totalReviews: 0 });
    }
    const result = await Feedback.aggregate([
      { $match: { movie: new mongoose.Types.ObjectId(movieId) } },
      { $group: {
          _id:           '$movie',
          averageRating: { $avg: '$rating' },
          totalReviews:  { $sum: 1 }
        }
      }
    ]);

    if (result.length === 0) {
      return res.json({ averageRating: 0, totalReviews: 0 });
    }

    res.json({
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews:  result[0].totalReviews
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET feedback submitted by logged in user
exports.getMyFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ user: req.user.id })
      .populate('movie', 'title genre posterUrl')
      .populate('adminReply.repliedBy', 'name');
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST create feedback
exports.createFeedback = async (req, res) => {
  try {
    const { movieId, rating, comment } = req.body;

    const movie = await Movie.findById(movieId);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });

    const attendedEnded = await Booking.find({
      user: req.user.id,
      status: 'confirmed',
    }).populate('showtime');
    const plains = attendedEnded.map(b => (b.toObject ? b.toObject() : { ...b }));
    await resolveMoviesOntoPlainBookings(plains);
    const canReview = plains.some(o => {
      mergeMovieSnapshotIntoBookingPlain(o);
      const st = o.showtime;
      if (!st) return false;
      const mid =
        (o.movieRef && String(o.movieRef)) ||
        (st.movie && (st.movie._id?.toString?.() || String(st.movie)));
      if (!mid || mid !== String(movieId)) return false;
      const dur = st.movie?.duration ?? o.movieDuration;
      return isShowEnded(st, dur);
    });
    if (!canReview) {
      return res.status(403).json({
        message: 'You can only review movies you watched (after a confirmed screening has ended)',
      });
    }

    // Check user has not already reviewed this movie
    const existing = await Feedback.findOne({
      user:  req.user.id,
      movie: movieId
    });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this movie' });
    }

    const feedback = await Feedback.create({
      user:    req.user.id,
      movie:   movieId,
      rating,
      comment
    });

    res.status(201).json(feedback);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update feedback — only the author may change their review
exports.updateFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

    const ownerId = String(feedback.user?._id ?? feedback.user);
    const requesterId = String(req.user.id);
    if (ownerId !== requesterId) {
      return res.status(403).json({ message: 'You can only edit your own feedback' });
    }

    const rating = Number(req.body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const patch = { rating };
    if (Object.prototype.hasOwnProperty.call(req.body, 'comment')) {
      patch.comment = String(req.body.comment ?? '').trim();
    }

    const updated = await Feedback.findByIdAndUpdate(req.params.id, patch, {
      new: true,
      runValidators: true,
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE feedback — only the author may remove their review (not admins for others)
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

    const ownerId = String(feedback.user?._id ?? feedback.user);
    const requesterId = String(req.user.id);
    if (ownerId !== requesterId) {
      return res.status(403).json({ message: 'You can only delete your own feedback' });
    }

    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ message: 'Feedback deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT admin reply to feedback
exports.replyToFeedback = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Reply message is required' });
    }

    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

    if (feedback.adminReply?.message?.trim()) {
      return res.status(400).json({ message: 'A reply was already posted and cannot be changed' });
    }

    feedback.adminReply = {
      message: message.trim(),
      repliedBy: req.user.id,
      repliedAt: new Date(),
    };

    await feedback.save();

    const populated = await Feedback.findById(feedback._id)
      .populate('user', 'name email')
      .populate('movie', 'title genre')
      .populate('adminReply.repliedBy', 'name email');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};