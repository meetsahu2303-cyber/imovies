import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const serverRoot = fileURLToPath(new URL('../', import.meta.url));
function loadConfig(
  overrides = {},
  script = "const {env,isReviewDeployment}=await import('./src/config/env.js'); console.log(JSON.stringify({origin:env.CLIENT_ORIGIN,isReviewDeployment}));",
) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    DEPLOYMENT_MODE: 'standard',
    PAYMENT_PROVIDER: 'demo',
    COOKIE_SECURE: 'true',
    CLIENT_ORIGIN: 'https://imovies-review.example.com',
    ALLOW_PREVIEW: 'false',
    JWT_SECRET: 'deployment-test-secret-with-at-least-thirty-two-characters',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    ...overrides,
  };
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: serverRoot,
    env,
    encoding: 'utf8',
  });
}
test('ordinary production still refuses simulated payments', () => {
  const result = loadConfig();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Demo payments are disabled in production/);
});
test('explicit HTTPS review deployment permits only simulated payments', () => {
  const result = loadConfig({ DEPLOYMENT_MODE: 'review' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).isReviewDeployment, true);
});
test('review mode refuses insecure cookies and plaintext origins', () => {
  assert.notEqual(loadConfig({ DEPLOYMENT_MODE: 'review', COOKIE_SECURE: 'false' }).status, 0);
  assert.notEqual(
    loadConfig({ DEPLOYMENT_MODE: 'review', CLIENT_ORIGIN: 'http://example.com' }).status,
    0,
  );
});
test('review mode refuses Stripe credentials and preview exemptions', () => {
  assert.notEqual(
    loadConfig({ DEPLOYMENT_MODE: 'review', STRIPE_SECRET_KEY: 'sk_test_example' }).status,
    0,
  );
  assert.notEqual(loadConfig({ DEPLOYMENT_MODE: 'review', ALLOW_PREVIEW: 'true' }).status, 0);
});
test('public review keeps the no-charge banner but hides local demo credentials', () => {
  const result = loadConfig(
    { DEPLOYMENT_MODE: 'review' },
    "const {createApp}=await import('./src/app.js'); const {default:request}=await import('supertest'); const r=await request(createApp()).get('/api/config'); console.log(JSON.stringify(r.body));",
  );
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.equal(config.demo, true);
  assert.equal(config.review, true);
  assert.equal(config.demoAccounts, false);
});
test('review mode cannot be enabled on a development server', () => {
  const result = loadConfig({ NODE_ENV: 'development', DEPLOYMENT_MODE: 'review' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Review mode requires NODE_ENV=production/);
});
