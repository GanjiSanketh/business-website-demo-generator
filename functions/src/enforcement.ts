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

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { requireAuth, CallableRequest } from './auth';
import {
  PlanId,
  PLAN_LIMITS,
  enforceBusinessCreationLimit,
  enforcePublishedLimit,
  enforceCustomDomainLimit,
  enforceSubscriptionActive,
  countBusinesses,
  countPublishedBusinesses,
  countCustomDomains,
} from './entitlements';

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface CheckPlanLimitRequest {
  /** The operation to check: 'createBusiness', 'publishBusiness', 'addCustomDomain'. */
  operation: 'createBusiness' | 'publishBusiness' | 'addCustomDomain';
  /** Business id (required for publish check to exclude the current business). */
  businessId?: string;
}

export interface PlanLimitResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number | null;
  plan: PlanId;
  businessCount?: number;
  publishedCount?: number;
  customDomainCount?: number;
}

export interface GetUsageRequest {
  /** Target user uid. If omitted, returns the caller's own usage. */
  targetUid?: string;
}

export interface UsageResponse {
  uid: string;
  plan: PlanId;
  businessCount: number;
  maxBusinesses: number | null;
  publishedCount: number;
  maxPublishedBusinesses: number | null;
  customDomainCount: number;
  maxCustomDomains: number | null;
  canCreateBusiness: boolean;
  canPublishBusiness: boolean;
  canAddCustomDomain: boolean;
}

// ---------------------------------------------------------------------------
// Check plan limit
// ---------------------------------------------------------------------------

/**
 * Check whether the authenticated user can perform a specific operation.
 * Returns the enforcement result without modifying any data.
 */
export async function checkPlanLimit(
  request: CallableRequest<CheckPlanLimitRequest>
): Promise<PlanLimitResult> {
  const { uid } = await requireAuth(request.auth);

  const { operation } = request.data;
  if (!operation) {
    throw new functions.https.HttpsError('invalid-argument', 'Operation is required.');
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found.');
  }

  const userData = userDoc.data()!;
  const plan = (userData.plan as PlanId) || 'free';
  const status = userData.subscriptionStatus;
  const isAdminUser = userData.role === 'admin';

  // Check subscription status first
  const statusCheck = enforceSubscriptionActive(status, plan);
  if (!statusCheck.allowed && !isAdminUser) {
    return {
      allowed: false,
      reason: statusCheck.reason,
      plan,
    };
  }

  // Check plan-specific limits
  let result: { allowed: boolean; reason?: string; currentCount?: number; limit?: number | null };

  switch (operation) {
    case 'createBusiness':
      result = await enforceBusinessCreationLimit(db, uid, plan, isAdminUser);
      break;
    case 'publishBusiness':
      result = await enforcePublishedLimit(db, uid, plan, isAdminUser);
      break;
    case 'addCustomDomain':
      result = await enforceCustomDomainLimit(db, uid, plan, isAdminUser);
      break;
    default:
      throw new functions.https.HttpsError('invalid-argument', `Unknown operation: ${operation}`);
  }

  // Get full counts for the response
  const [businessCount, publishedCount, customDomainCount] = await Promise.all([
    countBusinesses(db, uid, isAdminUser),
    countPublishedBusinesses(db, uid, isAdminUser),
    countCustomDomains(db, uid, isAdminUser),
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
export async function getUsage(
  request: CallableRequest<GetUsageRequest>
): Promise<UsageResponse> {
  const { uid: callerUid } = await requireAuth(request.auth);

  const targetUid = request.data.targetUid || callerUid;

  // Non-admin users can only read their own usage
  if (targetUid !== callerUid) {
    try {
      const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
      if (callerDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only admins can view other users\' usage.'
        );
      }
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      throw new functions.https.HttpsError('permission-denied', 'Permission denied.');
    }
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(targetUid).get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found.');
  }

  const userData = userDoc.data()!;
  const plan = (userData.plan as PlanId) || 'free';
  const isAdminUser = userData.role === 'admin';

  const [businessCount, publishedCount, customDomainCount] = await Promise.all([
    countBusinesses(db, targetUid, isAdminUser),
    countPublishedBusinesses(db, targetUid, isAdminUser),
    countCustomDomains(db, targetUid, isAdminUser),
  ]);

  const limits = PLAN_LIMITS[plan];

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
