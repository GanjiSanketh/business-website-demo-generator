import { Timestamp } from 'firebase/firestore';

export type UserRole = 'user' | 'admin';
export type PlanId = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'active' | 'trialing' | 'inactive' | 'cancelled' | 'past_due';
export type SubscriptionInterval = 'monthly' | 'yearly';

export interface UserSubscription {
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  /** Stripe subscription id (e.g. "sub_xxx"). Set by Cloud Functions. */
  stripeSubscriptionId?: string;
  /** Stripe price id (e.g. "price_xxx"). Set by Cloud Functions. */
  stripePriceId?: string;
  /** Billing interval. Derived from Stripe price by Cloud Functions. */
  interval?: SubscriptionInterval;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;

  role: UserRole;
  plan: PlanId;

  subscriptionStatus: SubscriptionStatus;

  createdAt: Timestamp;
  updatedAt: Timestamp;

  subscription?: UserSubscription;

  /**
   * Stripe customer id (e.g. "cus_xxx"). Created on first checkout.
   * Only settable by Cloud Functions with Admin SDK — Firestore rules
   * block client writes to this field.
   */
  stripeCustomerId?: string;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  description: string;
  features: {
    premiumTemplates: boolean;
    customDomain: boolean;
    advancedAnalytics: boolean;
    removeBranding: boolean;
    aiGeneration: boolean;
  };
}

export const DEFAULT_USER_PROFILE: Omit<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'createdAt' | 'updatedAt'> = {
  role: 'user',
  plan: 'free',
  subscriptionStatus: 'active',
};

export interface UserUsage {
  month: string;
  aiGenerations: number;
  businessesCreated: number;
  publishedBusinesses: number;
  customDomainsUsed: number;
  updatedAt: Timestamp;
}

export const PLAN_IDS: PlanId[] = ['free', 'pro', 'business'];

export const PLAN_LIMITS: Record<PlanId, {
  maxBusinesses: number | null;
  maxPublishedBusinesses: number | null;
  customDomains: number | null;
  aiGenerationsPerMonth: number | null;
}> = {
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

export const PLAN_FEATURES: Record<PlanId, {
  premiumTemplates: boolean;
  customDomain: boolean;
  advancedAnalytics: boolean;
  removeBranding: boolean;
  aiGeneration: boolean;
}> = {
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

export const PLAN_METADATA: Record<PlanId, {
  id: PlanId;
  name: string;
  price: number;
  description: string;
  /** Stripe price id for monthly billing. Populated in Part 2B. */
  stripePriceIdMonthly?: string;
  /** Stripe price id for yearly billing. Populated in Part 2B. */
  stripePriceIdYearly?: string;
}> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Perfect for trying out the platform',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    description: 'For growing businesses and freelancers',
    // stripePriceIdMonthly: 'price_pro_monthly_xxx',   // Part 2B
    // stripePriceIdYearly: 'price_pro_yearly_xxx',     // Part 2B
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 99,
    description: 'For agencies and teams',
    // stripePriceIdMonthly: 'price_business_monthly_xxx', // Part 2B
    // stripePriceIdYearly: 'price_business_yearly_xxx',   // Part 2B
  },
};

/**
 * Determine whether a plan upgrade is available from the given current plan.
 * Returns null if the plan is already the highest or unknown.
 */
export function getUpgradeTarget(currentPlan: PlanId): PlanId | null {
  const hierarchy: PlanId[] = ['free', 'pro', 'business'];
  const currentIndex = hierarchy.indexOf(currentPlan);
  if (currentIndex < 0 || currentIndex >= hierarchy.length - 1) return null;
  return hierarchy[currentIndex + 1];
}

/**
 * Check whether a plan change constitutes an upgrade (vs. downgrade or same).
 */
export function isPlanUpgrade(currentPlan: PlanId, targetPlan: PlanId): boolean {
  const hierarchy: PlanId[] = ['free', 'pro', 'business'];
  return hierarchy.indexOf(targetPlan) > hierarchy.indexOf(currentPlan);
}

export function isUnlimited(value: number | null): boolean {
  return value === null;
}

export function getRemainingLimit(current: number, limit: number | null): number | null {
  if (limit === null) return null;
  return Math.max(0, limit - current);
}

export function formatLimit(limit: number | null): string {
  return limit === null ? 'Unlimited' : limit.toString();
}