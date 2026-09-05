import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ─── POST /api/transactions/create-case ───────────────────────────────── */
// Creates a recovery case for an existing transaction.
// Refuses if a case already exists for that transaction.
export async function POST(req: NextRequest) {
  try {
    const { transactionId, priority } = await req.json();

    if (!transactionId) {
      return NextResponse.json({ success: false, error: "transactionId is required" }, { status: 400 });
    }

    // Fetch transaction with customer
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { customer: true, recoveryCase: true },
    });

    if (!transaction) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    // Block duplicates
    if (transaction.recoveryCase) {
      const existing = transaction.recoveryCase;
      return NextResponse.json({
        success: false,
        error: `A recovery case already exists for this transaction: ${existing.caseRef ?? existing.id}`,
      }, { status: 409 });
    }

    // Only recoverable transaction types get cases
    const recoverableStatuses = ["FAILED", "PENDING"];
    if (!recoverableStatuses.includes(transaction.status)) {
      return NextResponse.json({
        success: false,
        error: `Transaction status '${transaction.status}' does not require a recovery case.`,
      }, { status: 400 });
    }

    // Determine priority from transaction type + amount
    const autoPriority = priority ?? derivePriority(
      transaction.transactionType ?? "FAILED_PAYMENT",
      transaction.amount,
      transaction.customer.riskScore ?? 0
    );

    // Generate caseRef matching the txnRef suffix
    const txnSuffix = transaction.txnRef?.replace("TXN-", "") ?? transaction.id.slice(-5).toUpperCase();
    const caseRef = `CASE-${txnSuffix}`;

    // Create recovery case
    const recoveryCase = await prisma.recoveryCase.create({
      data: {
        caseRef,
        customerId: transaction.customerId,
        transactionId: transaction.id,
        status: "OPEN",
        priority: autoPriority,
        recoveredAmount: 0,
        attemptsCount: 0,
        notes: `Recovery case created from transaction ${transaction.txnRef ?? transaction.id}. Type: ${transaction.transactionType ?? "FAILED_PAYMENT"}.`,
      },
    });

    // Audit: CASE_CREATED
    await prisma.auditLog.create({
      data: {
        entityType: "RecoveryCase",
        entityId: recoveryCase.id,
        action: "CASE_CREATED",
        actor: "MERCHANT",
        transactionId: transaction.id,
        customerId: transaction.customerId,
        recoveryCaseId: recoveryCase.id,
        details: JSON.stringify({
          caseRef,
          transactionRef: transaction.txnRef,
          amount: transaction.amount,
          type: transaction.transactionType,
          priority: autoPriority,
          category: transaction.transactionType,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      recoveryCase: {
        id: recoveryCase.id,
        caseRef,
        status: recoveryCase.status,
        priority: recoveryCase.priority,
        transactionId: transaction.id,
        txnRef: transaction.txnRef,
        customerName: transaction.customer.name,
        amount: transaction.amount,
      },
      message: `Recovery case ${caseRef} created for transaction ${transaction.txnRef ?? transaction.id}.`,
    });
  } catch (err) {
    console.error("POST /api/transactions/create-case error:", err);
    return NextResponse.json({ success: false, error: "Failed to create recovery case" }, { status: 500 });
  }
}

function derivePriority(transactionType: string, amount: number, riskScore: number): string {
  if (transactionType === "OVERDUE_INVOICE" && amount >= 5000) return "URGENT";
  if (riskScore >= 0.6 || amount >= 2000) return "URGENT";
  if (riskScore >= 0.4 || amount >= 800) return "HIGH";
  if (amount >= 300) return "MEDIUM";
  return "LOW";
}
