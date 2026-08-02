import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const canonicalPath = resolve(appRoot, '..', 'PPP-Prospect-Results.json');
const bundledPath = resolve(appRoot, 'src', 'data', 'prospects.json');

const bundledText = await readFile(bundledPath, 'utf8');
const bundled = JSON.parse(bundledText);

if (!Array.isArray(bundled) || bundled.length === 0) {
  throw new Error('Bundled prospect data must be a non-empty JSON array.');
}

try {
  const canonicalText = await readFile(canonicalPath, 'utf8');
  const canonical = JSON.parse(canonicalText);

  if (!Array.isArray(canonical) || canonical.length === 0) {
    throw new Error('Canonical prospect data must be a non-empty JSON array.');
  }

  if (canonicalText !== bundledText) {
    throw new Error('Bundled prospect data is stale. Run `npm run sync-data` and commit the result.');
  }
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
    console.warn('Canonical data is outside the deployment root; validated the bundled copy only.');
  } else {
    throw error;
  }
}

console.log(`Prospect data is valid (${bundled.length} records).`);
