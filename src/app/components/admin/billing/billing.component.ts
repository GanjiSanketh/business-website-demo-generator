import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SubscriptionService } from '../../../services/subscription.service';
import { UserService } from '../../../services/user.service';
import { PlanId, PlanDefinition, PLAN_LIMITS } from '../../../models/user.model';

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

  /** Subscription status display. */
  subscriptionStatus = computed(() => {
    const status = this.profile()?.subscriptionStatus;
    if (!status) return 'Active';
    return status.charAt(0).toUpperCase() + status.slice(1);
  });

  isSubscriptionActive = computed(() => {
    const status = this.profile()?.subscriptionStatus;
    return status === 'active' || status === 'trialing';
  });

  checkoutLoading = signal(false);
  checkoutError = signal('');
  portalLoading = signal(false);

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
    // Load actual counts if not already loaded
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

    try {
      const url = await this.subscriptionService.startCheckout(planId);
      window.location.href = url;
    } catch (err: any) {
      const message = err?.message || 'Failed to start checkout. Please try again.';
      // Show user-friendly message for unimplemented Stripe
      if (message.includes('unimplemented') || message.includes('not yet configured')) {
        this.checkoutError.set('Stripe payment integration will be available in Phase 5 Part 2B. For now, you are on the Free plan with unlimited admin access.');
      } else {
        this.checkoutError.set(message);
      }
    } finally {
      this.checkoutLoading.set(false);
    }
  }

  async openPortal(): Promise<void> {
    this.portalLoading.set(true);
    try {
      const url = await this.subscriptionService.openCustomerPortal();
      window.location.href = url;
    } catch (err: any) {
      const message = err?.message || 'Failed to open billing portal.';
      if (message.includes('unimplemented') || message.includes('not yet configured')) {
        alert('Stripe billing portal will be available in Phase 5 Part 2B.');
      } else {
        alert(message);
      }
    } finally {
      this.portalLoading.set(false);
    }
  }

  onDowngrade(planId: PlanId): void {
    if (this.isCurrentPlan(planId)) return;
    alert('Downgrade logic will be available in Phase 5 Part 2B.');
  }
}