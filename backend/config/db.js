const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * If there are no admin users, create one from env (or dev-only defaults).
 *
 * Production: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 6 chars).
 * Optional: SEED_ADMIN_NAME (default "Admin").
 *
 * Non-production: defaults admin@cinema.local / admin123 if env vars unset.
 */
async function ensureSeedAdmin() {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount > 0) return;

    const isProd = process.env.NODE_ENV === 'production';
    const email = (
      process.env.SEED_ADMIN_EMAIL ||
      (!isProd ? 'admin@cinema.local' : '')
    )
      .trim()
      .toLowerCase();
    const password =
      process.env.SEED_ADMIN_PASSWORD || (!isProd ? 'admin123' : '');
    const name = (process.env.SEED_ADMIN_NAME || 'Admin').trim() || 'Admin';

    if (!email || !password) {
      console.warn(
        '[seed] No admin users in the database. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first admin on startup.'
      );
      return;
    }

    if (password.length < 6) {
      console.warn('[seed] SEED_ADMIN_PASSWORD must be at least 6 characters. Skipping admin seed.');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    try {
      await User.create({
        name,
        email,
        password: hashedPassword,
        role: 'admin',
      });
    } catch (err) {
      if (err?.code === 11000) {
        return;
      }
      throw err;
    }

    if (isProd) {
      console.log(`[seed] Created first admin user (${email}).`);
    } else {
      console.log(
        `[seed] Created first admin user (${email}). Dev defaults: change password after login or set SEED_ADMIN_* in .env.`
      );
    }
  } catch (err) {
    console.error('[seed] Failed to ensure admin user:', err.message);
  }
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
    await ensureSeedAdmin();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
