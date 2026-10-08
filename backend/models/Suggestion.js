const mongoose = require('mongoose');

const SuggestionSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  movieTitle:  { type: String, required: true },
  description: { type: String },
  votes:       { type: Number, default: 0 },
  votedBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Suggestion', SuggestionSchema);