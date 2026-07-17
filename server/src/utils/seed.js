// Creates two demo accounts so a reviewer can log in immediately without
// registering: demo1 (has coins, no uploads) and demo2 (has an uploaded
// paid image so the "owner" and "locked-until-purchased" flows are both
// visible right away).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const { startingBalance } = require('../config/env');
const User = require('../models/User');
const Media = require('../models/Media');
const Transaction = require('../models/Transaction');
const storage = require('../services/storage.service');
const preview = require('../services/preview.service');
const sharp = require('sharp');

async function upsertUser(username, email, password, balance) {
  let user = await User.findOne({ username });
  if (user) return user;

  const passwordHash = await bcrypt.hash(password, 12);
  user = await User.create({ username, email, passwordHash, walletBalance: balance });
  await Transaction.create({
    user: user._id,
    type: 'CREDIT',
    amount: balance,
    balanceAfter: balance,
    reason: 'SIGNUP_BONUS',
  });
  return user;
}

async function seedSampleMedia(owner) {
  const existing = await Media.findOne({ owner: owner._id });
  if (existing) return existing;

  // Generate a simple placeholder JPEG in-memory (no external assets
  // needed, so this works fully offline).
  const buffer = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 90, g: 120, b: 200 } },
  })
    .jpeg()
    .toBuffer();

  const { buffer: cleanOriginal, width, height } = await preview.sanitizeOriginal(buffer, 'image/jpeg');
  const previewBuffer = await preview.generatePreview(buffer);

  const originalStorageKey = await storage.writeOriginal(cleanOriginal, 'image/jpeg');
  const previewStorageKey = await storage.writePreview(previewBuffer);

  return Media.create({
    owner: owner._id,
    title: 'Sample Paid Photo',
    description: 'Seeded demo image - unlock it to see the full-resolution original.',
    unlockPrice: 20,
    originalStorageKey,
    previewStorageKey,
    mimeType: 'image/jpeg',
    originalFilename: 'seed.jpg',
    width,
    height,
  });
}

async function main() {
  await connectDB();

  const demo1 = await upsertUser('demo1', 'demo1@example.com', 'Password123!', startingBalance);
  const demo2 = await upsertUser('demo2', 'demo2@example.com', 'Password123!', startingBalance);
  await seedSampleMedia(demo2);

  console.log('Seed complete.');
  console.log('  demo1 / Password123!  (buyer)');
  console.log('  demo2 / Password123!  (has one uploaded paid image)');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
