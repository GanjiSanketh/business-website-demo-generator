"use strict";
/**
 * Subscription status retrieval.
 *
 * Provides a Cloud Function that returns the current subscription status
 * for the authenticated user. Used by the frontend to get authoritative
 * subscription state.
 *
 * Security:
 * - Requires authenticated user
 * - Users can only read their own subscription status
 * - Admin users can read any user's subscription status
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
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const entitlements_1 = require("./entitlements");
/**
 * Get subscription status for the authenticated user (or a target user for admins).
 */
async function getSubscriptionStatus(request) {
    const { uid: callerUid } = await (0, auth_1.requireAuth)(request.auth);
    const targetUid = request.data.targetUid || callerUid;
    // Non-admin users can only read their own status
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
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: subscription?.stripeSubscriptionId,
        isActive: status === 'active' || status === 'trialing',
    };
}
//# sourceMappingURL=subscription.js.map