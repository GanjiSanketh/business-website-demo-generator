import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
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
 */
export const createCheckoutSessionFn = functions.https.onCall(createCheckoutSession);

/**
 * Returns the current subscription status for the authenticated user.
 */
export const getSubscriptionStatusFn = functions.https.onCall(getSubscriptionStatus);

/**
 * Cancels the user's subscription via Razorpay API.
 */
export const cancelSubscriptionFn = functions.https.onCall(cancelSubscription);

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
 * Configure this URL in your Razorpay Dashboard:
 *   https://<region>-<project>.cloudfunctions.net/razorpayWebhook
 */
export const razorpayWebhook = functions.https.onRequest(handleRazorpayWebhook);

// ---------------------------------------------------------------------------
// SSR
// ---------------------------------------------------------------------------

/**
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR application.
 */
export const ssr = functions.https.onRequest(ssrHandler);
