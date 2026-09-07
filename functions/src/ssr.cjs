'use strict';

/**
 * Firebase Functions entry for the Angular SSR server bundle.
 *
 * The bundle is produced by `ng build` (Angular 21, outputMode "server") and
 * copied to functions/app/server/server.mjs by scripts/copy-ssr.js (see the
 * predeploy chain in firebase.json). The bundle is ESM, and this functions
 * package compiles to CommonJS, so the bundle is loaded with a native
 * `import()` from this CommonJS wrapper (require() cannot load .mjs).
 *
 * Firebase Hosting rewrites every request to the `ssr` function; the
 * underlying bundle contains the full Express app from src/server.ts,
 * including the custom-domain host-routing middleware.
 */

let handlerPromise = null;

function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import('../app/server/server.mjs').then((bundle) => {
      const handler =
        bundle && typeof bundle.reqHandler === 'function' ? bundle.reqHandler : null;
      if (!handler) {
        throw new Error('Angular SSR bundle does not export reqHandler');
      }
      return handler;
    });
  }
  return handlerPromise;
}

async function ssrHandler(req, res) {
  const handler = await getHandler();
  await handler(req, res);
}

module.exports = { ssrHandler };