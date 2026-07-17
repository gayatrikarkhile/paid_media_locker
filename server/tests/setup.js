const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test_jwt_secret';
process.env.FILE_TOKEN_SECRET = 'test_file_token_secret';
process.env.STARTING_BALANCE = '100';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
});
