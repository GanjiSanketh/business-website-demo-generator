import { expect } from 'chai';
import * as crypto from 'crypto';
import { verifyRazorpayWebhookSignature } from '../src/razorpay-types';

describe('Webhook Security — Signature Verification', () => {
  const TEST_SECRET = 'test_webhook_secret_12345';
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function computeSignature(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  describe('valid signature', () => {
    it('should accept a valid signature', () => {
      const body = '{"event":"subscription.authenticated"}';
      const signature = computeSignature(body, TEST_SECRET);

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        signature
      );
      expect(result).to.be.true;
    });

    it('should accept a valid signature with complex payload', () => {
      const body = JSON.stringify({
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: 'sub_1234567890',
              customer_id: 'cust_xxx',
              plan_id: 'plan_pro_monthly',
              status: 'active',
            },
          },
        },
      });
      const signature = computeSignature(body, TEST_SECRET);

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        signature
      );
      expect(result).to.be.true;
    });
  });

  describe('invalid signature', () => {
    it('should reject a completely wrong signature', () => {
      const body = '{"event":"subscription.authenticated"}';
      const wrongSignature = 'a'.repeat(64); // valid hex length but wrong value

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        wrongSignature
      );
      expect(result).to.be.false;
    });

    it('should reject a signature from a different secret', () => {
      const body = '{"event":"subscription.authenticated"}';
      const signature = computeSignature(body, 'wrong_secret');

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        signature
      );
      expect(result).to.be.false;
    });

    it('should reject a truncated signature', () => {
      const body = '{"event":"subscription.authenticated"}';
      const fullSignature = computeSignature(body, TEST_SECRET);
      const truncatedSignature = fullSignature.substring(0, 32); // half length

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        truncatedSignature
      );
      expect(result).to.be.false;
    });

    it('should reject an empty signature', () => {
      const body = '{"event":"subscription.authenticated"}';

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        ''
      );
      expect(result).to.be.false;
    });
  });

  describe('modified payload', () => {
    it('should reject when payload is modified after signing', () => {
      const originalBody = '{"event":"subscription.authenticated"}';
      const modifiedBody = '{"event":"subscription.cancelled"}';
      const signature = computeSignature(originalBody, TEST_SECRET);

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(modifiedBody),
        signature
      );
      expect(result).to.be.false;
    });

    it('should reject when a character is added to the payload', () => {
      const originalBody = '{"event":"test"}';
      const modifiedBody = '{"event":"testX"}';
      const signature = computeSignature(originalBody, TEST_SECRET);

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(modifiedBody),
        signature
      );
      expect(result).to.be.false;
    });

    it('should reject when a character is removed from the payload', () => {
      const originalBody = '{"event":"test"}';
      const modifiedBody = '{"event":"tes"}';
      const signature = computeSignature(originalBody, TEST_SECRET);

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(modifiedBody),
        signature
      );
      expect(result).to.be.false;
    });
  });

  describe('modified signature', () => {
    it('should reject when signature hex is modified', () => {
      const body = '{"event":"test"}';
      const signature = computeSignature(body, TEST_SECRET);
      // Flip the last character
      const lastChar = signature.charAt(signature.length - 1);
      const flipped = lastChar === 'a' ? 'b' : 'a';
      const modifiedSignature = signature.substring(0, signature.length - 1) + flipped;

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        modifiedSignature
      );
      expect(result).to.be.false;
    });
  });

  describe('missing or undefined inputs', () => {
    it('should reject when signature header is undefined', () => {
      const body = '{"event":"test"}';

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        undefined
      );
      expect(result).to.be.false;
    });

    it('should reject when webhook secret is not configured', () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const body = '{"event":"test"}';
      const signature = computeSignature(body, TEST_SECRET);

      const result = verifyRazorpayWebhookSignature(
        Buffer.from(body),
        signature
      );
      expect(result).to.be.false;
    });
  });
});
