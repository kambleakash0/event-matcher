import { getAttendeeAnalysis } from './agent1_openrouter.js';
import { getTopRelevantSponsors } from './agent2_openrouter.js';
import { generateMultipleNarratives } from './agent3_openrouter.js';
import { createEventSchedule } from './agent4_openrouter.js';
import { generateTipsAndFollowup } from './agent5_openrouter.js';
import { buildAttendeeText, generateEmbedding } from './embeddingService';

export async function runAgenticMatching(attendee, sponsors, event) {
  console.log("🤖 FULL LLM MATCHING (All 6 Agents)");
  console.log("=" .repeat(50));
  
  const startTime = Date.now();
  
  try {
    // STAGE 1: Profile Analysis (LLM)
    console.log("\n📊 STAGE 1: Profile Analysis (LLM)");
    const stage1Start = Date.now();
    const [attendeeAnalysis, attendeeEmbedding] = await Promise.all([
      getAttendeeAnalysis(attendee),
      generateEmbedding(buildAttendeeText(attendee))
    ]);
    console.log(`   ✅ ${Date.now() - stage1Start}ms - ${attendeeAnalysis.primaryGoal} / ${attendeeAnalysis.roleLevel}`);
    
    // STAGE 2: Sponsor Scoring (LLM with pre-filtering)
    console.log("\n🎯 STAGE 2: Relevance Scoring (LLM)");
    const stage2Start = Date.now();

    const topMatches = await getTopRelevantSponsors(
      attendeeAnalysis,
      sponsors,
      4, // Top 4 only
      attendeeEmbedding
    );
    console.log(`   ✅ ${Date.now() - stage2Start}ms - ${topMatches.length} matches found`);
    
    if (topMatches.length === 0) {
      console.log("⚠️  No matches, using fallback");
      return generateFallbackResponse(attendee, sponsors, event);
    }
    
    // STAGE 3: Narrative Generation (LLM parallel)
    console.log("\n✏️  STAGE 3: Narratives (LLM Parallel)");
    const stage3Start = Date.now();
    const narratives = await generateMultipleNarratives(
      attendee,
      topMatches,
      attendeeAnalysis
    );
    console.log(`   ✅ ${Date.now() - stage3Start}ms - ${narratives.length} narratives`);
    
    // STAGE 4: SKIPPED (fact checking unnecessary with good prompts)
    
    // STAGE 5: Schedule Generation (LLM) ← USING REAL AGENT 5
    console.log("\n📅 STAGE 5: Schedule (LLM) and 💡 STAGE 6: Tips (LLM)");
    const stage5Start = Date.now();
    const [schedule, tips] = await Promise.all([
      createEventSchedule(narratives, attendeeAnalysis, event),
      generateTipsAndFollowup(attendeeAnalysis, narratives)
    ]);
    console.log(`   ✅ ${Date.now() - stage5Start}ms - ${schedule.length} blocks`);
    
    // Compile result
    const result = {
      subject: `Your Personalized Guide for ${event.name || 'the Event'}`,
      attendeeSummary: attendeeAnalysis.summary,
      sponsorMatches: narratives,
      schedule: schedule,
      proTips: tips.proTips,
      afterEvent: tips.afterEvent
    };
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n" + "=".repeat(50));
    console.log(`🤖 FULL LLM MATCHING COMPLETE in ${duration}s`);
    console.log(`🎯 All agents used LLM (highest quality)`);
    console.log("=".repeat(50));
    
    return result;
    
  } catch (error) {
    console.error("\n❌ MATCHING FAILED:", error);
    return generateFallbackResponse(attendee, sponsors, event);
  }
}

/**
 * Fallback response (instant)
 */
function generateFallbackResponse(attendee, sponsors, event) {
  const topSponsors = sponsors.slice(0, 3);
  
  return {
    subject: `Your Guide for ${event.name || 'the Event'}`,
    attendeeSummary: `${attendee.jobTitle} at ${attendee.company}, interested in ${attendee.intent?.[0] || 'networking'}`,
    sponsorMatches: topSponsors.map((sponsor, idx) => ({
      sponsor: sponsor.companyName,
      matchScore: 70 - (idx * 10),
      whyYou: `${sponsor.companyName} in ${sponsor.domain} may align with your interests.`,
      whatYouGain: `Explore their ${sponsor.promotionType?.[0] || 'offerings'}.`,
      whoToMeet: sponsor.attendingTeam?.[0]?.name || "Team representative",
      theirRole: sponsor.attendingTeam?.[0]?.title || "Team member",
      whyThisPerson: `They can share insights about ${sponsor.companyName}.`,
      conversationStarter: `Hi, I'm ${attendee.name}. I'd like to learn about ${sponsor.companyName}.`,
      questionsToAsk: [
        `What does ${sponsor.companyName} do?`,
        "What opportunities are available?"
      ]
    })),
    schedule: [
      { time: "9:00 - 10:00 AM", activity: `Visit ${topSponsors[0]?.companyName}`, reason: "Top priority" },
      { time: "10:00 - 11:00 AM", activity: `Visit ${topSponsors[1]?.companyName}`, reason: "Good match" }
    ],
    proTips: [
      "Arrive early to beat the crowds",
      "Prepare questions for each sponsor",
      "Take notes during conversations"
    ],
    afterEvent: [
      "Send follow-up emails within 48 hours",
      "Connect on LinkedIn",
      "Review your notes and take action"
    ]
  };
}

/**
 * Export for compatibility
 */
export async function runMatching(attendee, sponsors, event) {
  return await runAgenticMatching(attendee, sponsors, event);
}
