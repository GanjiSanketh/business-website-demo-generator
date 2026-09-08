/**
 * Server-side enforcement callables for business CRUD operations.
 *
 * These Cloud Functions enforce plan limits atomically before writing to Firestore.
 * The client cannot bypass these checks because they run server-side with Admin SDK.
 *
 * Flow:
 * 1. Client sends business data to callable function
 * 2. Function verifies authentication
 * 3. Function loads user profile to get plan/subscription
 * 4. Function enforces plan limits (business count, published count, custom domains)
 * 5. If allowed, function writes to Firestore and returns document ID
 * 6. If denied, function throws HttpsError with reason
 */

import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { requireAuth, CallableRequest } from './auth';
import { PlanId, PLAN_METADATA, PLAN_LIMITS } from './entitlements';
import { enforceSubscriptionActive } from './entitlements';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessCreateRequest {
  businessName: string;
  category?: string;
  templateId?: string;
  tagline?: string;
  description?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  services?: string[];
  slug?: string;
  status?: 'draft' | 'published';
  logoUrl?: string;
  images?: string[];
  themeId?: string;
  themeOptions?: Record<string, any>;
  testimonials?: any[];
  faqs?: any[];
  socialLinks?: Record<string, string>;
  primaryCta?: any;
  announcement?: any;
  businessHours?: any;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  socialImageUrl?: string;
  faviconUrl?: string;
}

export interface BusinessCreateResponse {
  id?: string;
  error?: string;
}

export interface BusinessPublishRequest {
  businessId: string;
}

export interface BusinessPublishResponse {
  success?: boolean;
  error?: string;
}

export interface CustomDomainRequest {
  businessId: string;
  domain: string;
}

export interface CustomDomainResponse {
  domain?: string;
  status?: string;
  verificationToken?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load user profile and enforce subscription is active.
 * Returns user data or throws if subscription is not valid.
 */
async function loadAndEnforceSubscription(uid: string): Promise<{ userData: any; plan: PlanId }> {
  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found.');
  }

  const userData = userDoc.data()!;
  const plan = (userData.plan as PlanId) || 'free';
  const status = userData.subscriptionStatus || 'inactive';

  // Admin users bypass all checks
  const isAdmin = userData.isAdmin === true;
  if (!isAdmin) {
    const subscriptionCheck = enforceSubscriptionActive(status as any, plan);
    if (!subscriptionCheck.allowed) {
      throw new functions.https.HttpsError('failed-precondition', subscriptionCheck.reason!);
    }
  }

  return { userData, plan };
}

// ---------------------------------------------------------------------------
// Create Business (server-authoritative)
// ---------------------------------------------------------------------------

/**
 * Server-authoritative business creation.
 *
 * Uses a Firestore transaction to atomically count existing businesses
 * and create the new one, preventing race conditions.
 */
export async function createBusinessFn(
  request: CallableRequest<BusinessCreateRequest>
): Promise<BusinessCreateResponse> {
  const { uid } = await requireAuth(request.auth);
  const data = request.data;

  if (!data.businessName || data.businessName.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Business name is required.');
  }

  const { userData, plan } = await loadAndEnforceSubscription(uid);
  const isAdmin = userData.isAdmin === true;

  const db = admin.firestore();
  const businessesRef = db.collection('businesses');
  const status = data.status || 'draft';

  // Build document data (deterministic — no serverTimestamp inside tx)
  const slug = data.slug || data.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const docData: Record<string, any> = {
    ownerId: uid,
    businessName: data.businessName.trim(),
    category: data.category || '',
    templateId: data.templateId || '',
    tagline: data.tagline || '',
    description: data.description || '',
    phone: data.phone || '',
    whatsapp: data.whatsapp || '',
    address: data.address || '',
    services: data.services || [],
    slug,
    status,
  };

  const optionalFields = [
    'logoUrl', 'images', 'themeId', 'themeOptions', 'testimonials',
    'faqs', 'socialLinks', 'primaryCta', 'announcement', 'businessHours',
    'seoTitle', 'seoDescription', 'seoKeywords', 'socialImageUrl', 'faviconUrl',
  ];

  for (const field of optionalFields) {
    const value = (data as any)[field];
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && Object.keys(value).length === 0) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      docData[field] = value;
    }
  }

  // Atomic: count existing + create in one transaction
  const docRef = await db.runTransaction(async (tx) => {
    // Read all user businesses to count (transactions require reading before write)
    const userBizSnap = await tx.get(businessesRef.where('ownerId', '==', uid));
    const currentCount = userBizSnap.size;

    // Enforce business count limit
    if (!isAdmin) {
      const limit = PLAN_LIMITS[plan].maxBusinesses;
      if (limit !== null && currentCount >= limit) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Your ${PLAN_METADATA[plan].name} plan allows ${limit} business${limit === 1 ? '' : 'es'}. Upgrade to create more.`
        );
      }
    }

    // Enforce published business limit if creating as published
    if (status === 'published' && !isAdmin) {
      const publishedCount = userBizSnap.docs.filter(d => d.data().status === 'published').length;
      const pubLimit = PLAN_LIMITS[plan].maxPublishedBusinesses;
      if (pubLimit !== null && publishedCount >= pubLimit) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Your ${PLAN_METADATA[plan].name} plan allows ${pubLimit} published business${pubLimit === 1 ? '' : 'es'}. Upgrade to publish more.`
        );
      }
    }

    // Create the document
    const now = admin.firestore.FieldValue.serverTimestamp();
    const newRef = businessesRef.doc();
    tx.set(newRef, {
      ...docData,
      createdAt: now,
      updatedAt: now,
      ...(status === 'published' ? { publishedAt: now } : {}),
    });
    return newRef;
  });

  functions.logger.info('Business created (server-enforced, atomic)', {
    uid,
    businessId: docRef.id,
    plan,
    status,
  });

  return { id: docRef.id };
}

// ---------------------------------------------------------------------------
// Publish Business (server-authoritative)
// ---------------------------------------------------------------------------

/**
 * Server-authoritative business publishing.
 *
 * Uses a Firestore transaction to atomically count published businesses
 * and publish the target, preventing race conditions.
 */
export async function publishBusinessFn(
  request: CallableRequest<BusinessPublishRequest>
): Promise<BusinessPublishResponse> {
  const { uid } = await requireAuth(request.auth);
  const { businessId } = request.data;

  if (!businessId) {
    throw new functions.https.HttpsError('invalid-argument', 'Business ID is required.');
  }

  const { userData, plan } = await loadAndEnforceSubscription(uid);
  const isAdmin = userData.isAdmin === true;

  const db = admin.firestore();
  const businessesRef = db.collection('businesses');
  const businessRef = businessesRef.doc(businessId);

  // Atomic: read business + count published + publish in one transaction
  await db.runTransaction(async (tx) => {
    const businessDoc = await tx.get(businessRef);

    if (!businessDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Business not found.');
    }

    const businessData = businessDoc.data()!;

    // Ownership check (admin bypasses)
    if (!isAdmin && businessData.ownerId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'You do not own this business.');
    }

    // Already published — idempotent
    if (businessData.status === 'published') {
      return;
    }

    // Enforce published business limit
    if (!isAdmin) {
      const userBizSnap = await tx.get(businessesRef.where('ownerId', '==', uid));
      const publishedCount = userBizSnap.docs.filter(d => d.data().status === 'published').length;
      const limit = PLAN_LIMITS[plan].maxPublishedBusinesses;
      if (limit !== null && publishedCount >= limit) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Your ${PLAN_METADATA[plan].name} plan allows ${limit} published business${limit === 1 ? '' : 'es'}. Upgrade to publish more.`
        );
      }
    }

    // Publish
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.update(businessRef, {
      status: 'published',
      publishedAt: now,
      updatedAt: now,
    });
  });

  functions.logger.info('Business published (server-enforced, atomic)', {
    uid,
    businessId,
    plan,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Connect Custom Domain (server-authoritative)
// ---------------------------------------------------------------------------

/**
 * Server-authoritative custom domain connection.
 *
 * Uses a Firestore transaction to atomically check domain limits,
 * uniqueness, and connect the domain.
 */
export async function connectCustomDomainFn(
  request: CallableRequest<CustomDomainRequest>
): Promise<CustomDomainResponse> {
  const { uid } = await requireAuth(request.auth);
  const { businessId, domain } = request.data;

  if (!businessId || !domain) {
    throw new functions.https.HttpsError('invalid-argument', 'Business ID and domain are required.');
  }

  // Normalize and validate domain
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!normalized || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(normalized)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid domain format.');
  }

  const { userData, plan } = await loadAndEnforceSubscription(uid);
  const isAdmin = userData.isAdmin === true;

  const db = admin.firestore();
  const businessesRef = db.collection('businesses');
  const businessRef = businessesRef.doc(businessId);

  // Generate verification token (deterministic for transaction)
  const verificationToken = `v-domain-verification-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

  // Atomic: ownership + domain limit + uniqueness + connect in one transaction
  await db.runTransaction(async (tx) => {
    const businessDoc = await tx.get(businessRef);

    if (!businessDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Business not found.');
    }

    if (!isAdmin && businessDoc.data()!.ownerId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'You do not own this business.');
    }

    // Enforce custom domain limit
    if (!isAdmin) {
      const userBizSnap = await tx.get(businessesRef.where('ownerId', '==', uid));
      const domainCount = userBizSnap.docs.filter(d => {
        const cd = d.data().customDomain;
        return cd?.domain && cd?.status !== 'disabled';
      }).length;
      const limit = PLAN_LIMITS[plan].customDomains;
      if (limit !== null && domainCount >= limit) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `Your ${PLAN_METADATA[plan].name} plan allows ${limit} custom domain${limit === 1 ? '' : 's'}. Upgrade to add more.`
        );
      }
    }

    // Domain uniqueness — check for active domains with same hostname
    const conflictSnap = await tx.get(
      businessesRef
        .where('customDomain.domain', '==', normalized)
        .where('customDomain.status', 'in', ['pending', 'verified', 'live'])
    );
    const conflict = conflictSnap.docs.find(d => d.id !== businessId);
    if (conflict) {
      throw new functions.https.HttpsError('already-exists', 'This domain is already connected to another business.');
    }

    // Connect domain
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.update(businessRef, {
      customDomain: {
        domain: normalized,
        status: 'pending',
        verificationToken,
        verifiedAt: null,
      },
      updatedAt: now,
    });
  });

  functions.logger.info('Custom domain connected (server-enforced, atomic)', {
    uid,
    businessId,
    domain: normalized,
    plan,
  });

  return {
    domain: normalized,
    status: 'pending',
    verificationToken,
  };
}
