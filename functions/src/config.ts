/**
 * Firebase Functions v2 configuration for Razorpay integration.
 *
 * All Razorpay parameters and secrets are defined here and accessed via
 * the canonical Firebase Functions .value() API (which reads from process.env
 * at runtime). This provides a single source of truth for configuration.
 *
 * The parameter objects are NOT exported to avoid TS2742 declaration emit
 * errors from firebase-functions internals. Only the runtime access functions
 * are exported. Secret binding declarations live in index.ts.
 *
 * SENSITIVE values use defineSecret (encrypted at rest, access-controlled):
 *   - RAZORPAY_KEY_SECRET (SDK authentication)
 *   - RAZORPAY_WEBHOOK_SECRET (webhook signature verification)
 *
 * NON-SENSITIVE values use defineString (plain text):
 *   - RAZORPAY_KEY_ID (public by design, used in client-side Checkout)
 *   - RAZORPAY_PLAN_* (plan ID mapping)
 *
 * Deployment:
 *   Secrets:    firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   Parameters: functions/.env file (loaded by Firebase CLI during deploy)
 *
 * Local development: use `firebase emulators:start` which loads from
 * `functions/.env` automatically.
 */

import { defineSecret, defineString } from 'firebase-functions/params';

// ---------------------------------------------------------------------------
// Parameter definitions (registered with Firebase at deploy time)
//
// These are module-level constants — they register with Firebase's param
// system when the module is loaded. Do NOT move inside functions.
// ---------------------------------------------------------------------------

// SENSITIVE — encrypted at rest, only accessible to bound functions
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = defineSecret('RAZORPAY_WEBHOOK_SECRET');

// NON-SENSITIVE — plain text parameters
const RAZORPAY_KEY_ID = defineString('RAZORPAY_KEY_ID');
const RAZORPAY_PLAN_PRO_MONTHLY = defineString('RAZORPAY_PLAN_PRO_MONTHLY');
const RAZORPAY_PLAN_PRO_YEARLY = defineString('RAZORPAY_PLAN_PRO_YEARLY');
const RAZORPAY_PLAN_BUSINESS_MONTHLY = defineString('RAZORPAY_PLAN_BUSINESS_MONTHLY');
const RAZORPAY_PLAN_BUSINESS_YEARLY = defineString('RAZORPAY_PLAN_BUSINESS_YEARLY');

// ---------------------------------------------------------------------------
// Runtime access functions (use .value() — the canonical Firebase API)
//
// These functions read from process.env at runtime. They should only be
// called inside Cloud Function handlers, never at module-load time.
// ---------------------------------------------------------------------------

/** Get the Razorpay Key ID (public, used for client-side Checkout). */
export function getRazorpayKeyId(): string {
  return RAZORPAY_KEY_ID.value();
}

/** Get the Razorpay Key Secret (server-only, SDK authentication). */
export function getRazorpayKeySecret(): string {
  return RAZORPAY_KEY_SECRET.value();
}

/** Get the Razorpay Webhook Secret (server-only, signature verification). */
export function getRazorpayWebhookSecret(): string {
  return RAZORPAY_WEBHOOK_SECRET.value();
}

// ---------------------------------------------------------------------------
// Plan ID resolution
// ---------------------------------------------------------------------------

/** Internal map of plan parameters for runtime lookup. */
const PLAN_PARAMS: Record<string, Record<string, ReturnType<typeof defineString>>> = {
  pro: {
    monthly: RAZORPAY_PLAN_PRO_MONTHLY,
    yearly: RAZORPAY_PLAN_PRO_YEARLY,
  },
  business: {
    monthly: RAZORPAY_PLAN_BUSINESS_MONTHLY,
    yearly: RAZORPAY_PLAN_BUSINESS_YEARLY,
  },
};

/**
 * Resolve a Razorpay plan ID from the server configuration.
 *
 * @param planId - The internal plan ID ('pro' or 'business')
 * @param interval - The billing interval ('monthly' or 'yearly')
 * @returns The Razorpay plan ID, or null if not configured
 */
export function getRazorpayPlanId(planId: string, interval: 'monthly' | 'yearly' = 'monthly'): string | null {
  if (planId === 'free') return null;

  const planParams = PLAN_PARAMS[planId];
  if (!planParams) return null;

  const param = planParams[interval];
  if (!param) return null;

  const value = param.value();
  return value || null;
}
