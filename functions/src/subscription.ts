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

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { requireAuth, requireAdmin, CallableRequest } from './auth';
import { PlanId, SubscriptionStatus, PLAN_METADATA } from './entitlements';

export interface GetSubscriptionStatusRequest {
  /** Target user uid. If omitted, returns the caller's own status. */
  targetUid?: string;
}

export interface SubscriptionStatusResponse {
  uid: string;
  plan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  planName: string;
  planPrice: number;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  isActive: boolean;
}

/**
 * Get subscription status for the authenticated user (or a target user for admins).
 */
export async function getSubscriptionStatus(
  request: CallableRequest<GetSubscriptionStatusRequest>
): Promise<SubscriptionStatusResponse> {
  const { uid: callerUid } = await requireAuth(request.auth);

  const targetUid = request.data.targetUid || callerUid;

  // Non-admin users can only read their own status
  if (targetUid !== callerUid) {
    try {
      await requireAdmin(request.auth);
    } catch {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can view other users\' subscription status.'
      );
    }
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(targetUid).get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'User profile not found.'
    );
  }

  const data = userDoc.data()!;
  const subscription = data.subscription;

  const plan = (data.plan as PlanId) || 'free';
  const status = (data.subscriptionStatus as SubscriptionStatus) || 'inactive';

  return {
    uid: targetUid,
    plan,
    subscriptionStatus: status,
    planName: PLAN_METADATA[plan]?.name || 'Free',
    planPrice: PLAN_METADATA[plan]?.price || 0,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toDate?.()?.toISOString(),
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
    stripeCustomerId: data.stripeCustomerId,
    stripeSubscriptionId: subscription?.stripeSubscriptionId,
    isActive: status === 'active' || status === 'trialing',
  };
}
