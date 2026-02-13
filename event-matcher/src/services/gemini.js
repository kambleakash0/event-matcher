/**
 * HYBRID GEMINI.JS - Agentic + Fallback
 * Uses agentic system by default, falls back to monolithic if it fails
 */

// Import agentic system
// import { runAgenticMatching } from './agenticMatchingOrchestrator_openrouter.js';
import { runAgenticMatching } from './agenticMatchingOrchestrator_openrouter.js';

// API Keys
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY;

// Models to try in order (fallback)
const PROVIDERS = [
  {
    name: "Gemini 2.0 Flash",
    call: (prompt) => callGemini(prompt, "gemini-2.0-flash")
  },
  {
    name: "Gemini 1.5 Flash",
    call: (prompt) => callGemini(prompt, "gemini-1.5-flash")
  },
  {
    name: "OpenRouter GPT-4o-mini",
    call: (prompt) => callOpenRouter(prompt, "openai/gpt-4o-mini")
  },
  {
    name: "OpenRouter GPT-4o",
    call: (prompt) => callOpenRouter(prompt, "openai/gpt-4o")
  },
  {
    name: "OpenRouter Claude Sonnet",
    call: (prompt) => callOpenRouter(prompt, "anthropic/claude-3.5-sonnet")
  },
  {
    name: "OpenRouter Gemini",
    call: (prompt) => callOpenRouter(prompt, "google/gemini-2.0-flash-exp:free")
  },
  {
    name: "OpenRouter Llama",
    call: (prompt) => callOpenRouter(prompt, "meta-llama/llama-3.3-70b-instruct:free")
  }
];

/**
 * Main matching function - tries agentic first, falls back to monolithic
 */
export async function runMatching(attendee, sponsors, event) {
  console.log("🚀 Starting matching system...");

  try {
    // TRY AGENTIC SYSTEM FIRST
    console.log("🤖 Attempting agentic matching...");
    const result = await runAgenticMatching(attendee, sponsors, event);
    console.log("✅ Agentic matching succeeded!");
    return result;

  } catch (agenticError) {
    // FALLBACK TO MONOLITHIC
    console.warn("⚠️ Agentic matching failed, using fallback:", agenticError.message);
    console.log("🔄 Falling back to monolithic LLM approach...");

    return await runMonolithicMatching(attendee, sponsors, event);
  }
}

/**
 * Original monolithic matching (your current approach)
 */
async function runMonolithicMatching(attendee, sponsors, event) {
  const prompt = buildPrompt(attendee, sponsors, event);

  let lastError = null;

  for (const provider of PROVIDERS) {
    try {
      console.log(`Trying: ${provider.name}...`);
      const text = await provider.call(prompt);
      console.log(`✓ Success: ${provider.name}`);
      return parseResponse(text);
    } catch (error) {
      console.warn(`✗ ${provider.name} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError?.message}`);
}

async function callGemini(prompt, model) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenRouter(prompt, model) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

function parseResponse(text) {
  try {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
      text.match(/```\n?([\s\S]*?)\n?```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(jsonString.trim());
  } catch (error) {
    console.error("Parse error. Raw:", text);
    throw new Error("Failed to parse AI response");
  }
}

function buildPrompt(attendee, sponsors, event) {
  const sponsorsList = sponsors
    .map((s, i) => {
      const team = s.attendingTeam
        ?.map((t) => `${t.name} (${t.title})`)
        .join(", ") || "TBA";

      return `${i + 1}. ${s.companyName}
     - Domain: ${s.domain || "Tech"}
     - Promoting: ${s.promotionType?.join(", ") || "General"}
     - Products: ${s.projectName || "Various"}
     - Team Attending: ${team}`;
    })
    .join("\n\n");

  return `You are an AI assistant creating a personalized event guide for an attendee.
  
  EVENT: ${event.name}
  DATE: ${event.date}
  
  ATTENDEE PROFILE:
  - Name: ${attendee.name}
  - Role: ${attendee.jobTitle || "Professional"} at ${attendee.company || "N/A"}
  - Primary Goals: ${attendee.intent?.join(", ") || "Networking"}
  - GitHub: ${attendee.githubUrl || "Not provided"}
  - Email: ${attendee.email}
  
  SPONSORS AT EVENT:
  ${sponsorsList}
  
  YOUR TASK:
  Create a highly personalized event guide. Think deeply about WHY each sponsor matches this specific attendee based on their role, company, and goals.
  
  Return ONLY valid JSON:
  {
    "subject": "Your Personalized Guide for ${event.name}",
    "attendeeSummary": "Brief 1-2 sentence summary of who they are and what they're looking for",
    "sponsorMatches": [
      {
        "sponsor": "Company Name",
        "matchScore": 95,
        "whyYou": "Specific reason why this sponsor matches THIS attendee (mention their background, goals, skills)",
        "whatYouGain": "Concrete outcome they can expect (job opportunity, learn X technology, partnership potential)",
        "whoToMeet": "Specific person name from the team",
        "theirRole": "That person's title",
        "whyThisPerson": "Why this specific person is good for them to meet",
        "conversationStarter": "Actual opening line they can use when approaching",
        "questionsToAsk": ["Question 1 to ask", "Question 2 to ask"]
      }
    ],
    "schedule": [
      {
        "time": "9:00 - 10:00 AM",
        "activity": "What to do",
        "reason": "Why this timing makes sense"
      }
    ],
    "proTips": [
      "Specific tip based on their goals (e.g., for job hunters: bring resume copies)"
    ],
    "afterEvent": [
      "Follow-up action to take after the event"
    ]
  }
  
  IMPORTANT GUIDELINES:
  - Rank sponsors by TRUE relevance to this person's specific situation
  - If they're job hunting and a sponsor is hiring for their skill set, that's a strong match
  - If they want to learn and a sponsor has cutting-edge tech, explain the connection
  - Conversation starters should be natural, not salesy
  - Questions should help them extract real value
  - Schedule should have logical flow (e.g., high-priority booths when fresh)
  - Pro tips should be specific to their goal type
  - Include 3-4 sponsor matches maximum, quality over quantity
  - Be warm and encouraging in tone`;
}

/**
 * Export for compatibility
 */
export function getMatchExplanation(matchScore, scoreBreakdown) {
  if (matchScore > 85) return "Strong match based on goals and background";
  if (matchScore > 70) return "Good match with relevant opportunities";
  if (matchScore > 50) return "Moderate match worth exploring";
  return "General networking opportunity";
}
