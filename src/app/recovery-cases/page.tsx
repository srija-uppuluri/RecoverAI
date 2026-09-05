import { prisma } from "@/lib/prisma";
import { getCaseCategory } from "@/lib/caseHelpers";
import CasesSection, { SerializedCase } from "@/components/CasesSection";

// Force dynamic rendering so router.refresh() re-fetches from DB
export const dynamic = "force-dynamic";

export default async function RecoveryCasesPage() {
  const cases = await prisma.recoveryCase.findMany({
    include: {
      customer: true,
      transaction: true,
      auditLogs: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedCases: SerializedCase[] = cases.map((c) => ({
    id: c.id,
    status: c.status,
    priority: c.priority,
    recoveredAmount: c.recoveredAmount,
    attemptsCount: c.attemptsCount,
    createdAt: c.createdAt.toISOString(),
    caseType: getCaseCategory(c),
    customer: {
      name: c.customer.name,
      email: c.customer.email,
      phone: c.customer.phone,
      riskScore: c.customer.riskScore,
    },
    transaction: c.transaction
      ? {
          amount: c.transaction.amount,
          paymentMethod: c.transaction.paymentMethod,
          failureReason: c.transaction.failureReason,
        }
      : null,
  }));

  let initialAuditLogs: {
    id: string;
    action: string;
    actor: string;
    details?: string | null;
    createdAt: string;
  }[] = [];

  if (cases.length > 0) {
    try {
      const logs = await prisma.auditLog.findMany({
        where: { recoveryCaseId: cases[0].id },
        orderBy: { createdAt: "desc" },
      });
      initialAuditLogs = logs.map((l) => ({
        id: l.id,
        action: l.action,
        actor: l.actor,
        details: l.details,
        createdAt: l.createdAt.toISOString(),
      }));
    } catch (e) {
      console.error("Error pre-fetching initial case data:", e);
    }
  }

  return (
    <div style={{ maxWidth: "1200px" }}>
      <CasesSection
        cases={serializedCases}
        initialAuditLogs={initialAuditLogs}
      />
    </div>
  );
}
