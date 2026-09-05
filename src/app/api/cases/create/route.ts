import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ─── POST /api/cases/create ───────────────────────────────────────────── */
// Manual case creation from Recovery Cases page — merchant picks a transaction.
export async function POST(req: NextRequest) {
  try {
    const { transactionId, priority, notes } = await req.json();

    if (!transactionId) {
      return NextResponse.json({ success: false, error: "transactionId is required" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { customer: true, recoveryCase: true },
    });

    if (!transaction) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.recoveryCase) {
      return NextResponse.json({
        success: false,
        error: `Recovery case already exists: ${transaction.recoveryCase.caseRef ?? transaction.recoveryCase.id}`,
      }, { status: 409 });
    }

    const txnSuffix = transaction.txnRef?.replace("TXN-", "") ?? transaction.id.slice(-5).toUpperCase();
    const caseRef = `CASE-${txnSuffix}`;

    const finalPriority = priority ?? derivePriority(
      transaction.transactionType ?? "FAILED_PAYMENT",
      transaction.amount,
      transaction.customer.riskScore ?? 0
    );

    const recoveryCase = await prisma.recoveryCase.create({
      data: {
        caseRef,
        customerId: transaction.customerId,
        transactionId: transaction.id,
        status: "OPEN",
        priority: finalPriority,
        recoveredAmount: 0,
        attemptsCount: 0,
        notes: notes ?? `Manually created recovery case for transaction ${transaction.txnRef ?? transaction.id}.`,
      },
      include: { customer: true, transaction: true },
    });

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
          priority: finalPriority,
          createdBy: "MERCHANT",
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
        recoveredAmount: recoveryCase.recoveredAmount,
        attemptsCount: recoveryCase.attemptsCount,
        createdAt: recoveryCase.createdAt.toISOString(),
        caseType: mapTransactionType(transaction.transactionType),
        customer: {
          name: recoveryCase.customer.name,
          email: recoveryCase.customer.email,
          phone: recoveryCase.customer.phone,
          riskScore: recoveryCase.customer.riskScore,
        },
        transaction: {
          amount: recoveryCase.transaction.amount,
          paymentMethod: recoveryCase.transaction.paymentMethod,
          failureReason: recoveryCase.transaction.failureReason,
        },
      },
      message: `Recovery case ${caseRef} created successfully.`,
    });
  } catch (err) {
    console.error("POST /api/cases/create error:", err);
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

function mapTransactionType(t: string | null): string {
  switch (t) {
    case "FAILED_PAYMENT": return "Failed Payment";
    case "CHECKOUT_ABANDONMENT": return "Checkout Abandonment";
    case "FAILED_SUBSCRIPTION": return "Failed Subscription";
    case "OVERDUE_INVOICE": return "Overdue Invoice";
    default: return "Failed Payment";
  }
}
