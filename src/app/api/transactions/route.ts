import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ─── GET /api/transactions ─────────────────────────────────────────────── */
export async function GET() {
  try {
    const txns = await prisma.transaction.findMany({
      include: { customer: true, recoveryCase: true },
      orderBy: { createdAt: "desc" },
    });

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
      failureReason: t.failureReason,
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

    return NextResponse.json({ success: true, transactions: serialized });
  } catch (err) {
    console.error("GET /api/transactions error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch transactions" }, { status: 500 });
  }
}

/* ─── POST /api/transactions ─────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName,
      customerEmail,
      amount,
      currency = "USD",
      transactionType,
      paymentMethod,
      status,
      transactionDate,
    } = body;

    // Validate required fields
    if (!customerName || !customerEmail || !amount || !transactionType || !paymentMethod || !status) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: customerName, customerEmail, amount, transactionType, paymentMethod, status" },
        { status: 400 }
      );
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: "Amount must be a positive number" }, { status: 400 });
    }

    // Generate human-readable txnRef — TXN-XXXXX
    const txnNumber = Math.floor(10000 + Math.random() * 90000);
    const txnRef = `TXN-${txnNumber}`;

    // Upsert customer by email
    const customer = await prisma.customer.upsert({
      where: { email: customerEmail },
      update: { name: customerName },
      create: {
        name: customerName,
        email: customerEmail,
        riskScore: 0.3,
        status: "ACTIVE",
        lifetimeValue: Number(amount),
        currency,
      },
    });

    // Map transactionType to a failure reason for AI recommendation compatibility
    const failureReasonMap: Record<string, string> = {
      FAILED_PAYMENT: "CARD_DECLINED",
      CHECKOUT_ABANDONMENT: "CART_ABANDONED_PAYMENT_STEP",
      FAILED_SUBSCRIPTION: "RECURRING_BILLING_FAILED",
      OVERDUE_INVOICE: "NET_30_PAST_DUE",
    };

    const txnDate = transactionDate ? new Date(transactionDate) : new Date();

    const transaction = await prisma.transaction.create({
      data: {
        txnRef,
        customerId: customer.id,
        amount: Number(amount),
        currency,
        transactionType,
        status,
        paymentMethod,
        failureReason: status === "FAILED" ? (failureReasonMap[transactionType] ?? "GENERIC_DECLINE") : null,
        transactionDate: txnDate,
        createdAt: txnDate,
      },
    });

    // Audit: TRANSACTION_CREATED
    await prisma.auditLog.create({
      data: {
        entityType: "Transaction",
        entityId: transaction.id,
        action: "TRANSACTION_CREATED",
        actor: "MERCHANT",
        transactionId: transaction.id,
        customerId: customer.id,
        details: JSON.stringify({
          txnRef,
          amount: Number(amount),
          currency,
          transactionType,
          status,
          paymentMethod,
        }),
      },
    });

    // Auto-create a recovery case for recoverable transactions (FAILED or PENDING)
    let recoveryCase = null;
    if (status === "FAILED" || status === "PENDING") {
      const priority = derivePriority(transactionType, Number(amount), customer.riskScore ?? 0);

      // Build a unique caseRef — try the txnRef suffix first, fall back to a random suffix
      const preferredCaseRef = `CASE-${txnNumber}`;
      const existingCase = await prisma.recoveryCase.findUnique({ where: { caseRef: preferredCaseRef } });
      const caseRef = existingCase
        ? `CASE-${Math.floor(10000 + Math.random() * 90000)}`
        : preferredCaseRef;

      recoveryCase = await prisma.recoveryCase.create({
        data: {
          caseRef,
          customerId: customer.id,
          transactionId: transaction.id,
          status: "OPEN",
          priority,
          recoveredAmount: 0,
          attemptsCount: 0,
          notes: `Auto-generated recovery case for transaction ${txnRef}.`,
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
          customerId: customer.id,
          recoveryCaseId: recoveryCase.id,
          details: JSON.stringify({
            caseRef,
            transactionRef: txnRef,
            amount: Number(amount),
            type: transactionType,
            priority,
            category: transactionType,
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        txnRef,
        customerName: customer.name,
        customerEmail: customer.email,
        customerId: customer.id,
        amount: transaction.amount,
        currency: transaction.currency,
        transactionType: transaction.transactionType,
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        riskScore: customer.riskScore ?? 0,
        transactionDate: transaction.transactionDate.toISOString(),
        createdAt: transaction.createdAt.toISOString(),
        recoveryCase: recoveryCase
          ? {
              id: recoveryCase.id,
              caseRef: recoveryCase.caseRef!,
              status: recoveryCase.status,
              recoveredAmount: recoveryCase.recoveredAmount,
            }
          : null,
      },
      recoveryCase: recoveryCase
        ? { id: recoveryCase.id, caseRef: recoveryCase.caseRef }
        : null,
      message: recoveryCase
        ? `Transaction ${txnRef} created and recovery case ${recoveryCase.caseRef} opened automatically.`
        : `Transaction ${txnRef} created successfully.`,
    });
  } catch (err) {
    console.error("POST /api/transactions error:", err);
    return NextResponse.json({ success: false, error: "Failed to create transaction" }, { status: 500 });
  }
}

function derivePriority(transactionType: string, amount: number, riskScore: number): string {
  if (transactionType === "OVERDUE_INVOICE" && amount >= 5000) return "URGENT";
  if (riskScore >= 0.6 || amount >= 2000) return "URGENT";
  if (riskScore >= 0.4 || amount >= 800) return "HIGH";
  if (amount >= 300) return "MEDIUM";
  return "LOW";
}
