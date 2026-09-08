import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { verifyCustomDomain } from './domain-verification';
import { checkCustomDomainLive } from './domain-liveness';
import { createCheckoutSession } from './checkout';
import { handleStripeWebhook } from './webhook';
import { getSubscriptionStatus } from './subscription';
import { checkPlanLimit, getUsage } from './enforcement';
// The Angular SSR bundle is loaded through a CommonJS bridge (functions/src/
// ssr.cjs → functions/lib/ssr.cjs, copied by scripts/copy-ssr.js) because the
// bundle is ESM while this package compiles to CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ssrHandler } = require('./ssr.cjs');

admin.initializeApp();

// ---------------------------------------------------------------------------
// Domain management
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Subscription & Billing (Phase 5 Part 2A — architecture foundation)
// ---------------------------------------------------------------------------

/**
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 * Returns a URL that the user is redirected to for payment.
 *
 * Currently returns 'unimplemented' until Stripe SDK is added in Part 2B.
 */
export const createCheckoutSessionFn = functions.https.onCall(createCheckoutSession);

/**
 * Returns the current subscription status for the authenticated user.
 * Admins can query any user's status.
 */
export const getSubscriptionStatusFn = functions.https.onCall(getSubscriptionStatus);

/**
 * Checks whether the user can perform a specific operation given their plan limits.
 * Returns enforcement result without modifying any data.
 */
export const checkPlanLimitFn = functions.https.onCall(checkPlanLimit);

/**
 * Returns the current usage summary (business count, published count, etc.)
 * for the authenticated user. Used by billing and dashboard pages.
 */
export const getUsageFn = functions.https.onCall(getUsage);

// ---------------------------------------------------------------------------
// Stripe Webhooks (Phase 5 Part 2B — Stripe integration)
// ---------------------------------------------------------------------------
// export const stripeWebhook = functions.https.onRequest(handleStripeWebhook);

// ---------------------------------------------------------------------------
// SSR
// ---------------------------------------------------------------------------

/**
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR
 * application (see the hosting.rewrites block in firebase.json).
 */
export const ssr = functions.https.onRequest(ssrHandler);