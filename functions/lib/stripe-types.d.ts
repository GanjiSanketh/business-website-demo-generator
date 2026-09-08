/**
 * Stripe type definitions for Cloud Functions.
 *
 * These are minimal type stubs for the Stripe API objects used in this
 * project. The full Stripe SDK types are not used to keep the functions
 * bundle small. When Stripe SDK is installed in Part 2B, these can be
 * replaced with actual SDK types.
 */
export interface StripeCustomer {
    id: string;
    email?: string;
    metadata?: Record<string, string>;
}
export interface StripeSubscription {
    id: string;
    customer: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    items: {
        data: Array<{
            price: {
                id: string;
                unit_amount: number;
                recurring?: {
                    interval: 'month' | 'year';
                };
            };
        }>;
    };
    metadata?: Record<string, string>;
}
export interface StripeCheckoutSession {
    id: string;
    url?: string;
    customer?: string;
    mode: 'subscription' | 'payment';
    subscription?: string;
}
export interface StripeInvoice {
    id: string;
    customer: string;
    amount_paid: number;
    status: string;
}
export interface StripeWebhookEvent {
    id: string;
    type: string;
    data: {
        object: Record<string, any>;
    };
    created: number;
}
/** Map of plan id to Stripe price id for monthly billing. */
export declare const STRIPE_PRICE_MAP: Record<string, string>;
/**
 * Resolve Stripe price id from a plan id.
 * Returns null if no price is configured (e.g. free plan or missing env vars).
 */
export declare function getStripePriceId(planId: string, interval?: 'monthly' | 'yearly'): string | null;
//# sourceMappingURL=stripe-types.d.ts.map