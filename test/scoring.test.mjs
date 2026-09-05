import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRevenueRisk,
  calculateAmountScore,
  calculateCaseTypeScore,
  calculateFailureCountScore,
  calculateCustomerHistoryScore,
  classifyRiskLevel,
} from "../src/lib/scoring.ts";

test("Risk Level Classification Thresholds", () => {
  // Boundary tests for 0.00 - 0.39 = Low
  assert.equal(classifyRiskLevel(0.0), "Low");
  assert.equal(classifyRiskLevel(0.25), "Low");
  assert.equal(classifyRiskLevel(0.39), "Low");

  // Boundary tests for 0.40 - 0.69 = Medium
  assert.equal(classifyRiskLevel(0.4), "Medium");
  assert.equal(classifyRiskLevel(0.55), "Medium");
  assert.equal(classifyRiskLevel(0.69), "Medium");

  // Boundary tests for 0.70 - 1.00 = High
  assert.equal(classifyRiskLevel(0.7), "High");
  assert.equal(classifyRiskLevel(0.85), "High");
  assert.equal(classifyRiskLevel(1.0), "High");
});

test("Factor Calculation - Transaction Amount", () => {
  assert.equal(calculateAmountScore(45), 0.15); // < 100
  assert.equal(calculateAmountScore(250), 0.35); // 100 - 500
  assert.equal(calculateAmountScore(1200), 0.65); // 500 - 2500
  assert.equal(calculateAmountScore(5000), 0.85); // 2500 - 10000
  assert.equal(calculateAmountScore(15000), 1.0); // > 10000
});

test("Factor Calculation - Case Type", () => {
  assert.equal(calculateCaseTypeScore("FAILED_SUBSCRIPTION"), 0.3);
  assert.equal(calculateCaseTypeScore("Failed Subscription"), 0.3);

  assert.equal(calculateCaseTypeScore("FAILED_PAYMENT"), 0.45);
  assert.equal(calculateCaseTypeScore("Failed Payment"), 0.45);

  assert.equal(calculateCaseTypeScore("CHECKOUT_ABANDONMENT"), 0.65);
  assert.equal(calculateCaseTypeScore("Checkout Abandonment"), 0.65);

  assert.equal(calculateCaseTypeScore("OVERDUE_INVOICE"), 0.8);
  assert.equal(calculateCaseTypeScore("Overdue Invoice"), 0.8);
});

test("Factor Calculation - Failure Count", () => {
  assert.equal(calculateFailureCountScore(0), 0.1);
  assert.equal(calculateFailureCountScore(1), 0.2);
  assert.equal(calculateFailureCountScore(2), 0.5);
  assert.equal(calculateFailureCountScore(3), 0.8);
  assert.equal(calculateFailureCountScore(5), 1.0);
});

test("Factor Calculation - Customer History", () => {
  // High LTV active customer
  assert.equal(calculateCustomerHistoryScore({ lifetimeValue: 15000, status: "ACTIVE" }), 0.1);

  // Moderate LTV active customer
  assert.equal(calculateCustomerHistoryScore({ lifetimeValue: 4000, status: "ACTIVE" }), 0.3);

  // Lower LTV customer
  assert.equal(calculateCustomerHistoryScore({ lifetimeValue: 1000, status: "ACTIVE" }), 0.55);

  // New / low LTV customer
  assert.equal(calculateCustomerHistoryScore({ lifetimeValue: 200, status: "ACTIVE" }), 0.75);

  // At-risk status penalty
  assert.equal(calculateCustomerHistoryScore({ lifetimeValue: 4000, status: "AT_RISK" }), 0.45);

  // Churned status penalty
  assert.equal(calculateCustomerHistoryScore({ lifetimeValue: 4000, status: "CHURNED" }), 0.55);
});

test("End-to-End Scoring - Low Risk Profile", () => {
  const result = calculateRevenueRisk({
    amount: 49.0,
    caseType: "Failed Subscription",
    failureCount: 1,
    customerHistory: {
      lifetimeValue: 18000.0,
      status: "ACTIVE",
    },
  });

  assert.equal(result.riskLevel, "Low");
  assert.ok(result.score >= 0.0 && result.score <= 0.39, `Score ${result.score} should be <= 0.39`);
  assert.ok(result.reason.includes("Low risk"));
  assert.ok(result.reason.includes(result.score.toFixed(2)));
});

test("End-to-End Scoring - Medium Risk Profile", () => {
  const result = calculateRevenueRisk({
    amount: 450.0,
    caseType: "Failed Payment",
    failureCount: 2,
    customerHistory: {
      lifetimeValue: 3500.0,
      status: "ACTIVE",
    },
  });

  assert.equal(result.riskLevel, "Medium");
  assert.ok(result.score >= 0.4 && result.score <= 0.69, `Score ${result.score} should be between 0.40 and 0.69`);
  assert.ok(result.reason.includes("Medium risk"));
});

test("End-to-End Scoring - High Risk Profile", () => {
  const result = calculateRevenueRisk({
    amount: 14200.0,
    caseType: "Overdue Invoice",
    failureCount: 4,
    customerHistory: {
      lifetimeValue: 300.0,
      status: "AT_RISK",
    },
  });

  assert.equal(result.riskLevel, "High");
  assert.ok(result.score >= 0.7 && result.score <= 1.0, `Score ${result.score} should be >= 0.70`);
  assert.ok(result.reason.includes("High risk"));
  assert.ok(result.factors.amountScore >= 0.85);
  assert.ok(result.factors.failureCountScore === 1.0);
});

test("Score Clamping Constraint", () => {
  // Extreme high inputs
  const maxResult = calculateRevenueRisk({
    amount: 1000000,
    caseType: "Overdue Invoice",
    failureCount: 10,
    customerHistory: { lifetimeValue: 0, status: "SUSPENDED" },
  });
  assert.ok(maxResult.score <= 1.0);
  assert.equal(maxResult.riskLevel, "High");

  // Extreme low inputs
  const minResult = calculateRevenueRisk({
    amount: 0,
    caseType: "Failed Subscription",
    failureCount: 0,
    customerHistory: { lifetimeValue: 100000, status: "ACTIVE" },
  });
  assert.ok(minResult.score >= 0.0);
  assert.equal(minResult.riskLevel, "Low");
});
