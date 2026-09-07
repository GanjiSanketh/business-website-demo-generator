import * as functions from 'firebase-functions/v2';
import { VerifyCustomDomainRequest, VerifyCustomDomainResponse } from './domain-verification';
/**
 * Callable function to verify a custom domain by checking DNS TXT records.
 *
 * Requires authentication and authorization.
 * Verifies business ownership and domain ownership via DNS.
 */
export declare const verifyCustomDomainFn: functions.https.CallableFunction<VerifyCustomDomainRequest, Promise<VerifyCustomDomainResponse>, unknown>;
//# sourceMappingURL=index.d.ts.map