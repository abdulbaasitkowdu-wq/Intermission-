const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  movie:   { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  rating:  { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  adminReply: {
    message:   { type: String },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    repliedAt: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);