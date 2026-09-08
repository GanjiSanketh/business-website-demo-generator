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
  count,
} from 'firebase/firestore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
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

  /** Actual business counts queried from Firestore (replaces stub zeros). */
  private _businessCount = signal(0);
  private _publishedCount = signal(0);
  private _customDomainCount = signal(0);
  countsLoading = signal(false);

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
    return this._businessCount();
  }

  getPublishedBusinessCount(): number {
    return this._publishedCount();
  }

  getCustomDomainCount(): number {
    return this._customDomainCount();
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

  /**
   * Load actual business counts from Firestore.
   * Called once on dashboard init to replace the stub zeros with real data.
   */
  async loadCounts(): Promise<void> {
    const profile = this.userService.getProfile();
    if (!profile) return;

    this.countsLoading.set(true);
    try {
      const db = await this.getDb();
      const businessesRef = collection(db, 'businesses');

      // Total businesses for this user
      const totalQuery = query(
        businessesRef,
        where('ownerId', '==', profile.uid),
      );
      const totalSnapshot = await getDocs(totalQuery);
      this._businessCount.set(totalSnapshot.size);

      // Published businesses for this user
      let publishedCount = 0;
      let customDomainCount = 0;
      for (const docSnap of totalSnapshot.docs) {
        const data = docSnap.data();
        if (data['status'] === 'published') {
          publishedCount++;
        }
        if (data['customDomain']?.domain && data['customDomain']?.status !== 'disabled') {
          customDomainCount++;
        }
      }
      this._publishedCount.set(publishedCount);
      this._customDomainCount.set(customDomainCount);
    } catch (err) {
      console.error('[SubscriptionService] Failed to load business counts:', err);
    } finally {
      this.countsLoading.set(false);
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

  /**
   * Initiate a Stripe Checkout session for upgrading to the specified plan.
   * Calls the createCheckoutSession Cloud Function which returns a
   * Stripe Checkout Session URL. The user is redirected to Stripe.
   *
   * This method does NOT directly interact with Stripe — all Stripe
   * operations happen server-side in Cloud Functions.
   */
  async startCheckout(planId: PlanId): Promise<string> {
    const profile = this.userService.getProfile();
    if (!profile) {
      throw new Error('User profile not loaded. Please try again.');
    }

    if (planId === 'free') {
      throw new Error('Free plan does not require checkout.');
    }

    const apps = getApps();
    if (apps.length === 0) {
      throw new Error('Firebase is not initialized.');
    }

    const functions = getFunctions(apps[0]);
    const createCheckoutSession = httpsCallable<
      { planId: PlanId; email: string },
      { sessionId?: string; url?: string; error?: string }
    >(functions, 'createCheckoutSession');

    const result = await createCheckoutSession({
      planId,
      email: profile.email,
    });

    if (result.data.error) {
      throw new Error(result.data.error);
    }

    if (!result.data.url) {
      throw new Error('No checkout URL returned. Please try again.');
    }

    return result.data.url;
  }

  /**
   * Open the Stripe Customer Portal for managing the current subscription.
   * Used for cancel, update payment method, view invoices, etc.
   */
  async openCustomerPortal(): Promise<string> {
    const apps = getApps();
    if (apps.length === 0) {
      throw new Error('Firebase is not initialized.');
    }

    const functions = getFunctions(apps[0]);
    const createPortalSession = httpsCallable<
      { returnUrl: string },
      { url?: string; error?: string }
    >(functions, 'createPortalSession');

    const returnUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/admin/billing`
      : '/admin/billing';

    const result = await createPortalSession({ returnUrl });

    if (result.data.error) {
      throw new Error(result.data.error);
    }

    if (!result.data.url) {
      throw new Error('No portal URL returned. Please try again.');
    }

    return result.data.url;
  }
}