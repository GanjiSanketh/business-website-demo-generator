/**
 * Stripe Checkout Session creation.
 *
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 * Called from the frontend via Firebase Callable Functions.
 *
 * IMPORTANT: This function does NOT directly interact with Stripe yet.
 * It prepares the architecture. Stripe SDK integration happens in Part 2B.
 *
 * Security:
 * - Requires authenticated user
 * - Creates/reuses Stripe customer
 * - Returns Checkout Session URL for redirect
 */
import { CallableRequest } from './auth';
import { PlanId } from './entitlements';
export interface CreateCheckoutSessionRequest {
    planId: PlanId;
    email: string;
}
export interface CreateCheckoutSessionResponse {
    sessionId?: string;
    url?: string;
    error?: string;
}
/**
 * Create a Stripe Checkout session for plan upgrade.
 *
 * Flow:
 * 1. Verify user authentication
 * 2. Get or create Stripe customer
 * 3. Create Checkout session with the selected plan's price
 * 4. Return the session URL for frontend redirect
 *
 * When Stripe SDK is added in Part 2B, this function will:
 * - Import and initialize Stripe with the secret key
 * - Use stripe.customers.create() / stripe.customers.retrieve()
 * - Use stripe.checkout.sessions.create()
 * - Store stripeCustomerId on the user profile
 */
export declare function createCheckoutSession(request: CallableRequest<CreateCheckoutSessionRequest>): Promise<CreateCheckoutSessionResponse>;
//# sourceMappingURL=checkout.d.ts.map