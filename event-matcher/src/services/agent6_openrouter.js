/**
 * AGENT 6: TIPS GENERATOR
 * Creates actionable tips and after-event follow-up advice
 * Runs once per attendee
 * Uses OpenRouter API
 */

const OPENROUTER_KEY = "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";

async function callOpenRouter(prompt, model = "openai/gpt-4o-mini") {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { 
          role: "system", 
          content: "You are a JSON-only API. You MUST respond with ONLY valid JSON. No markdown code blocks, no explanations, no additional text. Just raw JSON." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 300  // Increased from 200 to allow complete JSON
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

export async function generateTipsAndFollowup(attendeeAnalysis, topMatches) {
  console.log("🤖 Agent 6: Generating tips and follow-up advice...");

  const prompt = `You are a JSON-only API. Respond with ONLY valid JSON, no explanations.

ATTENDEE PROFILE:
Primary Goal: ${attendeeAnalysis.primaryGoal}
Secondary Goals: ${attendeeAnalysis.secondaryGoals?.join(', ') || 'None'}
Role Level: ${attendeeAnalysis.roleLevel}
Technical Profile: ${attendeeAnalysis.technicalProfile}
Industries: ${attendeeAnalysis.industries?.join(', ') || 'General'}
Summary: ${attendeeAnalysis.summary}

TOP SPONSOR MATCHES (in priority order):
${topMatches.map((m, i) => `${i + 1}. ${m.sponsor} (Score: ${m.matchScore}/100)
   - Why relevant: ${m.whyYou?.substring(0, 100)}...
   - Who to meet: ${m.whoToMeet} (${m.theirRole})`).join('\n\n')}

TASK: Generate highly specific, actionable advice tailored to THIS attendee's situation.

Return ONLY this JSON object (no markdown, no explanation):
{
  "proTips": [
    "Specific tip 1 based on their ${attendeeAnalysis.primaryGoal} goal and ${attendeeAnalysis.roleLevel} level",
    "Specific tip 2 mentioning actual sponsor names from the list above",
    "Specific tip 3 about how to maximize their time at the event",
    "Specific tip 4 related to their technical profile: ${attendeeAnalysis.technicalProfile}"
  ],
  "afterEvent": [
    "Specific follow-up action 1 mentioning actual sponsor names",
    "Specific follow-up action 2 based on their ${attendeeAnalysis.primaryGoal} goal",
    "Specific follow-up action 3 for building relationships with ${topMatches[0]?.sponsor || 'top matches'}"
  ]
}

CRITICAL REQUIREMENTS:
- Be ULTRA-SPECIFIC: Use actual sponsor names (${topMatches.map(m => m.sponsor).join(', ')})
- Reference their actual goal: ${attendeeAnalysis.primaryGoal}
- Mention their role level: ${attendeeAnalysis.roleLevel}
- Reference actual people they'll meet: ${topMatches.map(m => m.whoToMeet).filter(Boolean).join(', ')}
- Make tips actionable and concrete, NOT generic advice
- NO markdown, NO explanations, ONLY the JSON object`;

  try {
    const text = await callOpenRouter(prompt);
    
    // Try multiple extraction methods
    let tips = null;
    
    // Method 1: Direct JSON parse (if response is pure JSON)
    try {
      tips = JSON.parse(text.trim());
      if (tips.proTips && tips.afterEvent) {
        console.log(`✅ Agent 6 complete: Generated ${tips.proTips.length} tips`);
        return tips;
      }
    } catch (e) {
      // Not pure JSON, continue to next method
    }
    
    // Method 2: Extract from code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        tips = JSON.parse(codeBlockMatch[1].trim());
        if (tips.proTips && tips.afterEvent) {
          console.log(`✅ Agent 6 complete: Generated ${tips.proTips.length} tips`);
          return tips;
        }
      } catch (e) {
        // Continue to next method
      }
    }
    
    // Method 3: Find JSON object in text - use greedy match
    const objectMatch = text.match(/\{\s*"proTips"[\s\S]*?"afterEvent"[\s\S]*?\]/);
    if (objectMatch) {
      // Find the closing brace
      let braceCount = 0;
      let endIdx = -1;
      for (let i = 0; i < objectMatch[0].length; i++) {
        if (objectMatch[0][i] === '{') braceCount++;
        if (objectMatch[0][i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
      }
      
      if (endIdx !== -1) {
        try {
          tips = JSON.parse(objectMatch[0].substring(0, endIdx + 1));
          if (tips.proTips && tips.afterEvent) {
            console.log(`✅ Agent 6 complete: Generated ${tips.proTips.length} tips`);
            return tips;
          }
        } catch (e) {
          console.warn("⚠️ Agent 6: Found object but couldn't parse:", e.message);
        }
      }
    }
    
    // Method 4: More aggressive extraction
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        tips = JSON.parse(text.substring(startIdx, endIdx + 1));
        if (tips.proTips && tips.afterEvent) {
          console.log(`✅ Agent 6 complete: Generated ${tips.proTips.length} tips`);
          return tips;
        }
      } catch (e) {
        console.warn("⚠️ Agent 6: Aggressive extraction failed:", e.message);
      }
    }
    
    // All methods failed
    console.warn("⚠️ Agent 6: Could not parse JSON, using template");
    console.log("Full response was:", text);
    throw new Error("No valid JSON in response");
    
  } catch (error) {
    console.error("❌ Agent 6 failed:", error);
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
