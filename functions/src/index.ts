import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { verifyCustomDomain } from './domain-verification';
import { checkCustomDomainLive } from './domain-liveness';
// The Angular SSR bundle is loaded through a CommonJS bridge (functions/src/
// ssr.cjs → functions/lib/ssr.cjs, copied by scripts/copy-ssr.js) because the
// bundle is ESM while this package compiles to CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ssrHandler } = require('./ssr.cjs');

admin.initializeApp();

/**
 * Callable function to verify a custom domain by checking DNS TXT records.
 *
 * Requires authentication and authorization.
 * Verifies business ownership and domain ownership via DNS.
 */
export const verifyCustomDomainFn = functions.https.onCall(verifyCustomDomain);

/**
 * Callable function that probes a verified custom domain over HTTPS and
 * flips it to 'live' when the application actually serves the business'
 * published demo on that domain.
 */
export const checkCustomDomainLiveFn = functions.https.onCall(checkCustomDomainLive);

/**
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR
 * application (see the hosting.rewrites block in firebase.json).
 */
export const ssr = functions.https.onRequest(ssrHandler);