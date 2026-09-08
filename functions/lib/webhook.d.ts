/**
 * Stripe Webhook handler.
 *
 * Processes Stripe webhook events to update subscription state in Firestore.
 * This is the authoritative source for subscription changes — the frontend
 * never directly modifies plan/subscription fields.
 *
 * IMPORTANT: This function does NOT directly interact with Stripe yet.
 * It prepares the architecture. Stripe SDK integration happens in Part 2B.
 *
 * Security:
 * - Verifies Stripe webhook signature (Part 2B)
 * - Uses Admin SDK to update user profiles
 * - Processes events idempotently
 *
 * Supported events (Part 2B):
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */
import * as functions from 'firebase-functions/v2';
/**
 * Handle Stripe webhook events.
 *
 * Architecture notes for Part 2B:
 * - This will be an onRequest function (not onCall) to receive Stripe POSTs
 * - Must verify stripe-signature header against webhook secret
 * - Must handle idempotency (check if event already processed)
 * - Must update Firestore user profile atomically
 */
export declare function handleStripeWebhook(request: functions.https.Request, response: {
    status: (code: number) => {
        json: (body: any) => void;
    };
}): Promise<void>;
//# sourceMappingURL=webhook.d.ts.map