"use strict";
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
exports.verifyRazorpayWebhookSignature = verifyRazorpayWebhookSignature;
const crypto = __importStar(require("crypto"));
const config_1 = require("./config");
// ---------------------------------------------------------------------------
// Razorpay SDK initialization
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');
let razorpayInstance = null;
/**
 * Get or initialize the Razorpay SDK instance.
 * Uses RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from config module.
 */
function getRazorpayInstance() {
    if (razorpayInstance)
        return razorpayInstance;
    const keyId = (0, config_1.getRazorpayKeyId)();
    const keySecret = (0, config_1.getRazorpayKeySecret)();
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
    const webhookSecret = (0, config_1.getRazorpayWebhookSecret)();
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