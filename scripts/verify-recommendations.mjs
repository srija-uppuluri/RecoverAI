import { prisma } from "../src/lib/prisma.ts";
import { generateCaseRecommendationFromDb } from "../src/lib/recommendations.ts";

async function verifyAllCases() {
  console.log("=================================================");
  console.log("   RECOVERAI RECOMMENDATION SERVICE VERIFICATION ");
  console.log("=================================================");

  const cases = await prisma.recoveryCase.findMany({
    include: {
      customer: true,
      transaction: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\nEvaluating AI/Deterministic Recommendations for all ${cases.length} database cases...\n`);

  if (cases.length !== 60) {
    throw new Error(`Expected 60 database cases, found ${cases.length}`);
  }

  const actionCounts = {};
  const channelCounts = {};
  let totalProbabilitySum = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const rec = await generateCaseRecommendationFromDb(c.id);

    // Verify all required fields are populated
    if (!rec.action || !rec.channel || !rec.reason || !rec.customerMessage) {
      throw new Error(`Incomplete recommendation for Case ${c.id}`);
    }

    actionCounts[rec.action] = (actionCounts[rec.action] || 0) + 1;
    channelCounts[rec.channel] = (channelCounts[rec.channel] || 0) + 1;
    totalProbabilitySum += rec.estimatedRecoveryProbability;

    // Log sample recommendations
    if (i < 4 || i === 25 || i === 40 || i === 50) {
      console.log(`[Sample Case ${i + 1}/${cases.length}] - ${c.customer.name}`);
      console.log(`  Amount:       $${c.transaction?.amount.toFixed(2)} (${c.transaction?.failureReason})`);
      console.log(`  Action:       ${rec.action}`);
      console.log(`  Channel:      ${rec.channel}`);
      console.log(`  Probability:  ${(rec.estimatedRecoveryProbability * 100).toFixed(0)}%`);
      console.log(`  Reason:       ${rec.reason}`);
      console.log(`  Message:      "${rec.customerMessage.slice(0, 100)}..."\n`);
    }
  }

  console.log("-------------------------------------------------");
  console.log("RECOMMENDATION ENGINE SUMMARY (60/60 PROCESSED):");
  console.log("-------------------------------------------------");

  console.log("\n[Action Distribution]");
  for (const [action, count] of Object.entries(actionCounts)) {
    console.log(`- ${action.padEnd(25)}: ${count}`);
  }

  console.log("\n[Channel Distribution]");
  for (const [channel, count] of Object.entries(channelCounts)) {
    console.log(`- ${channel.padEnd(25)}: ${count}`);
  }

  const avgRecoveryProb = ((totalProbabilitySum / cases.length) * 100).toFixed(1);
  console.log(`\n- Average Estimated Recovery Probability: ${avgRecoveryProb}%`);
  console.log("\n>>> ALL 60 CASES RECEIVED VALID, HIGH-QUALITY RECOMMENDATIONS! <<<\n");
}

verifyAllCases()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
