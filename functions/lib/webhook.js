"use strict";
/**
 * Razorpay Webhook handler.
 *
 * Processes Razorpay webhook events to update subscription state in Firestore.
 * This is the authoritative source for subscription changes — the frontend
 * never directly modifies plan/subscription fields.
 *
 * Security:
 * - Verifies Razorpay webhook signature using HMAC-SHA256
 * - Uses Admin SDK to update user profiles
 * - Processes events idempotently via Firestore transaction
 *
 * Supported events (Razorpay Subscriptions API):
 * - subscription.authenticated — first payment authorized, subscription active
 * - subscription.activated — moved to active state
 * - subscription.charged — recurring payment succeeded
 * - subscription.pending — charge attempt failed, will retry
 * - subscription.halted — all retries exhausted
 * - subscription.cancelled — user cancelled
 * - subscription.completed — all billing cycles ended (total_count reached)
 * - payment.failed — payment failed event
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
exports.handleRazorpayWebhook = handleRazorpayWebhook;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const config_1 = require("./config");
const razorpay_types_1 = require("./razorpay-types");
// ---------------------------------------------------------------------------
// Stale-processing recovery
// ---------------------------------------------------------------------------
/** A processing event older than this is considered stale and reclaimable. */
const WEBHOOK_PROCESSING_STALE_MS = 5 * 60 * 1000; // 5 minutes
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * Find Firebase user by Razorpay customer ID.
 */
async function findUserByRazorpayCustomer(customerId) {
    const db = admin.firestore();
    const snapshot = await db
        .collection('users')
        .where('paymentCustomerId', '==', customerId)
        .limit(1)
        .get();
    if (snapshot.empty)
        return null;
    return snapshot.docs[0].id;
}
/**
 * Resolve internal plan from Razorpay plan ID via config module.
 */
function planFromRazorpayPlanId(razorpayPlanId) {
    const plans = ['free', 'pro', 'business'];
    for (const plan of plans) {
        const monthlyId = (0, config_1.getRazorpayPlanId)(plan, 'monthly');
        const yearlyId = (0, config_1.getRazorpayPlanId)(plan, 'yearly');
        if (monthlyId === razorpayPlanId || yearlyId === razorpayPlanId) {
            return plan;
        }
    }
    return null;
}
/**
 * Resolve billing interval from Razorpay plan ID.
 */
function resolveIntervalFromPlanId(razorpayPlanId) {
    const proMonthly = (0, config_1.getRazorpayPlanId)('pro', 'monthly');
    const proYearly = (0, config_1.getRazorpayPlanId)('pro', 'yearly');
    const bizMonthly = (0, config_1.getRazorpayPlanId)('business', 'monthly');
    const bizYearly = (0, config_1.getRazorpayPlanId)('business', 'yearly');
    if (razorpayPlanId === proMonthly || razorpayPlanId === bizMonthly)
        return 'monthly';
    if (razorpayPlanId === proYearly || razorpayPlanId === bizYearly)
        return 'yearly';
    return undefined;
}
// ---------------------------------------------------------------------------
// Process individual events
// ---------------------------------------------------------------------------
/**
 * Process subscription.authenticated — first payment authorized.
 * Activates the subscription for the user.
 */
async function processSubscriptionAuthenticated(event) {
    const firebaseUID = await findUserByRazorpayCustomer(event.customer_id);
    if (!firebaseUID) {
        functions.logger.error('Subscription authenticated for unknown customer', { customerId: event.customer_id });
        return;
    }
    const db = admin.firestore();
    const userRef = db.collection('users').doc(firebaseUID);
    const userDoc = await userRef.get();
    if (!userDoc.exists)
        return;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const interval = resolveIntervalFromPlanId(event.plan_id);
    const plan = planFromRazorpayPlanId(event.plan_id) || userDoc.data().plan;
    await userRef.update({
        plan,
        subscriptionStatus: 'active',
        subscription: {
            plan,
            status: 'active',
            providerSubscriptionId: event.id,
            providerPlanId: event.plan_id,
            interval,
            currentPeriodStart: event.current_start
                ? admin.firestore.Timestamp.fromMillis(event.current_start * 1000)
                : null,
            currentPeriodEnd: event.current_end
                ? admin.firestore.Timestamp.fromMillis(event.current_end * 1000)
                : null,
            cancelAtPeriodEnd: event.cancel_at_cycle_end || false,
        },
        updatedAt: now,
    });
    functions.logger.info('Subscription authenticated', { firebaseUID, planId: plan, razorpaySubId: event.id });
}
/**
 * Process subscription.activated — moved to active state.
 */
async function processSubscriptionActivated(event) {
    const firebaseUID = await findUserByRazorpayCustomer(event.customer_id);
    if (!firebaseUID) {
        functions.logger.error('Subscription activated for unknown customer', { customerId: event.customer_id });
        return;
    }
    const db = admin.firestore();
    const userRef = db.collection('users').doc(firebaseUID);
    const userDoc = await userRef.get();
    if (!userDoc.exists)
        return;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const plan = planFromRazorpayPlanId(event.plan_id) || userDoc.data().plan;
    const interval = resolveIntervalFromPlanId(event.plan_id);
    await userRef.update({
        plan,
        subscriptionStatus: 'active',
        subscription: {
            plan,
            status: 'active',
            providerSubscriptionId: event.id,
            providerPlanId: event.plan_id,
            interval,
            currentPeriodStart: event.current_start
                ? admin.firestore.Timestamp.fromMillis(event.current_start * 1000)
                : null,
            currentPeriodEnd: event.current_end
                ? admin.firestore.Timestamp.fromMillis(event.current_end * 1000)
                : null,
            cancelAtPeriodEnd: event.cancel_at_cycle_end || false,
        },
        updatedAt: now,
    });
    functions.logger.info('Subscription activated', { firebaseUID, planId: plan });
}
/**
 * Process subscription.charged — recurring payment succeeded.
 * Confirms active status and updates period dates.
 */
async function processSubscriptionCharged(event) {
    const firebaseUID = await findUserByRazorpayCustomer(event.customer_id);
    if (!firebaseUID)
        return;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(firebaseUID);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await userRef.update({
        subscriptionStatus: 'active',
        'subscription.status': 'active',
        'subscription.currentPeriodStart': event.current_start
            ? admin.firestore.Timestamp.fromMillis(event.current_start * 1000)
            : admin.firestore.FieldValue.delete(),
        'subscription.currentPeriodEnd': event.current_end
            ? admin.firestore.Timestamp.fromMillis(event.current_end * 1000)
            : admin.firestore.FieldValue.delete(),
        updatedAt: now,
    });
    functions.logger.info('Subscription charged', { firebaseUID, razorpaySubId: event.id });
}
/**
 * Process subscription.pending — charge attempt failed, will retry.
 */
async function processSubscriptionPending(event) {
    const firebaseUID = await findUserByRazorpayCustomer(event.customer_id);
    if (!firebaseUID)
        return;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(firebaseUID);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await userRef.update({
        subscriptionStatus: 'past_due',
        'subscription.status': 'past_due',
        updatedAt: now,
    });
    functions.logger.warn('Subscription pending (payment retry)', { firebaseUID, razorpaySubId: event.id });
}
/**
 * Process subscription.halted — all retries exhausted.
 */
async function processSubscriptionHalted(event) {
    const firebaseUID = await findUserByRazorpayCustomer(event.customer_id);
    if (!firebaseUID)
        return;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(firebaseUID);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await userRef.update({
        subscriptionStatus: 'inactive',
        'subscription.status': 'inactive',
        updatedAt: now,
    });
    functions.logger.warn('Subscription halted', { firebaseUID, razorpaySubId: event.id });
}
/**
 * Process subscription.cancelled — subscription cancelled.
 * Downgrades to free plan at period end or immediately if already past period end.
 */
async function processSubscriptionCancelled(event) {
    const firebaseUID = await findUserByRazorpayCustomer(event.customer_id);
    if (!firebaseUID)
        return;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(firebaseUID);
    const now = admin.firestore.FieldValue.serverTimestamp();
    // Check if cancellation is at period end or immediate
    const userDoc = await userRef.get();
    if (!userDoc.exists)
        return;
    const currentEnd = event.current_end ? event.current_end * 1000 : 0;
    const nowMs = Date.now();
    const isImmediate = currentEnd === 0 || currentEnd <= nowMs;
    if (isImmediate) {
        // Immediate cancellation — downgrade to free
        await userRef.update({
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
        functions.logger.info('Subscription cancelled (immediate), user downgraded to free', { firebaseUID });
    }
    else {
        // Cancellation at period end — keep current plan, mark cancelAtPeriodEnd
        await userRef.update({
            'subscription.cancelAtPeriodEnd': true,
            updatedAt: now,
        });
        functions.logger.info('Subscription cancellation scheduled at period end', { firebaseUID });
    }
}
/**
 * Process subscription.completed — all billing cycles ended.
 * Only fires when total_count is reached (e.g., 12 months).
 */
async function processSubscriptionCompleted(event) {
    const firebaseUID = await findUserByRazorpayCustomer(event.customer_id);
    if (!firebaseUID)
        return;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(firebaseUID);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await userRef.update({
        plan: 'free',
        subscriptionStatus: 'inactive',
        subscription: {
            plan: 'free',
            status: 'inactive',
            providerSubscriptionId: null,
            providerPlanId: null,
            interval: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
        },
        updatedAt: now,
    });
    functions.logger.info('Subscription completed (all cycles ended), user downgraded to free', { firebaseUID });
}
/**
 * Process payment.failed — payment failed event.
 */
async function processPaymentFailed(event) {
    if (!event.subscription_id)
        return;
    const firebaseUID = await findUserByRazorpayCustomer(event.customer_id);
    if (!firebaseUID)
        return;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(firebaseUID);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await userRef.update({
        subscriptionStatus: 'past_due',
        'subscription.status': 'past_due',
        updatedAt: now,
    });
    functions.logger.warn('Payment failed', { firebaseUID, subscriptionId: event.subscription_id });
}
// ---------------------------------------------------------------------------
// Main webhook handler (onRequest)
// ---------------------------------------------------------------------------
/**
 * Handle Razorpay webhook events.
 *
 * This is an onRequest function (NOT onCall) because Razorpay sends
 * POST requests directly to this endpoint.
 */
async function handleRazorpayWebhook(request, response) {
    // Only accept POST
    if (request.method !== 'POST') {
        response.status(405).send('Method Not Allowed');
        return;
    }
    // Get raw body for signature verification
    const rawBody = request.rawBody;
    if (!rawBody) {
        response.status(400).send('Missing request body');
        return;
    }
    // Verify webhook signature
    const signature = request.headers['x-razorpay-signature'];
    if (!(0, razorpay_types_1.verifyRazorpayWebhookSignature)(rawBody, signature)) {
        functions.logger.error('Webhook signature verification failed');
        response.status(403).send('Invalid signature');
        return;
    }
    // Parse the event
    let event;
    try {
        event = JSON.parse(rawBody.toString('utf8'));
    }
    catch {
        response.status(400).send('Invalid JSON');
        return;
    }
    functions.logger.info('Webhook received', { event: event.event });
    // Extract event ID for idempotency
    const eventId = event.payload?.subscription?.entity?.id ||
        event.payload?.payment?.entity?.id ||
        'unknown';
    const eventKey = `${event.event}_${eventId}`;
    const eventRef = admin.firestore().collection('webhookEvents').doc(eventKey);
    const db = admin.firestore();
    // Idempotency: atomic claim via transaction state machine
    // States: processing → processed | failed (retryable)
    // Stale processing (>5 min) is reclaimed like failed
    let claimResult = 'already_processing';
    try {
        await db.runTransaction(async (tx) => {
            const existing = await tx.get(eventRef);
            if (existing.exists) {
                const data = existing.data();
                if (data.status === 'processed') {
                    claimResult = 'already_processed';
                    return;
                }
                if (data.status === 'processing') {
                    // Check if stale — recoverable crash scenario
                    const updatedAt = data.updatedAt;
                    let isStale = true; // assume stale if timestamp missing/invalid
                    if (updatedAt) {
                        try {
                            const age = Date.now() - updatedAt.toMillis();
                            isStale = age > WEBHOOK_PROCESSING_STALE_MS;
                        }
                        catch {
                            // invalid timestamp — treat as stale
                        }
                    }
                    if (!isStale) {
                        claimResult = 'already_processing';
                        return;
                    }
                    // Stale — re-claim like a failed event
                    tx.update(eventRef, {
                        status: 'processing',
                        attempts: (data.attempts || 1) + 1,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    claimResult = 'claimed';
                    return;
                }
                // status === 'failed' — retry: re-claim
                tx.update(eventRef, {
                    status: 'processing',
                    attempts: (data.attempts || 1) + 1,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                claimResult = 'claimed';
                return;
            }
            // New event — claim it
            tx.set(eventRef, {
                event: event.event,
                eventId,
                status: 'processing',
                attempts: 1,
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            claimResult = 'claimed';
        });
    }
    catch (err) {
        functions.logger.error('Webhook idempotency transaction failed', { error: err.message });
        response.status(500).json({ status: 'error', message: 'Internal error' });
        return;
    }
    if (claimResult === 'already_processed') {
        response.status(200).json({ status: 'already_processed' });
        return;
    }
    if (claimResult === 'already_processing') {
        // Another instance is processing this event — safe to return success
        response.status(200).json({ status: 'already_processing' });
        return;
    }
    // Process the event (outside transaction)
    try {
        switch (event.event) {
            case razorpay_types_1.RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_AUTHENTICATED:
                await processSubscriptionAuthenticated(event.payload.subscription.entity);
                break;
            case razorpay_types_1.RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_ACTIVATED:
                await processSubscriptionActivated(event.payload.subscription.entity);
                break;
            case razorpay_types_1.RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_CHARGED:
                await processSubscriptionCharged(event.payload.subscription.entity);
                break;
            case razorpay_types_1.RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_PENDING:
                await processSubscriptionPending(event.payload.subscription.entity);
                break;
            case razorpay_types_1.RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_HALTED:
                await processSubscriptionHalted(event.payload.subscription.entity);
                break;
            case razorpay_types_1.RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_CANCELLED:
                await processSubscriptionCancelled(event.payload.subscription.entity);
                break;
            case razorpay_types_1.RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_COMPLETED:
                await processSubscriptionCompleted(event.payload.subscription.entity);
                break;
            case razorpay_types_1.RAZORPAY_WEBHOOK_EVENTS.PAYMENT_FAILED:
                await processPaymentFailed(event.payload.payment.entity);
                break;
            default:
                functions.logger.info('Unhandled webhook event', { event: event.event });
        }
        // Mark as processed
        await eventRef.update({
            status: 'processed',
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        response.status(200).json({ status: 'ok' });
    }
    catch (err) {
        functions.logger.error('Webhook processing failed', { event: event.event, error: err.message });
        // Mark as failed — allows Razorpay retry to re-claim
        await eventRef.update({
            status: 'failed',
            error: err.message?.substring(0, 500),
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });
        // Return 500 so Razorpay retries
        response.status(500).json({ status: 'error', message: 'Processing failed' });
    }
}
//# sourceMappingURL=webhook.js.map