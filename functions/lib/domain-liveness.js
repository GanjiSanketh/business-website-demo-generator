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
exports.checkCustomDomainLive = checkCustomDomainLive;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const https = __importStar(require("node:https"));
const promises_1 = require("node:dns/promises");
const node_net_1 = require("node:net");
const auth_1 = require("./auth");
/**
 * Marker every page served by this application contains in <head>
 * (src/index.html). A custom domain is only considered LIVE when an HTTPS
 * GET to its root returns this application's own markup — ownership
 * verification (TXT) alone is never enough.
 */
const APP_MARKER = 'name="application-name" content="Business Demo Generator"';
/** RFC 1918 / loopback / link-local / CGNAT / IPv6-private ranges. */
function isPrivateIp(address) {
    if ((0, node_net_1.isIP)(address) === 4) {
        const parts = address.split('.').map(Number);
        if (parts[0] === 10)
            return true;
        if (parts[0] === 127)
            return true;
        if (parts[0] === 0)
            return true;
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
            return true; // CGNAT
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
            return true;
        if (parts[0] === 192 && parts[1] === 168)
            return true;
        if (parts[0] === 169 && parts[1] === 254)
            return true; // link-local
        return false;
    }
    if ((0, node_net_1.isIP)(address) === 6) {
        const lower = address.toLowerCase();
        if (lower === '::1')
            return true;
        if (lower.startsWith('fe80'))
            return true; // link-local
        if (lower.startsWith('fc') || lower.startsWith('fd'))
            return true; // ULA
        if (lower.startsWith('::ffff:127'))
            return true;
        if (lower.startsWith('::ffff:10.'))
            return true;
        if (lower.startsWith('::ffff:192.168.'))
            return true;
        if (lower.startsWith('::ffff:172.16.') || lower.startsWith('::ffff:172.17.') || lower.startsWith('::ffff:172.18.') || lower.startsWith('::ffff:172.19.') || lower.startsWith('::ffff:172.20.') || lower.startsWith('::ffff:172.21.') || lower.startsWith('::ffff:172.22.') || lower.startsWith('::ffff:172.23.') || lower.startsWith('::ffff:172.24.') || lower.startsWith('::ffff:172.25.') || lower.startsWith('::ffff:172.26.') || lower.startsWith('::ffff:172.27.') || lower.startsWith('::ffff:172.28.') || lower.startsWith('::ffff:172.29.') || lower.startsWith('::ffff:172.30.') || lower.startsWith('::ffff:172.31.'))
            return true;
        return false;
    }
    return true; // unresolvable / unknown format — treat as unsafe
}
/**
 * Probes https://<domain>/ and reports whether this application's demo page
 * is actually being served for the business. Never trusts a bare 200: the
 * body must contain the app marker and the business' demo URL.
 */
async function probeDomain(domain, slug, timeoutMs) {
    // SSRF guard: only probe public addresses.
    let validatedAddress;
    let validatedFamily;
    try {
        const result = await (0, promises_1.lookup)(domain, { verbatim: true });
        validatedAddress = result.address;
        validatedFamily = result.family;
    }
    catch {
        return {
            ok: false,
            reason: 'The domain does not resolve. Point its DNS (A/CNAME record) at Firebase Hosting, then try again.',
        };
    }
    if (isPrivateIp(validatedAddress)) {
        return { ok: false, reason: 'The domain resolves to a private address and cannot be probed.' };
    }
    return new Promise((resolve) => {
        const req = https.get({
            hostname: domain,
            // DNS-rebinding guard: pin the actual connection to the address
            // validated above. The socket is tied to the checked public IP while
            // TLS/SNI still use the real hostname (certificate validation is
            // unchanged), so a hostile DNS flip between validation and connection
            // cannot redirect the probe to an internal address.
            lookup: (_hostname, _options, callback) => {
                callback(null, validatedAddress, validatedFamily);
            },
            path: '/',
            headers: {
                'User-Agent': 'BusinessDemoGenerator-LiveCheck/1.0',
                Accept: 'text/html,application/xhtml+xml',
            },
        }, (res) => {
            const chunks = [];
            let size = 0;
            res.on('data', (chunk) => {
                size += chunk.length;
                if (size <= 512_000)
                    chunks.push(chunk);
            });
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                if (res.statusCode !== 200) {
                    resolve({
                        ok: false,
                        reason: `The domain responded with HTTP ${res.statusCode}. Add the domain to Firebase Hosting and point DNS at it first.`,
                    });
                    return;
                }
                if (!body.includes(APP_MARKER)) {
                    resolve({
                        ok: false,
                        reason: 'The domain is not serving this application. Add it to Firebase Hosting and point DNS at it, then try again.',
                    });
                    return;
                }
                if (!body.includes(`/demo/${slug}`)) {
                    resolve({
                        ok: false,
                        reason: 'The domain is serving the application but not this business\' demo. Verify the domain is mapped to this business.',
                    });
                    return;
                }
                resolve({ ok: true, reason: '' });
            });
        });
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve({
                ok: false,
                reason: 'Connection timed out. The domain may not be pointed at Firebase Hosting yet (DNS changes can take time to propagate).',
            });
        });
        req.on('error', (err) => {
            resolve({
                ok: false,
                reason: `Could not reach the domain over HTTPS: ${err.code || err.message}`,
            });
        });
    });
}
/**
 * Checks whether a verified custom domain is actually live — i.e. an HTTPS
 * request to https://<domain>/ successfully serves the published demo of the
 * owning business.
 *
 * This is the only way a domain transitions from 'verified' (ownership
 * proven via TXT) to 'live' (the application demonstrably answers on it).
 * The transition is NOT automatic: the operator must first add the domain to
 * Firebase Hosting (console/CLI) and point the domain's DNS at Firebase
 * Hosting. This function then confirms the result end-to-end.
 */
async function checkCustomDomainLive(request) {
    await (0, auth_1.checkAuthorization)(request.auth);
    const { businessId } = request.data;
    if (!businessId) {
        throw new functions.https.HttpsError('invalid-argument', 'businessId is required');
    }
    const db = admin.firestore();
    const businessRef = db.collection('businesses').doc(businessId);
    const snap = await businessRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Business not found');
    }
    const data = snap.data();
    const customDomain = data.customDomain;
    if (!customDomain?.domain) {
        throw new functions.https.HttpsError('failed-precondition', 'No custom domain configured for this business');
    }
    if (customDomain.status === 'live') {
        return { live: true, status: 'live', message: 'This domain is already live.' };
    }
    if (customDomain.status !== 'verified') {
        throw new functions.https.HttpsError('failed-precondition', 'Domain ownership must be verified before checking live status');
    }
    if (data.status !== 'published') {
        throw new functions.https.HttpsError('failed-precondition', 'Publish the business first — the domain can only go live for a published business');
    }
    const slug = data.slug;
    if (!slug) {
        throw new functions.https.HttpsError('failed-precondition', 'Business has no slug; publish it first');
    }
    const { ok, reason } = await probeDomain(customDomain.domain, slug, 10_000);
    if (!ok) {
        return {
            live: false,
            status: 'verified',
            message: reason,
        };
    }
    await businessRef.update({
        'customDomain.status': 'live',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        live: true,
        status: 'live',
        message: 'Live! https://' +
            customDomain.domain +
            ' is serving this business. Visitors reaching the domain are routed to the demo page.',
    };
}
//# sourceMappingURL=domain-liveness.js.map