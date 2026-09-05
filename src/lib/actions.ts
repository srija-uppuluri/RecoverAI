import { prisma } from "./prisma.ts";

export type ActionType =
  | "SEND_EMAIL"
  | "SEND_SMS"
  | "APPLY_DISCOUNT"
  | "RETRY_PAYMENT"
  | "MARK_RESOLVED";

export interface ActionExecutionInput {
  caseId: string;
  actionType: ActionType;
  customMessage?: string;
  actor?: string;
}

export interface ActionExecutionResult {
  success: boolean;
  actionType: ActionType;
  message: string;
  caseId: string;
  status: string;
  recoveredAmount: number;
  auditLogId: string;
  recoveryActionId?: string;
  details?: Record<string, unknown>;
}

/**
 * Executes a recovery action deterministically against the SQLite database,
 * creating corresponding RecoveryAction and AuditLog records and updating case status.
 */
export async function executeRecoveryAction(
  input: ActionExecutionInput
): Promise<ActionExecutionResult> {
  const { caseId, actionType, customMessage, actor = "USER" } = input;

  if (!caseId) {
    throw new Error("Missing required 'caseId'.");
  }

  // Fetch the full case with relations to validate
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: caseId },
    include: {
      customer: true,
      transaction: true,
    },
  });

  if (!recoveryCase) {
    throw new Error(`RecoveryCase with ID '${caseId}' not found.`);
  }

  const customer = recoveryCase.customer;
  const transaction = recoveryCase.transaction;
  const amount = transaction?.amount || 0;
  const formattedAmount = `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  // Run in a single atomic transaction
  return await prisma.$transaction(async (tx) => {
    switch (actionType) {
      case "SEND_EMAIL": {
        if (!customer.email || !customer.email.includes("@")) {
          throw new Error(`Customer '${customer.name}' does not have a valid email address.`);
        }

        const emailBody =
          customMessage ||
          `Hi ${customer.name.split(" ")[0]}, we encountered an issue processing your payment of ${formattedAmount}. Please update your payment details: https://recover.ai/pay/update-${caseId.slice(-6)}`;

        // Create RecoveryAction
        const recAction = await tx.recoveryAction.create({
          data: {
            recoveryCaseId: caseId,
            actionType: "EMAIL_DUNNING",
            channel: "EMAIL",
            status: "EXECUTED",
            executedAt: new Date(),
            result: "DELIVERED",
            metadata: JSON.stringify({
              to: customer.email,
              messageLength: emailBody.length,
            }),
          },
        });

        // Create AuditLog
        const auditLog = await tx.auditLog.create({
          data: {
            entityType: "RecoveryCase",
            entityId: caseId,
            action: "EMAIL_SENT",
            actor,
            customerId: customer.id,
            recoveryCaseId: caseId,
            details: JSON.stringify({
              channel: "EMAIL",
              recipient: customer.email,
              actionId: recAction.id,
            }),
          },
        });

        // Update Case status to IN_PROGRESS if OPEN
        const newStatus = recoveryCase.status === "OPEN" ? "IN_PROGRESS" : recoveryCase.status;
        const updated = await tx.recoveryCase.update({
          where: { id: caseId },
          data: { status: newStatus },
        });

        return {
          success: true,
          actionType: "SEND_EMAIL",
          message: `Email dunning successfully sent to ${customer.email}.`,
          caseId,
          status: updated.status,
          recoveredAmount: updated.recoveredAmount,
          auditLogId: auditLog.id,
          recoveryActionId: recAction.id,
        };
      }

      case "SEND_SMS": {
        if (!customer.phone || customer.phone.trim().length < 5) {
          throw new Error(`Customer '${customer.name}' does not have a valid mobile phone number on file.`);
        }

        const smsBody =
          customMessage ||
          `RecoverAI Alert: Action required for your payment of ${formattedAmount}. Update securely: https://recover.ai/pay/sms-${caseId.slice(-6)}`;

        const recAction = await tx.recoveryAction.create({
          data: {
            recoveryCaseId: caseId,
            actionType: "SMS_ALERT",
            channel: "SMS",
            status: "EXECUTED",
            executedAt: new Date(),
            result: "DELIVERED",
            metadata: JSON.stringify({
              to: customer.phone,
              messageLength: smsBody.length,
            }),
          },
        });

        const auditLog = await tx.auditLog.create({
          data: {
            entityType: "RecoveryCase",
            entityId: caseId,
            action: "SMS_SENT",
            actor,
            customerId: customer.id,
            recoveryCaseId: caseId,
            details: JSON.stringify({
              channel: "SMS",
              recipient: customer.phone,
              actionId: recAction.id,
            }),
          },
        });

        const newStatus = recoveryCase.status === "OPEN" ? "IN_PROGRESS" : recoveryCase.status;
        const updated = await tx.recoveryCase.update({
          where: { id: caseId },
          data: { status: newStatus },
        });

        return {
          success: true,
          actionType: "SEND_SMS",
          message: `SMS alert dispatched to ${customer.phone}.`,
          caseId,
          status: updated.status,
          recoveredAmount: updated.recoveredAmount,
          auditLogId: auditLog.id,
          recoveryActionId: recAction.id,
        };
      }

      case "APPLY_DISCOUNT": {
        const discountPercent = 15;
        const discountAmount = Number(((amount * discountPercent) / 100).toFixed(2));
        const finalAmount = Number((amount - discountAmount).toFixed(2));

        const recAction = await tx.recoveryAction.create({
          data: {
            recoveryCaseId: caseId,
            actionType: "DISCOUNT_INCENTIVE",
            channel: "EMAIL",
            status: "EXECUTED",
            executedAt: new Date(),
            result: "DISCOUNT_OFFERED",
            metadata: JSON.stringify({
              originalAmount: amount,
              discountPercent,
              discountAmount,
              finalAmount,
              promoCode: `RECOVER${discountPercent}`,
            }),
          },
        });

        const auditLog = await tx.auditLog.create({
          data: {
            entityType: "RecoveryCase",
            entityId: caseId,
            action: "DISCOUNT_APPLIED",
            actor,
            customerId: customer.id,
            recoveryCaseId: caseId,
            details: JSON.stringify({
              discountPercent,
              discountAmount,
              finalAmount,
              promoCode: `RECOVER${discountPercent}`,
            }),
          },
        });

        const existingNotes = recoveryCase.notes ? `${recoveryCase.notes}\n` : "";
        const updated = await tx.recoveryCase.update({
          where: { id: caseId },
          data: {
            status: "IN_PROGRESS",
            notes: `${existingNotes}[Discount Applied] 15% discount ($${discountAmount.toFixed(2)}) applied. New payable: $${finalAmount.toFixed(2)}.`,
          },
        });

        return {
          success: true,
          actionType: "APPLY_DISCOUNT",
          message: `15% recovery discount applied ($${discountAmount.toFixed(2)} savings). Promo code RECOVER15 issued.`,
          caseId,
          status: updated.status,
          recoveredAmount: updated.recoveredAmount,
          auditLogId: auditLog.id,
          recoveryActionId: recAction.id,
          details: { discountAmount, finalAmount },
        };
      }

      case "RETRY_PAYMENT": {
        const newAttempts = recoveryCase.attemptsCount + 1;

        // Execute smart simulated payment settlement
        const recAction = await tx.recoveryAction.create({
          data: {
            recoveryCaseId: caseId,
            actionType: "SMART_RETRY",
            channel: "SYSTEM",
            status: "EXECUTED",
            executedAt: new Date(),
            result: "PAYMENT_SETTLED",
            metadata: JSON.stringify({
              attempt: newAttempts,
              gateway: transaction?.paymentGateway || "STRIPE",
              amount,
            }),
          },
        });

        const auditLog = await tx.auditLog.create({
          data: {
            entityType: "RecoveryCase",
            entityId: caseId,
            action: "PAYMENT_RECOVERED",
            actor,
            customerId: customer.id,
            recoveryCaseId: caseId,
            details: JSON.stringify({
              recoveredAmount: amount,
              attempt: newAttempts,
              method: "SMART_RETRY",
            }),
          },
        });

        // Update RecoveryCase to RECOVERED and set recoveredAmount
        const updated = await tx.recoveryCase.update({
          where: { id: caseId },
          data: {
            status: "RECOVERED",
            recoveredAmount: amount,
            attemptsCount: newAttempts,
            resolvedAt: new Date(),
          },
        });

        // Update Transaction to SUCCEEDED
        if (transaction) {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: "SUCCEEDED" },
          });
        }

        return {
          success: true,
          actionType: "RETRY_PAYMENT",
          message: `Smart Payment Retry #${newAttempts} succeeded! Recovered ${formattedAmount}.`,
          caseId,
          status: updated.status,
          recoveredAmount: updated.recoveredAmount,
          auditLogId: auditLog.id,
          recoveryActionId: recAction.id,
        };
      }

      case "MARK_RESOLVED": {
        const recAction = await tx.recoveryAction.create({
          data: {
            recoveryCaseId: caseId,
            actionType: "MANUAL_OUTREACH",
            channel: "MANUAL_CALL",
            status: "EXECUTED",
            executedAt: new Date(),
            result: "RESOLVED_MANUALLY",
            metadata: JSON.stringify({
              amount,
              resolvedBy: actor,
            }),
          },
        });

        const auditLog = await tx.auditLog.create({
          data: {
            entityType: "RecoveryCase",
            entityId: caseId,
            action: "CASE_RESOLVED_MANUALLY",
            actor,
            customerId: customer.id,
            recoveryCaseId: caseId,
            details: JSON.stringify({
              resolvedBy: actor,
              amount,
            }),
          },
        });

        const updated = await tx.recoveryCase.update({
          where: { id: caseId },
          data: {
            status: "RECOVERED",
            recoveredAmount: amount,
            resolvedAt: new Date(),
          },
        });

        if (transaction) {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: "SUCCEEDED" },
          });
        }

        return {
          success: true,
          actionType: "MARK_RESOLVED",
          message: `Case marked as resolved and recovered (${formattedAmount}).`,
          caseId,
          status: updated.status,
          recoveredAmount: updated.recoveredAmount,
          auditLogId: auditLog.id,
          recoveryActionId: recAction.id,
        };
      }

      default:
        throw new Error(`Unsupported action type: '${actionType}'.`);
    }
  });
}
