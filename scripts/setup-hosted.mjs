import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const path = `${root}.env.hosted`;
if (existsSync(path)) {
  console.log('.env.hosted already exists; leaving it unchanged.');
} else {
  const strongPassword = () => `Iv7!${randomBytes(18).toString('base64url')}`;
  const content = readFileSync(`${root}.env.hosted.example`, 'utf8')
    .replace(
      'replace-with-a-random-secret-at-least-32-characters-long',
      randomBytes(48).toString('hex'),
    )
    .replace('replace-with-a-strong-review-admin-password', strongPassword())
    .replace('replace-with-a-strong-review-user-password', strongPassword());
  writeFileSync(path, content, { mode: 0o600 });
  console.log('Created .env.hosted with unique review passwords and a random JWT secret.');
  console.log('Next: edit MONGODB_URI in .env.hosted, then run npm run seed:review.');
  console.log('Keep this file private. Share only the reviewer credentials with your mentor.');
}
