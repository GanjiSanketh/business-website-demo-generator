#!/usr/bin/env node
/**
 * Copies the Angular SSR build output into the Firebase Functions package so
 * the `ssr` Cloud Function can serve the application.
 *
 * Layout produced:
 *   functions/app/browser/  → static assets (also what Firebase Hosting serves)
 *   functions/app/server/   → the ESM SSR server bundle (server.mjs + chunks)
 *   functions/lib/ssr.cjs   → CJS bridge entry used by functions/src/index.ts
 *
 * Run:  node scripts/copy-ssr.js   (after `npm run build`)
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appName = 'business-demo-generator';
const distRoot = path.join(root, 'dist', appName);
const functionsRoot = path.join(root, 'functions');
const functionsApp = path.join(functionsRoot, 'app');

const serverSrc = path.join(distRoot, 'server');
const browserSrc = path.join(distRoot, 'browser');

for (const dir of [serverSrc, browserSrc]) {
  if (!fs.existsSync(dir)) {
    console.error(`[copy-ssr] Missing ${dir}. Run "npm run build" first.`);
    process.exit(1);
  }
}

// Replace the previous copy entirely so removed build artifacts never linger.
fs.rmSync(functionsApp, { recursive: true, force: true });
fs.mkdirSync(functionsApp, { recursive: true });
fs.cpSync(serverSrc, path.join(functionsApp, 'server'), { recursive: true });
fs.cpSync(browserSrc, path.join(functionsApp, 'browser'), { recursive: true });

// The CJS bridge lives in functions/src (source) and is copied into lib/ so
// the compiled functions entry can require it. tsc does not copy non-TS files.
const ssrCjsSrc = path.join(functionsRoot, 'src', 'ssr.cjs');
const ssrCjsDest = path.join(functionsRoot, 'lib', 'ssr.cjs');
fs.mkdirSync(path.dirname(ssrCjsDest), { recursive: true });
fs.copyFileSync(ssrCjsSrc, ssrCjsDest);

console.log('[copy-ssr] Copied SSR bundle to functions/app/ and ssr.cjs to functions/lib/');