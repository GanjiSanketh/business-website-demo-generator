/**
 * Razorpay type definitions and configuration for Cloud Functions.
 *
 * This file provides:
 * - Razorpay SDK initialization
 * - Webhook signature verification
 * - Webhook event constants
 *
 * All configuration values are read from the config module using the
 * canonical Firebase Functions .value() API.
 */

import * as crypto from 'crypto';
import { getRazorpayKeyId, getRazorpayKeySecret, getRazorpayWebhookSecret } from './config';

// ---------------------------------------------------------------------------
// Razorpay SDK initialization
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');

let razorpayInstance: any = null;

/**
 * Get or initialize the Razorpay SDK instance.
 * Uses RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from config module.
 */
export function getRazorpayInstance(): any {
  if (razorpayInstance) return razorpayInstance;

  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();

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
  const webhookSecret = getRazorpayWebhookSecret();

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
