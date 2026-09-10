import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { verifyCustomDomain } from './domain-verification';
import { checkCustomDomainLive } from './domain-liveness';
import { createCheckoutSession } from './checkout';
import { handleRazorpayWebhook } from './webhook';
import {
  getSubscriptionStatus,
  cancelSubscription,
} from './subscription';
import { checkPlanLimit, getUsage } from './enforcement';
import {
  createBusinessFn,
  publishBusinessFn,
  connectCustomDomainFn,
} from './enforcement-callables';
// The Angular SSR bundle is loaded through a CommonJS bridge (functions/src/
// ssr.cjs → functions/lib/ssr.cjs, copied by scripts/copy-ssr.js) because the
// bundle is ESM while this package compiles to CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ssrHandler } = require('./ssr.cjs');

admin.initializeApp();

// ---------------------------------------------------------------------------
// Razorpay secret bindings (for function-level access control)
//
// These are separate from config.ts to avoid TS2742 errors. The actual
// secret values are accessed via config.ts runtime functions at request time.
// ---------------------------------------------------------------------------

const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

// ---------------------------------------------------------------------------
// Domain management
// ---------------------------------------------------------------------------

/**
 * Callable function to verify a custom domain by checking DNS TXT records.
 */
export const verifyCustomDomainFn = functions.https.onCall(verifyCustomDomain);

/**
 * Callable function that probes a verified custom domain over HTTPS.
 */
export const checkCustomDomainLiveFn = functions.https.onCall(checkCustomDomainLive);

// ---------------------------------------------------------------------------
// Subscription & Billing (Phase 5 Part 2B — Razorpay integration)
// ---------------------------------------------------------------------------

/**
 * Creates a Razorpay subscription for upgrading to a paid plan.
 * Returns subscription details for client-side Razorpay Checkout.
 *
 * Requires: RAZORPAY_KEY_SECRET (SDK auth)
 */
export const createCheckoutSessionFn = functions.https.onCall({
  secrets: [RAZORPAY_KEY_SECRET],
}, createCheckoutSession);

/**
 * Returns the current subscription status for the authenticated user.
 * No Razorpay secrets required — reads from Firestore only.
 */
export const getSubscriptionStatusFn = functions.https.onCall(getSubscriptionStatus);

/**
 * Cancels the user's subscription via Razorpay API.
 * Requires: RAZORPAY_KEY_SECRET (SDK auth)
 */
export const cancelSubscriptionFn = functions.https.onCall({
  secrets: [RAZORPAY_KEY_SECRET],
}, cancelSubscription);

/**
 * Checks whether the user can perform a specific operation given their plan limits.
 */
export const checkPlanLimitFn = functions.https.onCall(checkPlanLimit);

/**
 * Returns the current usage summary for the authenticated user.
 */
export const getUsageFn = functions.https.onCall(getUsage);

// ---------------------------------------------------------------------------
// Server-side Business Enforcement (Phase 5 Part 2B — plan limit enforcement)
// ---------------------------------------------------------------------------

/**
 * Server-authoritative business creation.
 * Enforces plan limits before writing to Firestore.
 */
export const createBusinessServerFn = functions.https.onCall(createBusinessFn);

/**
 * Server-authoritative business publishing.
 * Enforces published business limit before writing to Firestore.
 */
export const publishBusinessServerFn = functions.https.onCall(publishBusinessFn);

/**
 * Server-authoritative custom domain connection.
 * Enforces custom domain limit before writing to Firestore.
 */
export const connectCustomDomainServerFn = functions.https.onCall(connectCustomDomainFn);

// ---------------------------------------------------------------------------
// Razorpay Webhooks
// ---------------------------------------------------------------------------

/**
 * Razorpay webhook endpoint. Receives POST requests from Razorpay.
 * Verifies webhook signature and processes subscription events.
 *
 * Requires: RAZORPAY_WEBHOOK_SECRET (signature verification)
 *
 * Configure this URL in your Razorpay Dashboard:
 *   https://<region>-<project>.cloudfunctions.net/razorpayWebhook
 */
export const razorpayWebhook = functions.https.onRequest({
  secrets: [RAZORPAY_WEBHOOK_SECRET],
}, handleRazorpayWebhook);

// ---------------------------------------------------------------------------
// SSR
// ---------------------------------------------------------------------------

/**
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR application.
 */
export const ssr = functions.https.onRequest(ssrHandler);
