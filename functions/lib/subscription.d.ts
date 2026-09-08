/**
 * Subscription management Cloud Functions.
 *
 * Provides:
 * - getSubscriptionStatus: read current subscription state
 * - cancelSubscription: cancel a subscription via Razorpay
 *
 * Security:
 * - Requires authenticated user
 * - Users can only manage their own subscription
 * - Admins can manage any subscription
 * - All mutations go through Razorpay API (authoritative)
 */
import { CallableRequest } from './auth';
import { PlanId, SubscriptionStatus } from './entitlements';
export interface GetSubscriptionStatusRequest {
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
    paymentCustomerId?: string;
    providerSubscriptionId?: string;
    isActive: boolean;
}
export declare function getSubscriptionStatus(request: CallableRequest<GetSubscriptionStatusRequest>): Promise<SubscriptionStatusResponse>;
export interface CancelSubscriptionRequest {
    cancelAtCycleEnd?: boolean;
}
export interface CancelSubscriptionResponse {
    success: boolean;
    error?: string;
}
export declare function cancelSubscription(request: CallableRequest<CancelSubscriptionRequest>): Promise<CancelSubscriptionResponse>;
//# sourceMappingURL=subscription.d.ts.map