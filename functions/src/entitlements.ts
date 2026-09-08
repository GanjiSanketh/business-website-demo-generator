/**
 * Shared entitlements module — server-side plan definitions and enforcement.
 *
 * This file mirrors the plan architecture from src/app/models/user.model.ts
 * so Cloud Functions can enforce limits without importing Angular code.
 *
 * IMPORTANT: When plan definitions change in user.model.ts, this file MUST
 * be updated to stay in sync.
 */

import * as admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Plan types (mirrored from user.model.ts)
// ---------------------------------------------------------------------------

export type PlanId = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'active' | 'trialing' | 'inactive' | 'cancelled' | 'past_due';

export interface PlanLimits {
  maxBusinesses: number | null;
  maxPublishedBusinesses: number | null;
  customDomains: number | null;
  aiGenerationsPerMonth: number | null;
}

export interface PlanFeatures {
  premiumTemplates: boolean;
  customDomain: boolean;
  advancedAnalytics: boolean;
  removeBranding: boolean;
  aiGeneration: boolean;
}

export interface PlanMetadata {
  id: PlanId;
  name: string;
  price: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Plan definitions (MUST stay in sync with user.model.ts)
// ---------------------------------------------------------------------------

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    maxBusinesses: 1,
    maxPublishedBusinesses: 1,
    customDomains: 0,
    aiGenerationsPerMonth: 0,
  },
  pro: {
    maxBusinesses: 5,
    maxPublishedBusinesses: 5,
    customDomains: 2,
    aiGenerationsPerMonth: 20,
  },
  business: {
    maxBusinesses: null,
    maxPublishedBusinesses: null,
    customDomains: null,
    aiGenerationsPerMonth: 100,
  },
};

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    premiumTemplates: false,
    customDomain: false,
    advancedAnalytics: false,
    removeBranding: false,
    aiGeneration: false,
  },
  pro: {
    premiumTemplates: true,
    customDomain: true,
    advancedAnalytics: true,
    removeBranding: true,
    aiGeneration: true,
  },
  business: {
    premiumTemplates: true,
    customDomain: true,
    advancedAnalytics: true,
    removeBranding: true,
    aiGeneration: true,
  },
};

export const PLAN_METADATA: Record<PlanId, PlanMetadata> = {
  free: { id: 'free', name: 'Free', price: 0, description: 'Perfect for trying out the platform' },
  pro: { id: 'pro', name: 'Pro', price: 29, description: 'For growing businesses and freelancers' },
  business: { id: 'business', name: 'Business', price: 99, description: 'For agencies and teams' },
};

export const PLAN_IDS: PlanId[] = ['free', 'pro', 'business'];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function isUnlimited(value: number | null): boolean {
  return value === null;
}

/**
 * Check whether a user can perform an action given the current count and plan limit.
 */
export function canPerform(currentCount: number, limit: number | null): boolean {
  if (limit === null) return true; // unlimited
  return currentCount < limit;
}

/**
 * Get the number of remaining uses for a given limit.
 */
export function getRemaining(currentCount: number, limit: number | null): number | null {
  if (limit === null) return null; // unlimited
  return Math.max(0, limit - currentCount);
}

// ---------------------------------------------------------------------------
// Server-side count queries (using Admin SDK)
// ---------------------------------------------------------------------------

/**
 * Count businesses for a user. Admin sees all businesses; owner sees own.
 */
export async function countBusinesses(
  db: admin.firestore.Firestore,
  uid: string,
  isAdminUser: boolean
): Promise<number> {
  const businessesRef = db.collection('businesses');

  if (isAdminUser) {
    const snapshot = await businessesRef.count().get();
    return snapshot.data().count;
  }

  const snapshot = await businessesRef.where('ownerId', '==', uid).count().get();
  return snapshot.data().count;
}

/**
 * Count published businesses for a user.
 */
export async function countPublishedBusinesses(
  db: admin.firestore.Firestore,
  uid: string,
  isAdminUser: boolean
): Promise<number> {
  const businessesRef = db.collection('businesses');

  if (isAdminUser) {
    const snapshot = await businessesRef
      .where('status', '==', 'published')
      .count()
      .get();
    return snapshot.data().count;
  }

  const snapshot = await businessesRef
    .where('ownerId', '==', uid)
    .where('status', '==', 'published')
    .count()
    .get();
  return snapshot.data().count;
}

/**
 * Count active custom domains for a user.
 * Custom domains with status 'disabled' are not counted.
 */
export async function countCustomDomains(
  db: admin.firestore.Firestore,
  uid: string,
  isAdminUser: boolean
): Promise<number> {
  const businessesRef = db.collection('businesses');

  let snapshot: admin.firestore.QuerySnapshot;

  if (isAdminUser) {
    snapshot = await businessesRef
      .where('customDomain.status', 'in', ['pending', 'verified', 'live'])
      .get();
  } else {
    snapshot = await businessesRef
      .where('ownerId', '==', uid)
      .where('customDomain.status', 'in', ['pending', 'verified', 'live'])
      .get();
  }

  return snapshot.size;
}

// ---------------------------------------------------------------------------
// Plan enforcement checks
// ---------------------------------------------------------------------------

export interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number | null;
}

/**
 * Enforce business creation limit. Admin users bypass this check.
 */
export async function enforceBusinessCreationLimit(
  db: admin.firestore.Firestore,
  uid: string,
  plan: PlanId,
  isAdminUser: boolean
): Promise<EnforcementResult> {
  if (isAdminUser) {
    return { allowed: true };
  }

  const limit = PLAN_LIMITS[plan].maxBusinesses;
  if (isUnlimited(limit)) {
    return { allowed: true };
  }

  const currentCount = await countBusinesses(db, uid, false);
  if (currentCount >= limit!) {
    return {
      allowed: false,
      reason: `Your ${PLAN_METADATA[plan].name} plan allows ${limit} business${limit === 1 ? '' : 'es'}. Upgrade to create more.`,
      currentCount,
      limit,
    };
  }

  return { allowed: true, currentCount, limit };
}

/**
 * Enforce published business limit.
 */
export async function enforcePublishedLimit(
  db: admin.firestore.Firestore,
  uid: string,
  plan: PlanId,
  isAdminUser: boolean
): Promise<EnforcementResult> {
  if (isAdminUser) {
    return { allowed: true };
  }

  const limit = PLAN_LIMITS[plan].maxPublishedBusinesses;
  if (isUnlimited(limit)) {
    return { allowed: true };
  }

  const currentCount = await countPublishedBusinesses(db, uid, false);
  if (currentCount >= limit!) {
    return {
      allowed: false,
      reason: `Your ${PLAN_METADATA[plan].name} plan allows ${limit} published business${limit === 1 ? '' : 'es'}. Upgrade to publish more.`,
      currentCount,
      limit,
    };
  }

  return { allowed: true, currentCount, limit };
}

/**
 * Enforce custom domain limit.
 */
export async function enforceCustomDomainLimit(
  db: admin.firestore.Firestore,
  uid: string,
  plan: PlanId,
  isAdminUser: boolean
): Promise<EnforcementResult> {
  if (isAdminUser) {
    return { allowed: true };
  }

  const limit = PLAN_LIMITS[plan].customDomains;
  if (isUnlimited(limit)) {
    return { allowed: true };
  }

  const currentCount = await countCustomDomains(db, uid, false);
  if (currentCount >= limit!) {
    return {
      allowed: false,
      reason: `Your ${PLAN_METADATA[plan].name} plan allows ${limit} custom domain${limit === 1 ? '' : 's'}. Upgrade to add more.`,
      currentCount,
      limit,
    };
  }

  return { allowed: true, currentCount, limit };
}

/**
 * Check whether the subscription status allows the operation.
 * Only 'active' and 'trialing' statuses allow business operations.
 * Free plan users are always allowed — they have no paid subscription to enforce.
 */
export function enforceSubscriptionActive(status: SubscriptionStatus, plan: PlanId): EnforcementResult {
  if (plan === 'free') {
    return { allowed: true };
  }
  if (status === 'active' || status === 'trialing') {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Your subscription is ${status}. Please update your payment method to continue.`,
  };
}
