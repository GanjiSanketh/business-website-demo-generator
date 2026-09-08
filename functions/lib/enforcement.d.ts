/**
 * Plan enforcement Cloud Functions.
 *
 * Server-side enforcement of plan limits for business operations.
 * These functions are called before critical operations to verify
 * that the user's plan allows the action.
 *
 * Security:
 * - Requires authenticated user
 * - Uses Admin SDK for all Firestore queries (bypasses client-side rules)
 * - Returns enforcement result without modifying any data
 * - The calling code is responsible for acting on the result
 */
import { CallableRequest } from './auth';
import { PlanId } from './entitlements';
export interface CheckPlanLimitRequest {
    /** The operation to check: 'createBusiness', 'publishBusiness', 'addCustomDomain'. */
    operation: 'createBusiness' | 'publishBusiness' | 'addCustomDomain';
    /** Business id (required for publish check to exclude the current business). */
    businessId?: string;
}
export interface PlanLimitResult {
    allowed: boolean;
    reason?: string;
    currentCount?: number;
    limit?: number | null;
    plan: PlanId;
    businessCount?: number;
    publishedCount?: number;
    customDomainCount?: number;
}
export interface GetUsageRequest {
    /** Target user uid. If omitted, returns the caller's own usage. */
    targetUid?: string;
}
export interface UsageResponse {
    uid: string;
    plan: PlanId;
    businessCount: number;
    maxBusinesses: number | null;
    publishedCount: number;
    maxPublishedBusinesses: number | null;
    customDomainCount: number;
    maxCustomDomains: number | null;
    canCreateBusiness: boolean;
    canPublishBusiness: boolean;
    canAddCustomDomain: boolean;
}
/**
 * Check whether the authenticated user can perform a specific operation.
 * Returns the enforcement result without modifying any data.
 */
export declare function checkPlanLimit(request: CallableRequest<CheckPlanLimitRequest>): Promise<PlanLimitResult>;
/**
 * Get the current usage summary for a user.
 * Used by the billing page and dashboard to show accurate counts.
 */
export declare function getUsage(request: CallableRequest<GetUsageRequest>): Promise<UsageResponse>;
//# sourceMappingURL=enforcement.d.ts.map