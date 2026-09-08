"use strict";
/**
 * Shared entitlements module — server-side plan definitions and enforcement.
 *
 * This file mirrors the plan architecture from src/app/models/user.model.ts
 * so Cloud Functions can enforce limits without importing Angular code.
 *
 * IMPORTANT: When plan definitions change in user.model.ts, this file MUST
 * be updated to stay in sync.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_IDS = exports.PLAN_METADATA = exports.PLAN_FEATURES = exports.PLAN_LIMITS = void 0;
exports.isPlanUpgrade = isPlanUpgrade;
exports.isUnlimited = isUnlimited;
exports.canPerform = canPerform;
exports.getRemaining = getRemaining;
exports.countBusinesses = countBusinesses;
exports.countPublishedBusinesses = countPublishedBusinesses;
exports.countCustomDomains = countCustomDomains;
exports.enforceBusinessCreationLimit = enforceBusinessCreationLimit;
exports.enforcePublishedLimit = enforcePublishedLimit;
exports.enforceCustomDomainLimit = enforceCustomDomainLimit;
exports.enforceSubscriptionActive = enforceSubscriptionActive;
// ---------------------------------------------------------------------------
// Plan definitions (MUST stay in sync with user.model.ts)
// ---------------------------------------------------------------------------
exports.PLAN_LIMITS = {
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
exports.PLAN_FEATURES = {
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
exports.PLAN_METADATA = {
    free: { id: 'free', name: 'Free', price: 0, description: 'Perfect for trying out the platform' },
    pro: { id: 'pro', name: 'Pro', price: 29, description: 'For growing businesses and freelancers' },
    business: { id: 'business', name: 'Business', price: 99, description: 'For agencies and teams' },
};
exports.PLAN_IDS = ['free', 'pro', 'business'];
// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------
const PLAN_HIERARCHY = ['free', 'pro', 'business'];
/**
 * Check whether a plan change constitutes an upgrade (vs. downgrade or same).
 */
function isPlanUpgrade(currentPlan, targetPlan) {
    return PLAN_HIERARCHY.indexOf(targetPlan) > PLAN_HIERARCHY.indexOf(currentPlan);
}
function isUnlimited(value) {
    return value === null;
}
/**
 * Check whether a user can perform an action given the current count and plan limit.
 */
function canPerform(currentCount, limit) {
    if (limit === null)
        return true; // unlimited
    return currentCount < limit;
}
/**
 * Get the number of remaining uses for a given limit.
 */
function getRemaining(currentCount, limit) {
    if (limit === null)
        return null; // unlimited
    return Math.max(0, limit - currentCount);
}
// ---------------------------------------------------------------------------
// Server-side count queries (using Admin SDK)
// ---------------------------------------------------------------------------
/**
 * Count businesses for a user. Admin sees all businesses; owner sees own.
 */
async function countBusinesses(db, uid, isAdminUser) {
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
async function countPublishedBusinesses(db, uid, isAdminUser) {
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
async function countCustomDomains(db, uid, isAdminUser) {
    const businessesRef = db.collection('businesses');
    let snapshot;
    if (isAdminUser) {
        snapshot = await businessesRef
            .where('customDomain.status', 'in', ['pending', 'verified', 'live'])
            .get();
    }
    else {
        snapshot = await businessesRef
            .where('ownerId', '==', uid)
            .where('customDomain.status', 'in', ['pending', 'verified', 'live'])
            .get();
    }
    return snapshot.size;
}
/**
 * Enforce business creation limit. Admin users bypass this check.
 */
async function enforceBusinessCreationLimit(db, uid, plan, isAdminUser) {
    if (isAdminUser) {
        return { allowed: true };
    }
    const limit = exports.PLAN_LIMITS[plan].maxBusinesses;
    if (isUnlimited(limit)) {
        return { allowed: true };
    }
    const currentCount = await countBusinesses(db, uid, false);
    if (currentCount >= limit) {
        return {
            allowed: false,
            reason: `Your ${exports.PLAN_METADATA[plan].name} plan allows ${limit} business${limit === 1 ? '' : 'es'}. Upgrade to create more.`,
            currentCount,
            limit,
        };
    }
    return { allowed: true, currentCount, limit };
}
/**
 * Enforce published business limit.
 */
async function enforcePublishedLimit(db, uid, plan, isAdminUser) {
    if (isAdminUser) {
        return { allowed: true };
    }
    const limit = exports.PLAN_LIMITS[plan].maxPublishedBusinesses;
    if (isUnlimited(limit)) {
        return { allowed: true };
    }
    const currentCount = await countPublishedBusinesses(db, uid, false);
    if (currentCount >= limit) {
        return {
            allowed: false,
            reason: `Your ${exports.PLAN_METADATA[plan].name} plan allows ${limit} published business${limit === 1 ? '' : 'es'}. Upgrade to publish more.`,
            currentCount,
            limit,
        };
    }
    return { allowed: true, currentCount, limit };
}
/**
 * Enforce custom domain limit.
 */
async function enforceCustomDomainLimit(db, uid, plan, isAdminUser) {
    if (isAdminUser) {
        return { allowed: true };
    }
    const limit = exports.PLAN_LIMITS[plan].customDomains;
    if (isUnlimited(limit)) {
        return { allowed: true };
    }
    const currentCount = await countCustomDomains(db, uid, false);
    if (currentCount >= limit) {
        return {
            allowed: false,
            reason: `Your ${exports.PLAN_METADATA[plan].name} plan allows ${limit} custom domain${limit === 1 ? '' : 's'}. Upgrade to add more.`,
            currentCount,
            limit,
        };
    }
    return { allowed: true, currentCount, limit };
}
/**
 * Check whether the subscription status allows the operation.
 * Only 'active' status allows business operations.
 * Free plan users are always allowed — they have no paid subscription to enforce.
 */
function enforceSubscriptionActive(status, plan) {
    if (plan === 'free') {
        return { allowed: true };
    }
    if (status === 'active') {
        return { allowed: true };
    }
    return {
        allowed: false,
        reason: `Your subscription is ${status}. Please update your payment method to continue.`,
    };
}
//# sourceMappingURL=entitlements.js.map