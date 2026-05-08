# my-project

Small Express API demonstrating OAuth2 login with stateless access JWTs and Redis-backed refresh tokens with atomic, replay-safe rotation.

## Requirements

- Node.js ≥ 20
- Redis ≥ 6.2 (uses `GETDEL` for atomic refresh-token rotation)
- An OAuth2/OIDC provider (defaults in `.env.example` target Google)

## Setup

```bash
npm install
cp .env.example .env
# fill in JWT_SECRET (e.g. `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
# fill in OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, and the OAUTH_*_URL values for your provider
npm run dev   # or: npm start
```

The server fails fast at boot if `JWT_SECRET` or any required `OAUTH_*` variable is missing.

## Endpoints

| Method | Path             | Purpose                                                                   |
|--------|------------------|---------------------------------------------------------------------------|
| GET    | `/auth/login`    | Redirects to the OAuth provider.                                          |
| GET    | `/auth/callback` | OAuth callback. Returns `{ access_token, ... }`; sets `refresh_token` cookie. |
| POST   | `/auth/refresh`  | Reads refresh token (cookie or body), atomically rotates, returns a new access token. |
| POST   | `/auth/logout`   | Revokes the refresh token and clears the cookie.                          |
| GET    | `/me`            | Requires `Authorization: Bearer <access>`. Returns the decoded profile.   |
| GET    | `/health`        | `{ ok: true }`.                                                           |

Access tokens are JWTs valid for 15 minutes. Refresh tokens are opaque base64url strings stored in Redis under `refresh:<token>` with a 30-day TTL, and are delivered as `httpOnly` cookies scoped to `/auth`.

## Tests

```bash
npm test                                      # all unit tests (no Redis required)
node scripts/smoke-refresh.js                 # end-to-end against a live Redis
```

The unit tests inject a fake Redis via the `setRedis()` hook in `src/redis.js`, so they run without a Redis instance.
