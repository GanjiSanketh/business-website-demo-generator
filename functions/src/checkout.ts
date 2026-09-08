/**
 * Stripe Checkout Session creation.
 *
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 * Called from the frontend via Firebase Callable Functions.
 *
 * IMPORTANT: This function does NOT directly interact with Stripe yet.
 * It prepares the architecture. Stripe SDK integration happens in Part 2B.
 *
 * Security:
 * - Requires authenticated user
 * - Creates/reuses Stripe customer
 * - Returns Checkout Session URL for redirect
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { requireAuth, CallableRequest } from './auth';
import { PlanId, PLAN_METADATA } from './entitlements';
import { getStripePriceId } from './stripe-types';

export interface CreateCheckoutSessionRequest {
  planId: PlanId;
  email: string;
}

export interface CreateCheckoutSessionResponse {
  sessionId?: string;
  url?: string;
  error?: string;
}

/**
 * Create a Stripe Checkout session for plan upgrade.
 *
 * Flow:
 * 1. Verify user authentication
 * 2. Get or create Stripe customer
 * 3. Create Checkout session with the selected plan's price
 * 4. Return the session URL for frontend redirect
 *
 * When Stripe SDK is added in Part 2B, this function will:
 * - Import and initialize Stripe with the secret key
 * - Use stripe.customers.create() / stripe.customers.retrieve()
 * - Use stripe.checkout.sessions.create()
 * - Store stripeCustomerId on the user profile
 */
export async function createCheckoutSession(
  request: CallableRequest<CreateCheckoutSessionRequest>
): Promise<CreateCheckoutSessionResponse> {
  const { uid, email: authEmail } = await requireAuth(request.auth);

  const { planId, email } = request.data;

  // Validate plan
  if (!planId || !PLAN_METADATA[planId]) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid plan selected.'
    );
  }

  if (planId === 'free') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Free plan does not require checkout.'
    );
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'User profile not found.'
    );
  }

  const userData = userDoc.data()!;

  // Check if user is already on this plan
  if (userData.plan === planId && userData.subscriptionStatus === 'active') {
    throw new functions.https.HttpsError(
      'already-exists',
      `You are already on the ${PLAN_METADATA[planId].name} plan.`
    );
  }

  // Get or create Stripe customer
  let stripeCustomerId = userData.stripeCustomerId;

  if (!stripeCustomerId) {
    // Part 2B: Create Stripe customer
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // const customer = await stripe.customers.create({
    //   email: email || authEmail,
    //   metadata: { firebaseUID: uid },
    // });
    // stripeCustomerId = customer.id;
    // await userRef.update({ stripeCustomerId });

    // Placeholder: Return error until Stripe SDK is installed
    throw new functions.https.HttpsError(
      'unimplemented',
      'Stripe integration is not yet configured. Coming in Phase 5 Part 2B.'
    );
  }

  // Get the price id for the selected plan
  const priceId = getStripePriceId(planId, 'monthly');
  if (!priceId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No pricing configured for this plan.'
    );
  }

  // Part 2B: Create Checkout session
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // const session = await stripe.checkout.sessions.create({
  //   customer: stripeCustomerId,
  //   mode: 'subscription',
  //   payment_method_types: ['card'],
  //   line_items: [{ price: priceId, quantity: 1 }],
  //   success_url: `${process.env.APP_URL}/admin/billing?session_id={CHECKOUT_SESSION_ID}`,
  //   cancel_url: `${process.env.APP_URL}/admin/billing`,
  //   metadata: { firebaseUID: uid, planId },
  //   subscription_data: { metadata: { firebaseUID: uid, planId } },
  // });
  //
  // return { sessionId: session.id, url: session.url };

  // Placeholder until Stripe SDK is installed
  functions.logger.info('Checkout session requested', { uid, planId, stripeCustomerId });
  throw new functions.https.HttpsError(
    'unimplemented',
    'Stripe checkout is not yet configured. Coming in Phase 5 Part 2B.'
  );
}
