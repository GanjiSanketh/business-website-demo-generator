import * as functions from 'firebase-functions/v2';
/**
 * Callable function to verify a custom domain by checking DNS TXT records.
 *
 * Requires authentication and authorization.
 * Verifies business ownership and domain ownership via DNS.
 */
export declare const verifyCustomDomainFn: functions.https.CallableFunction<import("./domain-verification").VerifyCustomDomainRequest, Promise<import("./domain-verification").VerifyCustomDomainResponse>, unknown>;
/**
 * Callable function that probes a verified custom domain over HTTPS and
 * flips it to 'live' when the application actually serves the business'
 * published demo on that domain.
 */
export declare const checkCustomDomainLiveFn: functions.https.CallableFunction<import("./domain-liveness").CheckCustomDomainLiveRequest, Promise<import("./domain-liveness").CheckCustomDomainLiveResponse>, unknown>;
/**
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 * Returns a URL that the user is redirected to for payment.
 *
 * Currently returns 'unimplemented' until Stripe SDK is added in Part 2B.
 */
export declare const createCheckoutSessionFn: functions.https.CallableFunction<import("./checkout").CreateCheckoutSessionRequest, Promise<import("./checkout").CreateCheckoutSessionResponse>, unknown>;
/**
 * Returns the current subscription status for the authenticated user.
 * Admins can query any user's status.
 */
export declare const getSubscriptionStatusFn: functions.https.CallableFunction<import("./subscription").GetSubscriptionStatusRequest, Promise<import("./subscription").SubscriptionStatusResponse>, unknown>;
/**
 * Checks whether the user can perform a specific operation given their plan limits.
 * Returns enforcement result without modifying any data.
 */
export declare const checkPlanLimitFn: functions.https.CallableFunction<import("./enforcement").CheckPlanLimitRequest, Promise<import("./enforcement").PlanLimitResult>, unknown>;
/**
 * Returns the current usage summary (business count, published count, etc.)
 * for the authenticated user. Used by billing and dashboard pages.
 */
export declare const getUsageFn: functions.https.CallableFunction<import("./enforcement").GetUsageRequest, Promise<import("./enforcement").UsageResponse>, unknown>;
/**
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR
 * application (see the hosting.rewrites block in firebase.json).
 */
export declare const ssr: functions.https.HttpsFunction;
//# sourceMappingURL=index.d.ts.map