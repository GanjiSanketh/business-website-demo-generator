/**
 * Razorpay type definitions and configuration for Cloud Functions.
 *
 * This file provides:
 * - Razorpay SDK initialization
 * - Plan-to-Razorpay mapping (server-side only)
 * - Webhook signature verification
 * - Webhook event constants
 */

import * as crypto from 'crypto';
import { PlanId } from './entitlements';

// ---------------------------------------------------------------------------
// Razorpay SDK initialization
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');

let razorpayInstance: any = null;

/**
 * Get or initialize the Razorpay SDK instance.
 * Uses RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from environment.
 */
export function getRazorpayInstance(): any {
  if (razorpayInstance) return razorpayInstance;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Firebase Functions config.'
    );
  }

  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayInstance;
}

// ---------------------------------------------------------------------------
// Server-side plan → Razorpay plan mapping
// ---------------------------------------------------------------------------

/**
 * Razorpay plan IDs for each internal plan.
 * These are created in the Razorpay Dashboard and referenced by ID.
 *
 * Environment variables:
 *   RAZORPAY_PLAN_PRO_MONTHLY      — Razorpay plan id for Pro monthly
 *   RAZORPAY_PLAN_PRO_YEARLY       — Razorpay plan id for Pro yearly
 *   RAZORPAY_PLAN_BUSINESS_MONTHLY — Razorpay plan id for Business monthly
 *   RAZORPAY_PLAN_BUSINESS_YEARLY  — Razorpay plan id for Business yearly
 */
export function getRazorpayPlanId(planId: PlanId, interval: 'monthly' | 'yearly' = 'monthly'): string | null {
  if (planId === 'free') return null;

  const envKey = `RAZORPAY_PLAN_${planId.toUpperCase()}_${interval.toUpperCase()}`;
  const planIdValue = process.env[envKey];

  if (!planIdValue) {
    return null;
  }

  return planIdValue;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify Razorpay webhook signature using HMAC-SHA256.
 *
 * @param rawBody - The raw request body Buffer (NOT parsed JSON)
 * @param signatureHeader - The X-Razorpay-Signature header value
 * @returns true if signature is valid
 */
export function verifyRazorpayWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret || !signatureHeader) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  const a = Buffer.from(expectedSignature, 'hex');
  const b = Buffer.from(signatureHeader, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Razorpay event types we handle
// ---------------------------------------------------------------------------

export const RAZORPAY_WEBHOOK_EVENTS = {
  SUBSCRIPTION_AUTHENTICATED: 'subscription.authenticated',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_CHARGED: 'subscription.charged',
  SUBSCRIPTION_COMPLETED: 'subscription.completed',
  SUBSCRIPTION_PENDING: 'subscription.pending',
  SUBSCRIPTION_HALTED: 'subscription.halted',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  PAYMENT_FAILED: 'payment.failed',
} as const;

export type RazorpayWebhookEvent = typeof RAZORPAY_WEBHOOK_EVENTS[keyof typeof RAZORPAY_WEBHOOK_EVENTS];
