import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SubscriptionService } from '../../../services/subscription.service';
import { UserService } from '../../../services/user.service';
import { PlanId, PlanDefinition } from '../../../models/user.model';

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
export class BillingComponent {
  subscriptionService = inject(SubscriptionService);
  userService = inject(UserService);

  currentPlan = computed(() => this.subscriptionService.currentPlan());
  currentPlanMetadata = computed(() => this.subscriptionService.currentPlanMetadata());
  currentPlanLimits = computed(() => this.subscriptionService.currentPlanLimits());
  currentPlanFeatures = computed(() => this.subscriptionService.currentPlanFeatures());
  isAdmin = computed(() => this.userService.isAdmin());

  plans = computed(() => this.subscriptionService.getAllPlans());

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
    const currentIndex = ['free', 'pro', 'business'].indexOf(this.currentPlan());
    const targetIndex = ['free', 'pro', 'business'].indexOf(planId);
    return targetIndex > currentIndex;
  }

  onUpgrade(planId: PlanId): void {
    if (this.isCurrentPlan(planId)) return;
    alert(`Payment integration coming in Phase 5 Part 2. This would redirect to Stripe checkout for ${planId} plan.`);
  }

  onDowngrade(planId: PlanId): void {
    if (this.isCurrentPlan(planId)) return;
    alert(`Downgrade logic coming in Phase 5 Part 2.`);
  }
}