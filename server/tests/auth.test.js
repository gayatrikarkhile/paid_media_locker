const request = require('supertest');
require('./setup');
const createApp = require('../src/app');

const app = createApp();

describe('Auth', () => {
  test('registers a user and grants the starting balance', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.walletBalance).toBe(100);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('rejects duplicate registration', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'bob',
      email: 'bob@example.com',
      password: 'Password123!',
    });

    const res = await request(app).post('/api/auth/register').send({
      username: 'bob',
      email: 'bob@example.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(409);
  });

  test('logs in with correct credentials and rejects wrong password', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'carol',
      email: 'carol@example.com',
      password: 'Password123!',
    });

    const good = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'carol', password: 'Password123!' });
    expect(good.status).toBe(200);

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ emailOrUsername: 'carol', password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });
});
