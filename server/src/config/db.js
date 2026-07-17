const mongoose = require('mongoose');
const { mongoUri } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log(`[db] connected -> ${mongoUri}`);
}

module.exports = connectDB;
