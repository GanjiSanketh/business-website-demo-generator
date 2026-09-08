import { expect } from 'chai';
import {
  PLAN_LIMITS,
  PLAN_METADATA,
  canPerform,
  getRemaining,
  isUnlimited,
  enforceSubscriptionActive,
} from '../src/entitlements';
import type { PlanId } from '../src/entitlements';

/**
 * Plan Quota Tests
 *
 * Tests the quota decision logic for business limits,
 * published limits, and custom domains.
 * Uses the pure helper functions that the enforcement callables use.
 */

describe('Plan Quotas — Decision Logic', () => {
  // ---------------------------------------------------------------------------
  // Business limits
  // ---------------------------------------------------------------------------

  describe('business creation limits', () => {
    describe('free plan (limit = 1)', () => {
      it('should allow when existing = 0', () => {
        expect(canPerform(0, PLAN_LIMITS.free.maxBusinesses)).to.be.true;
      });

      it('should deny when existing = 1', () => {
        expect(canPerform(1, PLAN_LIMITS.free.maxBusinesses)).to.be.false;
      });

      it('should deny when existing = 2 (over limit)', () => {
        expect(canPerform(2, PLAN_LIMITS.free.maxBusinesses)).to.be.false;
      });

      it('remaining should be 0 at limit', () => {
        expect(getRemaining(1, PLAN_LIMITS.free.maxBusinesses)).to.equal(0);
      });

      it('remaining should be 1 when empty', () => {
        expect(getRemaining(0, PLAN_LIMITS.free.maxBusinesses)).to.equal(1);
      });
    });

    describe('pro plan (limit = 5)', () => {
      it('should allow when existing = 2', () => {
        expect(canPerform(2, PLAN_LIMITS.pro.maxBusinesses)).to.be.true;
      });

      it('should allow when existing = 4', () => {
        expect(canPerform(4, PLAN_LIMITS.pro.maxBusinesses)).to.be.true;
      });

      it('should deny when existing = 5', () => {
        expect(canPerform(5, PLAN_LIMITS.pro.maxBusinesses)).to.be.false;
      });

      it('should deny when existing = 6 (over limit)', () => {
        expect(canPerform(6, PLAN_LIMITS.pro.maxBusinesses)).to.be.false;
      });

      it('remaining should be 3 when 2 exist', () => {
        expect(getRemaining(2, PLAN_LIMITS.pro.maxBusinesses)).to.equal(3);
      });
    });

    describe('business plan (unlimited)', () => {
      it('should always allow (unlimited)', () => {
        expect(canPerform(0, PLAN_LIMITS.business.maxBusinesses)).to.be.true;
        expect(canPerform(100, PLAN_LIMITS.business.maxBusinesses)).to.be.true;
        expect(canPerform(10000, PLAN_LIMITS.business.maxBusinesses)).to.be.true;
      });

      it('remaining should be null (unlimited)', () => {
        expect(getRemaining(0, PLAN_LIMITS.business.maxBusinesses)).to.be.null;
        expect(getRemaining(100, PLAN_LIMITS.business.maxBusinesses)).to.be.null;
      });

      it('limit should be unlimited', () => {
        expect(isUnlimited(PLAN_LIMITS.business.maxBusinesses)).to.be.true;
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Published limits
  // ---------------------------------------------------------------------------

  describe('published business limits', () => {
    describe('free plan (limit = 1)', () => {
      it('should allow when published = 0', () => {
        expect(canPerform(0, PLAN_LIMITS.free.maxPublishedBusinesses)).to.be.true;
      });

      it('should deny when published = 1', () => {
        expect(canPerform(1, PLAN_LIMITS.free.maxPublishedBusinesses)).to.be.false;
      });
    });

    describe('pro plan (limit = 5)', () => {
      it('should allow when published = 4', () => {
        expect(canPerform(4, PLAN_LIMITS.pro.maxPublishedBusinesses)).to.be.true;
      });

      it('should deny when published = 5', () => {
        expect(canPerform(5, PLAN_LIMITS.pro.maxPublishedBusinesses)).to.be.false;
      });
    });

    describe('business plan (unlimited)', () => {
      it('should always allow', () => {
        expect(canPerform(0, PLAN_LIMITS.business.maxPublishedBusinesses)).to.be.true;
        expect(canPerform(100, PLAN_LIMITS.business.maxPublishedBusinesses)).to.be.true;
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Custom domain limits
  // ---------------------------------------------------------------------------

  describe('custom domain limits', () => {
    describe('free plan (limit = 0)', () => {
      it('should deny when domains = 0 (no capacity at limit 0)', () => {
        // limit=0 means no capacity; canPerform checks currentCount < limit
        expect(canPerform(0, PLAN_LIMITS.free.customDomains)).to.be.false;
      });

      it('should deny when domains = 1', () => {
        expect(canPerform(1, PLAN_LIMITS.free.customDomains)).to.be.false;
      });

      it('remaining should be 0', () => {
        expect(getRemaining(0, PLAN_LIMITS.free.customDomains)).to.equal(0);
      });
    });

    describe('pro plan (limit = 2)', () => {
      it('should allow when domains = 0', () => {
        expect(canPerform(0, PLAN_LIMITS.pro.customDomains)).to.be.true;
      });

      it('should allow when domains = 1', () => {
        expect(canPerform(1, PLAN_LIMITS.pro.customDomains)).to.be.true;
      });

      it('should deny when domains = 2', () => {
        expect(canPerform(2, PLAN_LIMITS.pro.customDomains)).to.be.false;
      });

      it('remaining should be 1 when 1 exists', () => {
        expect(getRemaining(1, PLAN_LIMITS.pro.customDomains)).to.equal(1);
      });
    });

    describe('business plan (unlimited)', () => {
      it('should always allow', () => {
        expect(canPerform(0, PLAN_LIMITS.business.customDomains)).to.be.true;
        expect(canPerform(50, PLAN_LIMITS.business.customDomains)).to.be.true;
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('canPerform with limit 0 and count 0 should deny (no capacity)', () => {
      // limit=0 means no capacity; 0 < 0 is false
      expect(canPerform(0, 0)).to.be.false;
    });

    it('getRemaining with limit 0 and count 0 should return 0', () => {
      expect(getRemaining(0, 0)).to.equal(0);
    });

    it('getRemaining with count exceeding limit should return 0 (not negative)', () => {
      expect(getRemaining(10, 5)).to.equal(0);
      expect(getRemaining(100, 1)).to.equal(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Subscription status interactions
  // ---------------------------------------------------------------------------

  describe('subscription status + plan limits combined', () => {
    it('active pro user with room should be allowed', () => {
      const subCheck = enforceSubscriptionActive('active', 'pro');
      const quotaCheck = canPerform(2, PLAN_LIMITS.pro.maxBusinesses);
      expect(subCheck.allowed).to.be.true;
      expect(quotaCheck).to.be.true;
    });

    it('inactive pro user should be denied by subscription check', () => {
      const subCheck = enforceSubscriptionActive('inactive', 'pro');
      expect(subCheck.allowed).to.be.false;
      // Quota check would pass, but subscription check blocks
    });

    it('past_due business user should be denied by subscription check', () => {
      const subCheck = enforceSubscriptionActive('past_due', 'business');
      expect(subCheck.allowed).to.be.false;
    });

    it('free user is always allowed regardless of subscription status', () => {
      expect(enforceSubscriptionActive('active', 'free').allowed).to.be.true;
      expect(enforceSubscriptionActive('inactive', 'free').allowed).to.be.true;
      expect(enforceSubscriptionActive('cancelled', 'free').allowed).to.be.true;
      expect(enforceSubscriptionActive('past_due', 'free').allowed).to.be.true;
    });
  });
});
