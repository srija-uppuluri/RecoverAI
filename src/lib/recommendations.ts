import { calculateRevenueRisk } from "./scoring.ts";
import type { CaseType } from "./scoring.ts";
import { prisma } from "./prisma.ts";

export type RecommendationActionType =
  | "SMART_RETRY"
  | "EMAIL_DUNNING"
  | "SMS_ALERT"
  | "PAYMENT_LINK"
  | "CARD_UPDATE_REQUEST"
  | "MANUAL_OUTREACH"
  | "AP_ESCALATION"
  | "DISCOUNT_INCENTIVE"
  | "GRACE_PERIOD_EXTENSION"
  | "SPLIT_PAYMENT";

export type DeliveryChannel = "EMAIL" | "SMS" | "BOTH" | "MANUAL_CALL";

export interface CustomerData {
  name: string;
  email: string;
  phone?: string | null;
  riskScore?: number | null;
  status?: string | null;
  lifetimeValue?: number | null;
}

export interface TransactionData {
  amount: number;
  currency?: string;
  failureReason?: string | null;
  failureCode?: string | null;
  paymentMethod?: string | null;
  paymentGateway?: string | null;
  transactionDate?: Date | string;
}

export interface CaseRecommendationInput {
  caseId?: string;
  caseType: string;
  attemptsCount: number;
  priority?: string;
  notes?: string | null;
  customer: CustomerData;
  transaction: TransactionData;
  previousActions?: Array<{
    actionType: string;
    channel?: string | null;
    result?: string | null;
  }>;
}

export interface RecommendationResult {
  action: RecommendationActionType;
  channel: DeliveryChannel;
  reason: string;
  customerMessage: string;
  estimatedRecoveryProbability: number;
  metadata: {
    urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    suggestedTiming: string;
    strategyName: string;
    riskScore: number;
    riskLevel: string;
    source: "AI_GENERATIVE" | "DETERMINISTIC_RULES";
  };
}

/**
 * Deterministic Strategy Evaluator
 * Evaluates the case details and selects the optimal recovery action, channel, and message.
 */
function evaluateDeterministicRecommendation(
  input: CaseRecommendationInput,
  riskScore: number,
  riskLevel: string
): RecommendationResult {
  const amount = input.transaction.amount;
  const currency = input.transaction.currency || "USD";
  const formattedAmount = `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const failureReason = (input.transaction.failureReason || "").toUpperCase();
  const failureCode = (input.transaction.failureCode || "").toUpperCase();
  const attempts = input.attemptsCount;
  const firstName = input.customer.name.split(" ")[0] || input.customer.name;
  const hasPhone = Boolean(input.customer.phone && input.customer.phone.trim().length > 5);

  const normalizedType = input.caseType.toUpperCase().replace(/\s+/g, "_");

  // Strategy 1: OVERDUE INVOICE
  if (normalizedType.includes("INVOICE")) {
    if (attempts >= 3 || riskLevel === "High") {
      return {
        action: "MANUAL_OUTREACH",
        channel: hasPhone ? "BOTH" : "EMAIL",
        reason: `High-exposure invoice (${formattedAmount}) with ${attempts} prior attempts requires direct account manager / finance controller outreach to resolve payment blockers.`,
        customerMessage: `Dear ${input.customer.name}, regarding invoice of ${formattedAmount} that is currently past due. Our executive finance team is available to assist your AP department with remittance confirmation or flexible settlement terms. Please contact us directly or access your secure invoice portal.`,
        estimatedRecoveryProbability: 0.72,
        metadata: {
          urgency: "CRITICAL",
          suggestedTiming: "Immediate business hours outreach",
          strategyName: "Executive Accounts Payable Escalation",
          riskScore,
          riskLevel,
          source: "DETERMINISTIC_RULES",
        },
      };
    }

    return {
      action: "AP_ESCALATION",
      channel: "EMAIL",
      reason: `Overdue B2B invoice (${formattedAmount}) requires formal accounts payable notice with direct payment link and invoice statement copy.`,
      customerMessage: `Hi ${firstName}, this is a reminder regarding your invoice for ${formattedAmount}. Please verify that this payment has been scheduled with your accounts payable department, or settle instantly via your payment link: https://recover.ai/pay/inv-${(input.caseId || "ref").slice(-6)}.`,
      estimatedRecoveryProbability: 0.88,
      metadata: {
        urgency: "HIGH",
        suggestedTiming: "Next business day 09:00 local time",
        strategyName: "Automated AP Dunning Sequence",
        riskScore,
        riskLevel,
        source: "DETERMINISTIC_RULES",
      },
    };
  }

  // Strategy 2: CHECKOUT ABANDONMENT
  if (normalizedType.includes("CHECKOUT") || normalizedType.includes("CART") || normalizedType.includes("ABANDON")) {
    if (failureReason.includes("3DS") || failureReason.includes("AUTH") || failureCode.includes("TIMEOUT")) {
      return {
        action: "PAYMENT_LINK",
        channel: hasPhone ? "SMS" : "EMAIL",
        reason: `Cart drop-off during 3DS/security verification (${formattedAmount}). An instant 1-click resume link removes friction.`,
        customerMessage: `Hi ${firstName}, we saved your cart (${formattedAmount})! Complete your checkout in one click with secure verification: https://recover.ai/cart/resume-${(input.caseId || "quick").slice(-6)}`,
        estimatedRecoveryProbability: 0.81,
        metadata: {
          urgency: "HIGH",
          suggestedTiming: "Immediate (within 15 minutes of abandonment)",
          strategyName: "1-Click Frictionless Checkout Recovery",
          riskScore,
          riskLevel,
          source: "DETERMINISTIC_RULES",
        },
      };
    }

    return {
      action: "DISCOUNT_INCENTIVE",
      channel: "EMAIL",
      reason: `Pre-checkout exit (${formattedAmount}) indicates pricing hesitation or form friction. A 48-hour price guarantee with direct link maximizes conversion.`,
      customerMessage: `Hi ${firstName}, your items are waiting! We've held your order for ${formattedAmount} with a 48-hour price guarantee. Finish your purchase here: https://recover.ai/cart/saved-${(input.caseId || "cart").slice(-6)}`,
      estimatedRecoveryProbability: 0.76,
      metadata: {
        urgency: "MEDIUM",
        suggestedTiming: "2 hours post-abandonment",
        strategyName: "Incentivized Cart Re-engagement",
        riskScore,
        riskLevel,
        source: "DETERMINISTIC_RULES",
      },
    };
  }

  // Strategy 3: FAILED SUBSCRIPTION
  if (normalizedType.includes("SUBSCRIPTION") || normalizedType.includes("RECURRING")) {
    if (failureReason.includes("EXPIRED") || failureCode.includes("EXPIRED")) {
      return {
        action: "CARD_UPDATE_REQUEST",
        channel: "EMAIL",
        reason: `Recurring subscription renewal (${formattedAmount}) failed due to an expired card. Self-service update portal avoids subscription disruption.`,
        customerMessage: `Hi ${firstName}, your recurring subscription renewal of ${formattedAmount} could not be processed because your card on file has expired. Please update your billing details to maintain uninterrupted access: https://recover.ai/billing/update-${(input.caseId || "sub").slice(-6)}.`,
        estimatedRecoveryProbability: 0.91,
        metadata: {
          urgency: "HIGH",
          suggestedTiming: "Immediate automated billing notification",
          strategyName: "Proactive Card Expiry Resolution",
          riskScore,
          riskLevel,
          source: "DETERMINISTIC_RULES",
        },
      };
    }

    if (attempts >= 2) {
      return {
        action: "GRACE_PERIOD_EXTENSION",
        channel: hasPhone ? "BOTH" : "EMAIL",
        reason: `Multiple recurring renewal failures (${attempts} attempts). Offering a 7-day grace extension preserves loyal customer relationship while resolving billing.`,
        customerMessage: `Hi ${firstName}, we noticed a difficulty processing your subscription renewal (${formattedAmount}). We've granted a 7-day grace extension so your service remains active. Please update your payment method: https://recover.ai/billing/manage-${(input.caseId || "sub").slice(-6)}.`,
        estimatedRecoveryProbability: 0.79,
        metadata: {
          urgency: "HIGH",
          suggestedTiming: "Within 24 hours of 2nd decline",
          strategyName: "Grace Period Retention Campaign",
          riskScore,
          riskLevel,
          source: "DETERMINISTIC_RULES",
        },
      };
    }

    return {
      action: "SMART_RETRY",
      channel: "EMAIL",
      reason: `First-time subscription billing decline (${formattedAmount}). Smart retry synchronized to optimal banking window with soft email notification.`,
      customerMessage: `Hi ${firstName}, we experienced a temporary issue processing your subscription payment of ${formattedAmount}. We will automatically retry shortly. If you prefer to use an alternative card, you can update it here: https://recover.ai/billing/update-${(input.caseId || "sub").slice(-6)}.`,
      estimatedRecoveryProbability: 0.87,
      metadata: {
        urgency: "LOW",
        suggestedTiming: "Smart retry window (24h - 48h)",
        strategyName: "Intelligent Scheduled Batch Retry",
        riskScore,
        riskLevel,
        source: "DETERMINISTIC_RULES",
      },
    };
  }

  // Strategy 4: FAILED PAYMENT (Default point-of-sale decline)
  if (failureReason.includes("EXPIRED") || failureReason.includes("CVC") || failureCode.includes("CVC")) {
    return {
      action: "CARD_UPDATE_REQUEST",
      channel: "EMAIL",
      reason: `Payment failed due to card expiration or incorrect security code (${failureReason || "Card Credentials"}). Self-service credential update requested.`,
      customerMessage: `Hi ${firstName}, your payment of ${formattedAmount} could not be completed due to invalid card details. Please securely update your payment information here: https://recover.ai/pay/update-${(input.caseId || "pay").slice(-6)}.`,
      estimatedRecoveryProbability: 0.89,
      metadata: {
        urgency: "HIGH",
        suggestedTiming: "Immediate email prompt",
        strategyName: "Credential Refresh Dunning",
        riskScore,
        riskLevel,
        source: "DETERMINISTIC_RULES",
      },
    };
  }

  if (failureReason.includes("FRAUD") || failureReason.includes("RESTRICT") || failureCode.includes("DO_NOT_HONOR")) {
    return {
      action: "EMAIL_DUNNING",
      channel: "EMAIL",
      reason: `Bank declined transaction with security/authorization flag (${failureReason}). Customer instructed to approve charge with issuing bank.`,
      customerMessage: `Hi ${firstName}, your card issuer temporarily declined a charge of ${formattedAmount}. This is often solved by confirming the transaction with your bank or mobile banking app, then clicking here to retry: https://recover.ai/pay/retry-${(input.caseId || "pay").slice(-6)}.`,
      estimatedRecoveryProbability: 0.82,
      metadata: {
        urgency: "HIGH",
        suggestedTiming: "Immediate authorization request",
        strategyName: "Bank Authorization Guidance",
        riskScore,
        riskLevel,
        source: "DETERMINISTIC_RULES",
      },
    };
  }

  if (amount >= 1000 && attempts >= 2) {
    return {
      action: "SPLIT_PAYMENT",
      channel: hasPhone ? "BOTH" : "EMAIL",
      reason: `High amount payment ($${amount.toFixed(2)}) with repeated declines indicates credit limit cap. Split payment or alternative installment option recommended.`,
      customerMessage: `Hi ${firstName}, we encountered an issue processing ${formattedAmount}. To make settlement easier, we can offer flexible 2-part split billing or an alternative payment method: https://recover.ai/pay/split-${(input.caseId || "split").slice(-6)}.`,
      estimatedRecoveryProbability: 0.74,
      metadata: {
        urgency: "HIGH",
        suggestedTiming: "Within 24 hours of 2nd decline",
        strategyName: "Flexible Installment Alternative",
        riskScore,
        riskLevel,
        source: "DETERMINISTIC_RULES",
      },
    };
  }

  // General Insufficient Funds / Generic Decline
  return {
    action: "SMART_RETRY",
    channel: hasPhone && riskLevel !== "Low" ? "BOTH" : "EMAIL",
    reason: `Temporary card decline (${failureReason || "Insufficient Funds"}). Smart retry scheduled with polite notification.`,
    customerMessage: `Hi ${firstName}, we were unable to process your payment of ${formattedAmount}. We will automatically re-attempt this charge in 48 hours. If you wish to use a different payment method, please visit: https://recover.ai/pay/update-${(input.caseId || "pay").slice(-6)}.`,
    estimatedRecoveryProbability: 0.85,
    metadata: {
      urgency: "MEDIUM",
      suggestedTiming: "Scheduled for next bank clearing cycle (48h)",
      strategyName: "Adaptive Dynamic Retry",
      riskScore,
      riskLevel,
      source: "DETERMINISTIC_RULES",
    },
  };
}

/**
 * Optional Generative AI Enrichment Hook
 * If GEMINI_API_KEY is available, calls Gemini API to customize message tone.
 * If not available or upon any error, seamlessly returns the deterministic recommendation.
 */
async function callGeminiIfAvailable(
  input: CaseRecommendationInput,
  baseRecommendation: RecommendationResult
): Promise<RecommendationResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return baseRecommendation;
  }

  try {
    const prompt = `You are RecoverAI, an expert AI revenue recovery assistant.
Context:
Customer: ${input.customer.name} (LTV: $${input.customer.lifetimeValue || 0}, Status: ${input.customer.status || "ACTIVE"})
Amount: $${input.transaction.amount}
Case Type: ${input.caseType}
Failure Reason: ${input.transaction.failureReason || "Declined"}
Attempts: ${input.attemptsCount}
Baseline Strategy: ${baseRecommendation.action} via ${baseRecommendation.channel}

Generate a concise, professional 2-3 sentence recovery customer message and a 1-sentence strategic rationale.
Return valid JSON only matching this format:
{"reason": "...", "customerMessage": "..."}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(3000), // Strict 3-second timeout
      }
    );

    if (res.ok) {
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.customerMessage && parsed.reason) {
          return {
            ...baseRecommendation,
            reason: parsed.reason,
            customerMessage: parsed.customerMessage,
            metadata: {
              ...baseRecommendation.metadata,
              source: "AI_GENERATIVE",
            },
          };
        }
      }
    }
  } catch (e) {
    // Graceful fallback to deterministic recommendation
  }

  return baseRecommendation;
}

/**
 * Main Recommendation Generator
 * Reuses risk scoring logic, evaluates recovery strategy, and personalizes communication.
 */
export async function generateCaseRecommendation(
  input: CaseRecommendationInput
): Promise<RecommendationResult> {
  // 1. Calculate risk score and level
  const riskResult = calculateRevenueRisk({
    amount: input.transaction.amount,
    caseType: input.caseType as CaseType,
    failureCount: input.attemptsCount,
    customerHistory: {
      lifetimeValue: input.customer.lifetimeValue || 0,
      status: input.customer.status || "ACTIVE",
    },
  });

  // 2. Generate deterministic recommendation
  const baseRecommendation = evaluateDeterministicRecommendation(
    input,
    riskResult.score,
    riskResult.riskLevel
  );

  // 3. Attempt AI refinement if API key configured, otherwise return deterministic result
  return await callGeminiIfAvailable(input, baseRecommendation);
}

/**
 * Helper to generate recommendations directly from a database case ID.
 */
export async function generateCaseRecommendationFromDb(
  caseId: string
): Promise<RecommendationResult> {
  const c = await prisma.recoveryCase.findUnique({
    where: { id: caseId },
    include: {
      customer: true,
      transaction: true,
      actions: true,
      auditLogs: true,
    },
  });

  if (!c) {
    throw new Error(`RecoveryCase with ID ${caseId} not found.`);
  }

  let caseType = "Failed Payment";
  if (c.auditLogs && c.auditLogs.length > 0) {
    for (const log of c.auditLogs) {
      if (log.details) {
        try {
          const parsed = JSON.parse(log.details);
          if (parsed.category === "FAILED_PAYMENT") caseType = "Failed Payment";
          if (parsed.category === "CHECKOUT_ABANDONMENT") caseType = "Checkout Abandonment";
          if (parsed.category === "FAILED_SUBSCRIPTION") caseType = "Failed Subscription";
          if (parsed.category === "OVERDUE_INVOICE") caseType = "Overdue Invoice";
        } catch (e) {}
      }
    }
  }

  const input: CaseRecommendationInput = {
    caseId: c.id,
    caseType,
    attemptsCount: c.attemptsCount,
    priority: c.priority,
    notes: c.notes,
    customer: {
      name: c.customer.name,
      email: c.customer.email,
      phone: c.customer.phone,
      riskScore: c.customer.riskScore,
      status: c.customer.status,
      lifetimeValue: c.customer.lifetimeValue,
    },
    transaction: {
      amount: c.transaction?.amount || 0,
      currency: c.transaction?.currency || "USD",
      failureReason: c.transaction?.failureReason,
      failureCode: c.transaction?.failureCode,
      paymentMethod: c.transaction?.paymentMethod,
      paymentGateway: c.transaction?.paymentGateway,
      transactionDate: c.transaction?.transactionDate,
    },
    previousActions: c.actions.map((a) => ({
      actionType: a.actionType,
      channel: a.channel,
      result: a.result,
    })),
  };

  return await generateCaseRecommendation(input);
}
