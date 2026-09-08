"use strict";
/**
 * Razorpay type definitions and configuration for Cloud Functions.
 *
 * This file provides:
 * - Razorpay SDK initialization
 * - Plan-to-Razorpay mapping (server-side only)
 * - Webhook signature verification
 * - Webhook event constants
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
exports.RAZORPAY_WEBHOOK_EVENTS = void 0;
exports.getRazorpayInstance = getRazorpayInstance;
exports.getRazorpayPlanId = getRazorpayPlanId;
exports.verifyRazorpayWebhookSignature = verifyRazorpayWebhookSignature;
const crypto = __importStar(require("crypto"));
// ---------------------------------------------------------------------------
// Razorpay SDK initialization
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');
let razorpayInstance = null;
/**
 * Get or initialize the Razorpay SDK instance.
 * Uses RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from environment.
 */
function getRazorpayInstance() {
    if (razorpayInstance)
        return razorpayInstance;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Firebase Functions config.');
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
function getRazorpayPlanId(planId, interval = 'monthly') {
    if (planId === 'free')
        return null;
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
function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
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
exports.RAZORPAY_WEBHOOK_EVENTS = {
    SUBSCRIPTION_AUTHENTICATED: 'subscription.authenticated',
    SUBSCRIPTION_ACTIVATED: 'subscription.activated',
    SUBSCRIPTION_CHARGED: 'subscription.charged',
    SUBSCRIPTION_COMPLETED: 'subscription.completed',
    SUBSCRIPTION_PENDING: 'subscription.pending',
    SUBSCRIPTION_HALTED: 'subscription.halted',
    SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
    PAYMENT_FAILED: 'payment.failed',
};
//# sourceMappingURL=razorpay-types.js.map