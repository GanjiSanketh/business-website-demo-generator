import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SubscriptionService } from '../../../services/subscription.service';
import { UserService } from '../../../services/user.service';
import { PlanId, PlanDefinition, PLAN_LIMITS, isUnlimited } from '../../../models/user.model';

interface FeatureEntry {
  key: keyof ReturnType<SubscriptionService['currentPlanFeatures']>;
  label: string;
  enabled: boolean;
}

interface PlanFeatureEntry {
  key: keyof PlanDefinition['features'];
  label: string;
  enabled: boolean;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.css',
})
export class BillingComponent implements OnInit {
  subscriptionService = inject(SubscriptionService);
  userService = inject(UserService);

  currentPlan = computed(() => this.subscriptionService.currentPlan());
  currentPlanMetadata = computed(() => this.subscriptionService.currentPlanMetadata());
  currentPlanLimits = computed(() => this.subscriptionService.currentPlanLimits());
  currentPlanFeatures = computed(() => this.subscriptionService.currentPlanFeatures());
  isAdmin = computed(() => this.userService.isAdmin());
  profile = computed(() => this.userService.profile());

  plans = computed(() => this.subscriptionService.getAllPlans());

  /** Real usage counts from Firestore. */
  businessCount = computed(() => this.subscriptionService.getBusinessCount());
  publishedCount = computed(() => this.subscriptionService.getPublishedBusinessCount());
  customDomainCount = computed(() => this.subscriptionService.getCustomDomainCount());
  countsLoading = computed(() => this.subscriptionService.countsLoading());

  /** Subscription status display. */
  subscriptionStatus = computed(() => {
    const status = this.profile()?.subscriptionStatus;
    if (!status) return 'Active';
    return status.charAt(0).toUpperCase() + status.slice(1);
  });

  isSubscriptionActive = computed(() => {
    const status = this.profile()?.subscriptionStatus;
    return status === 'active';
  });

  isSubscriptionPastDue = computed(() => {
    return this.profile()?.subscriptionStatus === 'past_due';
  });

  isSubscriptionCancelled = computed(() => {
    return this.profile()?.subscriptionStatus === 'cancelled';
  });

  isSubscriptionInactive = computed(() => {
    return this.profile()?.subscriptionStatus === 'inactive';
  });

  cancelAtPeriodEnd = computed(() => {
    return this.profile()?.subscription?.cancelAtPeriodEnd === true;
  });

  renewalDate = computed(() => {
    const end = this.profile()?.subscription?.currentPeriodEnd;
    if (!end) return null;
    try {
      const date = end instanceof Date ? end : end.toDate?.() || new Date(end as any);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return null;
    }
  });

  subscriptionInterval = computed(() => {
    return this.profile()?.subscription?.interval || null;
  });

  /** Progress percentages for usage display (0-100, or null for unlimited). */
  businessProgress = computed(() => {
    const limit = this.currentPlanLimits().maxBusinesses;
    if (isUnlimited(limit) || limit === null) return null;
    if (limit === 0) return 0;
    return Math.min(100, Math.round((this.businessCount() / limit) * 100));
  });

  publishedProgress = computed(() => {
    const limit = this.currentPlanLimits().maxPublishedBusinesses;
    if (isUnlimited(limit) || limit === null) return null;
    if (limit === 0) return 0;
    return Math.min(100, Math.round((this.publishedCount() / limit) * 100));
  });

  domainProgress = computed(() => {
    const limit = this.currentPlanLimits().customDomains;
    if (isUnlimited(limit) || limit === null) return null;
    if (limit === 0) return 0;
    return Math.min(100, Math.round((this.customDomainCount() / limit) * 100));
  });

  businessLimitReached = computed(() => {
    if (this.isAdmin()) return false;
    const limit = this.currentPlanLimits().maxBusinesses;
    if (isUnlimited(limit) || limit === null) return false;
    return this.businessCount() >= limit;
  });

  publishedLimitReached = computed(() => {
    if (this.isAdmin()) return false;
    const limit = this.currentPlanLimits().maxPublishedBusinesses;
    if (isUnlimited(limit) || limit === null) return false;
    return this.publishedCount() >= limit;
  });

  domainLimitReached = computed(() => {
    if (this.isAdmin()) return false;
    const limit = this.currentPlanLimits().customDomains;
    if (isUnlimited(limit) || limit === null) return false;
    return this.customDomainCount() >= limit;
  });

  upgradeTarget = computed(() => {
    const hierarchy: PlanId[] = ['free', 'pro', 'business'];
    const idx = hierarchy.indexOf(this.currentPlan());
    if (idx < 0 || idx >= hierarchy.length - 1) return null;
    return hierarchy[idx + 1];
  });

  checkoutLoading = signal(false);
  checkoutError = signal('');
  checkoutSuccess = signal('');
  manageLoading = signal(false);

  readonly featureEntries: FeatureEntry[] = [
    { key: 'premiumTemplates', label: 'Premium Templates', enabled: false },
    { key: 'customDomain', label: 'Custom Domain', enabled: false },
    { key: 'advancedAnalytics', label: 'Advanced Analytics', enabled: false },
    { key: 'removeBranding', label: 'Remove Branding', enabled: false },
    { key: 'aiGeneration', label: 'AI Generation', enabled: false },
  ];

  private recomputeFeatureEntries(features: ReturnType<SubscriptionService['currentPlanFeatures']>): FeatureEntry[] {
    return this.featureEntries.map(f => ({
      ...f,
      enabled: features[f.key],
    }));
  }

  currentFeatures = computed(() => this.recomputeFeatureEntries(this.currentPlanFeatures()));

  planEntries(plan: PlanDefinition): PlanFeatureEntry[] {
    const features = plan.features;
    return [
      { key: 'premiumTemplates', label: 'Premium Templates', enabled: features.premiumTemplates },
      { key: 'customDomain', label: 'Custom Domain', enabled: features.customDomain },
      { key: 'advancedAnalytics', label: 'Advanced Analytics', enabled: features.advancedAnalytics },
      { key: 'removeBranding', label: 'Remove Branding', enabled: features.removeBranding },
      { key: 'aiGeneration', label: 'AI Generation', enabled: features.aiGeneration },
    ];
  }

  ngOnInit(): void {
    if (this.businessCount() === 0 && this.publishedCount() === 0) {
      this.subscriptionService.loadCounts();
    }
  }

  getPlanIcon(planId: PlanId): string {
    switch (planId) {
      case 'free': return 'bi-shield';
      case 'pro': return 'bi-star';
      case 'business': return 'bi-gem';
      default: return 'bi-shield';
    }
  }

  formatPrice(price: number): string {
    return price === 0 ? 'Free' : `$${price}/month`;
  }

  isCurrentPlan(planId: PlanId): boolean {
    return this.currentPlan() === planId;
  }

  canUpgradeTo(planId: PlanId): boolean {
    if (this.isAdmin()) return true;
    const hierarchy: PlanId[] = ['free', 'pro', 'business'];
    const currentIndex = hierarchy.indexOf(this.currentPlan());
    const targetIndex = hierarchy.indexOf(planId);
    return targetIndex > currentIndex;
  }

  getRemainingBusinesses(): number | null {
    return this.subscriptionService.getRemainingBusinessCount();
  }

  getRemainingPublished(): number | null {
    return this.subscriptionService.getRemainingPublishedBusinessCount();
  }

  getRemainingDomains(): number | null {
    return this.subscriptionService.getRemainingCustomDomains();
  }

  async onUpgrade(planId: PlanId): Promise<void> {
    if (this.isCurrentPlan(planId)) return;
    if (this.isAdmin()) {
      alert('Admin accounts have unlimited access to all plans.');
      return;
    }

    this.checkoutLoading.set(true);
    this.checkoutError.set('');
    this.checkoutSuccess.set('');

    try {
      await this.subscriptionService.startCheckout(planId);
      this.checkoutSuccess.set(
        'Payment successful! Your subscription is being activated. This may take a moment.'
      );
      setTimeout(() => {
        this.subscriptionService.loadCounts();
      }, 3000);
    } catch (err: any) {
      const message = err?.message || 'Failed to start checkout. Please try again.';
      if (message.includes('cancelled') || message.includes('dismissed')) {
        // User cancelled — no error needed
      } else if (message.includes('not configured')) {
        this.checkoutError.set('Payment is not yet configured. Please contact support.');
      } else {
        this.checkoutError.set(message);
      }
    } finally {
      this.checkoutLoading.set(false);
    }
  }

  async onCancelSubscription(): Promise<void> {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of the billing cycle.')) {
      return;
    }

    this.manageLoading.set(true);
    try {
      await this.subscriptionService.cancelSubscription();
      this.checkoutSuccess.set('Subscription cancelled. You will retain access until the end of the billing cycle.');
    } catch (err: any) {
      this.checkoutError.set(err?.message || 'Failed to cancel subscription.');
    } finally {
      this.manageLoading.set(false);
    }
  }

  onDowngrade(planId: PlanId): void {
    if (this.isCurrentPlan(planId)) return;
    alert('Downgrades are not supported through the billing page. Please contact support.');
  }

  getProgressClass(progress: number | null): string {
    if (progress === null) return '';
    if (progress >= 100) return 'progress-full';
    if (progress >= 80) return 'progress-warning';
    return '';
  }
}
