import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import * as https from 'node:https';
import { lookup } from 'node:dns/promises';
import type { LookupAddress, LookupOptions } from 'node:dns';
import { isIP } from 'node:net';
import { requireAuth, CallableRequest } from './auth';

export interface CheckCustomDomainLiveRequest {
  businessId: string;
}

export interface CheckCustomDomainLiveResponse {
  live: boolean;
  status?: 'verified' | 'live';
  message?: string;
}

const APP_MARKER = 'name="application-name" content="Business Demo Generator"';

function isPrivateIp(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    return false;
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fe80')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('::ffff:127')) return true;
    if (lower.startsWith('::ffff:10.')) return true;
    if (lower.startsWith('::ffff:192.168.')) return true;
    if (lower.startsWith('::ffff:172.16.') || lower.startsWith('::ffff:172.17.') || lower.startsWith('::ffff:172.18.') || lower.startsWith('::ffff:172.19.') || lower.startsWith('::ffff:172.20.') || lower.startsWith('::ffff:172.21.') || lower.startsWith('::ffff:172.22.') || lower.startsWith('::ffff:172.23.') || lower.startsWith('::ffff:172.24.') || lower.startsWith('::ffff:172.25.') || lower.startsWith('::ffff:172.26.') || lower.startsWith('::ffff:172.27.') || lower.startsWith('::ffff:172.28.') || lower.startsWith('::ffff:172.29.') || lower.startsWith('::ffff:172.30.') || lower.startsWith('::ffff:172.31.')) return true;
    return false;
  }
  return true;
}

async function probeDomain(
  domain: string,
  slug: string,
  timeoutMs: number
): Promise<{ ok: boolean; reason: string }> {
  let validatedAddress: string;
  let validatedFamily: number;
  try {
    const result = await lookup(domain, { verbatim: true });
    validatedAddress = result.address;
    validatedFamily = result.family;
  } catch {
    return {
      ok: false,
      reason:
        'The domain does not resolve. Point its DNS (A/CNAME record) at Firebase Hosting, then try again.',
    };
  }
  if (isPrivateIp(validatedAddress)) {
    return { ok: false, reason: 'The domain resolves to a private address and cannot be probed.' };
  }

  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: domain,
        lookup: (
          _hostname: string,
          _options: LookupOptions,
          callback: (
            err: NodeJS.ErrnoException | null,
            address: string | LookupAddress[],
            family?: number
          ) => void
        ) => {
          callback(null, validatedAddress, validatedFamily);
        },
        path: '/',
        headers: {
          'User-Agent': 'BusinessDemoGenerator-LiveCheck/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size <= 512_000) chunks.push(chunk);
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
      }
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({
        ok: false,
        reason:
          'Connection timed out. The domain may not be pointed at Firebase Hosting yet (DNS changes can take time to propagate).',
      });
    });
    req.on('error', (err: NodeJS.ErrnoException) => {
      resolve({
        ok: false,
        reason: `Could not reach the domain over HTTPS: ${err.code || err.message}`,
      });
    });
  });
}

export async function checkCustomDomainLive(
  request: CallableRequest<CheckCustomDomainLiveRequest>
): Promise<CheckCustomDomainLiveResponse> {
  const { uid } = await requireAuth(request.auth);

  const { businessId } = request.data;
  if (!businessId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'businessId is required'
    );
  }

  const db = admin.firestore();
  const businessRef = db.collection('businesses').doc(businessId);
  const snap = await businessRef.get();

  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Business not found');
  }

  const data = snap.data()!;

  // Check ownership (admin or owner)
  const userDoc = await db.collection('users').doc(uid).get();
  const isAdmin = userDoc.exists && userDoc.data()?.role === 'admin';
  if (!isAdmin && data.ownerId !== uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not own this business'
    );
  }

  const customDomain = data.customDomain;

  if (!customDomain?.domain) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No custom domain configured for this business'
    );
  }

  if (customDomain.status === 'live') {
    return { live: true, status: 'live', message: 'This domain is already live.' };
  }

  if (customDomain.status !== 'verified') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Domain ownership must be verified before checking live status'
    );
  }

  if (data.status !== 'published') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Publish the business first — the domain can only go live for a published business'
    );
  }

  const slug = data.slug;
  if (!slug) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Business has no slug; publish it first'
    );
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
    message:
      'Live! https://' +
      customDomain.domain +
      ' is serving this business. Visitors reaching the domain are routed to the demo page.',
  };
}