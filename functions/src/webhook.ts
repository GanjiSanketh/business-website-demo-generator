/**
 * Stripe Webhook handler.
 *
 * Processes Stripe webhook events to update subscription state in Firestore.
 * This is the authoritative source for subscription changes — the frontend
 * never directly modifies plan/subscription fields.
 *
 * IMPORTANT: This function does NOT directly interact with Stripe yet.
 * It prepares the architecture. Stripe SDK integration happens in Part 2B.
 *
 * Security:
 * - Verifies Stripe webhook signature (Part 2B)
 * - Uses Admin SDK to update user profiles
 * - Processes events idempotently
 *
 * Supported events (Part 2B):
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { PlanId, SubscriptionStatus } from './entitlements';

// ---------------------------------------------------------------------------
// Event type definitions (minimal stubs for Part 2A architecture)
// ---------------------------------------------------------------------------

interface CheckoutSessionCompleted {
  customer: string;
  subscription?: string;
  metadata?: Record<string, string>;
}

interface SubscriptionUpdated {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start: number;
  current_period_end: number;
  items?: {
    data: Array<{
      price?: { id: string };
    }>;
  };
  metadata?: Record<string, string>;
}

interface InvoiceEvent {
  customer: string;
  subscription?: string;
  amount_paid?: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// Stripe status → SubscriptionStatus mapping
// ---------------------------------------------------------------------------

function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'cancelled':
    case 'unpaid':
      return 'cancelled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'inactive';
    default:
      return 'inactive';
  }
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

/**
 * Handle Stripe webhook events.
 *
 * Architecture notes for Part 2B:
 * - This will be an onRequest function (not onCall) to receive Stripe POSTs
 * - Must verify stripe-signature header against webhook secret
 * - Must handle idempotency (check if event already processed)
 * - Must update Firestore user profile atomically
 */
export async function handleStripeWebhook(
  request: functions.https.Request,
  response: { status: (code: number) => { json: (body: any) => void } }
): Promise<void> {
  // Part 2B: Verify webhook signature
  // const sig = request.headers['stripe-signature'];
  // const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  //
  // let event;
  // try {
  //   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  //   event = stripe.webhooks.constructEvent(request.rawBody, sig, endpointSecret);
  // } catch (err) {
  //   functions.logger.error('Webhook signature verification failed', { error: err });
  //   response.status(400).send('Webhook Error: Invalid signature');
  //   return;
  // }

  // Placeholder until Stripe SDK is installed
  functions.logger.info('Webhook received (placeholder)', {
    method: request.method,
    url: request.url,
  });

  response.status(200).json({ received: true });
}

// ---------------------------------------------------------------------------
// Individual event processors (called from the main handler in Part 2B)
// ---------------------------------------------------------------------------

/**
 * Process checkout.session.completed — user completed Stripe Checkout.
 * Creates or updates the user's subscription in Firestore.
 */
async function processCheckoutCompleted(event: CheckoutSessionCompleted): Promise<void> {
  const firebaseUID = event.metadata?.firebaseUID;
  if (!firebaseUID) {
    functions.logger.error('Checkout completed without firebaseUID metadata');
    return;
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(firebaseUID);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    functions.logger.error('Checkout completed for unknown user', { firebaseUID });
    return;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  await userRef.update({
    plan: (event.metadata?.planId as PlanId) || 'pro',
    subscriptionStatus: 'active',
    stripeCustomerId: event.customer,
    subscription: {
      plan: (event.metadata?.planId as PlanId) || 'pro',
      status: 'active',
      stripeSubscriptionId: event.subscription || null,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    updatedAt: now,
  });

  functions.logger.info('Subscription activated via checkout', { firebaseUID, planId: event.metadata?.planId });
}

/**
 * Process customer.subscription.updated — subscription details changed.
 * Updates period dates, cancellation status, and plan changes.
 */
async function processSubscriptionUpdated(event: SubscriptionUpdated): Promise<void> {
  const firebaseUID = event.metadata?.firebaseUID;
  if (!firebaseUID) {
    functions.logger.error('Subscription updated without firebaseUID metadata');
    return;
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(firebaseUID);
  const userDoc = await userRef.get();

  if (!userDoc.exists) return;

  const status = mapStripeStatus(event.status);
  const priceId = event.items?.data?.[0]?.price?.id;
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Determine plan from price id (Part 2B will have a price→plan mapping)
  let newPlan: PlanId = userDoc.data()!.plan;
  // Part 2B: const newPlan = planFromPriceId(priceId) || userDoc.data()!.plan;

  await userRef.update({
    plan: newPlan,
    subscriptionStatus: status,
    subscription: {
      plan: newPlan,
      status,
      stripeSubscriptionId: event.id,
      currentPeriodStart: admin.firestore.Timestamp.fromMillis(event.current_period_start * 1000),
      currentPeriodEnd: admin.firestore.Timestamp.fromMillis(event.current_period_end * 1000),
      cancelAtPeriodEnd: event.cancel_at_period_end,
    },
    updatedAt: now,
  });

  functions.logger.info('Subscription updated', { firebaseUID, status, cancelAtPeriodEnd: event.cancel_at_period_end });
}

/**
 * Process customer.subscription.deleted — subscription fully cancelled.
 * Downgrades user to free plan.
 */
async function processSubscriptionDeleted(subscriptionId: string): Promise<void> {
  const db = admin.firestore();

  // Find user by subscription id
  const usersSnapshot = await db
    .collection('users')
    .where('subscription.stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    functions.logger.error('Subscription deleted for unknown user', { subscriptionId });
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const now = admin.firestore.FieldValue.serverTimestamp();

  await userDoc.ref.update({
    plan: 'free',
    subscriptionStatus: 'inactive',
    subscription: {
      plan: 'free',
      status: 'inactive',
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
    updatedAt: now,
  });

  functions.logger.info('Subscription deleted, user downgraded to free', { uid: userDoc.id });
}

/**
 * Process invoice.payment_succeeded — payment confirmed.
 * Updates subscription status to active.
 */
async function processInvoiceSucceeded(event: InvoiceEvent): Promise<void> {
  const db = admin.firestore();

  const usersSnapshot = await db
    .collection('users')
    .where('stripeCustomerId', '==', event.customer)
    .limit(1)
    .get();

  if (usersSnapshot.empty) return;

  const userDoc = usersSnapshot.docs[0];
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Only update if subscription exists and was in a problematic state
  const currentStatus = userDoc.data().subscriptionStatus;
  if (currentStatus === 'past_due' || currentStatus === 'inactive') {
    await userDoc.ref.update({
      subscriptionStatus: 'active',
      updatedAt: now,
    });
  }
}

/**
 * Process invoice.payment_failed — payment failed.
 * Marks subscription as past_due to restrict access.
 */
async function processInvoiceFailed(event: InvoiceEvent): Promise<void> {
  const db = admin.firestore();

  const usersSnapshot = await db
    .collection('users')
    .where('stripeCustomerId', '==', event.customer)
    .limit(1)
    .get();

  if (usersSnapshot.empty) return;

  const userDoc = usersSnapshot.docs[0];
  const now = admin.firestore.FieldValue.serverTimestamp();

  await userDoc.ref.update({
    subscriptionStatus: 'past_due',
    updatedAt: now,
  });

  functions.logger.warn('Payment failed, marked subscription as past_due', { uid: userDoc.id });
}
