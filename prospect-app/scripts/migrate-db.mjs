import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const sql = neon(databaseUrl);
const migrationsDirectory = resolve(process.cwd(), 'db');
const files = (await readdir(migrationsDirectory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();

for (const file of files) {
  const source = await readFile(resolve(migrationsDirectory, file), 'utf8');
  await sql.query(source);
  console.log(`Applied ${file}`);
}
