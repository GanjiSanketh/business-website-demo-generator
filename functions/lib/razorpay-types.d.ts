/**
 * Razorpay type definitions and configuration for Cloud Functions.
 *
 * This file provides:
 * - Razorpay SDK initialization
 * - Plan-to-Razorpay mapping (server-side only)
 * - Webhook signature verification
 * - Webhook event constants
 */
import { PlanId } from './entitlements';
/**
 * Get or initialize the Razorpay SDK instance.
 * Uses RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from environment.
 */
export declare function getRazorpayInstance(): any;
/**
 * Razorpay plan IDs for each internal plan.
 * These are created in the Razorpay Dashboard and referenced by ID.
 *
 * Environment variables:
 *   RAZORPAY_PLAN_PRO_MONTHLY      — Razorpay plan id for Pro monthly
 *   RAZORPAY_PLAN_PRO_YEARLY       — Razorpay plan id for Pro yearly
 *   RAZORPAY_PLAN_BUSINESS_MONTHLY — Razorpay plan id for Business monthly
 *   RAZORPAY_PLAN_BUSINESS_YEARLY  — Razorpay plan id for Business yearly
 */
export declare function getRazorpayPlanId(planId: PlanId, interval?: 'monthly' | 'yearly'): string | null;
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