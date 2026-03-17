import { findTopSponsors } from './similarityService.js';
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.1,
  maxTokens: 50,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.VITE_OPENROUTER_KEY
  }
});

const prompt = ChatPromptTemplate.fromTemplate(`
Score match 0-100:

Attendee: {attendeeprimaryGoal}, {attendeeroleLevel}
Sponsor: {sponsorcompanyName}, {sponsordomain}, {sponsorpromotionType}

Return JSON: {{"score": 85, "reason": "brief"}}`);

const parser = new JsonOutputParser();
const chain = prompt.pipe(model).pipe(parser);

async function scoreSponsorWithLLM(attendeeAnalysis, sponsor) {
  const startTime = Date.now();
  try {
    const scoring = await chain.invoke({
      attendeeprimaryGoal: attendeeAnalysis.primaryGoal,
      attendeeroleLevel: attendeeAnalysis.roleLevel,
      sponsorcompanyName: sponsor.companyName,
      sponsordomain: sponsor.domain,
      sponsorpromotionType: sponsor.promotionType?.[0] || ''
    });

    console.log(`${Date.now() - startTime}ms for Agent 2 analysis`);
    
    return {
      sponsor,
      isRelevant: scoring.score >= 60,
      score: scoring.score,
      reason: scoring.reason || "Match identified"
    };
    
  } catch (error) {
    console.error("Error scoring sponsor:", error);
    return {
      sponsor,
      isRelevant: false,
      score: 0,
      reason: "Error during scoring"
    };
  }
}

// Simple concurrency-limited async mapper to avoid unbounded LLM fan-out
async function mapWithConcurrencyLimit(items, limit, mapper) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) break;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

export async function getTopRelevantSponsors(attendeeAnalysis, sponsors, topN = 4, attendeeEmbedding = null) {
  if (attendeeEmbedding) {
    console.log('Using embeddings — no LLM calls');
    const results = findTopSponsors(attendeeEmbedding, sponsors, topN);
    if (results.length > 0) return results;
    console.warn('⚠️ Embedding path returned no results — falling back to LLM');
  }
  console.log('Using LLM scoring...');
  // Limit concurrent LLM calls to reduce rate-limit and timeout risk
  const CONCURRENCY_LIMIT = 5;
  const scores = await mapWithConcurrencyLimit(
    sponsors,
    CONCURRENCY_LIMIT,
    sponsor => scoreSponsorWithLLM(attendeeAnalysis, sponsor)
  );
  return scores
    .filter(s => s.isRelevant)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
