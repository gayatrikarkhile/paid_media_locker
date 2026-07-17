const request = require('supertest');
const sharp = require('sharp');
require('./setup');
const createApp = require('../src/app');

const app = createApp();

async function registerUser(username) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@example.com`, password: 'Password123!' });
  return { token: res.body.token, user: res.body.user };
}

async function tinyJpeg() {
  return sharp({ create: { width: 50, height: 50, channels: 3, background: { r: 10, g: 10, b: 10 } } })
    .jpeg()
    .toBuffer();
}

async function uploadMedia(token, price) {
  const buf = await tinyJpeg();
  const res = await request(app)
    .post('/api/media')
    .set('Authorization', `Bearer ${token}`)
    .field('title', 'Test image')
    .field('unlockPrice', String(price))
    .attach('image', buf, 'test.jpg');
  return res.body.media;
}

describe('Unlock flow', () => {
  test('non-owner cannot fetch the original before unlocking, can after', async () => {
    const seller = await registerUser('seller1');
    const buyer = await registerUser('buyer1');
    const media = await uploadMedia(seller.token, 30);

    const before = await request(app)
      .get(`/api/media/${media.id}/file?variant=original`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(before.status).toBe(403);

    const unlockRes = await request(app)
      .post(`/api/media/${media.id}/unlock`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(unlockRes.status).toBe(201);
    expect(unlockRes.body.walletBalance).toBe(70); // 100 - 30

    const after = await request(app)
      .get(`/api/media/${media.id}/file?variant=original`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(after.status).toBe(200);
  });

  test('rejects duplicate purchase of the same media', async () => {
    const seller = await registerUser('seller2');
    const buyer = await registerUser('buyer2');
    const media = await uploadMedia(seller.token, 10);

    const first = await request(app)
      .post(`/api/media/${media.id}/unlock`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/media/${media.id}/unlock`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(second.status).toBe(409);
  });

  test('rejects unlock when wallet balance is insufficient', async () => {
    const seller = await registerUser('seller3');
    const buyer = await registerUser('buyer3');
    const media = await uploadMedia(seller.token, 999); // more than the 100 starting balance

    const res = await request(app)
      .post(`/api/media/${media.id}/unlock`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(res.status).toBe(402);

    // and no Unlock row should have been left behind (rollback worked)
    const originalAttempt = await request(app)
      .get(`/api/media/${media.id}/file?variant=original`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(originalAttempt.status).toBe(403);
  });

  test('preview is publicly viewable by any authenticated user without unlocking', async () => {
    const seller = await registerUser('seller4');
    const buyer = await registerUser('buyer4');
    const media = await uploadMedia(seller.token, 15);

    const res = await request(app)
      .get(`/api/media/${media.id}/file?variant=preview`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
  });

  test('rejects file access with no credentials at all', async () => {
    const seller = await registerUser('seller5');
    const media = await uploadMedia(seller.token, 15);

    const res = await request(app).get(`/api/media/${media.id}/file?variant=preview`);
    expect(res.status).toBe(401);
  });
});
