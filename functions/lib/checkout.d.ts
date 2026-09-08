/**
 * Razorpay Checkout — creates subscription for plan upgrades.
 *
 * Flow:
 * 1. Verify user authentication
 * 2. Get or create Razorpay customer
 * 3. Validate upgrade eligibility
 * 4. Resolve trusted Razorpay plan from server config
 * 5. Create Razorpay Subscription
 * 6. Return subscription ID for client-side Razorpay Checkout authorization
 *
 * Security:
 * - Requires authenticated user
 * - Plan ID resolved server-side (client cannot send arbitrary Razorpay plan)
 * - Upgrade eligibility checked server-side
 * - Razorpay secret key NEVER exposed to client
 * - Client callback does NOT activate subscription; only webhook does
 */
import { CallableRequest } from './auth';
import { PlanId } from './entitlements';
export interface CreateCheckoutRequest {
    planId: PlanId;
}
export interface CreateCheckoutResponse {
    subscriptionId?: string;
    razorpayKeyId?: string;
    planId?: string;
    error?: string;
}
/**
 * Create a Razorpay Subscription for plan upgrade.
 *
 * Returns subscription details for the client to open Razorpay Checkout.
 * The actual subscription activation happens ONLY via webhook confirmation.
 */
export declare function createCheckoutSession(request: CallableRequest<CreateCheckoutRequest>): Promise<CreateCheckoutResponse>;
//# sourceMappingURL=checkout.d.ts.map