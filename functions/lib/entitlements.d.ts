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
export type PlanId = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'past_due';
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
export declare const PLAN_LIMITS: Record<PlanId, PlanLimits>;
export declare const PLAN_FEATURES: Record<PlanId, PlanFeatures>;
export declare const PLAN_METADATA: Record<PlanId, PlanMetadata>;
export declare const PLAN_IDS: PlanId[];
/**
 * Check whether a plan change constitutes an upgrade (vs. downgrade or same).
 */
export declare function isPlanUpgrade(currentPlan: PlanId, targetPlan: PlanId): boolean;
export declare function isUnlimited(value: number | null): boolean;
/**
 * Check whether a user can perform an action given the current count and plan limit.
 */
export declare function canPerform(currentCount: number, limit: number | null): boolean;
/**
 * Get the number of remaining uses for a given limit.
 */
export declare function getRemaining(currentCount: number, limit: number | null): number | null;
/**
 * Count businesses for a user. Admin sees all businesses; owner sees own.
 */
export declare function countBusinesses(db: admin.firestore.Firestore, uid: string, isAdminUser: boolean): Promise<number>;
/**
 * Count published businesses for a user.
 */
export declare function countPublishedBusinesses(db: admin.firestore.Firestore, uid: string, isAdminUser: boolean): Promise<number>;
/**
 * Count active custom domains for a user.
 * Custom domains with status 'disabled' are not counted.
 */
export declare function countCustomDomains(db: admin.firestore.Firestore, uid: string, isAdminUser: boolean): Promise<number>;
export interface EnforcementResult {
    allowed: boolean;
    reason?: string;
    currentCount?: number;
    limit?: number | null;
}
/**
 * Enforce business creation limit. Admin users bypass this check.
 */
export declare function enforceBusinessCreationLimit(db: admin.firestore.Firestore, uid: string, plan: PlanId, isAdminUser: boolean): Promise<EnforcementResult>;
/**
 * Enforce published business limit.
 */
export declare function enforcePublishedLimit(db: admin.firestore.Firestore, uid: string, plan: PlanId, isAdminUser: boolean): Promise<EnforcementResult>;
/**
 * Enforce custom domain limit.
 */
export declare function enforceCustomDomainLimit(db: admin.firestore.Firestore, uid: string, plan: PlanId, isAdminUser: boolean): Promise<EnforcementResult>;
/**
 * Check whether the subscription status allows the operation.
 * Only 'active' status allows business operations.
 * Free plan users are always allowed — they have no paid subscription to enforce.
 */
export declare function enforceSubscriptionActive(status: SubscriptionStatus, plan: PlanId): EnforcementResult;
//# sourceMappingURL=entitlements.d.ts.map