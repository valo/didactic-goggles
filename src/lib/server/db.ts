import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required for server-side API routes');
}

export const pool =
  global.pgPool ||
  new Pool({
    connectionString,
    max: 5
  });

if (!global.pgPool) {
  global.pgPool = pool;
}
