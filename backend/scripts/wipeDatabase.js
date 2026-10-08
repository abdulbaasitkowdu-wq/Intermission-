/**
 * Drops the entire MongoDB database named in MONGO_URI (all collections, all data).
 *
 *   cd backend
 *   node scripts/wipeDatabase.js --yes
 *
 * For production, set MONGO_URI in the environment or rely on .env (same as the app).
 * This cannot be undone.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
  if (!process.argv.includes('--yes')) {
    console.error(
      'Refusing to run without --yes.\nUsage: node scripts/wipeDatabase.js --yes\n'
    );
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error('Missing MONGO_URI in .env or environment.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Dropping database: ${dbName}`);
  await mongoose.connection.dropDatabase();
  console.log('Done. Database is empty; restart the API and register fresh users.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
