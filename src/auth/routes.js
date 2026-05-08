import { Router } from 'express';
import passport from 'passport';
import {
  issueAccessToken,
  issueRefreshToken,
  rotateRefresh,
  revokeRefresh,
} from './tokens.js';

const router = Router();

const refreshCookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/auth',
};

router.get('/login', passport.authenticate('oauth2'));

router.get(
  '/callback',
  passport.authenticate('oauth2', { session: false, failureRedirect: '/auth/failure' }),
  async (req, res, next) => {
    try {
      const access = issueAccessToken(req.user);
      const refresh = await issueRefreshToken(req.user);
      res.cookie('refresh_token', refresh, refreshCookieOpts);
      res.json({ access_token: access, token_type: 'Bearer', expires_in: 15 * 60 });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/refresh', async (req, res, next) => {
  try {
    const refresh = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!refresh) return res.status(401).json({ error: 'missing_refresh_token' });

    const result = await rotateRefresh(refresh);
    if (!result) return res.status(401).json({ error: 'invalid_refresh_token' });

    res.cookie('refresh_token', result.refresh, refreshCookieOpts);
    res.json({ access_token: result.access, token_type: 'Bearer', expires_in: 15 * 60 });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const refresh = req.cookies?.refresh_token;
    if (refresh) await revokeRefresh(refresh);
    res.clearCookie('refresh_token', { path: '/auth' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/failure', (_req, res) => res.status(401).json({ error: 'oauth_failed' }));

export default router;
