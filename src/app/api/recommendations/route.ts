import { NextRequest, NextResponse } from "next/server";
import { generateCaseRecommendationFromDb } from "@/lib/recommendations";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");

    if (!caseId) {
      return NextResponse.json(
        { error: "Missing required parameter 'caseId'" },
        { status: 400 }
      );
    }

    const recommendation = await generateCaseRecommendationFromDb(caseId);

    const [auditLogs, actions] = await Promise.all([
      prisma.auditLog.findMany({
        where: { recoveryCaseId: caseId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.recoveryAction.findMany({
        where: { recoveryCaseId: caseId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      caseId,
      recommendation,
      auditLogs,
      actions,
    });
  } catch (error: unknown) {
    console.error("Error fetching recommendation:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: error instanceof Error && message.includes("not found") ? 404 : 500 }
    );
  }
}
