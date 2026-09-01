#!/usr/bin/env node
/**
 * One-time setup: reads .env.local and generates public/env-config.json
 * so the Angular app can fetch Firebase config at runtime.
 *
 * Run:  node scripts/setup-env.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');
const outPath = path.join(root, 'public', 'env-config.json');

if (!fs.existsSync(envPath)) {
  console.error('[setup-env] .env.local not found. Create it first.');
  process.exit(1);
}

const text = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of text.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  env[k] = v;
}

const config = {
  FIREBASE_API_KEY: env.FIREBASE_API_KEY || '',
  FIREBASE_AUTH_DOMAIN: env.FIREBASE_AUTH_DOMAIN || '',
  FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID || '',
  FIREBASE_STORAGE_BUCKET: env.FIREBASE_STORAGE_BUCKET || '',
  FIREBASE_MESSAGING_SENDER_ID: env.FIREBASE_MESSAGING_SENDER_ID || '',
  FIREBASE_APP_ID: env.FIREBASE_APP_ID || '',
};

// Diagnostic — show which keys are present (not the values)
console.log('[setup-env] Firebase config status:');
for (const [k, v] of Object.entries(config)) {
  console.log(`  ${k}: ${v ? 'present' : 'MISSING'}`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(config, null, 2) + '\n');
console.log(`[setup-env] Wrote ${outPath}`);
