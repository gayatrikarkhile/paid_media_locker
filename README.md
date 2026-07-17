# Paid Media Locker

A backend + Expo React Native app that lets users upload images, set an
unlock price, and monetize them with a coin wallet. Everyone sees a
watermarked/low-res preview; only buyers (and the owner) can see the
original.

Built for the Konvo backend intern assignment. **Backend implementation is
the focus** of this submission, per the brief.

---

## 1. What's here

```
paid-media-locker/
├── server/          Node.js + Express + MongoDB API
├── mobile/           Expo (React Native) Android app
├── docker-compose.yml
└── .github/workflows/server-ci.yml   basic CI (runs backend tests)
```

## 2. A note on this deliverable's scope

This was written in a sandboxed environment with **no network/internet
access**, which meant I could not run `npm install`, start a live MongoDB
instance, or run `eas build` to produce a real `.apk`. So instead of
shipping a half-tested build, I've delivered:

- Complete, careful source code for both the backend and the Expo app
  (not scaffolding - every route, model, and screen described in the
  brief is implemented).
- A test suite (Jest + Supertest + an in-memory MongoDB) covering the
  security-critical paths: duplicate-purchase prevention, insufficient
  balance, and access control before/after unlock.
- Docker + docker-compose so the backend can be brought up with one
  command once you have Docker.
- Full setup instructions below so you can run it locally and generate
  the APK yourself via `expo run:android` or `eas build`.

I'd rather be upfront about this than hand over an APK I couldn't
actually verify boots.

## 3. Quick start - Backend

**Requirements:** Node 20+, MongoDB running locally (or Docker).

```bash
cd server
cp .env.example .env      # edit if you want, defaults work for local dev
npm install
npm run seed               # creates demo1 / demo2 accounts + one sample image
npm run dev                 # starts on http://localhost:4000
```

Or with Docker (spins up Mongo + the API together):

```bash
docker compose up --build
# then, in another shell, seed demo data:
docker compose exec server npm run seed
```

Health check: `GET http://localhost:4000/health` → `{ ok: true }`

Run tests:

```bash
cd server
npm test
```

### Demo credentials (after `npm run seed`)

| Username | Password      | Notes                                    |
|----------|---------------|-------------------------------------------|
| `demo1`  | `Password123!` | 100 coins, no uploads - use to test buying |
| `demo2`  | `Password123!` | 100 coins, has 1 uploaded paid image      |

## 4. Quick start - Mobile app (Expo)

**Requirements:** Node 20+, Expo CLI (`npx expo`), Android Studio/emulator
or a physical device with Expo Go.

```bash
cd mobile
npm install
```

Point the app at your backend. Edit `mobile/app.json` → `expo.extra.apiBaseUrl`:

- Android emulator talking to a backend on the same machine: `http://10.0.2.2:4000/api` (already the default)
- Physical device on the same Wi-Fi: `http://<your-computer-LAN-IP>:4000/api`
- Backend deployed somewhere: its public URL + `/api`

```bash
npx expo start
```

Scan the QR code with Expo Go, or press `a` to launch on a connected
Android emulator.

### Building a real APK

```bash
cd mobile
npx eas login
npx eas build -p android --profile preview
```

(or `npx expo run:android` for a debug build if you have the Android SDK
installed locally). Both require network access and an Expo account,
neither of which this sandbox has.

## 5. API documentation

See [`API_DOCS.md`](./API_DOCS.md) for every endpoint, request/response
shapes, and status codes.

## 6. Database schema

See [`DB_SCHEMA.md`](./DB_SCHEMA.md) for collections, fields, and indexes.

## 7. Security decisions

This section is deliberately detailed since the brief specifically asks
for it.

### 7.1 Access control model

Every media item has exactly two representations:

- **Preview** - watermarked, resized (max 480px wide), heavily
  recompressed JPEG (quality ~45), stripped of EXIF/GPS metadata. This is
  what the feed and the "locked" state show. It's viewable by *any
  authenticated user*, unlock status irrelevant - previews are the
  product's advertisement, not the product.
- **Original** - the actual uploaded file (still stripped of EXIF/GPS,
  otherwise untouched), only ever served to the **owner** or a user with
  a matching **Unlock** record.

Access is checked **on every single request** for the file, not just at
upload/purchase time - so a change in ownership, or (in a future version)
a refund/ban, is enforced immediately.

### 7.2 Preventing direct access to original files

The `uploads/` directory is **never** mounted with `express.static()`.
There is no public URL that maps 1:1 to a file on disk. The only way to
read a file's bytes is through `GET /api/media/:id/file`, which:

1. Requires either a valid login JWT or a valid short-lived file token
   (see 7.3).
2. Re-derives the requester's identity from that credential (never trusts
   a client-supplied user id).
3. For `variant=original`, re-checks ownership/unlock status against the
   database on that request - not against anything cached in the token.
4. Streams the file directly from disk (`fs.createReadStream`) - it's
   never copied to a public-facing path.

File names on disk are randomly generated UUIDs (see
`storage.service.js`), so even if directory listing were somehow
possible, filenames give away nothing about content, owner, or order of
upload.

### 7.3 Secure delivery / temporary access URLs (bonus)

`GET /api/media/:id/access-url?variant=preview|original` issues a
**60-second, single-purpose JWT** (separate secret from the login JWT)
encoding exactly `(user id, media id, variant)`. That token is only
useful for:

- fetching that one file,
- as that one variant,
- for the next ~60 seconds.

This is what the mobile app actually uses for every `<Image>` it renders
(`SecureImage.js`) - it's a deliberate demonstration of "don't just point
the UI at a permanent authenticated endpoint", even though the
`/file` endpoint also accepts a normal `Authorization: Bearer` header
directly for convenience/testing (e.g. via curl or Postman).

This directly limits the impact of URL sharing: if someone copies the
image URL out of the app and sends it to a friend, it stops working
within a minute, and never worked for any file except the one it was
issued for.

### 7.4 Preventing duplicate purchases

`Unlock` has a **unique compound index** on `(user, media)`. The purchase
flow inserts the `Unlock` row *before* debiting the wallet, specifically
so that under concurrent duplicate requests, MongoDB's unique index -
not application logic - is what rejects the second one (`E11000` → HTTP
409). Application-level "does an Unlock already exist" checks are
race-prone by themselves; the DB constraint isn't.

### 7.5 Preventing overspend / race conditions on the wallet

Wallet debits use a single conditional `findOneAndUpdate` with
`{ walletBalance: { $gte: amount } }` in the *filter*, not a
read-balance-then-write pattern. Two simultaneous unlock requests against
a low balance can't both succeed and drive the balance negative, because
the decrement and the sufficiency check happen atomically in MongoDB
itself.

If the debit fails after the `Unlock` row was already inserted (should be
rare, since we checked balance client-side and it's now confirmed
server-side), the `Unlock` row is deleted as a compensating action so the
user never ends up "unlocked but never charged."

> **On transactions:** a proper multi-document ACID transaction (Mongo
> `session.withTransaction`) would be the textbook way to make the
> Unlock-insert + wallet-debit atomic as a single unit. I didn't wire
> that in by default because it requires MongoDB to run as a replica set
> (a bare `mongod` won't support transactions), which adds real setup
> friction for a "runs locally with minimal setup" assignment. The
> two-step insert-then-debit-then-compensate approach above gets the same
> *user-visible* guarantees (no duplicate purchase, no negative balance,
> no "charged but not unlocked") without that requirement. If you run
> Mongo as a replica set (`docker-compose` can be extended for this),
> swapping in a session-wrapped transaction in `unlock.controller.js` is
> a small change.

### 7.6 Ownership validation

Every mutating/sensitive route re-derives `req.user` from the verified
JWT (`middleware/auth.js`) - the client never gets to just say "I am user
X". Media ownership checks compare `media.owner` against `req.user._id`
pulled from that verified identity, server-side, every time.

### 7.7 Other hardening

- Passwords hashed with **bcrypt**, 12 rounds; never returned by any API
  response (`select: false` on the schema field + a `toSafeJSON()`
  serializer used everywhere).
- **express-mongo-sanitize** strips `$`/`.` keys from `req.body`/`req.query`
  to block NoSQL operator injection.
- **helmet** for standard security headers; **cors** locked to a
  configurable origin.
- **express-validator** on every route that accepts user input (register,
  login, upload, ids, pagination).
- **Rate limiting** (`express-rate-limit`): tighter limits on
  `/auth/register`, `/auth/login`, and `/media/:id/unlock` than the
  general API limiter, since those are the routes most worth
  brute-forcing/spamming.
- **File upload validation**: MIME allow-list (JPEG/PNG/WEBP only), 15MB
  size cap, single file per request, buffered in memory (not written to
  disk) until it's passed validation and gone through the preview
  pipeline.
- **EXIF/GPS stripping** on both the original and the preview via
  `sharp(...).withMetadata({})`, so uploading a phone photo doesn't leak
  the uploader's location.
- **Audit logging**: an `AccessLog` collection records every file read
  (who, which media, which variant, IP, user agent) - useful for spotting
  abuse patterns like the same signed token pattern being hit from many
  different IPs in a short window.
- **JWT auth** for the interactive session (7-day expiry by default,
  configurable) is deliberately separate from the 60-second file tokens
  above - compromising one doesn't compromise the other's blast radius.

## 8. What I'd add with more time

- Real Mongo-transaction-wrapped unlock (see 7.5) once running against a
  replica set.
- Refresh tokens / shorter-lived access tokens + rotation.
- Redis-backed rate limiting (current `express-rate-limit` store is
  in-memory, fine for a single instance, not for horizontal scaling).
- CDN-fronted preview delivery (previews are non-sensitive and cacheable
  publicly; originals should stay behind the signed-URL scheme even
  behind a CDN).
- Pagination cursors instead of page/limit for the feed at scale.
- Soft-delete / moderation flow for reported media.
