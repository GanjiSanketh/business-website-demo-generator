"use strict";
/**
 * Subscription management Cloud Functions.
 *
 * Provides:
 * - getSubscriptionStatus: read current subscription state
 * - cancelSubscription: cancel a subscription via Razorpay
 *
 * Security:
 * - Requires authenticated user
 * - Users can only manage their own subscription
 * - Admins can manage any subscription
 * - All mutations go through Razorpay API (authoritative)
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
exports.getSubscriptionStatus = getSubscriptionStatus;
exports.cancelSubscription = cancelSubscription;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const entitlements_1 = require("./entitlements");
const razorpay_types_1 = require("./razorpay-types");
async function getSubscriptionStatus(request) {
    const { uid: callerUid } = await (0, auth_1.requireAuth)(request.auth);
    const targetUid = request.data.targetUid || callerUid;
    if (targetUid !== callerUid) {
        try {
            await (0, auth_1.requireAdmin)(request.auth);
        }
        catch {
            throw new functions.https.HttpsError('permission-denied', 'Only admins can view other users\' subscription status.');
        }
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(targetUid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }
    const data = userDoc.data();
    const subscription = data.subscription;
    const plan = data.plan || 'free';
    const status = data.subscriptionStatus || 'inactive';
    return {
        uid: targetUid,
        plan,
        subscriptionStatus: status,
        planName: entitlements_1.PLAN_METADATA[plan]?.name || 'Free',
        planPrice: entitlements_1.PLAN_METADATA[plan]?.price || 0,
        currentPeriodEnd: subscription?.currentPeriodEnd?.toDate?.()?.toISOString(),
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
        paymentCustomerId: data.paymentCustomerId,
        providerSubscriptionId: subscription?.providerSubscriptionId,
        isActive: status === 'active',
    };
}
async function cancelSubscription(request) {
    const { uid } = await (0, auth_1.requireAuth)(request.auth);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }
    const data = userDoc.data();
    const subscriptionId = data.subscription?.providerSubscriptionId;
    if (!subscriptionId) {
        throw new functions.https.HttpsError('failed-precondition', 'No active subscription to cancel.');
    }
    const razorpay = (0, razorpay_types_1.getRazorpayInstance)();
    try {
        await razorpay.subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: request.data.cancelAtCycleEnd ? 1 : 0 });
        functions.logger.info('Subscription cancelled via API', { uid, subscriptionId });
        // If immediate cancellation, update Firestore now
        // (webhook will also confirm this)
        if (!request.data.cancelAtCycleEnd) {
            const now = admin.firestore.FieldValue.serverTimestamp();
            await db.collection('users').doc(uid).update({
                plan: 'free',
                subscriptionStatus: 'cancelled',
                subscription: {
                    plan: 'free',
                    status: 'cancelled',
                    providerSubscriptionId: null,
                    providerPlanId: null,
                    interval: null,
                    currentPeriodStart: null,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                },
                updatedAt: now,
            });
        }
        else {
            // Just mark as cancel-at-cycle-end
            await db.collection('users').doc(uid).update({
                'subscription.cancelAtPeriodEnd': true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (err) {
        functions.logger.error('Failed to cancel subscription', { uid, error: err.message });
        throw new functions.https.HttpsError('internal', `Failed to cancel subscription: ${err.message}`);
    }
}
//# sourceMappingURL=subscription.js.map