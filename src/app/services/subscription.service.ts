import { Injectable, signal, computed, inject } from '@angular/core';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  DocumentData,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  collection,
} from 'firebase/firestore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import {
  PlanId,
  UserProfile,
  UserUsage,
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLAN_METADATA,
  PLAN_IDS,
  isUnlimited,
  getRemainingLimit,
  formatLimit,
} from '../models/user.model';
import { getFirebaseConfig } from '../environment/environment';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private db: ReturnType<typeof getFirestore> | undefined;
  private dbInitialized = false;

  private authService = inject(AuthService);
  private userService = inject(UserService);

  usage = signal<UserUsage | null>(null);
  usageLoading = signal(false);

  currentPlan = computed(() => this.userService.currentPlan());
  currentPlanLimits = computed(() => PLAN_LIMITS[this.currentPlan()]);
  currentPlanFeatures = computed(() => PLAN_FEATURES[this.currentPlan()]);
  currentPlanMetadata = computed(() => PLAN_METADATA[this.currentPlan()]);
  isAdmin = computed(() => this.userService.isAdmin());

  readonly featureLabels = {
    premiumTemplates: 'Premium Templates',
    customDomain: 'Custom Domain',
    advancedAnalytics: 'Advanced Analytics',
    removeBranding: 'Remove Branding',
    aiGeneration: 'AI Generation',
  };

  private async getDb() {
    if (this.db && this.dbInitialized) {
      return this.db;
    }

    await this.authService.ready;

    try {
      const apps = getApps();
      if (apps.length === 0) {
        throw new Error('Firebase is not initialized');
      }
      this.db = getFirestore(apps[0]);
      this.dbInitialized = true;
      return this.db;
    } catch (err) {
      console.error('[SubscriptionService] Failed to initialize Firestore:', err);
      throw new Error('Firestore is not initialized. Please refresh and try again.');
    }
  }

  getCurrentPlan(): PlanId {
    return this.currentPlan();
  }

  getPlanDefinition(planId: PlanId) {
    return {
      id: planId,
      name: PLAN_METADATA[planId].name,
      price: PLAN_METADATA[planId].price,
      description: PLAN_METADATA[planId].description,
      limits: PLAN_LIMITS[planId],
      features: PLAN_FEATURES[planId],
    };
  }

  getAllPlans() {
    return PLAN_IDS.map((id) => this.getPlanDefinition(id));
  }

  canCreateBusiness(): boolean {
    if (this.isAdmin()) return true;
    const profile = this.userService.getProfile();
    if (!profile) return false;

    const limit = PLAN_LIMITS[profile.plan].maxBusinesses;
    if (limit === null) return true;
    const current = this.getBusinessCount();
    return current < limit;
  }

  canPublishBusiness(): boolean {
    if (this.isAdmin()) return true;
    const profile = this.userService.getProfile();
    if (!profile) return false;

    const limit = PLAN_LIMITS[profile.plan].maxPublishedBusinesses;
    if (limit === null) return true;
    return this.getPublishedBusinessCount() < limit;
  }

  canUseCustomDomain(): boolean {
    if (this.isAdmin()) return true;
    const profile = this.userService.getProfile();
    if (!profile) return false;

    const limit = PLAN_LIMITS[profile.plan].customDomains;
    if (limit === null) return true;
    return this.getCustomDomainCount() < limit;
  }

  canUsePremiumTemplate(): boolean {
    if (this.isAdmin()) return true;
    return PLAN_FEATURES[this.currentPlan()].premiumTemplates;
  }

  canUseAiGeneration(): boolean {
    if (this.isAdmin()) return true;
    return PLAN_FEATURES[this.currentPlan()].aiGeneration;
  }

  getRemainingBusinessCount(): number | null {
    if (this.isAdmin()) return null;
    const profile = this.userService.getProfile();
    if (!profile) return 0;

    const limit = PLAN_LIMITS[profile.plan].maxBusinesses;
    if (isUnlimited(limit)) return null;
    return getRemainingLimit(this.getBusinessCount(), limit);
  }

  getRemainingPublishedBusinessCount(): number | null {
    if (this.isAdmin()) return null;
    const profile = this.userService.getProfile();
    if (!profile) return 0;

    const limit = PLAN_LIMITS[profile.plan].maxPublishedBusinesses;
    if (isUnlimited(limit)) return null;
    return getRemainingLimit(this.getPublishedBusinessCount(), limit);
  }

  getRemainingCustomDomains(): number | null {
    if (this.isAdmin()) return null;
    const profile = this.userService.getProfile();
    if (!profile) return 0;

    const limit = PLAN_LIMITS[profile.plan].customDomains;
    if (isUnlimited(limit)) return null;
    return getRemainingLimit(this.getCustomDomainCount(), limit);
  }

  getRemainingAiGenerations(): number | null {
    if (this.isAdmin()) return null;
    const profile = this.userService.getProfile();
    if (!profile) return 0;

    const limit = PLAN_LIMITS[profile.plan].aiGenerationsPerMonth;
    if (isUnlimited(limit)) return null;
    return getRemainingLimit(this.getAiGenerationsThisMonth(), limit);
  }

  getBusinessCount(): number {
    return 0;
  }

  getPublishedBusinessCount(): number {
    return 0;
  }

  getCustomDomainCount(): number {
    return 0;
  }

  getAiGenerationsThisMonth(): number {
    const usage = this.usage();
    return usage?.aiGenerations ?? 0;
  }

  async loadUsage(): Promise<void> {
    const profile = this.userService.getProfile();
    if (!profile) return;

    this.usageLoading.set(true);
    try {
      const db = await this.getDb();
      const monthKey = new Date().toISOString().slice(0, 7);
      const usageRef = doc(db, 'users', profile.uid, 'usage', monthKey);
      const snapshot = await getDoc(usageRef);

      if (snapshot.exists()) {
        this.usage.set(snapshot.data() as UserUsage);
      } else {
        this.usage.set({
          month: monthKey,
          aiGenerations: 0,
          businessesCreated: 0,
          publishedBusinesses: 0,
          customDomainsUsed: 0,
          updatedAt: Timestamp.now(),
        });
      }
    } catch (err) {
      console.error('[SubscriptionService] Failed to load usage:', err);
    } finally {
      this.usageLoading.set(false);
    }
  }

  async incrementUsage(field: keyof Pick<UserUsage, 'aiGenerations' | 'businessesCreated' | 'publishedBusinesses' | 'customDomainsUsed'>): Promise<void> {
    const profile = this.userService.getProfile();
    if (!profile) return;

    const db = await this.getDb();
    const monthKey = new Date().toISOString().slice(0, 7);
    const usageRef = doc(db, 'users', profile.uid, 'usage', monthKey);
    const snapshot = await getDoc(usageRef);

    const now = Timestamp.now();
    const currentData = snapshot.exists() ? snapshot.data() : {
      month: monthKey,
      aiGenerations: 0,
      businessesCreated: 0,
      publishedBusinesses: 0,
      customDomainsUsed: 0,
      updatedAt: now,
    };

    const updates: DocumentData = {
      [field]: (currentData[field] ?? 0) + 1,
      updatedAt: now,
    };

    if (snapshot.exists()) {
      await updateDoc(usageRef, updates);
    } else {
      await setDoc(usageRef, { ...currentData, ...updates });
    }

    this.usage.set({ ...currentData, ...updates } as UserUsage);
  }

  formatLimit(limit: number | null): string {
    return formatLimit(limit);
  }

  getUpgradeUrl(): string {
    return '/admin/billing';
  }
}