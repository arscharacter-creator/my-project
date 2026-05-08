import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-secret';

const { setRedis } = await import('../src/redis.js');

function makeFakeRedis() {
  const store = new Map();
  return {
    async set(key, value) {
      store.set(key, value);
    },
    async getDel(key) {
      const v = store.get(key);
      store.delete(key);
      return v ?? null;
    },
    async del(key) {
      store.delete(key);
    },
    _store: store,
  };
}

setRedis(makeFakeRedis());

const {
  issueAccessToken,
  verifyAccess,
  issueRefreshToken,
  rotateRefresh,
  revokeRefresh,
} = await import('../src/auth/tokens.js');

test('issueAccessToken + verifyAccess round-trip preserves sub', () => {
  const token = issueAccessToken({ sub: 'u1' });
  assert.equal(verifyAccess(token).sub, 'u1');
});

test('issueAccessToken falls back to id, then email, then "anonymous"', () => {
  assert.equal(verifyAccess(issueAccessToken({ id: 'u-id' })).sub, 'u-id');
  assert.equal(verifyAccess(issueAccessToken({ email: 'a@b.dev' })).sub, 'a@b.dev');
  assert.equal(verifyAccess(issueAccessToken({})).sub, 'anonymous');
});

test('verifyAccess rejects a tampered token', () => {
  const token = issueAccessToken({ sub: 'u1' });
  // Flip a middle char: the last base64url char of the signature only encodes
  // 4 bits, so swapping it can decode to the same bytes (~5% flake rate).
  // Middle chars contribute all 6 bits, so any change is guaranteed to corrupt.
  const i = Math.floor(token.length / 2);
  const swap = token[i] === 'a' || token[i] === '.' ? 'b' : 'a';
  const tampered = token.slice(0, i) + swap + token.slice(i + 1);
  assert.throws(() => verifyAccess(tampered));
});

test('issueRefreshToken returns a base64url string', async () => {
  const r = await issueRefreshToken({ sub: 'u2' });
  assert.match(r, /^[A-Za-z0-9_-]+$/);
  assert.ok(r.length >= 40);
});

test('rotateRefresh issues a fresh access + refresh pair', async () => {
  const r = await issueRefreshToken({ sub: 'u3' });
  const result = await rotateRefresh(r);
  assert.ok(result);
  assert.notEqual(result.refresh, r);
  assert.equal(verifyAccess(result.access).sub, 'u3');
});

test('rotateRefresh of an already-rotated refresh returns null (replay protection)', async () => {
  const r = await issueRefreshToken({ sub: 'u4' });
  await rotateRefresh(r);
  assert.equal(await rotateRefresh(r), null);
});

test('rotateRefresh of a revoked refresh returns null', async () => {
  const r = await issueRefreshToken({ sub: 'u5' });
  await revokeRefresh(r);
  assert.equal(await rotateRefresh(r), null);
});

test('rotateRefresh of an unknown token returns null', async () => {
  assert.equal(await rotateRefresh('totally-fake-token'), null);
});
