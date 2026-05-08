import { verifyAccess } from '../auth/tokens.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing_bearer_token' });
  }

  try {
    req.user = verifyAccess(token);
    next();
  } catch {
    res.status(401).json({ error: 'invalid_or_expired_token' });
  }
}
