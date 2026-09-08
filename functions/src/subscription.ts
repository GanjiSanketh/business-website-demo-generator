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

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { requireAuth, requireAdmin, CallableRequest } from './auth';
import { PlanId, SubscriptionStatus, PLAN_METADATA } from './entitlements';
import { getRazorpayInstance } from './razorpay-types';

// ---------------------------------------------------------------------------
// Get subscription status
// ---------------------------------------------------------------------------

export interface GetSubscriptionStatusRequest {
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
  paymentCustomerId?: string;
  providerSubscriptionId?: string;
  isActive: boolean;
}

export async function getSubscriptionStatus(
  request: CallableRequest<GetSubscriptionStatusRequest>
): Promise<SubscriptionStatusResponse> {
  const { uid: callerUid } = await requireAuth(request.auth);

  const targetUid = request.data.targetUid || callerUid;

  if (targetUid !== callerUid) {
    try {
      await requireAdmin(request.auth);
    } catch {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can view other users\' subscription status.');
    }
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(targetUid).get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found.');
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
    paymentCustomerId: data.paymentCustomerId,
    providerSubscriptionId: subscription?.providerSubscriptionId,
    isActive: status === 'active',
  };
}

// ---------------------------------------------------------------------------
// Cancel subscription
// ---------------------------------------------------------------------------

export interface CancelSubscriptionRequest {
  cancelAtCycleEnd?: boolean;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  error?: string;
}

export async function cancelSubscription(
  request: CallableRequest<CancelSubscriptionRequest>
): Promise<CancelSubscriptionResponse> {
  const { uid } = await requireAuth(request.auth);

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found.');
  }

  const data = userDoc.data()!;
  const subscriptionId = data.subscription?.providerSubscriptionId;

  if (!subscriptionId) {
    throw new functions.https.HttpsError('failed-precondition', 'No active subscription to cancel.');
  }

  const razorpay = getRazorpayInstance();

  try {
    await razorpay.subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: request.data.cancelAtCycleEnd ? 1 : 0 } as any);

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
    } else {
      // Just mark as cancel-at-cycle-end
      await db.collection('users').doc(uid).update({
        'subscription.cancelAtPeriodEnd': true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { success: true };
  } catch (err: any) {
    functions.logger.error('Failed to cancel subscription', { uid, error: err.message });
    throw new functions.https.HttpsError('internal', `Failed to cancel subscription: ${err.message}`);
  }
}
