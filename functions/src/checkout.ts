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

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { requireAuth, CallableRequest } from './auth';
import { PlanId, PLAN_METADATA, isPlanUpgrade } from './entitlements';
import { getRazorpayInstance, getRazorpayPlanId } from './razorpay-types';

export interface CreateCheckoutRequest {
  planId: PlanId;
}

export interface CreateCheckoutResponse {
  subscriptionId?: string;
  razorpayKeyId?: string;
  planId?: string;
  error?: string;
}

/**
 * Create a Razorpay Subscription for plan upgrade.
 *
 * Returns subscription details for the client to open Razorpay Checkout.
 * The actual subscription activation happens ONLY via webhook confirmation.
 */
export async function createCheckoutSession(
  request: CallableRequest<CreateCheckoutRequest>
): Promise<CreateCheckoutResponse> {
  const { uid, email } = await requireAuth(request.auth);

  const { planId } = request.data;

  // Validate plan
  if (!planId || !PLAN_METADATA[planId]) {
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

  const userData = userDoc.data()!;

  // Check if user is already on this plan with active subscription
  if (userData.plan === planId && userData.subscriptionStatus === 'active') {
    throw new functions.https.HttpsError('already-exists', `You are already on the ${PLAN_METADATA[planId].name} plan.`);
  }

  // Validate upgrade eligibility (server-side)
  const currentPlan = (userData.plan as PlanId) || 'free';
  if (!isPlanUpgrade(currentPlan, planId) && currentPlan !== planId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Downgrades are not supported through checkout. Please contact support.'
    );
  }

  // Resolve Razorpay plan ID from trusted server config
  const razorpayPlanId = getRazorpayPlanId(planId, 'monthly');
  if (!razorpayPlanId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Payment plan is not configured. Please contact support.'
    );
  }

  // Get or create Razorpay customer
  const razorpay = getRazorpayInstance();
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
    } catch (err: any) {
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
  } catch (err: any) {
    functions.logger.error('Failed to create Razorpay subscription', { uid, planId, error: err.message });
    throw new functions.https.HttpsError('internal', 'Failed to create subscription. Please try again.');
  }
}
