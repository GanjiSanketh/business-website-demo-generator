import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { verifyCustomDomain } from './domain-verification';
import { VerifyCustomDomainRequest, VerifyCustomDomainResponse } from './domain-verification';

admin.initializeApp();

/**
 * Callable function to verify a custom domain by checking DNS TXT records.
 * 
 * Requires authentication and authorization.
 * Verifies business ownership and domain ownership via DNS.
 */
export const verifyCustomDomainFn = functions.https.onCall<VerifyCustomDomainRequest, VerifyCustomDomainResponse>(verifyCustomDomain);