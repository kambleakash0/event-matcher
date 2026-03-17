import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.1,
  maxTokens: 100,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.VITE_OPENROUTER_KEY
  }
});

const prompt = ChatPromptTemplate.fromTemplate(`
Analyze attendee. Return JSON only:

Role: {jobTitle} at {company}
Intent: {intent}

JSON format:
{{
  "primaryGoal": "job_hunting|learning|networking|partnerships|funding",
  "secondaryGoals": ["goal"],
  "roleLevel": "junior|mid|senior|executive",
  "technicalProfile": "technical|business|mixed",
  "mustHaves": ["keyword"],
  "summary": "brief summary"
}}`);

const parser = new JsonOutputParser();
const chain = prompt.pipe(model).pipe(parser);

export async function getAttendeeAnalysis(attendee) {
  const startTime = Date.now();
  const ref = doc(db, 'attendeeAnalysis', attendee.id);
  const cached = await getDoc(ref);
  if (cached.exists()) {
    const cachedAt = cached.data().cachedAt?.toDate();
    const updatedAt = attendee.updatedAt?.toDate();
    if (!updatedAt || cachedAt > updatedAt) {
      return cached.data();
    }
  }

  try {
    const analysis = await chain.invoke({
      jobTitle: attendee.jobTitle,
      company: attendee.company,
      intent: Array.isArray(attendee.intent) 
        ? attendee.intent.join(', ') 
        : attendee.intent
    });

    console.log(`${Date.now() - startTime}ms for Agent 1 analysis`);

    await setDoc(ref, { ...analysis, cachedAt: new Date() });

    return analysis;
  } catch (error) {
    console.error("Error in Agent 1 analysis:", error);
    return generateFallbackAnalysis(attendee);
  }
}

function generateFallbackAnalysis(attendee) {
  const intent = Array.isArray(attendee.intent) ? attendee.intent : [attendee.intent || 'networking'];
  const role = (attendee.jobTitle || '').toLowerCase();

  let primaryGoal = 'networking';
  if (intent.some(i => (i || '').toLowerCase().includes('job'))) primaryGoal = 'job_hunting';
  else if (intent.some(i => (i || '').toLowerCase().includes('learn'))) primaryGoal = 'learning';
  else if (intent.some(i => (i || '').toLowerCase().includes('partner'))) primaryGoal = 'partnerships';
  else if (intent.some(i => (i || '').toLowerCase().includes('fund'))) primaryGoal = 'funding';

  let roleLevel = 'mid';
  if (role.includes('senior') || role.includes('lead')) roleLevel = 'senior';
  else if (role.includes('junior') || role.includes('intern')) roleLevel = 'junior';
  else if (role.includes('director') || role.includes('vp') || role.includes('chief')) roleLevel = 'executive';

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