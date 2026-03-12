/**
 * AGENT 3: ULTRA-FAST NARRATIVE GENERATOR
 * Target: 1000ms for 4 narratives (parallel)
 * 
 * OPTIMIZATIONS:
 * - Reduced max_tokens: 500 → 250
 * - Simplified prompt (fewer examples)
 * - Parallel execution (4 at once)
 * - Faster JSON parsing
 */

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY;

/**
 * Ultra-fast API call
 */
async function callOpenRouter(prompt, model = "openai/gpt-4o-mini") {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 250 // Reduced by 50% for speed
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

/**
 * ULTRA-FAST: Generate single narrative (250ms target)
 */
export async function generateNarrative(attendee, sponsor, attendeeAnalysis) {
  // Simplified prompt for speed
  const prompt = `Match narrative. Return JSON only:

Attendee: ${attendee.name}, ${attendee.jobTitle}, Goal: ${attendeeAnalysis.primaryGoal}
Sponsor: ${sponsor.companyName}, ${sponsor.domain}
Team: ${sponsor.attendingTeam?.[0]?.name} (${sponsor.attendingTeam?.[0]?.title})

JSON:
{
  "whyYou": "2 sentences: why match",
  "whatYouGain": "2 sentences: benefits",
  "whoToMeet": "name",
  "theirRole": "title",
  "whyThisPerson": "1 sentence",
  "conversationStarter": "opening line",
  "questionsToAsk": ["q1", "q2"]
}`;

  try {
    const text = await callOpenRouter(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error("No JSON");
    
    const narrative = JSON.parse(jsonMatch[0]);
    
    return {
      sponsor: sponsor.companyName,
      matchScore: 85, // Will be set by Agent 2
      ...narrative
    };
    
  } catch (error) {
    return generateFallbackNarrative(sponsor, attendee, attendeeAnalysis);
  }
}

/**
 * Instant fallback (0ms)
 */
function generateFallbackNarrative(sponsor, attendee, attendeeAnalysis) {
  const team = sponsor.attendingTeam || [];
  const person = team[0] || { name: "Team rep", title: "Team member" };
  
  return {
    sponsor: sponsor.companyName,
    matchScore: 70,
    whyYou: `${sponsor.companyName} in ${sponsor.domain || 'industry'} aligns with your ${attendeeAnalysis.primaryGoal.replace('_', ' ')} goal as ${attendee.jobTitle}.`,
    whatYouGain: `Explore ${sponsor.promotionType?.[0] || 'opportunities'} and ${sponsor.projectName || 'products'}.`,
    whoToMeet: person.name,
    theirRole: person.title,
    whyThisPerson: `${person.name} can share insights about ${sponsor.companyName}.`,
    conversationStarter: `Hi, I'm ${attendee.name}. I'm interested in ${sponsor.companyName}.`,
    questionsToAsk: [
      `What does ${sponsor.companyName} do?`,
      "What opportunities are available?"
    ]
  };
}

/**
 * ULTRA-FAST: Generate multiple narratives in parallel
 * Target: 1000ms for 4 narratives
 */
export async function generateMultipleNarratives(attendee, topMatches, attendeeAnalysis) {
  const startTime = Date.now();
  console.log(`✏️  Agent 3 ULTRA-FAST: ${topMatches.length} narratives...`);
  
  // Generate all in parallel
  const narrativePromises = topMatches.map(async (matchData) => {
    try {
      const narrative = await generateNarrative(
        attendee, 
        matchData.sponsor, 
        attendeeAnalysis
      );
      
      // Preserve Agent 2's score
      narrative.matchScore = matchData.score;
      return narrative;
      
    } catch (error) {
      return generateFallbackNarrative(matchData.sponsor, attendee, attendeeAnalysis);
    }
  });
  
  const narratives = await Promise.all(narrativePromises);
  
  console.log(`   ✅ Agent 3: ${Date.now() - startTime}ms - ${narratives.length} narratives`);
  
  return narratives;
}
