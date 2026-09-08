import { expect } from 'chai';
import {
  RAZORPAY_WEBHOOK_EVENTS,
} from '../src/razorpay-types';

/**
 * Webhook Idempotency Tests
 *
 * Tests the state machine logic for event deduplication:
 * - New event → processing → processed
 * - Duplicate processed event → ignored
 * - Failed event → reclaimed → processing
 * - Active processing (<5 min) → already_processing
 * - Stale processing (>5 min) → reclaimed
 * - Missing timestamp → reclaimable
 */

// ---------------------------------------------------------------------------
// State machine constants (mirrored from webhook.ts)
// ---------------------------------------------------------------------------

const WEBHOOK_PROCESSING_STALE_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Simulated state machine (mirrors the Firestore transaction logic)
// ---------------------------------------------------------------------------

interface WebhookEventRecord {
  event: string;
  eventId: string;
  status: 'processing' | 'processed' | 'failed';
  attempts: number;
  receivedAt?: Date;
  updatedAt?: Date;
}

type ClaimResult = 'claimed' | 'already_processed' | 'already_processing';

function simulateClaim(
  existing: WebhookEventRecord | null,
  nowMs: number
): { result: ClaimResult; updatedRecord?: Partial<WebhookEventRecord> } {
  if (existing) {
    if (existing.status === 'processed') {
      return { result: 'already_processed' };
    }
    if (existing.status === 'processing') {
      let isStale = true; // assume stale if timestamp missing/invalid
      if (existing.updatedAt) {
        try {
          const age = nowMs - existing.updatedAt.getTime();
          isStale = age > WEBHOOK_PROCESSING_STALE_MS;
        } catch {
          // invalid timestamp — treat as stale
        }
      }
      if (!isStale) {
        return { result: 'already_processing' };
      }
      // Stale — re-claim
      return {
        result: 'claimed',
        updatedRecord: {
          status: 'processing',
          attempts: (existing.attempts || 1) + 1,
        },
      };
    }
    // status === 'failed' — retry: re-claim
    return {
      result: 'claimed',
      updatedRecord: {
        status: 'processing',
        attempts: (existing.attempts || 1) + 1,
      },
    };
  }

  // New event — claim it
  return {
    result: 'claimed',
    updatedRecord: {
      status: 'processing',
      attempts: 1,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Webhook Idempotency — State Machine', () => {
  const NOW_MS = Date.now();

  describe('new event', () => {
    it('should claim a new event (no existing record)', () => {
      const { result, updatedRecord } = simulateClaim(null, NOW_MS);
      expect(result).to.equal('claimed');
      expect(updatedRecord).to.deep.include({
        status: 'processing',
        attempts: 1,
      });
    });
  });

  describe('duplicate processed event', () => {
    it('should return already_processed for a processed event', () => {
      const existing: WebhookEventRecord = {
        event: 'subscription.authenticated',
        eventId: 'sub_123',
        status: 'processed',
        attempts: 1,
        updatedAt: new Date(NOW_MS - 1000),
      };
      const { result } = simulateClaim(existing, NOW_MS);
      expect(result).to.equal('already_processed');
    });
  });

  describe('active processing (< 5 minutes)', () => {
    it('should return already_processing for recent processing event', () => {
      const existing: WebhookEventRecord = {
        event: 'subscription.charged',
        eventId: 'sub_456',
        status: 'processing',
        attempts: 1,
        updatedAt: new Date(NOW_MS - 60_000), // 1 minute ago
      };
      const { result } = simulateClaim(existing, NOW_MS);
      expect(result).to.equal('already_processing');
    });

    it('should return already_processing at 4 minutes 59 seconds', () => {
      const existing: WebhookEventRecord = {
        event: 'subscription.charged',
        eventId: 'sub_456',
        status: 'processing',
        attempts: 1,
        updatedAt: new Date(NOW_MS - (5 * 60 * 1000 - 1000)), // 4:59 ago
      };
      const { result } = simulateClaim(existing, NOW_MS);
      expect(result).to.equal('already_processing');
    });
  });

  describe('stale processing (> 5 minutes)', () => {
    it('should reclaim a processing event older than 5 minutes', () => {
      const existing: WebhookEventRecord = {
        event: 'subscription.pending',
        eventId: 'sub_789',
        status: 'processing',
        attempts: 1,
        updatedAt: new Date(NOW_MS - (5 * 60 * 1000 + 1000)), // 5:01 ago
      };
      const { result, updatedRecord } = simulateClaim(existing, NOW_MS);
      expect(result).to.equal('claimed');
      expect(updatedRecord).to.deep.include({
        status: 'processing',
        attempts: 2,
      });
    });

    it('should reclaim a processing event at exactly 5 minutes + 1ms', () => {
      const existing: WebhookEventRecord = {
        event: 'subscription.halted',
        eventId: 'sub_abc',
        status: 'processing',
        attempts: 3,
        updatedAt: new Date(NOW_MS - WEBHOOK_PROCESSING_STALE_MS - 1),
      };
      const { result, updatedRecord } = simulateClaim(existing, NOW_MS);
      expect(result).to.equal('claimed');
      expect(updatedRecord).to.deep.include({
        status: 'processing',
        attempts: 4,
      });
    });
  });

  describe('missing timestamp', () => {
    it('should reclaim a processing event with missing updatedAt', () => {
      const existing: WebhookEventRecord = {
        event: 'subscription.cancelled',
        eventId: 'sub_def',
        status: 'processing',
        attempts: 1,
        // updatedAt is missing
      };
      const { result, updatedRecord } = simulateClaim(existing, NOW_MS);
      expect(result).to.equal('claimed');
      expect(updatedRecord).to.deep.include({
        status: 'processing',
        attempts: 2,
      });
    });
  });

  describe('failed event', () => {
    it('should reclaim a failed event', () => {
      const existing: WebhookEventRecord = {
        event: 'payment.failed',
        eventId: 'pay_123',
        status: 'failed',
        attempts: 1,
        updatedAt: new Date(NOW_MS - 1000),
      };
      const { result, updatedRecord } = simulateClaim(existing, NOW_MS);
      expect(result).to.equal('claimed');
      expect(updatedRecord).to.deep.include({
        status: 'processing',
        attempts: 2,
      });
    });

    it('should increment attempts on re-claim', () => {
      const existing: WebhookEventRecord = {
        event: 'payment.failed',
        eventId: 'pay_456',
        status: 'failed',
        attempts: 5,
        updatedAt: new Date(NOW_MS - 1000),
      };
      const { result, updatedRecord } = simulateClaim(existing, NOW_MS);
      expect(result).to.equal('claimed');
      expect(updatedRecord).to.deep.include({
        attempts: 6,
      });
    });
  });

  describe('event type constants', () => {
    it('should define all expected webhook events', () => {
      expect(RAZORPAY_WEBHOOK_EVENTS).to.have.all.keys(
        'SUBSCRIPTION_AUTHENTICATED',
        'SUBSCRIPTION_ACTIVATED',
        'SUBSCRIPTION_CHARGED',
        'SUBSCRIPTION_COMPLETED',
        'SUBSCRIPTION_PENDING',
        'SUBSCRIPTION_HALTED',
        'SUBSCRIPTION_CANCELLED',
        'PAYMENT_FAILED'
      );
    });

    it('event values should follow Razorpay naming convention', () => {
      expect(RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_AUTHENTICATED).to.equal('subscription.authenticated');
      expect(RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_ACTIVATED).to.equal('subscription.activated');
      expect(RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_CHARGED).to.equal('subscription.charged');
      expect(RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_COMPLETED).to.equal('subscription.completed');
      expect(RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_PENDING).to.equal('subscription.pending');
      expect(RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_HALTED).to.equal('subscription.halted');
      expect(RAZORPAY_WEBHOOK_EVENTS.SUBSCRIPTION_CANCELLED).to.equal('subscription.cancelled');
      expect(RAZORPAY_WEBHOOK_EVENTS.PAYMENT_FAILED).to.equal('payment.failed');
    });
  });
});
