/**
 * AGENT 2: ULTRA-FAST RELEVANCE SCORER
 * Target: 500ms for all sponsors
 * 
 * OPTIMIZATIONS:
 * - Pre-filter to top 8 candidates (vs 20+)
 * - Parallel scoring of only 8 sponsors
 * - Reduced max_tokens: 100 → 50
 * - Simplified scoring prompt
 * - Skip LLM for obvious mismatches
 */

import { preFilterSponsors } from './smartSponsorFilter.js';

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
      temperature: 0.1,
      max_tokens: 50 // Reduced by 50% for speed
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message?.content || "";
}

/**
 * ULTRA-FAST: Score single sponsor (60ms target)
 */
async function scoreSponsorRelevance(attendeeAnalysis, sponsor) {
  // Simplified prompt for speed
  const prompt = `Score match 0-100:

Attendee: ${attendeeAnalysis.primaryGoal}, ${attendeeAnalysis.roleLevel}
Sponsor: ${sponsor.companyName}, ${sponsor.domain}, ${sponsor.promotionType?.[0]}

Return JSON: {"score": 85, "reason": "brief"}`;

  try {
    const text = await callOpenRouter(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error("No JSON");
    
    const scoring = JSON.parse(jsonMatch[0]);
    
    return {
      sponsor,
      isRelevant: scoring.score >= 60,
      score: scoring.score,
      reason: scoring.reason || "Match identified"
    };
    
  } catch (error) {
    // Instant fallback
    const score = calculateQuickScore(attendeeAnalysis, sponsor);
    return {
      sponsor,
      isRelevant: score >= 60,
      score: score,
      reason: "Heuristic match"
    };
  }
}

/**
 * Instant heuristic scoring (0ms)
 */
function calculateQuickScore(attendeeAnalysis, sponsor) {
  let score = 0;
  const goal = attendeeAnalysis.primaryGoal.toLowerCase();
  const promos = (sponsor.promotionType || []).map(p => p.toLowerCase()).join(' ');
  const domain = (sponsor.domain || '').toLowerCase();
  
  // Goal matching (0-50 points)
  if (goal.includes('job') && promos.includes('hir')) score += 50;
  else if (goal.includes('learn') && (promos.includes('product') || promos.includes('tech'))) score += 40;
  else if (goal.includes('network')) score += 30;
  else if (goal.includes('partner') && promos.includes('partner')) score += 45;
  else if (goal.includes('fund') && (promos.includes('fund') || domain.includes('vc'))) score += 50;
  
  // Technical fit (0-30 points)
  if (attendeeAnalysis.technicalProfile === 'technical') {
    if (domain.includes('tech') || domain.includes('software') || domain.includes('developer')) {
      score += 30;
    }
  }
  
  // Role fit (0-20 points)
  if (attendeeAnalysis.roleLevel === 'senior' || attendeeAnalysis.roleLevel === 'executive') {
    const team = sponsor.attendingTeam || [];
    if (team.some(m => (m.title || '').toLowerCase().match(/director|vp|head|chief/))) {
      score += 20;
    }
  }
  
  return Math.min(100, score);
}

/**
 * ULTRA-FAST: Batch score with aggressive pre-filtering
 * Target: 500ms for 20+ sponsors
 */
export async function batchScoreSponsors(attendeeAnalysis, sponsors) {
  const startTime = Date.now();
  console.log(`🎯 Agent 2 ULTRA-FAST: ${sponsors.length} sponsors...`);
  
  // OPTIMIZATION 1: Aggressive pre-filter (reduces 20 → 8)
  const maxCandidates = Math.min(sponsors.length, 8); // Reduced from 10
  const preFiltered = preFilterSponsors(attendeeAnalysis, sponsors, maxCandidates);
  
  console.log(`   📊 Pre-filter: ${sponsors.length} → ${preFiltered.length} (${Date.now() - startTime}ms)`);
  
  // OPTIMIZATION 2: Parallel score only top candidates
  const scoreStart = Date.now();
  const scores = await Promise.all(
    preFiltered.map(sponsor => scoreSponsorRelevance(attendeeAnalysis, sponsor))
  );
  
  console.log(`   ⚡ LLM scoring: ${Date.now() - scoreStart}ms`);
  
  // Filter and sort
  const relevant = scores
    .filter(s => s.isRelevant && s.score >= 60)
    .sort((a, b) => b.score - a.score);
  
  console.log(`   ✅ Agent 2: ${Date.now() - startTime}ms - ${relevant.length} matches`);
  
  return relevant;
}

/**
 * Get top N sponsors (ultra-fast)
 */
export async function getTopRelevantSponsors(attendeeAnalysis, sponsors, topN = 4) {
  const relevant = await batchScoreSponsors(attendeeAnalysis, sponsors);
  return relevant.slice(0, topN);
}
