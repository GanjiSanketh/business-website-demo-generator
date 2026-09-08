/**
 * Subscription status retrieval.
 *
 * Provides a Cloud Function that returns the current subscription status
 * for the authenticated user. Used by the frontend to get authoritative
 * subscription state.
 *
 * Security:
 * - Requires authenticated user
 * - Users can only read their own subscription status
 * - Admin users can read any user's subscription status
 */
import { CallableRequest } from './auth';
import { PlanId, SubscriptionStatus } from './entitlements';
export interface GetSubscriptionStatusRequest {
    /** Target user uid. If omitted, returns the caller's own status. */
    targetUid?: string;
}
export interface SubscriptionStatusResponse {
    uid: string;
    plan: PlanId;
    subscriptionStatus: SubscriptionStatus;
    planName: string;
    planPrice: number;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    isActive: boolean;
}
/**
 * Get subscription status for the authenticated user (or a target user for admins).
 */
export declare function getSubscriptionStatus(request: CallableRequest<GetSubscriptionStatusRequest>): Promise<SubscriptionStatusResponse>;
//# sourceMappingURL=subscription.d.ts.map