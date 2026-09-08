"use strict";
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
exports.createCheckoutSession = createCheckoutSession;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const entitlements_1 = require("./entitlements");
const razorpay_types_1 = require("./razorpay-types");
/**
 * Create a Razorpay Subscription for plan upgrade.
 *
 * Returns subscription details for the client to open Razorpay Checkout.
 * The actual subscription activation happens ONLY via webhook confirmation.
 */
async function createCheckoutSession(request) {
    const { uid, email } = await (0, auth_1.requireAuth)(request.auth);
    const { planId } = request.data;
    // Validate plan
    if (!planId || !entitlements_1.PLAN_METADATA[planId]) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid plan selected.');
    }
    if (planId === 'free') {
        throw new functions.https.HttpsError('failed-precondition', 'Free plan does not require checkout.');
    }
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }
    const userData = userDoc.data();
    // Check if user is already on this plan with active subscription
    if (userData.plan === planId && userData.subscriptionStatus === 'active') {
        throw new functions.https.HttpsError('already-exists', `You are already on the ${entitlements_1.PLAN_METADATA[planId].name} plan.`);
    }
    // Validate upgrade eligibility (server-side)
    const currentPlan = userData.plan || 'free';
    if (!(0, entitlements_1.isPlanUpgrade)(currentPlan, planId) && currentPlan !== planId) {
        throw new functions.https.HttpsError('failed-precondition', 'Downgrades are not supported through checkout. Please contact support.');
    }
    // Resolve Razorpay plan ID from trusted server config
    const razorpayPlanId = (0, razorpay_types_1.getRazorpayPlanId)(planId, 'monthly');
    if (!razorpayPlanId) {
        throw new functions.https.HttpsError('failed-precondition', 'Payment plan is not configured. Please contact support.');
    }
    // Get or create Razorpay customer
    const razorpay = (0, razorpay_types_1.getRazorpayInstance)();
    let razorpayCustomerId = userData.paymentCustomerId;
    if (!razorpayCustomerId) {
        try {
            const customer = await razorpay.customers.create({
                name: userData.displayName || email || 'User',
                email: email || undefined,
                notes: { firebaseUID: uid },
            });
            razorpayCustomerId = customer.id;
            await userRef.update({ paymentCustomerId: razorpayCustomerId });
        }
        catch (err) {
            functions.logger.error('Failed to create Razorpay customer', { uid, error: err.message });
            throw new functions.https.HttpsError('internal', 'Failed to create payment customer. Please try again.');
        }
    }
    // Create Razorpay Subscription
    try {
        const subscription = await razorpay.subscriptions.create({
            plan_id: razorpayPlanId,
            customer_id: razorpayCustomerId,
            total_count: 12, // 12 billing cycles (months) — auto-renews via webhook
            quantity: 1,
            customer_notify: 1,
            notes: {
                firebaseUID: uid,
                planId,
            },
        });
        functions.logger.info('Razorpay subscription created', {
            uid,
            planId,
            subscriptionId: subscription.id,
            razorpayPlanId,
        });
        return {
            subscriptionId: subscription.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            planId,
        };
    }
    catch (err) {
        functions.logger.error('Failed to create Razorpay subscription', { uid, planId, error: err.message });
        throw new functions.https.HttpsError('internal', 'Failed to create subscription. Please try again.');
    }
}
//# sourceMappingURL=checkout.js.map