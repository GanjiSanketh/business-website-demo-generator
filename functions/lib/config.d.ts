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
/** Get the Razorpay Key ID (public, used for client-side Checkout). */
export declare function getRazorpayKeyId(): string;
/** Get the Razorpay Key Secret (server-only, SDK authentication). */
export declare function getRazorpayKeySecret(): string;
/** Get the Razorpay Webhook Secret (server-only, signature verification). */
export declare function getRazorpayWebhookSecret(): string;
/**
 * Resolve a Razorpay plan ID from the server configuration.
 *
 * @param planId - The internal plan ID ('pro' or 'business')
 * @param interval - The billing interval ('monthly' or 'yearly')
 * @returns The Razorpay plan ID, or null if not configured
 */
export declare function getRazorpayPlanId(planId: string, interval?: 'monthly' | 'yearly'): string | null;
//# sourceMappingURL=config.d.ts.map