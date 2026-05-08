import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { configurePassport } from './auth/passport.js';
import authRoutes from './auth/routes.js';
import { requireAuth } from './middleware/requireAuth.js';
import { redis } from './redis.js';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();
configurePassport();

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

app.use('/auth', authRoutes);

app.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 3000;

await redis.connect();
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
