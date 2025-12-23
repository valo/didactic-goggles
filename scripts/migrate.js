#!/usr/bin/env node
/* eslint-disable no-console */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '..', 'migrations');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required to run migrations');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });

async function ensureTable() {
  await pool.query(`
    create table if not exists migrations (
      id serial primary key,
      name text not null unique,
      applied_at timestamptz not null default now()
    );
  `);
}

async function getApplied() {
  const res = await pool.query('select name from migrations');
  return new Set(res.rows.map((r) => r.name));
}

async function loadMigrations() {
  const files = await fs.readdir(migrationsDir);
  return files
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, fullPath: path.join(migrationsDir, name) }));
}

async function applyMigration(client, migration) {
  const sql = await fs.readFile(migration.fullPath, 'utf8');
  await client.query('begin');
  try {
    await client.query(sql);
    await client.query('insert into migrations (name) values ($1)', [migration.name]);
    await client.query('commit');
    console.log(`✅ applied ${migration.name}`);
  } catch (err) {
    await client.query('rollback');
    console.error(`❌ failed ${migration.name}`, err);
    throw err;
  }
}

async function main() {
  await ensureTable();
  const applied = await getApplied();
  const migrations = await loadMigrations();

  if (process.argv.includes('--status')) {
    migrations.forEach((m) => {
      const state = applied.has(m.name) ? 'applied' : 'pending';
      console.log(`${state.padEnd(7)} ${m.name}`);
    });
    await pool.end();
    return;
  }

  const pending = migrations.filter((m) => !applied.has(m.name));
  if (pending.length === 0) {
    console.log('No pending migrations.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    for (const migration of pending) {
      await applyMigration(client, migration);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
