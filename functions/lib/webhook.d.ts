/**
 * Razorpay Webhook handler.
 *
 * Processes Razorpay webhook events to update subscription state in Firestore.
 * This is the authoritative source for subscription changes — the frontend
 * never directly modifies plan/subscription fields.
 *
 * Security:
 * - Verifies Razorpay webhook signature using HMAC-SHA256
 * - Uses Admin SDK to update user profiles
 * - Processes events idempotently via Firestore transaction
 *
 * Supported events (Razorpay Subscriptions API):
 * - subscription.authenticated — first payment authorized, subscription active
 * - subscription.activated — moved to active state
 * - subscription.charged — recurring payment succeeded
 * - subscription.pending — charge attempt failed, will retry
 * - subscription.halted — all retries exhausted
 * - subscription.cancelled — user cancelled
 * - subscription.completed — all billing cycles ended (total_count reached)
 * - payment.failed — payment failed event
 */
import * as functions from 'firebase-functions/v2';
/**
 * Handle Razorpay webhook events.
 *
 * This is an onRequest function (NOT onCall) because Razorpay sends
 * POST requests directly to this endpoint.
 */
export declare function handleRazorpayWebhook(request: functions.https.Request, response: {
    status: (code: number) => {
        send: (body: string) => void;
        json: (body: any) => void;
    };
}): Promise<void>;
//# sourceMappingURL=webhook.d.ts.map