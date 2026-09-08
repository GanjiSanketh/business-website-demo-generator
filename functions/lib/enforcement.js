"use strict";
/**
 * Plan enforcement Cloud Functions.
 *
 * Server-side enforcement of plan limits for business operations.
 * These functions are called before critical operations to verify
 * that the user's plan allows the action.
 *
 * Security:
 * - Requires authenticated user
 * - Uses Admin SDK for all Firestore queries (bypasses client-side rules)
 * - Returns enforcement result without modifying any data
 * - The calling code is responsible for acting on the result
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
exports.checkPlanLimit = checkPlanLimit;
exports.getUsage = getUsage;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const entitlements_1 = require("./entitlements");
// ---------------------------------------------------------------------------
// Check plan limit
// ---------------------------------------------------------------------------
/**
 * Check whether the authenticated user can perform a specific operation.
 * Returns the enforcement result without modifying any data.
 */
async function checkPlanLimit(request) {
    const { uid } = await (0, auth_1.requireAuth)(request.auth);
    const { operation } = request.data;
    if (!operation) {
        throw new functions.https.HttpsError('invalid-argument', 'Operation is required.');
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }
    const userData = userDoc.data();
    const plan = userData.plan || 'free';
    const status = userData.subscriptionStatus;
    const isAdminUser = userData.role === 'admin';
    // Check subscription status first
    const statusCheck = (0, entitlements_1.enforceSubscriptionActive)(status, plan);
    if (!statusCheck.allowed && !isAdminUser) {
        return {
            allowed: false,
            reason: statusCheck.reason,
            plan,
        };
    }
    // Check plan-specific limits
    let result;
    switch (operation) {
        case 'createBusiness':
            result = await (0, entitlements_1.enforceBusinessCreationLimit)(db, uid, plan, isAdminUser);
            break;
        case 'publishBusiness':
            result = await (0, entitlements_1.enforcePublishedLimit)(db, uid, plan, isAdminUser);
            break;
        case 'addCustomDomain':
            result = await (0, entitlements_1.enforceCustomDomainLimit)(db, uid, plan, isAdminUser);
            break;
        default:
            throw new functions.https.HttpsError('invalid-argument', `Unknown operation: ${operation}`);
    }
    // Get full counts for the response
    const [businessCount, publishedCount, customDomainCount] = await Promise.all([
        (0, entitlements_1.countBusinesses)(db, uid, isAdminUser),
        (0, entitlements_1.countPublishedBusinesses)(db, uid, isAdminUser),
        (0, entitlements_1.countCustomDomains)(db, uid, isAdminUser),
    ]);
    return {
        allowed: result.allowed,
        reason: result.reason,
        currentCount: result.currentCount,
        limit: result.limit,
        plan,
        businessCount,
        publishedCount,
        customDomainCount,
    };
}
// ---------------------------------------------------------------------------
// Get usage summary
// ---------------------------------------------------------------------------
/**
 * Get the current usage summary for a user.
 * Used by the billing page and dashboard to show accurate counts.
 */
async function getUsage(request) {
    const { uid: callerUid } = await (0, auth_1.requireAuth)(request.auth);
    const targetUid = request.data.targetUid || callerUid;
    // Non-admin users can only read their own usage
    if (targetUid !== callerUid) {
        try {
            const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
            if (callerDoc.data()?.role !== 'admin') {
                throw new functions.https.HttpsError('permission-denied', 'Only admins can view other users\' usage.');
            }
        }
        catch (err) {
            if (err instanceof functions.https.HttpsError)
                throw err;
            throw new functions.https.HttpsError('permission-denied', 'Permission denied.');
        }
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(targetUid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }
    const userData = userDoc.data();
    const plan = userData.plan || 'free';
    const isAdminUser = userData.role === 'admin';
    const [businessCount, publishedCount, customDomainCount] = await Promise.all([
        (0, entitlements_1.countBusinesses)(db, targetUid, isAdminUser),
        (0, entitlements_1.countPublishedBusinesses)(db, targetUid, isAdminUser),
        (0, entitlements_1.countCustomDomains)(db, targetUid, isAdminUser),
    ]);
    const limits = entitlements_1.PLAN_LIMITS[plan];
    return {
        uid: targetUid,
        plan,
        businessCount,
        maxBusinesses: limits.maxBusinesses,
        publishedCount,
        maxPublishedBusinesses: limits.maxPublishedBusinesses,
        customDomainCount,
        maxCustomDomains: limits.customDomains,
        canCreateBusiness: isAdminUser || (limits.maxBusinesses === null || businessCount < limits.maxBusinesses),
        canPublishBusiness: isAdminUser || (limits.maxPublishedBusinesses === null || publishedCount < limits.maxPublishedBusinesses),
        canAddCustomDomain: isAdminUser || (limits.customDomains === null || customDomainCount < limits.customDomains),
    };
}
//# sourceMappingURL=enforcement.js.map