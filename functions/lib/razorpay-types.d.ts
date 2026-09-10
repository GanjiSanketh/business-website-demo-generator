/**
 * Razorpay type definitions and configuration for Cloud Functions.
 *
 * This file provides:
 * - Razorpay SDK initialization
 * - Webhook signature verification
 * - Webhook event constants
 *
 * All configuration values are read from the config module using the
 * canonical Firebase Functions .value() API.
 */
/**
 * Get or initialize the Razorpay SDK instance.
 * Uses RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from config module.
 */
export declare function getRazorpayInstance(): any;
/**
 * Verify Razorpay webhook signature using HMAC-SHA256.
 *
 * @param rawBody - The raw request body Buffer (NOT parsed JSON)
 * @param signatureHeader - The X-Razorpay-Signature header value
 * @returns true if signature is valid
 */
export declare function verifyRazorpayWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;
export declare const RAZORPAY_WEBHOOK_EVENTS: {
    readonly SUBSCRIPTION_AUTHENTICATED: "subscription.authenticated";
    readonly SUBSCRIPTION_ACTIVATED: "subscription.activated";
    readonly SUBSCRIPTION_CHARGED: "subscription.charged";
    readonly SUBSCRIPTION_COMPLETED: "subscription.completed";
    readonly SUBSCRIPTION_PENDING: "subscription.pending";
    readonly SUBSCRIPTION_HALTED: "subscription.halted";
    readonly SUBSCRIPTION_CANCELLED: "subscription.cancelled";
    readonly PAYMENT_FAILED: "payment.failed";
};
export type RazorpayWebhookEvent = typeof RAZORPAY_WEBHOOK_EVENTS[keyof typeof RAZORPAY_WEBHOOK_EVENTS];
//# sourceMappingURL=razorpay-types.d.ts.map