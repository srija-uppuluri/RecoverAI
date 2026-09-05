import { prisma } from "@/lib/prisma";
import { getCaseCategory } from "@/lib/caseHelpers";
import AuditTrailSection from "@/components/AuditTrailSection";

export default async function AuditTrailPage() {
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      recoveryCase: {
        include: {
          customer: true,
          transaction: true,
          auditLogs: true,
        },
      },
      transaction: true,
    },
  });

  const logs = auditLogs.map((log) => {
    const txn = log.transaction ?? log.recoveryCase?.transaction ?? null;
    const customerName =
      log.recoveryCase?.customer?.name ??
      log.transaction?.customerId ??   // fallback
      "Unknown";
    return {
      id: log.id,
      action: log.action,
      actor: log.actor,
      details: log.details,
      createdAt: log.createdAt.toISOString(),
      caseId: log.recoveryCaseId,
      caseRef: log.recoveryCase?.caseRef ?? null,
      txnRef: txn?.txnRef ?? null,
      customerName,
      caseType: log.recoveryCase
        ? getCaseCategory(log.recoveryCase)
        : txn?.transactionType?.replace(/_/g, " ") ?? "Unknown",
    };
  });

  return (
    <div style={{ maxWidth: "1400px" }}>
      <AuditTrailSection logs={logs} />
    </div>
  );
}
