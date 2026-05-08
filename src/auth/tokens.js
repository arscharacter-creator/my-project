import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { redis } from '../redis.js';

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
const key = (token) => `refresh:${token}`;

function userId(profile) {
  return profile?.sub || profile?.id || profile?.email || 'anonymous';
}

export function issueAccessToken(profile) {
  return jwt.sign(
    { sub: userId(profile), profile },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL_SEC }
  );
}

export async function issueRefreshToken(profile) {
  const token = crypto.randomBytes(32).toString('base64url');
  await redis.set(key(token), JSON.stringify({ profile }), { EX: REFRESH_TTL_SEC });
  return token;
}

// GETDEL is atomic (Redis 6.2+); prevents refresh-token replay races.
export async function rotateRefresh(oldToken) {
  const raw = await redis.getDel(key(oldToken));
  if (!raw) return null;

  const { profile } = JSON.parse(raw);
  return {
    access: issueAccessToken(profile),
    refresh: await issueRefreshToken(profile),
  };
}

export async function revokeRefresh(token) {
  await redis.del(key(token));
}

export function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
