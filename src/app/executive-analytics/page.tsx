import { prisma } from "@/lib/prisma";
import { getCaseCategory, makeCategoryStats } from "@/lib/caseHelpers";
import ExecutiveAnalyticsSection from "@/components/ExecutiveAnalyticsSection";

export default async function ExecutiveAnalyticsPage() {
  const cases = await prisma.recoveryCase.findMany({
    include: {
      customer: true,
      transaction: true,
      auditLogs: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalCases = cases.length;
  const totalRevenueAtRisk = cases.reduce((acc, c) => acc + (c.transaction?.amount || 0), 0);
  const totalRevenueRecovered = cases.reduce((acc, c) => acc + (c.recoveredAmount || 0), 0);

  const recoveryEfficiency =
    totalRevenueAtRisk > 0 ? (totalRevenueRecovered / totalRevenueAtRisk) * 100 : 0;

  const failedCases = cases.filter((c) => c.status === "FAILED");
  const revenueLost = failedCases.reduce(
    (acc, c) => acc + ((c.transaction?.amount || 0) - c.recoveredAmount),
    0
  );

  const recoveredCases = cases.filter((c) => c.status === "RECOVERED" && c.resolvedAt);
  const avgResolutionDays =
    recoveredCases.length > 0
      ? recoveredCases.reduce((acc, c) => {
          const ms = new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime();
          return acc + ms / (1000 * 60 * 60 * 24);
        }, 0) / recoveredCases.length
      : null;

  const avgAttemptsToRecover =
    recoveredCases.length > 0
      ? recoveredCases.reduce((acc, c) => acc + c.attemptsCount, 0) / recoveredCases.length
      : null;

  const urgentCount      = cases.filter((c) => c.priority === "URGENT").length;
  const highPriorityCount   = cases.filter((c) => c.priority === "HIGH").length;
  const mediumPriorityCount = cases.filter((c) => c.priority === "MEDIUM").length;
  const lowPriorityCount    = cases.filter((c) => c.priority === "LOW").length;

  const categories = makeCategoryStats();
  for (const c of cases) {
    const caseType = getCaseCategory(c);
    const cat = categories.find((item) => item.label === caseType);
    if (cat) {
      cat.atRisk     += c.transaction?.amount || 0;
      cat.recovered  += c.recoveredAmount || 0;
      cat.count      += 1;
    }
  }

  return (
    <div style={{ maxWidth: "1200px" }}>
      <ExecutiveAnalyticsSection
        totalCases={totalCases}
        totalRevenueAtRisk={totalRevenueAtRisk}
        totalRevenueRecovered={totalRevenueRecovered}
        revenueLost={revenueLost}
        recoveryEfficiency={recoveryEfficiency}
        avgResolutionDays={avgResolutionDays}
        avgAttemptsToRecover={avgAttemptsToRecover}
        highPriorityCount={highPriorityCount}
        urgentCount={urgentCount}
        mediumPriorityCount={mediumPriorityCount}
        lowPriorityCount={lowPriorityCount}
        categories={categories}
      />
    </div>
  );
}
