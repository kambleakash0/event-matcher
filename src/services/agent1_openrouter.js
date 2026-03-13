/**
 * AGENT 1: ULTRA-FAST PROFILE ANALYZER
 * Target: 400ms per analysis (0ms if cached)
 * 
 * OPTIMIZATIONS:
 * - Reduced max_tokens: 300 → 150
 * - Faster model: gpt-4o-mini (fastest available)
 * - Lower temperature: 0.2 → 0.1
 * - Aggressive caching
 * - Simplified prompt
 */

import { matchingCache } from './matchingCache.js';

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
      temperature: 0.1, // Reduced for speed
      max_tokens: 100   // Reduced by 50% for speed
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

/**
 * ULTRA-FAST: Analyze attendee (400ms target)
 */
export async function getAttendeeAnalysis(attendee) {
  // OPTIMIZATION: Check cache first (0ms if hit)
  const cached = matchingCache.getAttendeeAnalysis(attendee.id);
  if (cached) {
    console.log(`💾 Cache HIT: ${attendee.name} (0ms)`);
    return cached;
  }
  
  const startTime = Date.now();
  console.log(`🤖 Agent 1: Analyzing ${attendee.name}...`);

  // OPTIMIZATION: Simplified prompt for faster processing
  const prompt = `Analyze attendee. Return JSON only:

Role: ${attendee.jobTitle} at ${attendee.company}
Intent: ${Array.isArray(attendee.intent) ? attendee.intent.join(', ') : attendee.intent}

JSON format:
{
  "primaryGoal": "job_hunting|learning|networking|partnerships|funding",
  "secondaryGoals": ["goal"],
  "roleLevel": "junior|mid|senior|executive",
  "technicalProfile": "technical|business|mixed",
  "mustHaves": ["keyword"],
  "summary": "brief summary"
}`;

  try {
    const text = await callOpenRouter(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("No JSON found");
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    const duration = Date.now() - startTime;
    
    console.log(`  ✅ ${duration}ms - ${analysis.primaryGoal} / ${analysis.roleLevel}`);
    
    // Cache result
    matchingCache.setAttendeeAnalysis(attendee.id, analysis);
    
    return analysis;
    
  } catch (error) {
    console.error(`❌ Agent 1 failed (${Date.now() - startTime}ms):`, error.message);
    
    // Fallback: instant analysis
    const fallback = generateFallbackAnalysis(attendee);
    matchingCache.setAttendeeAnalysis(attendee.id, fallback);
    return fallback;
  }
}

/**
 * Instant fallback (0ms)
 */
function generateFallbackAnalysis(attendee) {
  const intent = Array.isArray(attendee.intent) ? attendee.intent : [attendee.intent || 'networking'];
  const role = (attendee.jobTitle || '').toLowerCase();
  
  // Quick goal detection
  let primaryGoal = 'networking';
  if (intent.some(i => (i || '').toLowerCase().includes('job'))) primaryGoal = 'job_hunting';
  else if (intent.some(i => (i || '').toLowerCase().includes('learn'))) primaryGoal = 'learning';
  else if (intent.some(i => (i || '').toLowerCase().includes('partner'))) primaryGoal = 'partnerships';
  else if (intent.some(i => (i || '').toLowerCase().includes('fund'))) primaryGoal = 'funding';
  
  // Quick level detection
  let roleLevel = 'mid';
  if (role.includes('senior') || role.includes('lead')) roleLevel = 'senior';
  else if (role.includes('junior') || role.includes('intern')) roleLevel = 'junior';
  else if (role.includes('director') || role.includes('vp') || role.includes('chief')) roleLevel = 'executive';
  
  // Quick technical detection
  const technical = ['engineer', 'developer', 'programmer', 'architect'].some(k => role.includes(k));
  
  return {
    primaryGoal,
    secondaryGoals: intent.slice(1, 2),
    roleLevel,
    technicalProfile: technical ? 'technical' : 'business',
    mustHaves: intent.slice(0, 2),
    summary: `${attendee.jobTitle} at ${attendee.company}, ${primaryGoal.replace('_', ' ')}`
  };
}
