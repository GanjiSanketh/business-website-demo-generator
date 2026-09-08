import { expect } from 'chai';
import {
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLAN_METADATA,
  PLAN_IDS,
  isPlanUpgrade,
  isUnlimited,
  canPerform,
  getRemaining,
  enforceSubscriptionActive,
} from '../src/entitlements';
import type { PlanId, SubscriptionStatus } from '../src/entitlements';

describe('Entitlements', () => {
  // ---------------------------------------------------------------------------
  // Plan definitions
  // ---------------------------------------------------------------------------

  describe('PLAN_LIMITS', () => {
    it('should define limits for all three plans', () => {
      expect(PLAN_LIMITS).to.have.all.keys('free', 'pro', 'business');
    });

    it('free plan should have restrictive limits', () => {
      expect(PLAN_LIMITS.free.maxBusinesses).to.equal(1);
      expect(PLAN_LIMITS.free.maxPublishedBusinesses).to.equal(1);
      expect(PLAN_LIMITS.free.customDomains).to.equal(0);
    });

    it('pro plan should have moderate limits', () => {
      expect(PLAN_LIMITS.pro.maxBusinesses).to.equal(5);
      expect(PLAN_LIMITS.pro.maxPublishedBusinesses).to.equal(5);
      expect(PLAN_LIMITS.pro.customDomains).to.equal(2);
    });

    it('business plan should have unlimited limits (null)', () => {
      expect(PLAN_LIMITS.business.maxBusinesses).to.be.null;
      expect(PLAN_LIMITS.business.maxPublishedBusinesses).to.be.null;
      expect(PLAN_LIMITS.business.customDomains).to.be.null;
    });
  });

  describe('PLAN_FEATURES', () => {
    it('free plan should have no premium features', () => {
      expect(PLAN_FEATURES.free.premiumTemplates).to.be.false;
      expect(PLAN_FEATURES.free.customDomain).to.be.false;
      expect(PLAN_FEATURES.free.advancedAnalytics).to.be.false;
      expect(PLAN_FEATURES.free.removeBranding).to.be.false;
      expect(PLAN_FEATURES.free.aiGeneration).to.be.false;
    });

    it('pro plan should have all premium features', () => {
      expect(PLAN_FEATURES.pro.premiumTemplates).to.be.true;
      expect(PLAN_FEATURES.pro.customDomain).to.be.true;
      expect(PLAN_FEATURES.pro.advancedAnalytics).to.be.true;
      expect(PLAN_FEATURES.pro.removeBranding).to.be.true;
      expect(PLAN_FEATURES.pro.aiGeneration).to.be.true;
    });

    it('business plan should have all premium features', () => {
      expect(PLAN_FEATURES.business.premiumTemplates).to.be.true;
      expect(PLAN_FEATURES.business.customDomain).to.be.true;
      expect(PLAN_FEATURES.business.advancedAnalytics).to.be.true;
      expect(PLAN_FEATURES.business.removeBranding).to.be.true;
      expect(PLAN_FEATURES.business.aiGeneration).to.be.true;
    });
  });

  describe('PLAN_METADATA', () => {
    it('should have correct pricing', () => {
      expect(PLAN_METADATA.free.price).to.equal(0);
      expect(PLAN_METADATA.pro.price).to.equal(29);
      expect(PLAN_METADATA.business.price).to.equal(99);
    });

    it('all plans should have required fields', () => {
      for (const planId of PLAN_IDS) {
        const meta = PLAN_METADATA[planId];
        expect(meta).to.have.property('id', planId);
        expect(meta).to.have.property('name').that.is.a('string');
        expect(meta).to.have.property('price').that.is.a('number');
        expect(meta).to.have.property('description').that.is.a('string');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Helper functions
  // ---------------------------------------------------------------------------

  describe('isPlanUpgrade', () => {
    it('free → pro should be an upgrade', () => {
      expect(isPlanUpgrade('free', 'pro')).to.be.true;
    });

    it('free → business should be an upgrade', () => {
      expect(isPlanUpgrade('free', 'business')).to.be.true;
    });

    it('pro → business should be an upgrade', () => {
      expect(isPlanUpgrade('pro', 'business')).to.be.true;
    });

    it('pro → free should not be an upgrade', () => {
      expect(isPlanUpgrade('pro', 'free')).to.be.false;
    });

    it('business → pro should not be an upgrade', () => {
      expect(isPlanUpgrade('business', 'pro')).to.be.false;
    });

    it('same plan should not be an upgrade', () => {
      expect(isPlanUpgrade('free', 'free')).to.be.false;
      expect(isPlanUpgrade('pro', 'pro')).to.be.false;
      expect(isPlanUpgrade('business', 'business')).to.be.false;
    });
  });

  describe('isUnlimited', () => {
    it('null should be unlimited', () => {
      expect(isUnlimited(null)).to.be.true;
    });

    it('0 should not be unlimited', () => {
      expect(isUnlimited(0)).to.be.false;
    });

    it('positive number should not be unlimited', () => {
      expect(isUnlimited(5)).to.be.false;
      expect(isUnlimited(100)).to.be.false;
    });
  });

  describe('canPerform', () => {
    it('unlimited (null) should always allow', () => {
      expect(canPerform(0, null)).to.be.true;
      expect(canPerform(100, null)).to.be.true;
      expect(canPerform(999999, null)).to.be.true;
    });

    it('should allow when under limit', () => {
      expect(canPerform(0, 5)).to.be.true;
      expect(canPerform(4, 5)).to.be.true;
      expect(canPerform(2, 3)).to.be.true;
    });

    it('should deny when at limit', () => {
      expect(canPerform(5, 5)).to.be.false;
      expect(canPerform(1, 1)).to.be.false;
      expect(canPerform(3, 3)).to.be.false;
    });

    it('should deny when over limit', () => {
      expect(canPerform(6, 5)).to.be.false;
      expect(canPerform(10, 5)).to.be.false;
    });

    it('should deny when limit is 0 even if count is 0', () => {
      // limit=0 means no capacity; 0 < 0 is false
      expect(canPerform(0, 0)).to.be.false;
    });
  });

  describe('getRemaining', () => {
    it('unlimited (null) should return null', () => {
      expect(getRemaining(0, null)).to.be.null;
      expect(getRemaining(100, null)).to.be.null;
    });

    it('should return correct remaining count', () => {
      expect(getRemaining(0, 5)).to.equal(5);
      expect(getRemaining(3, 5)).to.equal(2);
      expect(getRemaining(5, 5)).to.equal(0);
    });

    it('should return 0 when over limit (never negative)', () => {
      expect(getRemaining(6, 5)).to.equal(0);
      expect(getRemaining(100, 5)).to.equal(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Subscription enforcement
  // ---------------------------------------------------------------------------

  describe('enforceSubscriptionActive', () => {
    it('free plan should always be allowed', () => {
      const result = enforceSubscriptionActive('active', 'free');
      expect(result.allowed).to.be.true;
    });

    it('free plan with inactive status should be allowed', () => {
      const result = enforceSubscriptionActive('inactive', 'free');
      expect(result.allowed).to.be.true;
    });

    it('free plan with cancelled status should be allowed', () => {
      const result = enforceSubscriptionActive('cancelled', 'free');
      expect(result.allowed).to.be.true;
    });

    it('free plan with past_due status should be allowed', () => {
      const result = enforceSubscriptionActive('past_due', 'free');
      expect(result.allowed).to.be.true;
    });

    it('active subscription should be allowed', () => {
      const result = enforceSubscriptionActive('active', 'pro');
      expect(result.allowed).to.be.true;
    });

    it('inactive subscription should be denied', () => {
      const result = enforceSubscriptionActive('inactive', 'pro');
      expect(result.allowed).to.be.false;
      expect(result.reason).to.be.a('string');
    });

    it('cancelled subscription should be denied', () => {
      const result = enforceSubscriptionActive('cancelled', 'business');
      expect(result.allowed).to.be.false;
      expect(result.reason).to.be.a('string');
    });

    it('past_due subscription should be denied', () => {
      const result = enforceSubscriptionActive('past_due', 'pro');
      expect(result.allowed).to.be.false;
      expect(result.reason).to.be.a('string');
    });

    it('error message should contain the status', () => {
      const result = enforceSubscriptionActive('past_due', 'pro');
      expect(result.reason).to.include('past_due');
    });
  });
});
