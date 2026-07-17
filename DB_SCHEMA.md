# Database Schema (MongoDB / Mongoose)

Four collections. `_id` fields are ObjectIds unless noted. All collections
use Mongoose `timestamps: true` (adds `createdAt`/`updatedAt`).

## `users`

| field           | type    | notes                                            |
|-----------------|---------|---------------------------------------------------|
| `username`      | String  | unique, indexed, 3-30 chars                        |
| `email`         | String  | unique, indexed, lowercased                        |
| `passwordHash`  | String  | bcrypt hash; `select: false` (never returned by default) |
| `walletBalance` | Number  | default 0, min 0                                   |
| `createdAt`     | Date    |                                                      |
| `updatedAt`     | Date    |                                                      |

**Indexes:** `{ username: 1 }` unique, `{ email: 1 }` unique.

---

## `media`

| field                 | type       | notes                                                     |
|-----------------------|------------|------------------------------------------------------------|
| `owner`               | ObjectId → users | indexed                                              |
| `title`                | String     | required, ≤120 chars                                       |
| `description`          | String     | ≤1000 chars, default `""`                                  |
| `unlockPrice`          | Number     | required, ≥ 0                                               |
| `originalStorageKey`   | String     | random UUID-based filename under `uploads/originals/` - **never derived from user input** |
| `previewStorageKey`    | String     | random UUID-based filename under `uploads/previews/`        |
| `mimeType`             | String     | e.g. `image/jpeg`                                            |
| `originalFilename`     | String     | user's original filename, display-only, never used for storage paths |
| `width` / `height`     | Number     | of the sanitized original                                    |
| `createdAt`             | Date       |                                                                |

**Indexes:** `{ owner: 1 }`.

Note: there is deliberately **no field that is a public URL** to the
file. Delivery always goes through the `/media/:id/file` controller,
which resolves `originalStorageKey`/`previewStorageKey` to a path on
disk that is never exposed directly.

---

## `unlocks`

Represents a completed purchase - one row per (user, media) pair, ever.

| field         | type              | notes                                   |
|---------------|-------------------|-------------------------------------------|
| `user`        | ObjectId → users  |                                             |
| `media`       | ObjectId → media  |                                             |
| `pricePaid`   | Number            | snapshot of the price at purchase time (so later price changes don't rewrite history) |
| `createdAt`   | Date              | = the unlock timestamp                     |

**Indexes:** `{ user: 1, media: 1 }` **unique** - this is the actual
enforcement mechanism for "no duplicate purchases", not just an
application-level check.

---

## `transactions`

The wallet ledger / audit log. Every coin movement (signup bonus,
unlock spend, any future top-up) creates one row here - this collection
IS the transaction history the wallet feature requires.

| field           | type                     | notes                                  |
|------------------|--------------------------|------------------------------------------|
| `user`           | ObjectId → users, indexed |                                          |
| `type`           | String enum              | `CREDIT` \| `DEBIT`                       |
| `amount`         | Number, ≥ 0               | always positive; sign is implied by `type` |
| `balanceAfter`   | Number                    | wallet balance immediately after this entry - lets you reconstruct history without replaying all rows |
| `reason`         | String                    | e.g. `SIGNUP_BONUS`, `UNLOCK_MEDIA`        |
| `relatedMedia`   | ObjectId → media, nullable |                                          |
| `createdAt`      | Date                      |                                          |

---

## `accesslogs` (bonus - audit logging)

Every time a file (preview or original) is actually streamed to someone,
one row is written here. Best-effort / fire-and-forget - never blocks or
fails the actual file response.

| field        | type                      | notes                        |
|---------------|---------------------------|-------------------------------|
| `user`        | ObjectId → users          | resolved from either the login JWT or the short-lived file token |
| `media`       | ObjectId → media          |                                |
| `variant`     | String enum               | `preview` \| `original`        |
| `ip`          | String                    |                                |
| `userAgent`   | String                    |                                |
| `createdAt`   | Date                      |                                |

---

## Entity relationship summary

```
User 1───* Media          (owner)
User 1───* Unlock  *───1 Media    (unique on user+media)
User 1───* Transaction    (optionally references a Media via relatedMedia)
User 1───* AccessLog  *───1 Media
```
