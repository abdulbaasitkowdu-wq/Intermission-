const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/** Trim, Unicode NFC when available, then lowercasing for comparisons. */
function normalizeEmail(email) {
  let s = String(email || '').trim().toLowerCase();
  if (typeof s.normalize === 'function') {
    try {
      s = s.normalize('NFC');
    } catch (_) {
      /* ignore */
    }
  }
  return s;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Plain user doc from Mongo (not a Mongoose model) so `password` is always the
 * stored hash for bcrypt — avoids hydrate/cast edge cases.
 * Tries: exact email → $expr lower+trim match → anchored case-insensitive regex.
 */
async function findUserRawByEmailCaseInsensitive(normalizedLowerEmail) {
  if (!normalizedLowerEmail) return null;
  const coll = User.collection;

  let doc = await coll.findOne({ email: normalizedLowerEmail });
  if (doc) return doc;

  doc = await coll.findOne({
    $expr: {
      $eq: [
        {
          $toLower: {
            $trim: { input: { $ifNull: ['$email', ''] } },
          },
        },
        normalizedLowerEmail,
      ],
    },
  });
  if (doc) return doc;

  doc = await coll.findOne({
    email: { $regex: new RegExp(`^${escapeRegex(normalizedLowerEmail)}$`, 'i') },
  });
  return doc || null;
}

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const existing = await findUserRawByEmailCaseInsensitive(normalizedEmail);
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: role || 'user'
    });

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    res.status(500).json({ message: err.message });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const emailRaw = req.body?.email;
    const password = req.body?.password;
    const normalizedEmail = normalizeEmail(emailRaw);

    if (!normalizedEmail || password == null || password === '') {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const doc = await findUserRawByEmailCaseInsensitive(normalizedEmail);
    if (!doc || doc.password == null) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    let hash = doc.password;
    if (Buffer.isBuffer(hash)) {
      hash = hash.toString('utf8');
    } else if (hash != null && typeof hash !== 'string' && typeof hash.toString === 'function') {
      hash = hash.toString('utf8');
    } else {
      hash = String(hash);
    }
    const isMatch = await bcrypt.compare(password, hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const id = doc._id;
    const role = doc.role || 'user';
    const name = doc.name;

    const token = jwt.sign(
      { id, role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({ token, user: { id, name, role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};