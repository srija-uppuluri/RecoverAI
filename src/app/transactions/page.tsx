import { prisma } from "@/lib/prisma";
import TransactionsSection from "@/components/TransactionsSection";

export default async function TransactionsPage() {
  const txns = await prisma.transaction.findMany({
    include: { customer: true, recoveryCase: true },
    orderBy: { createdAt: "desc" },
  });

  const total = txns.length;
  const successful = txns.filter((t) => t.status === "SUCCEEDED").length;
  const failed = txns.filter((t) => t.status === "FAILED").length;
  const pending = txns.filter((t) => t.status === "PENDING").length;
  const totalValue = txns.reduce((s, t) => s + t.amount, 0);
  const revenueAtRisk = txns
    .filter((t) => t.status === "FAILED" || t.status === "PENDING")
    .reduce((s, t) => s + t.amount, 0);

  const serialized = txns.map((t) => ({
    id: t.id,
    txnRef: t.txnRef ?? `TXN-${t.id.slice(-6).toUpperCase()}`,
    customerName: t.customer.name,
    customerEmail: t.customer.email,
    customerId: t.customerId,
    amount: t.amount,
    currency: t.currency,
    transactionType: t.transactionType ?? "FAILED_PAYMENT",
    status: t.status,
    paymentMethod: t.paymentMethod ?? "CREDIT_CARD",
    failureReason: t.failureReason ?? null,
    riskScore: t.customer.riskScore ?? 0,
    transactionDate: t.transactionDate.toISOString(),
    createdAt: t.createdAt.toISOString(),
    recoveryCase: t.recoveryCase
      ? {
          id: t.recoveryCase.id,
          caseRef: t.recoveryCase.caseRef ?? `CASE-${t.recoveryCase.id.slice(-6).toUpperCase()}`,
          status: t.recoveryCase.status,
          recoveredAmount: t.recoveryCase.recoveredAmount,
        }
      : null,
  }));

  // Transactions without a recovery case that are recoverable
  const unlinkedRecoverable = txns.filter(
    (t) => !t.recoveryCase && (t.status === "FAILED" || t.status === "PENDING")
  ).length;

  return (
    <div style={{ maxWidth: "1400px" }}>
      <TransactionsSection
        transactions={serialized}
        kpis={{ total, successful, failed, pending, totalValue, revenueAtRisk, unlinkedRecoverable }}
      />
    </div>
  );
}
