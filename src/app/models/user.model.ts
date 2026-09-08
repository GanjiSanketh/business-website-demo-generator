import { Timestamp } from 'firebase/firestore';

export type UserRole = 'user' | 'admin';
export type PlanId = 'free' | 'pro' | 'business';
export type SubscriptionStatus = 'active' | 'trialing' | 'inactive' | 'cancelled';

export interface UserSubscription {
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
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
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 99,
    description: 'For agencies and teams',
  },
};

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