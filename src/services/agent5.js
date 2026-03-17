import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.6,
  maxTokens: 300,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.VITE_OPENROUTER_KEY
  }
});

const prompt = ChatPromptTemplate.fromTemplate(`
Generate specific actionable event tips. Return JSON only.

Attendee:
- Primary Goal: {primaryGoal}
- Secondary Goals: {secondaryGoals}
- Role Level: {roleLevel}
- Technical Profile: {technicalProfile}
- Summary: {summary}

Top Sponsor Matches:
{matchesSummary}

Return JSON:
{{
  "proTips": ["tip1", "tip2", "tip3", "tip4"],
  "afterEvent": ["action1", "action2", "action3"]
}}

Requirements:
- Use actual sponsor names: {sponsorNames}
- Reference their goal: {primaryGoal}
- Mention people they will meet: {contactNames}
- Be specific and actionable, not generic`);

const parser = new JsonOutputParser();
const chain = prompt.pipe(model).pipe(parser);

export async function generateTipsAndFollowup(attendeeAnalysis, topMatches) {

  const matchesSummary = topMatches.map((m, i) =>
    `${i + 1}. ${m.sponsor} (Score: ${m.matchScore}/100)\n   Why: ${m.whyYou?.substring(0, 100)}...\n   Meet: ${m.whoToMeet} (${m.theirRole})`
  ).join('\n\n');
  try { 
    const startTime = Date.now();
    const tips = await chain.invoke({
      primaryGoal: attendeeAnalysis.primaryGoal,
      secondaryGoals: attendeeAnalysis.secondaryGoals?.join(', ') || 'None',
      roleLevel: attendeeAnalysis.roleLevel,
      technicalProfile: attendeeAnalysis.technicalProfile,
      summary: attendeeAnalysis.summary,
      matchesSummary,
      sponsorNames: topMatches.map(m => m.sponsor).join(', '),
      contactNames: topMatches.map(m => m.whoToMeet).filter(Boolean).join(', ')
    });
    console.log(`${Date.now() - startTime}ms for Agent 5 analysis`);
    return tips;
  } catch (error) {
    console.error("❌ Agent 5 failed:", error);
    return generateTemplateTips(attendeeAnalysis, topMatches);
  }
}

function generateTemplateTips(attendeeAnalysis, topMatches) {
  const tips = { proTips: [], afterEvent: [] };
  
  const primaryGoal = attendeeAnalysis.primaryGoal;
  const roleLevel = attendeeAnalysis.roleLevel;
  const technical = attendeeAnalysis.technicalProfile;
  const topSponsor = topMatches[0]?.sponsor || 'your top matches';
  const secondSponsor = topMatches[1]?.sponsor || 'key sponsors';
  const topPerson = topMatches[0]?.whoToMeet || 'team representatives';
  
  // Generate goal-specific tips
  switch (primaryGoal) {
    case 'job_hunting':
    case 'intern':
      tips.proTips = [
        `Bring 5-10 printed copies of your resume to hand to ${topSponsor} and ${secondSponsor}`,
        `Research ${topSponsor}'s open positions before the event - they scored ${topMatches[0]?.matchScore}/100 for you`,
        `Prepare a 30-second elevator pitch highlighting your ${roleLevel}-level experience in ${technical === 'technical' ? 'technical' : 'your'} field`,
        `Ask ${topPerson} at ${topSponsor} about team structure and growth opportunities, not just job descriptions`
      ];
      tips.afterEvent = [
        `Send personalized LinkedIn connection requests to ${topPerson} and other ${topSponsor} representatives within 24 hours`,
        `Follow up via email with ${topSponsor} and ${secondSponsor} referencing specific conversation points within 48 hours`,
        `Apply to any mentioned positions at ${topMatches.slice(0, 3).map(m => m.sponsor).join(', ')} and reference your conversations in cover letters`
      ];
      break;
      
    case 'learning':
      tips.proTips = [
        `Prepare specific technical questions about ${topSponsor}'s ${technical === 'technical' ? 'technology stack and architecture' : 'products and approach'}`,
        `Take detailed notes when talking to ${topPerson} at ${topSponsor} - they're your highest match at ${topMatches[0]?.matchScore}/100`,
        `Ask ${topSponsor} and ${secondSponsor} for documentation, tutorials, or demo access to explore after the event`,
        `Focus on understanding how ${topMatches.slice(0, 2).map(m => m.sponsor).join(' and ')} solve problems in their domain`
      ];
      tips.afterEvent = [
        `Review and organize your notes from ${topSponsor}, ${secondSponsor}, and ${topMatches[2]?.sponsor || 'other sponsors'} while details are fresh`,
        `Sign up for newsletters and communities mentioned by ${topSponsor} and follow their engineering blogs`,
        `Start a small project using what you learned from ${topSponsor} to solidify your knowledge`
      ];
      break;
      
    case 'networking':
    case 'partnerships':
      tips.proTips = [
        `Bring business cards or have a digital card ready when meeting ${topPerson} at ${topSponsor}`,
        `Research ${topSponsor}'s recent partnerships and initiatives - look for collaboration opportunities`,
        `At ${secondSponsor}, focus on building genuine connections with their ${topMatches[1]?.whoToMeet || 'team'} rather than just collecting contacts`,
        `Look for common interests with ${topMatches.slice(0, 3).map(m => m.sponsor).join(', ')} teams to build rapport`
      ];
      tips.afterEvent = [
        `Connect on LinkedIn with ${topPerson} from ${topSponsor} and ${topMatches[1]?.whoToMeet || 'representatives'} from ${secondSponsor}`,
        `Send personalized follow-up messages to ${topSponsor} and ${secondSponsor} mentioning specific discussion topics within 24-48 hours`,
        `Look for ways to provide value to your new connections at ${topMatches.slice(0, 2).map(m => m.sponsor).join(' and ')}`
      ];
      break;
      
    case 'investment':
    case 'funding':
      tips.proTips = [
        `Prepare your elevator pitch tailored to ${topSponsor}'s investment thesis and portfolio`,
        `Research ${topSponsor} and ${secondSponsor}'s recent investments and portfolio companies beforehand`,
        `Ask ${topPerson} at ${topSponsor} about their decision-making process and what makes them excited about opportunities`,
        `Bring a concise deck or one-pager about your venture to share with ${topMatches.slice(0, 3).map(m => m.sponsor).join(', ')}`
      ];
      tips.afterEvent = [
        `Send a follow-up email to ${topPerson} at ${topSponsor} with your pitch deck and key metrics within 24 hours`,
        `Connect with ${topSponsor} and ${secondSponsor} teams on LinkedIn and engage with their content`,
        `Schedule follow-up calls with interested parties from ${topMatches.map(m => m.sponsor).join(', ')}`
      ];
      break;
      
    default:
      tips.proTips = [
        `Arrive early to visit ${topSponsor} (your top match at ${topMatches[0]?.matchScore}/100) before crowds form`,
        `Prepare 2-3 specific questions for ${topPerson} at ${topSponsor} about their work and offerings`,
        `Take notes on key insights from ${topMatches.slice(0, 3).map(m => m.sponsor).join(', ')}`,
        `Ask for business cards or contact information from ${topSponsor} and ${secondSponsor} for follow-up`
      ];
      tips.afterEvent = [
        `Send thank-you messages to ${topPerson} and other contacts from ${topSponsor} within 24 hours`,
        `Review your notes from ${topMatches.slice(0, 3).map(m => m.sponsor).join(', ')} and identify actionable next steps`,
        `Follow up on any commitments or promises made during conversations with ${topSponsor} and ${secondSponsor}`
      ];
  }
  
  return tips;
}
