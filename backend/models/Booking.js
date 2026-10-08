const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  showtime:    { type: mongoose.Schema.Types.ObjectId, ref: 'Showtime', required: true },
  seats:       { type: [String], required: true },
  totalPrice:  { type: Number, required: true },
  status:      { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  /** Copied at booking time so archive / watched still show the title if the movie is later archived or removed. */
  movieRef:        { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
  movieTitle:      { type: String },
  moviePosterUrl:  { type: String },
  movieDuration:   { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);