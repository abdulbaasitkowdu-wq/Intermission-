const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');

const app = express();

/** Netlify + local dev; add CORS_ORIGINS=https://other.com,https://x.com for more */
function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return callback(null, true);
    }
    if (hostname.endsWith('.netlify.app')) {
      return callback(null, true);
    }
    // Expo / LAN (device on same network)
    if (/^192\.168\.\d+\.\d+$/.test(hostname) || /^10\.\d+\.\d+\.\d+$/.test(hostname)) {
      return callback(null, true);
    }
  } catch {
    return callback(null, false);
  }
  const extras = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extras.includes(origin)) return callback(null, true);
  return callback(null, false);
}

app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/movies',      require('./routes/movies'));
app.use('/api/showtimes',   require('./routes/showtimes'));
app.use('/api/bookings',    require('./routes/bookings'));
app.use('/api/feedback',    require('./routes/feedback'));
app.use('/api/suggestions', require('./routes/suggestions'));

app.get('/', (req, res) => res.send('Cinema API running'));

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();