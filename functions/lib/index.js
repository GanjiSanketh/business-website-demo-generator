"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ssr = exports.getUsageFn = exports.checkPlanLimitFn = exports.getSubscriptionStatusFn = exports.createCheckoutSessionFn = exports.checkCustomDomainLiveFn = exports.verifyCustomDomainFn = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const domain_verification_1 = require("./domain-verification");
const domain_liveness_1 = require("./domain-liveness");
const checkout_1 = require("./checkout");
const subscription_1 = require("./subscription");
const enforcement_1 = require("./enforcement");
// The Angular SSR bundle is loaded through a CommonJS bridge (functions/src/
// ssr.cjs → functions/lib/ssr.cjs, copied by scripts/copy-ssr.js) because the
// bundle is ESM while this package compiles to CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ssrHandler } = require('./ssr.cjs');
admin.initializeApp();
// ---------------------------------------------------------------------------
// Domain management
// ---------------------------------------------------------------------------
/**
 * Callable function to verify a custom domain by checking DNS TXT records.
 *
 * Requires authentication and authorization.
 * Verifies business ownership and domain ownership via DNS.
 */
exports.verifyCustomDomainFn = functions.https.onCall(domain_verification_1.verifyCustomDomain);
/**
 * Callable function that probes a verified custom domain over HTTPS and
 * flips it to 'live' when the application actually serves the business'
 * published demo on that domain.
 */
exports.checkCustomDomainLiveFn = functions.https.onCall(domain_liveness_1.checkCustomDomainLive);
// ---------------------------------------------------------------------------
// Subscription & Billing (Phase 5 Part 2A — architecture foundation)
// ---------------------------------------------------------------------------
/**
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 * Returns a URL that the user is redirected to for payment.
 *
 * Currently returns 'unimplemented' until Stripe SDK is added in Part 2B.
 */
exports.createCheckoutSessionFn = functions.https.onCall(checkout_1.createCheckoutSession);
/**
 * Returns the current subscription status for the authenticated user.
 * Admins can query any user's status.
 */
exports.getSubscriptionStatusFn = functions.https.onCall(subscription_1.getSubscriptionStatus);
/**
 * Checks whether the user can perform a specific operation given their plan limits.
 * Returns enforcement result without modifying any data.
 */
exports.checkPlanLimitFn = functions.https.onCall(enforcement_1.checkPlanLimit);
/**
 * Returns the current usage summary (business count, published count, etc.)
 * for the authenticated user. Used by billing and dashboard pages.
 */
exports.getUsageFn = functions.https.onCall(enforcement_1.getUsage);
// ---------------------------------------------------------------------------
// Stripe Webhooks (Phase 5 Part 2B — Stripe integration)
// ---------------------------------------------------------------------------
// export const stripeWebhook = functions.https.onRequest(handleStripeWebhook);
// ---------------------------------------------------------------------------
// SSR
// ---------------------------------------------------------------------------
/**
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR
 * application (see the hosting.rewrites block in firebase.json).
 */
exports.ssr = functions.https.onRequest(ssrHandler);
//# sourceMappingURL=index.js.map