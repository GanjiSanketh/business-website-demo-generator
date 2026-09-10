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
exports.ssr = exports.razorpayWebhook = exports.connectCustomDomainServerFn = exports.publishBusinessServerFn = exports.createBusinessServerFn = exports.getUsageFn = exports.checkPlanLimitFn = exports.cancelSubscriptionFn = exports.getSubscriptionStatusFn = exports.createCheckoutSessionFn = exports.checkCustomDomainLiveFn = exports.verifyCustomDomainFn = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const domain_verification_1 = require("./domain-verification");
const domain_liveness_1 = require("./domain-liveness");
const checkout_1 = require("./checkout");
const webhook_1 = require("./webhook");
const subscription_1 = require("./subscription");
const enforcement_1 = require("./enforcement");
const enforcement_callables_1 = require("./enforcement-callables");
// The Angular SSR bundle is loaded through a CommonJS bridge (functions/src/
// ssr.cjs → functions/lib/ssr.cjs, copied by scripts/copy-ssr.js) because the
// bundle is ESM while this package compiles to CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ssrHandler } = require('./ssr.cjs');
admin.initializeApp();
// ---------------------------------------------------------------------------
// Razorpay secret bindings (for function-level access control)
//
// These are separate from config.ts to avoid TS2742 errors. The actual
// secret values are accessed via config.ts runtime functions at request time.
// ---------------------------------------------------------------------------
const RAZORPAY_KEY_SECRET = (0, params_1.defineSecret)('RAZORPAY_KEY_SECRET');
const RAZORPAY_WEBHOOK_SECRET = (0, params_1.defineSecret)('RAZORPAY_WEBHOOK_SECRET');
// ---------------------------------------------------------------------------
// Domain management
// ---------------------------------------------------------------------------
/**
 * Callable function to verify a custom domain by checking DNS TXT records.
 */
exports.verifyCustomDomainFn = functions.https.onCall(domain_verification_1.verifyCustomDomain);
/**
 * Callable function that probes a verified custom domain over HTTPS.
 */
exports.checkCustomDomainLiveFn = functions.https.onCall(domain_liveness_1.checkCustomDomainLive);
// ---------------------------------------------------------------------------
// Subscription & Billing (Phase 5 Part 2B — Razorpay integration)
// ---------------------------------------------------------------------------
/**
 * Creates a Razorpay subscription for upgrading to a paid plan.
 * Returns subscription details for client-side Razorpay Checkout.
 *
 * Requires: RAZORPAY_KEY_SECRET (SDK auth)
 */
exports.createCheckoutSessionFn = functions.https.onCall({
    secrets: [RAZORPAY_KEY_SECRET],
}, checkout_1.createCheckoutSession);
/**
 * Returns the current subscription status for the authenticated user.
 * No Razorpay secrets required — reads from Firestore only.
 */
exports.getSubscriptionStatusFn = functions.https.onCall(subscription_1.getSubscriptionStatus);
/**
 * Cancels the user's subscription via Razorpay API.
 * Requires: RAZORPAY_KEY_SECRET (SDK auth)
 */
exports.cancelSubscriptionFn = functions.https.onCall({
    secrets: [RAZORPAY_KEY_SECRET],
}, subscription_1.cancelSubscription);
/**
 * Checks whether the user can perform a specific operation given their plan limits.
 */
exports.checkPlanLimitFn = functions.https.onCall(enforcement_1.checkPlanLimit);
/**
 * Returns the current usage summary for the authenticated user.
 */
exports.getUsageFn = functions.https.onCall(enforcement_1.getUsage);
// ---------------------------------------------------------------------------
// Server-side Business Enforcement (Phase 5 Part 2B — plan limit enforcement)
// ---------------------------------------------------------------------------
/**
 * Server-authoritative business creation.
 * Enforces plan limits before writing to Firestore.
 */
exports.createBusinessServerFn = functions.https.onCall(enforcement_callables_1.createBusinessFn);
/**
 * Server-authoritative business publishing.
 * Enforces published business limit before writing to Firestore.
 */
exports.publishBusinessServerFn = functions.https.onCall(enforcement_callables_1.publishBusinessFn);
/**
 * Server-authoritative custom domain connection.
 * Enforces custom domain limit before writing to Firestore.
 */
exports.connectCustomDomainServerFn = functions.https.onCall(enforcement_callables_1.connectCustomDomainFn);
// ---------------------------------------------------------------------------
// Razorpay Webhooks
// ---------------------------------------------------------------------------
/**
 * Razorpay webhook endpoint. Receives POST requests from Razorpay.
 * Verifies webhook signature and processes subscription events.
 *
 * Requires: RAZORPAY_WEBHOOK_SECRET (signature verification)
 *
 * Configure this URL in your Razorpay Dashboard:
 *   https://<region>-<project>.cloudfunctions.net/razorpayWebhook
 */
exports.razorpayWebhook = functions.https.onRequest({
    secrets: [RAZORPAY_WEBHOOK_SECRET],
}, webhook_1.handleRazorpayWebhook);
// ---------------------------------------------------------------------------
// SSR
// ---------------------------------------------------------------------------
/**
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR application.
 */
exports.ssr = functions.https.onRequest(ssrHandler);
//# sourceMappingURL=index.js.map