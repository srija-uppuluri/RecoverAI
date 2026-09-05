import test from "node:test";
import assert from "node:assert/strict";
import { generateCaseRecommendation } from "../src/lib/recommendations.ts";

test("Recommendations - Overdue Invoice Strategy", async () => {
  // Moderate overdue invoice
  const res1 = await generateCaseRecommendation({
    caseType: "Overdue Invoice",
    attemptsCount: 1,
    customer: {
      name: "Global Logistics Group",
      email: "invoices@globallogistics.com",
      lifetimeValue: 85000,
      status: "ACTIVE",
    },
    transaction: {
      amount: 6850.0,
      failureReason: "NET_30_PAST_DUE",
    },
  });

  assert.equal(res1.action, "AP_ESCALATION");
  assert.equal(res1.channel, "EMAIL");
  assert.ok(res1.reason.length > 10);
  assert.ok(res1.customerMessage.includes("6,850.00"));
  assert.ok(res1.customerMessage.includes("Global"));

  // Escalated overdue invoice with 3+ attempts
  const res2 = await generateCaseRecommendation({
    caseType: "Overdue Invoice",
    attemptsCount: 4,
    customer: {
      name: "Atlas Heavy Industries",
      email: "ap@atlasheavy.com",
      phone: "+1-412-555-0422",
      lifetimeValue: 145000,
      status: "AT_RISK",
    },
    transaction: {
      amount: 14200.0,
      failureReason: "NET_60_PAST_DUE",
    },
  });

  assert.equal(res2.action, "MANUAL_OUTREACH");
  assert.equal(res2.channel, "BOTH");
  assert.ok(res2.customerMessage.includes("14,200.00"));
});

test("Recommendations - Checkout Abandonment Strategy", async () => {
  // 3DS Security timeout drop-off
  const res1 = await generateCaseRecommendation({
    caseType: "Checkout Abandonment",
    attemptsCount: 1,
    customer: {
      name: "Benjamin Scott",
      email: "b.scott@scottmotors.com",
      phone: "+1-313-555-0195",
      lifetimeValue: 2400,
      status: "ACTIVE",
    },
    transaction: {
      amount: 450.0,
      failureReason: "3DS_AUTHENTICATION_TIMEOUT",
      failureCode: "three_ds_timeout",
    },
  });

  assert.equal(res1.action, "PAYMENT_LINK");
  assert.equal(res1.channel, "SMS");
  assert.ok(res1.customerMessage.includes("450.00"));
  assert.ok(res1.customerMessage.includes("Benjamin"));

  // Cart pricing hesitation
  const res2 = await generateCaseRecommendation({
    caseType: "Checkout Abandonment",
    attemptsCount: 1,
    customer: {
      name: "Gabriel Dupont",
      email: "gabriel@lyon-biotech.fr",
      lifetimeValue: 6200,
      status: "ACTIVE",
    },
    transaction: {
      amount: 350.0,
      failureReason: "CURRENCY_CONVERSION_HESITATION",
    },
  });

  assert.equal(res2.action, "DISCOUNT_INCENTIVE");
  assert.equal(res2.channel, "EMAIL");
  assert.ok(res2.customerMessage.includes("350.00"));
});

test("Recommendations - Failed Subscription Strategy", async () => {
  // Expired card on subscription renewal
  const res1 = await generateCaseRecommendation({
    caseType: "Failed Subscription",
    attemptsCount: 1,
    customer: {
      name: "Vertex AI Labs",
      email: "finance@vertexlabs.ai",
      lifetimeValue: 36000,
      status: "ACTIVE",
    },
    transaction: {
      amount: 999.0,
      failureReason: "CARD_EXPIRED_ON_RENEWAL",
      failureCode: "card_expired_subscription",
    },
  });

  assert.equal(res1.action, "CARD_UPDATE_REQUEST");
  assert.equal(res1.channel, "EMAIL");
  assert.ok(res1.customerMessage.includes("999.00"));
  assert.ok(res1.customerMessage.includes("Vertex"));

  // Repeat renewal decline (2+ attempts)
  const res2 = await generateCaseRecommendation({
    caseType: "Failed Subscription",
    attemptsCount: 2,
    customer: {
      name: "Acme Analytics",
      email: "billing@acmeanalytics.com",
      phone: "+1-415-555-0301",
      lifetimeValue: 18000,
      status: "ACTIVE",
    },
    transaction: {
      amount: 499.0,
      failureReason: "RECURRING_BILLING_FAILED",
    },
  });

  assert.equal(res2.action, "GRACE_PERIOD_EXTENSION");
  assert.equal(res2.channel, "BOTH");
  assert.ok(res2.customerMessage.includes("grace"));
});

test("Recommendations - Failed Payment Strategy", async () => {
  // Card verification / CVC error
  const res1 = await generateCaseRecommendation({
    caseType: "Failed Payment",
    attemptsCount: 1,
    customer: {
      name: "Siddharth Menon",
      email: "siddharth@menonlogistics.in",
      lifetimeValue: 8900,
      status: "ACTIVE",
    },
    transaction: {
      amount: 520.0,
      failureReason: "INCORRECT_CVC",
    },
  });

  assert.equal(res1.action, "CARD_UPDATE_REQUEST");
  assert.equal(res1.channel, "EMAIL");
  assert.ok(res1.customerMessage.includes("520.00"));

  // Suspected fraud / bank block
  const res2 = await generateCaseRecommendation({
    caseType: "Failed Payment",
    attemptsCount: 1,
    customer: {
      name: "Lucas Silva",
      email: "lucas@inovacaobr.com",
      lifetimeValue: 1600,
      status: "ACTIVE",
    },
    transaction: {
      amount: 95.0,
      failureReason: "FRAUD_SUSPECTED",
      failureCode: "DO_NOT_HONOR",
    },
  });

  assert.equal(res2.action, "EMAIL_DUNNING");
  assert.equal(res2.channel, "EMAIL");
  assert.ok(res2.customerMessage.includes("bank"));
});

test("Deterministic Fallback Resilience", async () => {
  const result = await generateCaseRecommendation({
    caseType: "Failed Payment",
    attemptsCount: 1,
    customer: {
      name: "Marcus Vance",
      email: "marcus@vancetech.io",
      lifetimeValue: 4200,
    },
    transaction: {
      amount: 349.0,
      failureReason: "INSUFFICIENT_FUNDS",
    },
  });

  assert.ok(result.action);
  assert.ok(result.channel);
  assert.ok(result.reason && result.reason.length > 5);
  assert.ok(result.customerMessage && result.customerMessage.length > 10);
  assert.ok(result.estimatedRecoveryProbability > 0 && result.estimatedRecoveryProbability <= 1.0);
  assert.equal(result.metadata.source, "DETERMINISTIC_RULES");
});
