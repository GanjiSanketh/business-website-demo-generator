# Razorpay Payment Integration — Configuration Guide

## Overview

Phase 5 Part 2B integrates Razorpay as the payment provider for subscription
management. This document explains how to configure Razorpay credentials for
both local development and production deployment.

## Required Razorpay Account

1. Create a Razorpay account at https://dashboard.razorpay.com
2. Complete KYC verification
3. Switch to **Live mode** for production (keep **Test mode** for development)

## Required Configuration Values

### 1. Razorpay Key ID (PUBLIC — may be exposed to client)

- Found in: Razorpay Dashboard → Settings → API Keys → Key ID
- Format: `rzp_live_xxxxx` or `rzp_test_xxxxx`
- Used by: Client-side Razorpay Checkout script
- This value IS safe to expose to the browser

### 2. Razorpay Key Secret (SERVER ONLY — NEVER expose to client)

- Found in: Razorpay Dashboard → Settings → API Keys → Key Secret
- Format: `xxxxxxxxxxxxx`
- Used by: Cloud Functions (server-side Razorpay SDK)
- NEVER commit this value or expose it to the browser

### 3. Razorpay Webhook Secret (SERVER ONLY — NEVER expose to client)

- Found in: Razorpay Dashboard → Settings → Webhooks → Webhook Secret
- Format: `xxxxxxxxxxxxx`
- Used by: Cloud Functions webhook handler to verify webhook signatures
- NEVER commit this value or expose it to the browser

### 4. Razorpay Plan IDs (SERVER ONLY)

You must create subscription plans in the Razorpay Dashboard:
- Razorpay Dashboard → Subscriptions → Plans → Create Plan

For each plan (pro, business), create monthly and yearly variants.
Record the plan IDs (e.g., `plan_xxxxx`).

## Firebase Functions v2 — Secret & Config Architecture

This project uses Firebase Functions v2 with `defineSecret()` and `defineString()`
from `firebase-functions/params`. The two types use different deployment commands:

| Type | Definition | Deployment Command | Runtime Access |
|------|------------|-------------------|----------------|
| **Secret** (sensitive) | `defineSecret('NAME')` | `firebase functions:secrets:set NAME` | `process.env.NAME` (auto-injected) |
| **String** (non-sensitive) | `defineString('NAME')` | `firebase functions:config:set name="value"` | `process.env.NAME` (auto-injected) |

**IMPORTANT**: `firebase functions:config:set` is DEPRECATED for secrets.
Secrets must use `firebase functions:secrets:set` for proper encryption at rest.

### Secrets (defineSecret — encrypted at rest)

| Variable | Used By | Purpose |
|----------|---------|---------|
| `RAZORPAY_KEY_SECRET` | `createCheckoutSessionFn`, `cancelSubscriptionFn` | Razorpay SDK authentication |
| `RAZORPAY_WEBHOOK_SECRET` | `razorpayWebhook` | Webhook signature verification |

### String Parameters (defineString — plain text)

| Variable | Used By | Purpose |
|----------|---------|---------|
| `RAZORPAY_KEY_ID` | `createCheckoutSessionFn` (returned to client) | Razorpay API Key ID |
| `RAZORPAY_PLAN_PRO_MONTHLY` | `createCheckoutSessionFn`, `razorpayWebhook` | Razorpay plan ID for Pro monthly |
| `RAZORPAY_PLAN_PRO_YEARLY` | `razorpayWebhook` | Razorpay plan ID for Pro yearly |
| `RAZORPAY_PLAN_BUSINESS_MONTHLY` | `createCheckoutSessionFn`, `razorpayWebhook` | Razorpay plan ID for Business monthly |
| `RAZORPAY_PLAN_BUSINESS_YEARLY` | `razorpayWebhook` | Razorpay plan ID for Business yearly |

## Local Development Configuration

### Option 1: `.env` file (Recommended for local dev)

Create a `.env` file in the `functions/` directory (NEVER commit this file).
Firebase emulators load these as `process.env` values automatically:

```
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
RAZORPAY_PLAN_PRO_MONTHLY=plan_xxxxx
RAZORPAY_PLAN_PRO_YEARLY=plan_xxxxx
RAZORPAY_PLAN_BUSINESS_MONTHLY=plan_xxxxx
RAZORPAY_PLAN_BUSINESS_YEARLY=plan_xxxxx
```

### Option 2: Firebase Functions Config (for emulator)

```bash
# Set string parameters for local emulator
firebase functions:config:set \
  razorpay.key_id="rzp_test_xxxxx" \
  razorpay.plan_pro_monthly="plan_xxxxx" \
  razorpay.plan_pro_yearly="plan_xxxxx" \
  razorpay.plan_business_monthly="plan_xxxxx" \
  razorpay.plan_business_yearly="plan_xxxxx"

# Set secrets for local emulator (interactive prompt)
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

## Production Configuration (Firebase Deploy)

### Step 1: Set Secrets (encrypted at rest)

```bash
# Set sensitive secrets — interactive prompt will ask for the value
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

### Step 2: Set String Parameters (plain text)

```bash
# Set non-sensitive parameters
firebase functions:config:set \
  razorpay.key_id="rzp_live_xxxxx" \
  razorpay.plan_pro_monthly="plan_xxxxx" \
  razorpay.plan_pro_yearly="plan_xxxxx" \
  razorpay.plan_business_monthly="plan_xxxxx" \
  razorpay.plan_business_yearly="plan_xxxxx"
```

### Step 3: Deploy Functions

```bash
firebase deploy --only functions
```

### Verifying Configuration

```bash
# Check string parameters
firebase functions:config:get

# Check secrets (values are hidden, only shows metadata)
firebase functions:secrets:access
```

## Razorpay Dashboard Webhook Configuration

### Webhook URL

Configure the webhook URL in Razorpay Dashboard → Settings → Webhooks:

```
https://<region>-<project-id>.cloudfunctions.net/razorpayWebhook
```

Example:
```
https://us-central1-my-project.cloudfunctions.net/razorpayWebhook
```

### Webhook Events to Subscribe

Select these events in the Razorpay Dashboard:

- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.pending`
- `subscription.halted`
- `subscription.cancelled`
- `subscription.completed`
- `payment.failed`

### Webhook Secret

Generate a webhook secret in the Razorpay Dashboard and configure it
in your Firebase Functions config or secrets.

## Test Mode vs Live Mode

### Test Mode

- Use `rzp_test_xxxxx` keys
- Use test card numbers from Razorpay docs
- Webhooks may not fire in test mode — use manual testing
- No real money is charged

### Live Mode

- Use `rzp_live_xxxxx` keys
- Real payments are processed
- Webhooks fire automatically
- Requires completed KYC on Razorpay account

## Environment Variable Reference

| Variable | Required | Public | Description |
|----------|----------|--------|-------------|
| `RAZORPAY_KEY_ID` | Yes | Yes (client) | Razorpay API Key ID |
| `RAZORPAY_KEY_SECRET` | Yes | No (server) | Razorpay API Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | No (server) | Webhook signature verification secret |
| `RAZORPAY_PLAN_PRO_MONTHLY` | Yes | No (server) | Razorpay Plan ID for Pro monthly |
| `RAZORPAY_PLAN_PRO_YEARLY` | No | No (server) | Razorpay Plan ID for Pro yearly |
| `RAZORPAY_PLAN_BUSINESS_MONTHLY` | Yes | No (server) | Razorpay Plan ID for Business monthly |
| `RAZORPAY_PLAN_BUSINESS_YEARLY` | No | No (server) | Razorpay Plan ID for Business yearly |

## Security Notes

1. **NEVER** commit `.env` files or secrets to version control
2. **NEVER** expose `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to the client
3. `RAZORPAY_KEY_ID` is safe to expose (it's a public key used by Razorpay Checkout)
4. All payment writes originate from verified Cloud Functions or webhook processing
5. Webhook signatures are verified using HMAC-SHA256 with timing-safe comparison
6. Idempotency is enforced — duplicate webhook events are safely ignored
7. `defineSecret()` values are encrypted at rest and only accessible to bound functions
8. `defineString()` values are plain text — use only for non-sensitive configuration
9. `firebase functions:config:set` is DEPRECATED for secrets — use `secrets:set` instead
