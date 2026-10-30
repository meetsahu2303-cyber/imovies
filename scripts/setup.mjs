import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const path = `${root}.env`;
if (existsSync(path)) {
  console.log('.env already exists; leaving it unchanged.');
} else {
  const template = readFileSync(`${root}.env.example`, 'utf8');
  writeFileSync(
    path,
    template.replace(
      'replace-with-a-random-secret-at-least-32-characters-long',
      randomBytes(48).toString('hex'),
    ),
    { mode: 0o600 },
  );
  console.log(
    'Created .env with a unique JWT secret. Demo credentials are for local development only.',
  );
}
