import * as functions from 'firebase-functions/v2';
/**
 * Callable function to verify a custom domain by checking DNS TXT records.
 */
export declare const verifyCustomDomainFn: functions.https.CallableFunction<import("./domain-verification").VerifyCustomDomainRequest, Promise<import("./domain-verification").VerifyCustomDomainResponse>, unknown>;
/**
 * Callable function that probes a verified custom domain over HTTPS.
 */
export declare const checkCustomDomainLiveFn: functions.https.CallableFunction<import("./domain-liveness").CheckCustomDomainLiveRequest, Promise<import("./domain-liveness").CheckCustomDomainLiveResponse>, unknown>;
/**
 * Creates a Razorpay subscription for upgrading to a paid plan.
 * Returns subscription details for client-side Razorpay Checkout.
 */
export declare const createCheckoutSessionFn: functions.https.CallableFunction<import("./checkout").CreateCheckoutRequest, Promise<import("./checkout").CreateCheckoutResponse>, unknown>;
/**
 * Returns the current subscription status for the authenticated user.
 */
export declare const getSubscriptionStatusFn: functions.https.CallableFunction<import("./subscription").GetSubscriptionStatusRequest, Promise<import("./subscription").SubscriptionStatusResponse>, unknown>;
/**
 * Cancels the user's subscription via Razorpay API.
 */
export declare const cancelSubscriptionFn: functions.https.CallableFunction<import("./subscription").CancelSubscriptionRequest, Promise<import("./subscription").CancelSubscriptionResponse>, unknown>;
/**
 * Checks whether the user can perform a specific operation given their plan limits.
 */
export declare const checkPlanLimitFn: functions.https.CallableFunction<import("./enforcement").CheckPlanLimitRequest, Promise<import("./enforcement").PlanLimitResult>, unknown>;
/**
 * Returns the current usage summary for the authenticated user.
 */
export declare const getUsageFn: functions.https.CallableFunction<import("./enforcement").GetUsageRequest, Promise<import("./enforcement").UsageResponse>, unknown>;
/**
 * Server-authoritative business creation.
 * Enforces plan limits before writing to Firestore.
 */
export declare const createBusinessServerFn: functions.https.CallableFunction<import("./enforcement-callables").BusinessCreateRequest, Promise<import("./enforcement-callables").BusinessCreateResponse>, unknown>;
/**
 * Server-authoritative business publishing.
 * Enforces published business limit before writing to Firestore.
 */
export declare const publishBusinessServerFn: functions.https.CallableFunction<import("./enforcement-callables").BusinessPublishRequest, Promise<import("./enforcement-callables").BusinessPublishResponse>, unknown>;
/**
 * Server-authoritative custom domain connection.
 * Enforces custom domain limit before writing to Firestore.
 */
export declare const connectCustomDomainServerFn: functions.https.CallableFunction<import("./enforcement-callables").CustomDomainRequest, Promise<import("./enforcement-callables").CustomDomainResponse>, unknown>;
/**
 * Razorpay webhook endpoint. Receives POST requests from Razorpay.
 * Verifies webhook signature and processes subscription events.
 *
 * Configure this URL in your Razorpay Dashboard:
 *   https://<region>-<project>.cloudfunctions.net/razorpayWebhook
 */
export declare const razorpayWebhook: functions.https.HttpsFunction;
/**
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR application.
 */
export declare const ssr: functions.https.HttpsFunction;
//# sourceMappingURL=index.d.ts.map