import { createClient } from 'redis';

export let redis = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
});

redis.on('error', (err) => console.error('Redis error:', err.message));

// Test-only: swap the client. Relies on ESM live bindings so importers
// of `redis` pick up the replacement after this call.
export function setRedis(client) {
  redis = client;
}
