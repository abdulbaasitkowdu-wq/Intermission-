const mongoose = require('mongoose');

const ShowtimeSchema = new mongoose.Schema({
  movie:          { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
  date:           { type: Date, required: true },
  time:           { type: String, required: true },
  screenNumber:   { type: Number, required: true },
  availableSeats: { type: Number, required: true },
  totalSeats:     { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Showtime', ShowtimeSchema);