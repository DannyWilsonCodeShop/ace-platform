import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', 'amplify_outputs.json');

if (!existsSync(filePath)) {
  console.log('amplify_outputs.json not found, skipping patch.');
  process.exit(0);
}

const data = JSON.parse(readFileSync(filePath, 'utf8'));

if (data.auth && data.auth.groups && Array.isArray(data.auth.groups)) {
  const original = JSON.stringify(data.auth.groups);
  data.auth.groups = data.auth.groups.map(g =>
    typeof g === 'string' ? g : Object.keys(g)[0]
  );
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Patched groups: ${original} -> ${JSON.stringify(data.auth.groups)}`);
} else {
  console.log('Groups already in correct format or not present.');
}
