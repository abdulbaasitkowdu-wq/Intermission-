/**
 * One-off: list users whose stored emails are the same when lowercased + trimmed
 * (e.g. Abdul@gmail.com vs abdul@gmail.com). Run from backend folder:
 *
 *   node scripts/findDuplicateEmailsCase.js
 *
 * Loads MONGO_URI from backend/.env (same as the app).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const User = require('../models/User');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const dupes = await User.aggregate([
    {
      $project: {
        emailRaw: '$email',
        key: { $toLower: { $trim: { input: { $ifNull: ['$email', ''] } } } },
        name: 1,
        role: 1,
        createdAt: 1,
      },
    },
    {
      $group: {
        _id: '$key',
        count: { $sum: 1 },
        users: {
          $push: {
            _id: '$_id',
            email: '$emailRaw',
            name: '$name',
            role: '$role',
            createdAt: '$createdAt',
          },
        },
      },
    },
    { $match: { count: { $gt: 1 }, _id: { $ne: '' } } },
    { $sort: { count: -1 } },
  ]);

  if (dupes.length === 0) {
    console.log('No case-only duplicate emails found (each lowercased address maps to at most one user).');
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  console.log(`Found ${dupes.length} lowercased email key(s) with more than one user:\n`);
  for (const g of dupes) {
    console.log(`— Key: "${g._id}" (${g.count} accounts)`);
    for (const u of g.users) {
      console.log(
        `    id=${u._id}  email="${u.email}"  name="${u.name}"  role=${u.role}  createdAt=${u.createdAt?.toISOString?.() || u.createdAt}`
      );
    }
    console.log('');
  }

  console.log(
    'Resolve manually in MongoDB (or Compass): keep one account, merge data if needed, delete the other, or change email on duplicates.'
  );

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
