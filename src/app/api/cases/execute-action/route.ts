import { NextRequest, NextResponse } from "next/server";
import { executeRecoveryAction, ActionType } from "@/lib/actions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseId, actionType, customMessage, actor } = body;

    if (!caseId || !actionType) {
      return NextResponse.json(
        { success: false, error: "Missing required fields 'caseId' or 'actionType'." },
        { status: 400 }
      );
    }

    const validActions: ActionType[] = [
      "SEND_EMAIL",
      "SEND_SMS",
      "APPLY_DISCOUNT",
      "RETRY_PAYMENT",
      "MARK_RESOLVED",
    ];

    if (!validActions.includes(actionType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid actionType '${actionType}'. Must be one of: ${validActions.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const result = await executeRecoveryAction({
      caseId,
      actionType,
      customMessage,
      actor: actor || "USER",
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Action execution error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute recovery action";
    const status = message.includes("not found") ? 404 : 400;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
