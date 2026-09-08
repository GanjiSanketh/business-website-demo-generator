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

/**
 * Declare the global Razorpay constructor loaded from the Razorpay Checkout script.
 * The script is loaded dynamically when checkout is initiated.
 */
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: RazorpayPaymentResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayPaymentResponse {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: any) => void) => void;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private db: ReturnType<typeof getFirestore> | undefined;
  private dbInitialized = false;
  private razorpayScriptLoaded = false;

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
   */
  async loadCounts(): Promise<void> {
    const profile = this.userService.getProfile();
    if (!profile) return;

    this.countsLoading.set(true);
    try {
      const db = await this.getDb();
      const businessesRef = collection(db, 'businesses');

      const totalQuery = query(
        businessesRef,
        where('ownerId', '==', profile.uid),
      );
      const totalSnapshot = await getDocs(totalQuery);
      this._businessCount.set(totalSnapshot.size);

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

  // ---------------------------------------------------------------------------
  // Razorpay Checkout
  // ---------------------------------------------------------------------------

  /**
   * Load the Razorpay Checkout script from checkout.razorpay.com.
   * Only loads once; subsequent calls are no-ops.
   */
  private loadRazorpayScript(): Promise<void> {
    if (this.razorpayScriptLoaded && typeof window !== 'undefined' && window.Razorpay) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Razorpay Checkout is only available in the browser.'));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        this.razorpayScriptLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Razorpay Checkout script.'));
      document.head.appendChild(script);
    });
  }

  /**
   * Initiate Razorpay Checkout for upgrading to the specified plan.
   *
   * Flow:
   * 1. Call createCheckoutSession Cloud Function → get Razorpay subscription ID
   * 2. Load Razorpay Checkout script
   * 3. Open Razorpay Checkout modal with subscription_id
   * 4. On payment success, the webhook will confirm activation
   * 5. Return a promise that resolves when the modal closes
   *
   * NOTE: A successful payment callback does NOT immediately activate the
   * subscription. Activation happens via the server-side webhook.
   * The client shows a "processing" state until the user refreshes or
   * the profile updates in real-time.
   */
  async startCheckout(planId: PlanId): Promise<void> {
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

    // Step 1: Create Razorpay subscription via Cloud Function
    const functions = getFunctions(apps[0]);
    const createCheckoutSession = httpsCallable<
      { planId: PlanId },
      { subscriptionId?: string; razorpayKeyId?: string; planId?: string; error?: string }
    >(functions, 'createCheckoutSessionFn');

    const result = await createCheckoutSession({ planId });

    if (result.data.error) {
      throw new Error(result.data.error);
    }

    if (!result.data.subscriptionId || !result.data.razorpayKeyId) {
      throw new Error('No subscription returned from server. Please try again.');
    }

    // Step 2: Load Razorpay Checkout script
    await this.loadRazorpayScript();

    // Step 3: Open Razorpay Checkout with subscription_id
    return new Promise<void>((resolve, reject) => {
      const options: RazorpayOptions = {
        key: result.data.razorpayKeyId!,
        subscription_id: result.data.subscriptionId!,
        name: PLAN_METADATA[planId].name,
        description: `Upgrade to ${PLAN_METADATA[planId].name} Plan`,
        handler: (_response: RazorpayPaymentResponse) => {
          // Payment successful — webhook will confirm activation
          resolve();
        },
        prefill: {
          name: profile.displayName || '',
          email: profile.email || '',
        },
        theme: {
          color: '#0d6efd',
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled.'));
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (response: { error: { description: string } }) => {
        reject(new Error(response.error?.description || 'Payment failed.'));
      });
      razorpay.open();
    });
  }

  /**
   * Cancel the user's subscription.
   */
  async cancelSubscription(): Promise<void> {
    const apps = getApps();
    if (apps.length === 0) throw new Error('Firebase is not initialized.');

    const functions = getFunctions(apps[0]);
    const cancelFn = httpsCallable<
      { cancelAtCycleEnd?: boolean },
      { success: boolean; error?: string }
    >(functions, 'cancelSubscription');

    const result = await cancelFn({ cancelAtCycleEnd: true });

    if (result.data.error) {
      throw new Error(result.data.error);
    }
  }
}
