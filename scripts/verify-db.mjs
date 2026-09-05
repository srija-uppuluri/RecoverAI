import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Verifying Prisma database configuration...");

  // 1. Verify model access
  const customerCount = await prisma.customer.count();
  const txCount = await prisma.transaction.count();
  const caseCount = await prisma.recoveryCase.count();
  const actionCount = await prisma.recoveryAction.count();
  const auditCount = await prisma.auditLog.count();

  console.log("Model connectivity verified successfully:");
  console.log(`- Customer count: ${customerCount}`);
  console.log(`- Transaction count: ${txCount}`);
  console.log(`- RecoveryCase count: ${caseCount}`);
  console.log(`- RecoveryAction count: ${actionCount}`);
  console.log(`- AuditLog count: ${auditCount}`);

  // 2. Perform a transactional create and rollback test to verify write and relations
  const testRun = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        externalId: "cust_test_foundation",
        name: "Test Customer",
        email: "test@recoverai.local",
        status: "ACTIVE",
        lifetimeValue: 1200.0,
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        customerId: customer.id,
        amount: 299.0,
        currency: "USD",
        status: "FAILED",
        failureReason: "INSUFFICIENT_FUNDS",
        paymentMethod: "CREDIT_CARD",
      },
    });

    const recoveryCase = await tx.recoveryCase.create({
      data: {
        customerId: customer.id,
        transactionId: transaction.id,
        status: "OPEN",
        priority: "HIGH",
      },
    });

    const recoveryAction = await tx.recoveryAction.create({
      data: {
        recoveryCaseId: recoveryCase.id,
        actionType: "EMAIL_DUNNING",
        channel: "EMAIL",
        status: "PENDING",
      },
    });

    const auditLog = await tx.auditLog.create({
      data: {
        entityType: "RecoveryCase",
        entityId: recoveryCase.id,
        action: "CASE_OPENED",
        actor: "SYSTEM",
        customerId: customer.id,
        recoveryCaseId: recoveryCase.id,
      },
    });

    return {
      customerId: customer.id,
      transactionId: transaction.id,
      recoveryCaseId: recoveryCase.id,
      recoveryActionId: recoveryAction.id,
      auditLogId: auditLog.id,
    };
  });

  console.log("Test record creation verified across all 5 models:", testRun);

  // Clean up the verification records (to adhere to 'Do not generate mock data yet')
  await prisma.auditLog.deleteMany({ where: { id: testRun.auditLogId } });
  await prisma.recoveryAction.deleteMany({ where: { id: testRun.recoveryActionId } });
  await prisma.recoveryCase.deleteMany({ where: { id: testRun.recoveryCaseId } });
  await prisma.transaction.deleteMany({ where: { id: testRun.transactionId } });
  await prisma.customer.deleteMany({ where: { id: testRun.customerId } });

  console.log("Cleaned up temporary verification records.");
  console.log("Prisma SQLite configuration is 100% operational!");
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
