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
 * Firebase Hosting → Cloud Functions v2 rewrite target for the Angular SSR
 * application (see the hosting.rewrites block in firebase.json).
 */
export declare const ssr: functions.https.HttpsFunction;
//# sourceMappingURL=index.d.ts.map