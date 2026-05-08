import { redis } from '../src/redis.js';
import {
  issueRefreshToken,
  rotateRefresh,
  revokeRefresh,
  issueAccessToken,
  verifyAccess,
} from '../src/auth/tokens.js';

process.env.JWT_SECRET ||= 'smoke-test-secret';

await redis.connect();

const profile = { sub: 'user-42', email: 'smoke@test.dev' };

const r1 = await issueRefreshToken(profile);
console.log('issued refresh:', r1.slice(0, 12), '...');

const access = issueAccessToken(profile);
console.log('access verified sub:', verifyAccess(access).sub);

const rotated = await rotateRefresh(r1);
console.log('rotated -> new refresh:', rotated.refresh.slice(0, 12), '...');

const replay = await rotateRefresh(r1);
console.log('replay of old refresh (must be null):', replay);

await revokeRefresh(rotated.refresh);
const revoked = await rotateRefresh(rotated.refresh);
console.log('after revoke (must be null):', revoked);

await redis.quit();
console.log('OK');
