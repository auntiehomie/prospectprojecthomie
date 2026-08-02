import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const source = resolve(appRoot, '..', 'PPP-Prospect-Results.json');
const destination = resolve(appRoot, 'src', 'data', 'prospects.json');

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Synced ${source} -> ${destination}`);
