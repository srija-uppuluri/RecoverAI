import { prisma } from "@/lib/prisma";
import { getCaseCategory, makeCategoryStats } from "@/lib/caseHelpers";
import OverviewSection from "@/components/OverviewSection";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
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
  const recoveryRate =
    totalRevenueAtRisk > 0 ? (totalRevenueRecovered / totalRevenueAtRisk) * 100 : 0;

  const recoveredCount = cases.filter((c) => c.status === "RECOVERED").length;
  const inProgressCount = cases.filter((c) => c.status === "IN_PROGRESS").length;
  const openCount = cases.filter((c) => c.status === "OPEN").length;
  const escalatedCount = cases.filter((c) => c.status === "ESCALATED").length;
  const failedCount = cases.filter((c) => c.status === "FAILED").length;

  const categories = makeCategoryStats();

  for (const c of cases) {
    const caseType = getCaseCategory(c);
    const cat = categories.find((item) => item.label === caseType);
    if (cat) {
      cat.atRisk += c.transaction?.amount || 0;
      cat.recovered += c.recoveredAmount || 0;
      cat.count += 1;
    }
  }

  const maxCategoryAmount = Math.max(
    ...categories.map((c) => Math.max(c.atRisk, c.recovered)),
    1
  );

  return (
    <div style={{ maxWidth: "1200px" }}>
        <OverviewSection
          totalCases={totalCases}
          totalRevenueAtRisk={totalRevenueAtRisk}
          totalRevenueRecovered={totalRevenueRecovered}
          recoveryRate={recoveryRate}
          recoveredCount={recoveredCount}
          inProgressCount={inProgressCount}
          openCount={openCount}
          escalatedCount={escalatedCount}
          failedCount={failedCount}
          categories={categories}
          maxCategoryAmount={maxCategoryAmount}
        />
    </div>
  );
}
