/**
 * Patch amplify_outputs.json to fix groups format.
 * Amplify Gen 2 outputs groups as [{owner: {precedence: 0}}]
 * but the aws-amplify client library expects ['owner', 'manager', ...]
 * 
 * This runs during the Amplify build, AFTER the outputs are generated
 * but BEFORE vite bundles the app.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'amplify_outputs.json');

if (!fs.existsSync(filePath)) {
  console.log('amplify_outputs.json not found, skipping patch.');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

if (data.auth && data.auth.groups && Array.isArray(data.auth.groups)) {
  const original = JSON.stringify(data.auth.groups);
  data.auth.groups = data.auth.groups.map(g =>
    typeof g === 'string' ? g : Object.keys(g)[0]
  );
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ Patched groups: ${original} → ${JSON.stringify(data.auth.groups)}`);
} else {
  console.log('Groups already in correct format or not present.');
}
