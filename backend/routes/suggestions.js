const router  = require('express').Router();
const protect = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const {
  getSuggestions,
  getSuggestionsAdmin,
  getSuggestion,
  getMySuggestions,
  getSuggestionsByStatus,
  createSuggestion,
  voteSuggestion,
  updateSuggestion,
  updateSuggestionStatus,
  deleteSuggestion
} = require('../controllers/suggestionController');

// Public routes
router.get('/',                  getSuggestions);
router.get('/status/:status',    getSuggestionsByStatus);

// Protected routes
router.get('/admin/all',         protect, adminOnly, getSuggestionsAdmin);
router.get('/my',                protect, getMySuggestions);
router.get('/:id',               protect, getSuggestion);
router.post('/',                 protect, createSuggestion);
router.put('/:id/vote',          protect, voteSuggestion);
router.put('/:id',               protect, updateSuggestion);
router.put('/:id/status',        protect, adminOnly, updateSuggestionStatus);
router.delete('/:id',            protect, deleteSuggestion);

module.exports = router;