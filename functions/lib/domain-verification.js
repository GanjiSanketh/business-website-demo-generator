"use strict";
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
exports.verifyCustomDomain = verifyCustomDomain;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const promises_1 = require("dns/promises");
const ALLOWED_EMAILS = ['gsanketh7121@gmail.com'];
const VERIFICATION_TXT_HOST = '_demosite-verification';
const VERIFICATION_TXT_PREFIX = 'demosite-verification=';
/**
 * Validates that the user is authenticated and authorized.
 */
async function checkAuthorization(auth) {
    if (!auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const email = auth.token.email;
    if (!email || !ALLOWED_EMAILS.includes(email)) {
        throw new functions.https.HttpsError('permission-denied', 'You are not authorized to verify this domain');
    }
    return { uid: auth.uid, email };
}
/**
 * Normalizes a domain to lowercase hostname without protocol/trailing slash.
 */
function normalizeDomain(input) {
    if (!input || typeof input !== 'string')
        return null;
    let domain = input.trim();
    if (!domain)
        return null;
    if (/^(javascript|data):/i.test(domain))
        return null;
    try {
        if (domain.includes('://')) {
            const url = new URL(domain);
            if (url.protocol !== 'http:' && url.protocol !== 'https:')
                return null;
            if (url.pathname !== '/' && url.pathname !== '')
                return null;
            if (url.search)
                return null;
            if (url.hash)
                return null;
            domain = url.hostname;
        }
        else {
            if (domain.includes('/') || domain.includes('?') || domain.includes('#'))
                return null;
        }
    }
    catch {
        return null;
    }
    domain = domain.replace(/\.$/, '').toLowerCase();
    return domain || null;
}
/**
 * Validates domain hostname per RFC 1123/952.
 */
function isValidDomainHostname(domain) {
    if (!domain || typeof domain !== 'string')
        return false;
    if (domain.trim() === '')
        return false;
    if (domain === 'localhost')
        return false;
    if (domain === '127.0.0.1')
        return false;
    if (domain === '::1')
        return false;
    if (domain.endsWith('.localhost'))
        return false;
    if (domain.endsWith('.local'))
        return false;
    if (domain.endsWith('.internal'))
        return false;
    if (domain.match(/^10\./))
        return false;
    if (domain.match(/^192\.168\./))
        return false;
    if (domain.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./))
        return false;
    if (domain.length > 253)
        return false;
    const labels = domain.split('.');
    if (labels.length < 2)
        return false;
    for (const label of labels) {
        if (label.length === 0 || label.length > 63)
            return false;
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label))
            return false;
    }
    const tld = labels[labels.length - 1];
    if (/^\d+$/.test(tld))
        return false;
    return true;
}
/**
 * Queries DNS for TXT records at the verification subdomain.
 * Returns the matching verification token if found, null otherwise.
 */
async function queryVerificationTxtRecord(domain, expectedToken) {
    const txtHost = `${VERIFICATION_TXT_HOST}.${domain}`;
    const expectedValue = `${VERIFICATION_TXT_PREFIX}${expectedToken}`;
    try {
        const records = await (0, promises_1.resolveTxt)(txtHost);
        // resolveTxt returns string[][] - each inner array is the chunks of one TXT record
        for (const record of records) {
            const fullValue = record.join('');
            if (fullValue === expectedValue) {
                return fullValue;
            }
        }
        return null;
    }
    catch (err) {
        // DNS lookup failed - could be NXDOMAIN, timeout, SERVFAIL, etc.
        const code = err?.code;
        if (code === 'ENOTFOUND' || code === 'ENODATA') {
            // No TXT record found - this is expected during propagation
            return null;
        }
        // Other DNS errors - rethrow to be handled by caller
        throw new Error(`DNS lookup failed: ${err?.message || 'Unknown error'}`);
    }
}
/**
 * Checks if another business already has this domain verified.
 */
async function checkVerifiedDomainConflict(db, domain, excludeBusinessId) {
    const snapshot = await db
        .collection('businesses')
        .where('customDomain.domain', '==', domain)
        .where('customDomain.status', '==', 'verified')
        .limit(1)
        .get();
    if (snapshot.empty)
        return false;
    const existingDoc = snapshot.docs[0];
    return existingDoc.id !== excludeBusinessId;
}
/**
 * Main callable function handler for custom domain verification.
 * Uses v2 CallableRequest format: handler(request) where request.data has the typed payload.
 */
async function verifyCustomDomain(request) {
    // 1. Check authentication and authorization
    const { uid } = await checkAuthorization(request.auth);
    // 2. Validate input
    const { businessId, domain } = request.data;
    if (!businessId || !domain) {
        throw new functions.https.HttpsError('invalid-argument', 'businessId and domain are required');
    }
    // 3. Normalize domain
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain || !isValidDomainHostname(normalizedDomain)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid domain format');
    }
    const db = admin.firestore();
    // 4. Load business document
    const businessRef = db.collection('businesses').doc(businessId);
    const businessSnap = await businessRef.get();
    if (!businessSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Business not found');
    }
    const businessData = businessSnap.data();
    const customDomain = businessData.customDomain;
    // 5. Verify business ownership (the authenticated user must own this business)
    // In this app, business ownership is determined by the ALLOWED_EMAILS list
    // Since we already checked authorization against ALLOWED_EMAILS, we trust this.
    // If multi-user support is added later, add business.ownerUid check here.
    // 6. Check custom domain configuration exists
    if (!customDomain) {
        throw new functions.https.HttpsError('failed-precondition', 'No custom domain configured for this business');
    }
    // 7. Verify domain matches
    if (customDomain.domain !== normalizedDomain) {
        throw new functions.https.HttpsError('failed-precondition', 'Domain does not match configured domain');
    }
    // 8. Verify status is pending
    if (customDomain.status !== 'pending') {
        if (customDomain.status === 'verified') {
            throw new functions.https.HttpsError('failed-precondition', 'Domain is already verified');
        }
        throw new functions.https.HttpsError('failed-precondition', 'Domain is not in pending state');
    }
    // 9. Check verification token exists
    const verificationToken = customDomain.verificationToken;
    if (!verificationToken) {
        throw new functions.https.HttpsError('failed-precondition', 'No verification token available. Reconnect the domain first.');
    }
    // 10. Check for verified domain conflict with other businesses
    const hasConflict = await checkVerifiedDomainConflict(db, normalizedDomain, businessId);
    if (hasConflict) {
        throw new functions.https.HttpsError('already-exists', 'This domain is already verified for another business');
    }
    // 11. Query DNS for verification TXT record
    let txtRecordFound = false;
    let dnsError = null;
    try {
        const found = await queryVerificationTxtRecord(normalizedDomain, verificationToken);
        txtRecordFound = !!found;
    }
    catch (err) {
        dnsError = err instanceof Error ? err.message : 'DNS lookup failed';
        functions.logger.error('DNS verification error', { businessId, domain: normalizedDomain, error: dnsError });
    }
    // 12. If DNS lookup failed with an error (not just missing record), return error
    if (dnsError) {
        throw new functions.https.HttpsError('unavailable', 'Unable to check DNS right now. Please try again later.');
    }
    // 13. If TXT record not found, return pending status
    if (!txtRecordFound) {
        return {
            success: false,
            status: 'pending',
            error: 'We couldn\'t find the verification record yet. DNS changes can take time to propagate.',
            errorCode: 'verification-record-not-found',
        };
    }
    // 14. TXT record found - update business document
    const now = admin.firestore.FieldValue.serverTimestamp();
    await businessRef.update({
        'customDomain.status': 'verified',
        'customDomain.verifiedAt': now,
        'customDomain.verificationToken': admin.firestore.FieldValue.delete(),
        updatedAt: now,
    });
    return {
        success: true,
        status: 'verified',
    };
}
//# sourceMappingURL=domain-verification.js.map