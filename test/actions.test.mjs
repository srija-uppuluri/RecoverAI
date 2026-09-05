import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.ts";
import { executeRecoveryAction } from "../src/lib/actions.ts";

test("Action Execution - SEND_EMAIL", async () => {
  // Find a test case
  const testCase = await prisma.recoveryCase.findFirst({
    where: { status: "OPEN" },
    include: { customer: true, transaction: true },
  });

  assert.ok(testCase, "Should find at least one OPEN case");

  const result = await executeRecoveryAction({
    caseId: testCase.id,
    actionType: "SEND_EMAIL",
    actor: "TEST_RUNNER",
  });

  assert.equal(result.success, true);
  assert.equal(result.actionType, "SEND_EMAIL");
  assert.equal(result.status, "IN_PROGRESS");
  assert.ok(result.auditLogId);
  assert.ok(result.message.includes(testCase.customer.email));

  // Verify DB AuditLog
  const log = await prisma.auditLog.findUnique({ where: { id: result.auditLogId } });
  assert.ok(log);
  assert.equal(log.action, "EMAIL_SENT");
  assert.equal(log.actor, "TEST_RUNNER");
});

test("Action Execution - SEND_SMS (Phone Validation)", async () => {
  // Test with a case having phone
  const caseWithPhone = await prisma.recoveryCase.findFirst({
    where: { customer: { phone: { not: null } } },
    include: { customer: true },
  });

  assert.ok(caseWithPhone);

  const res = await executeRecoveryAction({
    caseId: caseWithPhone.id,
    actionType: "SEND_SMS",
    actor: "TEST_RUNNER",
  });

  assert.equal(res.success, true);
  assert.equal(res.actionType, "SEND_SMS");
  assert.ok(res.message.includes(caseWithPhone.customer.phone));
});

test("Action Execution - APPLY_DISCOUNT", async () => {
  const testCase = await prisma.recoveryCase.findFirst({
    include: { customer: true, transaction: true },
  });

  assert.ok(testCase);

  const res = await executeRecoveryAction({
    caseId: testCase.id,
    actionType: "APPLY_DISCOUNT",
    actor: "TEST_RUNNER",
  });

  assert.equal(res.success, true);
  assert.equal(res.actionType, "APPLY_DISCOUNT");
  assert.ok(res.details.discountAmount > 0);
  assert.ok(res.message.includes("15% recovery discount applied"));

  // Verify AuditLog
  const log = await prisma.auditLog.findUnique({ where: { id: res.auditLogId } });
  assert.equal(log.action, "DISCOUNT_APPLIED");
});

test("Action Execution - RETRY_PAYMENT", async () => {
  // Create a temporary isolated case for retry test to not corrupt main seed distribution
  const customer = await prisma.customer.create({
    data: {
      name: "Retry Test User",
      email: "retry.test@recoverai.local",
      status: "ACTIVE",
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      customerId: customer.id,
      amount: 199.0,
      status: "FAILED",
      paymentMethod: "CREDIT_CARD",
    },
  });

  const tempCase = await prisma.recoveryCase.create({
    data: {
      customerId: customer.id,
      transactionId: transaction.id,
      status: "OPEN",
      attemptsCount: 1,
    },
  });

  const res = await executeRecoveryAction({
    caseId: tempCase.id,
    actionType: "RETRY_PAYMENT",
    actor: "TEST_RUNNER",
  });

  assert.equal(res.success, true);
  assert.equal(res.status, "RECOVERED");
  assert.equal(res.recoveredAmount, 199.0);
  assert.ok(res.message.includes("199.00"));

  // Verify transaction status updated to SUCCEEDED
  const updatedTx = await prisma.transaction.findUnique({ where: { id: transaction.id } });
  assert.equal(updatedTx.status, "SUCCEEDED");

  // Clean up temporary test records
  await prisma.auditLog.deleteMany({ where: { recoveryCaseId: tempCase.id } });
  await prisma.recoveryAction.deleteMany({ where: { recoveryCaseId: tempCase.id } });
  await prisma.recoveryCase.deleteMany({ where: { id: tempCase.id } });
  await prisma.transaction.deleteMany({ where: { id: transaction.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
});

test("Action Execution - MARK_RESOLVED", async () => {
  const customer = await prisma.customer.create({
    data: {
      name: "Resolve Test User",
      email: "resolve.test@recoverai.local",
      status: "ACTIVE",
    },
  });

  const transaction = await prisma.transaction.create({
    data: {
      customerId: customer.id,
      amount: 350.0,
      status: "FAILED",
      paymentMethod: "ACH",
    },
  });

  const tempCase = await prisma.recoveryCase.create({
    data: {
      customerId: customer.id,
      transactionId: transaction.id,
      status: "OPEN",
    },
  });

  const res = await executeRecoveryAction({
    caseId: tempCase.id,
    actionType: "MARK_RESOLVED",
    actor: "ADMIN_OFFICER",
  });

  assert.equal(res.success, true);
  assert.equal(res.status, "RECOVERED");
  assert.equal(res.recoveredAmount, 350.0);

  // Clean up temporary test records
  await prisma.auditLog.deleteMany({ where: { recoveryCaseId: tempCase.id } });
  await prisma.recoveryAction.deleteMany({ where: { recoveryCaseId: tempCase.id } });
  await prisma.recoveryCase.deleteMany({ where: { id: tempCase.id } });
  await prisma.transaction.deleteMany({ where: { id: transaction.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
});

test("Action Execution - Invalid Case Validation", async () => {
  await assert.rejects(
    executeRecoveryAction({
      caseId: "non_existent_case_id_123",
      actionType: "SEND_EMAIL",
    }),
    /not found/
  );
});
