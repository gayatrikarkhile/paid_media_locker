# API Documentation

Base URL (local dev): `http://localhost:4000/api`

All authenticated routes require:

```
Authorization: Bearer <jwt from /auth/login or /auth/register>
```

Errors are always `{ "error": "message", "details": [...optional...] }`
with an appropriate HTTP status code (400/401/402/403/404/409/429/500).

---

## Auth

### `POST /auth/register`
Create an account. Grants the starting coin balance immediately.

**Body**
```json
{ "username": "alice", "email": "alice@example.com", "password": "Password123!" }
```
- `username`: 3-30 chars, letters/numbers/underscore only
- `password`: min 8 characters

**201**
```json
{
  "token": "eyJ...",
  "user": { "id": "...", "username": "alice", "email": "alice@example.com", "walletBalance": 100, "createdAt": "..." }
}
```
`409` if the username/email is already taken.

---

### `POST /auth/login`
**Body**
```json
{ "emailOrUsername": "alice", "password": "Password123!" }
```
**200** → same shape as register. **401** on bad credentials (same error
for "no such user" and "wrong password" - avoids account enumeration).

---

### `GET /auth/me` 🔒
Returns the current user's profile.
**200** `{ "user": { ...same as above } }`

---

## Wallet

### `GET /wallet/balance` 🔒
**200** `{ "walletBalance": 80 }`

### `GET /wallet/transactions?page=1&limit=20` 🔒
Full ledger (audit trail) of every credit/debit for the current user.

**200**
```json
{
  "page": 1, "limit": 20, "total": 3,
  "items": [
    { "id": "...", "type": "DEBIT", "amount": 20, "balanceAfter": 80,
      "reason": "UNLOCK_MEDIA", "relatedMedia": { "id": "...", "title": "Sunset" },
      "createdAt": "..." },
    { "id": "...", "type": "CREDIT", "amount": 100, "balanceAfter": 100,
      "reason": "SIGNUP_BONUS", "relatedMedia": null, "createdAt": "..." }
  ]
}
```

---

## Media

### `POST /media` 🔒
Upload + publish a new paid image. `multipart/form-data`.

| field         | type   | notes                                  |
|---------------|--------|------------------------------------------|
| `image`       | file   | JPEG/PNG/WEBP, ≤15MB                     |
| `title`       | string | 1-120 chars                              |
| `description` | string | optional, ≤1000 chars                    |
| `unlockPrice` | number | ≥ 0                                       |

**201**
```json
{
  "media": {
    "id": "...", "title": "Sunset", "description": "", "unlockPrice": 20,
    "owner": { "id": "...", "username": "alice" },
    "isUnlocked": true, "isOwner": true,
    "width": 1200, "height": 800, "createdAt": "..."
  }
}
```
(`isUnlocked`/`isOwner` are `true` for the uploader's own media.)

---

### `GET /media?page=1&limit=20` 🔒
Browse/feed. Every item includes whether the *current* user has it
unlocked.

**200**
```json
{
  "page": 1, "limit": 20, "total": 5,
  "items": [
    { "id": "...", "title": "Sunset", "unlockPrice": 20,
      "owner": { "id": "...", "username": "bob" },
      "isUnlocked": false, "isOwner": false, "createdAt": "..." }
  ]
}
```

### `GET /media/:id` 🔒
Single media item detail, same shape as one feed item.
`404` if it doesn't exist.

---

### `GET /media/:id/access-url?variant=preview|original` 🔒
Issues a short-lived (60s) signed URL for actually fetching the bytes.
`variant=original` requires the caller to own or have unlocked the media
- **403** otherwise.

**200**
```json
{ "url": "/api/media/652.../file?variant=preview&token=eyJ...", "expiresInSeconds": 60 }
```
Prefix `url` with the API base URL to get a fetchable link.

---

### `GET /media/:id/file?variant=preview|original&token=...`
Streams the actual image bytes. Accepts **either**:
- a `?token=` from `access-url` above, **or**
- a normal `Authorization: Bearer <login JWT>` header (re-checked live
  against the DB on every request).

`variant` defaults to `preview` if omitted.

- **200** - image bytes, `Content-Type: image/jpeg` (preview) or the
  original's mime type.
- **401** - no credentials, or an expired/invalid token.
- **403** - asking for `variant=original` without owning/unlocking it, or
  a token that doesn't match this media/variant.
- **404** - media (or the underlying file) doesn't exist.

---

### `POST /media/:id/unlock` 🔒
Spend coins to unlock this media's original.

**201**
```json
{ "unlocked": true, "walletBalance": 80, "media": { "id": "...", "title": "Sunset" } }
```

| Status | Meaning |
|--------|---------|
| 400 | You already own this media (you're the uploader) |
| 402 | Insufficient wallet balance |
| 404 | Media not found |
| 409 | You've already unlocked this media (duplicate purchase blocked) |

---

## Unlocks (purchase history)

### `GET /unlocks` 🔒
Everything the current user has purchased.

**200**
```json
{
  "items": [
    { "id": "...", "media": { "id": "...", "title": "Sunset", "unlockPrice": 20 },
      "pricePaid": 20, "unlockedAt": "..." }
  ]
}
```

---

## Misc

### `GET /health`
No auth. `{ "ok": true }` - liveness check for Docker/orchestration.
