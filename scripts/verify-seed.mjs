import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verify() {
  console.log("==========================================");
  console.log("   RECOVERAI DATABASE SEED VERIFICATION   ");
  console.log("==========================================");

  // 1. Overall counts
  const customerCount = await prisma.customer.count();
  const txCount = await prisma.transaction.count();
  const caseCount = await prisma.recoveryCase.count();
  const actionCount = await prisma.recoveryAction.count();
  const auditCount = await prisma.auditLog.count();

  console.log("\n[Record Counts]");
  console.log(`- Customers:       ${customerCount}`);
  console.log(`- Transactions:    ${txCount}`);
  console.log(`- Recovery Cases:  ${caseCount}`);
  console.log(`- Recovery Actions:${actionCount}`);
  console.log(`- Audit Logs:      ${auditCount}`);

  if (caseCount !== 60) {
    throw new Error(`Expected 60 cases, but found ${caseCount}`);
  }

  // 2. Breakdown by category in audit logs
  const auditLogs = await prisma.auditLog.findMany();
  const categoryMap = {
    FAILED_PAYMENT: 0,
    CHECKOUT_ABANDONMENT: 0,
    FAILED_SUBSCRIPTION: 0,
    OVERDUE_INVOICE: 0,
  };

  for (const log of auditLogs) {
    if (log.details) {
      try {
        const parsed = JSON.parse(log.details);
        if (parsed.category && categoryMap[parsed.category] !== undefined) {
          categoryMap[parsed.category]++;
        }
      } catch (e) {}
    }
  }

  console.log("\n[Category Distribution]");
  console.log(`- Failed Payments:        ${categoryMap.FAILED_PAYMENT} (Expected: 25)`);
  console.log(`- Checkout Abandonments:  ${categoryMap.CHECKOUT_ABANDONMENT} (Expected: 15)`);
  console.log(`- Failed Subscriptions:   ${categoryMap.FAILED_SUBSCRIPTION} (Expected: 10)`);
  console.log(`- Overdue Invoices:       ${categoryMap.OVERDUE_INVOICE} (Expected: 10)`);

  const categoryPassed =
    categoryMap.FAILED_PAYMENT === 25 &&
    categoryMap.CHECKOUT_ABANDONMENT === 15 &&
    categoryMap.FAILED_SUBSCRIPTION === 10 &&
    categoryMap.OVERDUE_INVOICE === 10;

  if (!categoryPassed) {
    throw new Error("Category breakdown does not match expected target counts!");
  }

  // 3. Status breakdown
  const statusGroups = await prisma.recoveryCase.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  console.log("\n[Case Status Distribution]");
  for (const g of statusGroups) {
    console.log(`- ${g.status.padEnd(14)}: ${g._count.status}`);
  }

  // 4. Priority breakdown
  const priorityGroups = await prisma.recoveryCase.groupBy({
    by: ["priority"],
    _count: { priority: true },
  });

  console.log("\n[Priority Distribution]");
  for (const g of priorityGroups) {
    console.log(`- ${g.priority.padEnd(14)}: ${g._count.priority}`);
  }

  // 5. Financial metrics
  const transactions = await prisma.transaction.findMany();
  const cases = await prisma.recoveryCase.findMany();

  const totalAtRisk = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalRecovered = cases.reduce((sum, c) => sum + c.recoveredAmount, 0);
  const recoveryRate = ((totalRecovered / totalAtRisk) * 100).toFixed(1);

  console.log("\n[Financial Metrics]");
  console.log(`- Total Value Processed: $${totalAtRisk.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  console.log(`- Total Recovered Value: $${totalRecovered.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  console.log(`- Synthetic Recovery Rate: ${recoveryRate}%`);

  // 6. Relational Integrity Check
  const sampleCase = await prisma.recoveryCase.findFirst({
    include: {
      customer: true,
      transaction: true,
      actions: true,
      auditLogs: true,
    },
  });

  console.log("\n[Relational Integrity Verification]");
  console.log(`- Sample Case ID:      ${sampleCase.id}`);
  console.log(`- Customer:            ${sampleCase.customer.name} (${sampleCase.customer.email})`);
  console.log(`- Transaction Amount:  $${sampleCase.transaction.amount} (${sampleCase.transaction.failureReason})`);
  console.log(`- Recovery Actions:    ${sampleCase.actions.length} action(s) linked`);
  console.log(`- Audit Logs:          ${sampleCase.auditLogs.length} log(s) linked`);

  console.log("\n>>> ALL 60 SYNTHETIC CASES SUCCESSFULLY VERIFIED! <<<\n");
}

verify()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
