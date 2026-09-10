"use strict";
/**
 * Firebase Functions v2 configuration for Razorpay integration.
 *
 * Secrets are defined inline in index.ts using defineSecret/defineString
 * from firebase-functions/params. This avoids TS2742 declaration emit
 * errors caused by firebase-functions package export restrictions.
 *
 * SENSITIVE values use defineSecret (encrypted at rest, access-controlled):
 *   - RAZORPAY_KEY_SECRET (SDK authentication)
 *   - RAZORPAY_WEBHOOK_SECRET (webhook signature verification)
 *
 * NON-SENSITIVE values use defineString (plain text):
 *   - RAZORPAY_KEY_ID (public by design, used in client-side Checkout)
 *   - RAZORPAY_PLAN_* (plan ID mapping)
 *
 * Local development: use `firebase emulators:start` which loads from
 * `.secret.local` files or `firebase functions:config:get`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=config.js.map