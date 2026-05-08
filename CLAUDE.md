# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev    # node --watch src/server.js
npm start      # node src/server.js
npm test       # node --test tests/tokens.test.js
```

Run a single test by name pattern:

```bash
node --test --test-name-pattern="rotateRefresh" tests/tokens.test.js
```

End-to-end refresh-token smoke test (requires a running Redis and a real `JWT_SECRET` in env):

```bash
node scripts/smoke-refresh.js
```

There is no lint/format/build step — the project ships plain ESM JavaScript and runs on Node ≥ 20.

## Required environment

Boot is fail-fast on missing config:

- `src/server.js` exits with code 1 if `JWT_SECRET` is unset.
- `configurePassport()` (`src/auth/passport.js`) throws if any of `OAUTH_AUTH_URL`, `OAUTH_TOKEN_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_CALLBACK_URL` is missing — this happens at startup, not on first login.

`OAUTH_USERINFO_URL` is optional; without it the OAuth2 strategy returns an empty profile and downstream `userId()` falls back to `'anonymous'`.

`.env.example` lists Google OAuth defaults but the strategy is provider-agnostic.

## Architecture

The app is a thin Express server (`src/server.js`) that wires three concerns together: OAuth2 login (passport), token issuance/rotation (JWT + Redis), and a bearer-token-protected route.

### Token lifecycle

1. `GET /auth/login` → passport redirects to the OAuth provider.
2. `GET /auth/callback` → on success, issues a short-lived **access JWT** (15 min, returned in JSON body) and a long-lived **refresh token** (30 days, opaque random base64url, set as an `httpOnly` cookie scoped to `/auth`).
3. `POST /auth/refresh` → reads the refresh token from cookie or body, atomically rotates it, returns a new access token and sets a new refresh cookie.
4. `POST /auth/logout` → deletes the refresh token from Redis and clears the cookie. Access JWTs are stateless and remain valid until expiry.
5. `GET /me` → requires `Authorization: Bearer <access>` (see `src/middleware/requireAuth.js`).

Refresh tokens live in Redis under the key `refresh:<token>` with the user profile as JSON value and a 30-day TTL.

### Atomic refresh rotation (critical invariant)

`rotateRefresh()` in `src/auth/tokens.js:28` uses `redis.getDel()` to read-and-delete the old token in a single atomic op. This is what prevents refresh-token replay races — if you swap it for `get` + `del`, two concurrent refreshes can both succeed.

**This requires Redis 6.2+.** The `.env.example` says so; don't downgrade.

### `userId()` fallback chain

`tokens.js` derives the JWT `sub` claim by trying `profile.sub → profile.id → profile.email → 'anonymous'`. Provider profiles vary (Google emits `sub`, others emit `id`), so the fallback is intentional. Tests cover all four branches.

### Custom passport strategy

`UserInfoStrategy` in `src/auth/passport.js` extends `passport-oauth2` solely to add a `userProfile()` implementation that fetches `OAUTH_USERINFO_URL` with the access token. The base library doesn't ship a userinfo client.

## Test architecture: ESM live-binding redis injection

`src/redis.js` exports a **mutable** `redis` binding plus a `setRedis(client)` function. Tests inject a fake Redis without a DI framework by relying on ES module live bindings:

```js
const { setRedis } = await import('../src/redis.js');
setRedis(makeFakeRedis());
const { rotateRefresh } = await import('../src/auth/tokens.js');  // imports AFTER swap
```

The dynamic-import ordering matters: once a module captures `redis` into a local const, it would freeze the original. Because `tokens.js` does `import { redis } from '../src/redis.js'` (a live binding, not a snapshot), reassigning the export via `setRedis` is observed by the importer.

When adding tests that touch redis: follow the same pattern in `tests/tokens.test.js` — call `setRedis()` *before* dynamically importing the module under test. A static `import` at the top of a test file runs before `setRedis()` and will bind too early in some module-graph orderings.

The fake redis only implements the methods the production code uses (`set`, `getDel`, `del`). If you add a new redis call in `tokens.js`, extend the fake — there's no proxy.
