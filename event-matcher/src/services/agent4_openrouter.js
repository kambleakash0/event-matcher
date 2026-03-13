/**
 * AGENT 5: SCHEDULE OPTIMIZER
 * Creates optimal event schedule based on match priorities
 * Runs once per attendee
 * Uses OpenRouter API
 */

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY;

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
      temperature: 0.5,
      max_tokens: 400  // Increased from 250 to allow complete JSON
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

export async function createEventSchedule(topMatches, attendeeAnalysis, event) {
  console.log("🤖 Agent 5: Creating event schedule...");

  const matchesSummary = topMatches.map((m, i) => 
    `${i + 1}. ${m.sponsor} (Score: ${m.matchScore}/100, Goal: ${attendeeAnalysis.primaryGoal})`
  ).join('\n');

  // Extract event timing
  const eventStartTime = event.startTime || event.start_time || "9:00 AM";
  const eventEndTime = event.endTime || event.end_time || "5:00 PM";
  const eventDuration = event.duration || "full day";

  const prompt = `You are a JSON-only API. Respond with ONLY valid JSON, no explanations.

ATTENDEE:
Primary Goal: ${attendeeAnalysis.primaryGoal}
Role Level: ${attendeeAnalysis.roleLevel}

TOP MATCHES:
${matchesSummary}

EVENT DETAILS:
Name: ${event.name || 'Event'}
Date: ${event.date || 'TBA'}
Start Time: ${eventStartTime}
End Time: ${eventEndTime}
Duration: ${eventDuration}

Create a strategic schedule that fits EXACTLY within the event timing above. Return ONLY this JSON array (no markdown, no explanation):
[
  {
    "time": "9:00 - 10:00 AM",
    "activity": "Visit [Sponsor Name] booth",
    "reason": "Why this timing is strategic"
  }
]

Guidelines:
- MUST start at or after ${eventStartTime}
- MUST end at or before ${eventEndTime}
- Visit highest-priority sponsors first (when attendee is fresh)
- Include breaks if event is longer than 4 hours
- Include networking time
- Include 4-6 time blocks that fit the event duration
- Use actual sponsor names from the top matches list
- NO markdown, NO explanations, ONLY the JSON array`;

  try {
    const text = await callOpenRouter(prompt);
    
    // Try multiple extraction methods
    let schedule = null;
    
    // Method 1: Direct JSON parse (if response is pure JSON)
    try {
      schedule = JSON.parse(text.trim());
      if (Array.isArray(schedule)) {
        console.log(`✅ Agent 5 complete: Created ${schedule.length} time blocks`);
        return schedule;
      }
    } catch (e) {
      // Not pure JSON, continue to next method
    }
    
    // Method 2: Extract from code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        schedule = JSON.parse(codeBlockMatch[1].trim());
        if (Array.isArray(schedule)) {
          console.log(`✅ Agent 5 complete: Created ${schedule.length} time blocks`);
          return schedule;
        }
      } catch (e) {
        // Continue to next method
      }
    }
    
    // Method 3: Find JSON array in text - use greedy match to get complete array
    const arrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (arrayMatch) {
      try {
        schedule = JSON.parse(arrayMatch[0]);
        if (Array.isArray(schedule)) {
          console.log(`✅ Agent 5 complete: Created ${schedule.length} time blocks`);
          return schedule;
        }
      } catch (e) {
        console.warn("⚠️ Agent 5: Found array but couldn't parse:", e.message);
      }
    }
    
    // Method 4: More aggressive extraction - find last complete ]
    const startIdx = text.indexOf('[');
    const endIdx = text.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        schedule = JSON.parse(text.substring(startIdx, endIdx + 1));
        if (Array.isArray(schedule)) {
          console.log(`✅ Agent 5 complete: Created ${schedule.length} time blocks`);
          return schedule;
        }
      } catch (e) {
        console.warn("⚠️ Agent 5: Aggressive extraction failed:", e.message);
      }
    }
    
    // All methods failed
    console.warn("⚠️ Agent 5: Could not parse JSON, using template");
    console.log("Full response was:", text);
    throw new Error("No valid JSON array in response");
    
  } catch (error) {
    console.error("❌ Agent 5 failed:", error);
    return generateTemplateSchedule(topMatches, attendeeAnalysis, event);
  }
}

function generateTemplateSchedule(topMatches, attendeeAnalysis, event) {
  const schedule = [];
  
  // Extract event timing with fallbacks
  let startHour = 9; // Default 9 AM
  let endHour = 17; // Default 5 PM
  
  // Try to parse start time
  if (event.startTime || event.start_time) {
    const timeStr = event.startTime || event.start_time;
    const match = timeStr.match(/(\d+)/);
    if (match) startHour = parseInt(match[1]);
  }
  
  // Try to parse end time
  if (event.endTime || event.end_time) {
    const timeStr = event.endTime || event.end_time;
    const match = timeStr.match(/(\d+)/);
    if (match) {
      endHour = parseInt(match[1]);
      // Handle PM times
      if (timeStr.toLowerCase().includes('pm') && endHour < 12) {
        endHour += 12;
      }
    }
  }
  
  let currentHour = startHour;
  
  // Visit top priority sponsors first
  topMatches.slice(0, Math.min(2, topMatches.length)).forEach((match, i) => {
    if (currentHour < endHour - 1) {
      const endBlock = currentHour + 1;
      const period = currentHour < 12 ? 'AM' : 'PM';
      const displayHour = currentHour > 12 ? currentHour - 12 : currentHour;
      
      schedule.push({
        time: `${displayHour}:00 - ${displayHour + 1}:00 ${period}`,
        activity: `Visit ${match.sponsor} booth`,
        reason: i === 0 
          ? "Your top match - visit first when you're most energized"
          : "High-priority match while you're still fresh"
      });
      currentHour++;
    }
  });
  
  // Add networking break if time permits
  if (currentHour < endHour - 2 && endHour - startHour > 4) {
    const period = currentHour < 12 ? 'AM' : 'PM';
    const displayHour = currentHour > 12 ? currentHour - 12 : currentHour;
    
    schedule.push({
      time: `${displayHour}:00 - ${displayHour}:30 ${period}`,
      activity: "Networking break / Coffee",
      reason: "Process what you've learned and prepare for next conversations"
    });
    currentHour++;
  }
  
  // Add remaining sponsors if time permits
  const remainingSponsors = topMatches.slice(2, 4);
  remainingSponsors.forEach((match) => {
    if (currentHour < endHour - 1) {
      const period = currentHour < 12 ? 'AM' : 'PM';
      const displayHour = currentHour > 12 ? currentHour - 12 : currentHour;
      
      schedule.push({
        time: `${displayHour}:00 - ${displayHour + 1}:00 ${period}`,
        activity: `Visit ${match.sponsor} booth`,
        reason: "Strong match - good time to explore their offerings"
      });
      currentHour++;
    }
  });
  
  // Add lunch if it's a full day event
  if (endHour - startHour >= 6 && currentHour >= 12 && currentHour < 14) {
    schedule.push({
      time: "12:00 - 1:00 PM",
      activity: "Lunch / Informal networking",
      reason: "Build relationships in a casual setting"
    });
  }
  
  // Add follow-up time towards the end
  if (currentHour < endHour - 1) {
    const period = currentHour < 12 ? 'AM' : 'PM';
    const displayHour = currentHour > 12 ? currentHour - 12 : currentHour;
    
    schedule.push({
      time: `${displayHour}:00 - ${displayHour + 1}:00 ${period}`,
      activity: "Follow-up conversations / Ask remaining questions",
      reason: "Revisit sponsors to clarify or discuss next steps"
    });
  }
  
  return schedule;
}
