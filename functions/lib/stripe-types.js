"use strict";
/**
 * Stripe type definitions for Cloud Functions.
 *
 * These are minimal type stubs for the Stripe API objects used in this
 * project. The full Stripe SDK types are not used to keep the functions
 * bundle small. When Stripe SDK is installed in Part 2B, these can be
 * replaced with actual SDK types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRIPE_PRICE_MAP = void 0;
exports.getStripePriceId = getStripePriceId;
/** Map of plan id to Stripe price id for monthly billing. */
exports.STRIPE_PRICE_MAP = {
// Populated from environment variables in Part 2B:
// pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
// business_monthly: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '',
};
/**
 * Resolve Stripe price id from a plan id.
 * Returns null if no price is configured (e.g. free plan or missing env vars).
 */
function getStripePriceId(planId, interval = 'monthly') {
    if (planId === 'free')
        return null;
    const key = `${planId}_${interval}`;
    const priceId = exports.STRIPE_PRICE_MAP[key] || process.env[`STRIPE_${planId.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`];
    return priceId || null;
}
//# sourceMappingURL=stripe-types.js.map