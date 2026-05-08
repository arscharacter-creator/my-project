import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const refreshStore = new Map();

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

export function issueRefreshToken(profile) {
  const token = crypto.randomBytes(32).toString('base64url');
  refreshStore.set(token, {
    profile,
    expiresAt: Date.now() + REFRESH_TTL_MS,
  });
  return token;
}

export function rotateRefresh(oldToken) {
  const record = refreshStore.get(oldToken);
  if (!record) return null;

  refreshStore.delete(oldToken);
  if (record.expiresAt < Date.now()) return null;

  return {
    access: issueAccessToken(record.profile),
    refresh: issueRefreshToken(record.profile),
  };
}

export function revokeRefresh(token) {
  refreshStore.delete(token);
}

export function verifyAccess(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
