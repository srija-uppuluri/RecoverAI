export type CaseCategory =
  | "Failed Payment"
  | "Checkout Abandonment"
  | "Failed Subscription"
  | "Overdue Invoice";

type CaseItem = {
  auditLogs?: { details: string | null }[];
  transaction?: {
    failureReason: string | null;
    paymentGateway: string | null;
    paymentMethod: string | null;
  } | null;
};

/**
 * Derives a human-readable category label from a recovery case record.
 * Checks audit log metadata first, then falls back to transaction failure reason heuristics.
 */
export function getCaseCategory(c: CaseItem): CaseCategory {
  if (c.auditLogs && c.auditLogs.length > 0) {
    for (const log of c.auditLogs) {
      if (log.details) {
        try {
          const parsed = JSON.parse(log.details);
          if (parsed.category === "FAILED_PAYMENT") return "Failed Payment";
          if (parsed.category === "CHECKOUT_ABANDONMENT") return "Checkout Abandonment";
          if (parsed.category === "FAILED_SUBSCRIPTION") return "Failed Subscription";
          if (parsed.category === "OVERDUE_INVOICE") return "Overdue Invoice";
        } catch {
          // ignore malformed JSON
        }
      }
    }
  }

  const reason = c.transaction?.failureReason || "";
  const gateway = c.transaction?.paymentGateway || "";

  if (
    gateway.includes("INVOICE") ||
    reason.includes("INVOICE") ||
    reason.includes("NET_") ||
    reason.includes("PO_") ||
    reason.includes("REMITTANCE")
  ) {
    return "Overdue Invoice";
  }
  if (
    reason.includes("SUBSCRIPTION") ||
    reason.includes("RECURRING") ||
    reason.includes("MANDATE")
  ) {
    return "Failed Subscription";
  }
  if (
    reason.includes("CART") ||
    reason.includes("3DS") ||
    reason.includes("PAYPAL") ||
    reason.includes("CHECKOUT") ||
    reason.includes("KLARNA") ||
    reason.includes("OTP")
  ) {
    return "Checkout Abandonment";
  }
  return "Failed Payment";
}

export type CategoryStat = {
  key: string;
  label: CaseCategory;
  atRisk: number;
  recovered: number;
  count: number;
};

/** Returns a fresh zeroed category stats array. */
export function makeCategoryStats(): CategoryStat[] {
  return [
    { key: "FAILED_PAYMENT", label: "Failed Payment", atRisk: 0, recovered: 0, count: 0 },
    { key: "CHECKOUT_ABANDONMENT", label: "Checkout Abandonment", atRisk: 0, recovered: 0, count: 0 },
    { key: "FAILED_SUBSCRIPTION", label: "Failed Subscription", atRisk: 0, recovered: 0, count: 0 },
    { key: "OVERDUE_INVOICE", label: "Overdue Invoice", atRisk: 0, recovered: 0, count: 0 },
  ];
}
