export type CaseType =
  | "FAILED_PAYMENT"
  | "CHECKOUT_ABANDONMENT"
  | "FAILED_SUBSCRIPTION"
  | "OVERDUE_INVOICE"
  | "Failed Payment"
  | "Checkout Abandonment"
  | "Failed Subscription"
  | "Overdue Invoice";

export type RiskLevel = "Low" | "Medium" | "High";

export interface CustomerHistoryInput {
  lifetimeValue?: number;
  status?: string;
  previousCasesCount?: number;
  accountAgeDays?: number;
}

export interface ScoringInput {
  amount: number;
  caseType: CaseType;
  failureCount: number;
  customerHistory?: CustomerHistoryInput;
}

export interface RiskFactorsBreakdown {
  amountScore: number;
  caseTypeScore: number;
  failureCountScore: number;
  customerHistoryScore: number;
}

export interface ScoringResult {
  score: number;
  riskLevel: RiskLevel;
  reason: string;
  factors: RiskFactorsBreakdown;
}

/**
 * 1. Amount Factor Score (0.0 to 1.0)
 * Evaluates exposure level based on financial loss risk.
 */
export function calculateAmountScore(amount: number): number {
  if (amount <= 0) return 0.05;
  if (amount < 100) return 0.15;
  if (amount <= 500) return 0.35;
  if (amount <= 2500) return 0.65;
  if (amount <= 10000) return 0.85;
  return 1.0;
}

/**
 * 2. Case Type Factor Score (0.0 to 1.0)
 * Evaluates recovery difficulty by mechanism and customer intent level.
 */
export function calculateCaseTypeScore(caseType: CaseType): number {
  const normalized = caseType.toUpperCase().replace(/\s+/g, "_");
  switch (normalized) {
    case "FAILED_SUBSCRIPTION":
      return 0.3; // High recurring intent, established mandate
    case "FAILED_PAYMENT":
      return 0.45; // Point-in-time decline, standard dunning
    case "CHECKOUT_ABANDONMENT":
      return 0.65; // High-friction drop-off, perishable impulse
    case "OVERDUE_INVOICE":
      return 0.8; // Extended aging, liquidity/cash flow delays
    default:
      return 0.5;
  }
}

/**
 * 3. Failure Count Factor Score (0.0 to 1.0)
 * Evaluates decline persistence and retry exhaustion.
 */
export function calculateFailureCountScore(failureCount: number): number {
  if (failureCount <= 0) return 0.1;
  if (failureCount === 1) return 0.2;
  if (failureCount === 2) return 0.5;
  if (failureCount === 3) return 0.8;
  return 1.0; // 4 or more attempts
}

/**
 * 4. Customer History Factor Score (0.0 to 1.0)
 * Evaluates customer loyalty, LTV, and historical reliability.
 */
export function calculateCustomerHistoryScore(history?: CustomerHistoryInput): number {
  if (!history) return 0.5;

  const ltv = history.lifetimeValue ?? 0;
  const status = (history.status || "ACTIVE").toUpperCase();

  let score = 0.5;

  if (ltv >= 10000) {
    score = 0.1;
  } else if (ltv >= 2500) {
    score = 0.3;
  } else if (ltv >= 500) {
    score = 0.55;
  } else {
    score = 0.75;
  }

  // Adjust for account standing
  if (status === "AT_RISK") {
    score = Math.min(1.0, score + 0.15);
  } else if (status === "CHURNED" || status === "SUSPENDED") {
    score = Math.min(1.0, score + 0.25);
  }

  return Number(score.toFixed(2));
}

/**
 * Classifies numeric score into Low, Medium, or High
 * 0.00 - 0.39 = Low
 * 0.40 - 0.69 = Medium
 * 0.70 - 1.00 = High
 */
export function classifyRiskLevel(score: number): RiskLevel {
  if (score <= 0.39) return "Low";
  if (score <= 0.69) return "Medium";
  return "High";
}

/**
 * Synthesizes a human-readable explanation of the score.
 */
export function generateRiskReason(
  score: number,
  riskLevel: RiskLevel,
  input: ScoringInput,
  factors: RiskFactorsBreakdown
): string {
  const reasons: string[] = [];

  // Identify highest risk contributors
  if (factors.failureCountScore >= 0.8) {
    reasons.push(`${input.failureCount} failed recovery attempts`);
  } else if (factors.failureCountScore >= 0.5) {
    reasons.push(`${input.failureCount} retry attempts`);
  }

  if (factors.amountScore >= 0.85) {
    reasons.push(`high transaction exposure ($${input.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })})`);
  } else if (factors.amountScore <= 0.2) {
    reasons.push(`low financial exposure ($${input.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })})`);
  }

  const normalizedType = input.caseType.toUpperCase().replace(/\s+/g, "_");
  if (normalizedType === "OVERDUE_INVOICE") {
    reasons.push("overdue B2B invoice aging");
  } else if (normalizedType === "CHECKOUT_ABANDONMENT") {
    reasons.push("checkout abandonment drop-off");
  } else if (normalizedType === "FAILED_SUBSCRIPTION" && factors.customerHistoryScore <= 0.3) {
    reasons.push("active subscription with loyal customer history");
  }

  const ltv = input.customerHistory?.lifetimeValue ?? 0;
  if (ltv >= 10000) {
    reasons.push(`high customer LTV ($${ltv.toLocaleString("en-US", { minimumFractionDigits: 0 })})`);
  } else if (input.customerHistory?.status === "AT_RISK") {
    reasons.push("customer marked at-risk");
  }

  if (reasons.length === 0) {
    reasons.push(`standard ${input.caseType} baseline metrics`);
  }

  return `${riskLevel} risk (${score.toFixed(2)}) based on ${reasons.join(", ")}.`;
}

/**
 * Deterministic Revenue Risk Scoring Engine
 * Evaluates amount, case type, failure count, and customer history.
 */
export function calculateRevenueRisk(input: ScoringInput): ScoringResult {
  const amountScore = calculateAmountScore(input.amount);
  const caseTypeScore = calculateCaseTypeScore(input.caseType);
  const failureCountScore = calculateFailureCountScore(input.failureCount);
  const customerHistoryScore = calculateCustomerHistoryScore(input.customerHistory);

  // Equal 25% weight across the 4 core dimensions
  const rawScore =
    0.25 * amountScore +
    0.25 * caseTypeScore +
    0.25 * failureCountScore +
    0.25 * customerHistoryScore;

  // Clamp strictly between 0.00 and 1.00
  const score = Math.max(0.0, Math.min(1.0, Number(rawScore.toFixed(2))));
  const riskLevel = classifyRiskLevel(score);

  const factors: RiskFactorsBreakdown = {
    amountScore,
    caseTypeScore,
    failureCountScore,
    customerHistoryScore,
  };

  const reason = generateRiskReason(score, riskLevel, input, factors);

  return {
    score,
    riskLevel,
    reason,
    factors,
  };
}
