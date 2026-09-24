/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node provisioning script */
// Provision a local signing secret without printing it or changing other settings.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const envPath = path.resolve(__dirname, '../.env.local');
const contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const match = contents.match(/^JWT_SECRET\s*=\s*(.*)$/m);
const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, '') || '';
if (value.length >= 32) {
  console.log('Existing JWT signing secret retained.');
} else {
  const line = 'JWT_SECRET=' + crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(envPath, match ? contents.replace(/^JWT_SECRET\s*=.*$/m, line) : contents.trimEnd() + '\n' + line + '\n');
  console.log('Strong local JWT signing secret configured. Existing logins must sign in again.');
}
