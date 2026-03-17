import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

const sanitize = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => v === undefined ? null : v));

function getTeamMember(attendingTeam) {
  const member = attendingTeam?.[0];
  if (!member) return { name: 'Team rep', title: 'Team member' };
  if (typeof member === 'object') return { name: member.name || 'Team rep', title: member.title || 'Team member' };
  const match = member.match(/^(.+?)\s*[\(\-]\s*(.+?)[\)]?\s*$/);
  if (match) return { name: match[1].trim(), title: match[2].trim() };
  return { name: member.trim(), title: 'Team member' };
}

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.7,
  maxTokens: 250,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: import.meta.env.VITE_OPENROUTER_KEY
  }
});

const prompt = ChatPromptTemplate.fromTemplate(`
Match narrative. Return JSON only:

Attendee: {attendeeName}, {attendeeJobTitle}, Goal: {attendeePrimaryGoal}
Sponsor: {sponsorCompanyName}, {sponsorDomain}
Team: {sponsorAttendingTeamName} ({sponsorAttendingTeamTitle})

JSON:
{{
  "whyYou": "2 sentences: why match",
  "whatYouGain": "2 sentences: benefits",
  "whoToMeet": "name",
  "theirRole": "title",
  "whyThisPerson": "1 sentence",
  "conversationStarter": "opening line",
  "questionsToAsk": ["q1", "q2"]
}}`);

const parser = new JsonOutputParser();
const chain = prompt.pipe(model).pipe(parser);

export async function generateNarrative(attendee, sponsor, attendeeAnalysis, score) {

  try {
    const teamMember = getTeamMember(sponsor.attendingTeam);
    const narrative = await chain.invoke({
      attendeeName: attendee.name,
      attendeeJobTitle: attendee.jobTitle,
      attendeePrimaryGoal: attendeeAnalysis.primaryGoal.replace('_', ' '),
      sponsorCompanyName: sponsor.companyName,
      sponsorDomain: sponsor.domain || '',
      sponsorAttendingTeamName: teamMember.name || 'Team rep',
      sponsorAttendingTeamTitle: teamMember.title || 'Team member'
    });

    return {
      sponsor: sponsor.companyName,
      matchScore: score ?? 85,
      ...narrative
    };
    
  } catch (error) {
    return generateFallbackNarrative(sponsor, attendee, attendeeAnalysis);
  }
}

function generateFallbackNarrative(sponsor, attendee, attendeeAnalysis) {
  const person = getTeamMember(sponsor.attendingTeam);
  
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

export async function generateMultipleNarratives(attendee, topMatches, attendeeAnalysis) {
  const startTime = Date.now();
  
  const cacheRefs = topMatches.map(m => 
    doc(db, 'narrativeCache', `${attendee.id}_${m.sponsor.id}`)
  );
  const cachedDocs = await Promise.all(cacheRefs.map(ref => getDoc(ref)));

  const hits = [];
  const misses = [];

  cachedDocs.forEach((cached, idx) => {
    const matchData = topMatches[idx];
    if (cached.exists()) {
      const cachedAt = cached.data().cachedAt?.toDate();
      const attendeeUpdatedAt = attendee.updatedAt?.toDate();
      const sponsorUpdatedAt = matchData.sponsor.updatedAt?.toDate();
      if ((!attendeeUpdatedAt || cachedAt > attendeeUpdatedAt) && (!sponsorUpdatedAt || cachedAt > sponsorUpdatedAt)) {
        hits.push({ idx, narrative: cached.data().narrative });
        return;
      }
    }
    misses.push({ idx, matchData });
  });

  if (misses.length === 0) {
    console.log(`Agent 3: All ${hits.length} narratives from cache`);
    return hits.map(h => ({ ...h.narrative, matchScore: topMatches[h.idx].score ?? 85 }));
  }

  try{
    const narrativeArray = await Promise.all(
      misses.map(({ matchData: m }) => 
        generateNarrative(attendee, m.sponsor, attendeeAnalysis, m.score)
      )
    );
    console.log(`${Date.now() - startTime}ms for Agent 3 analysis`);

    await Promise.all(
      narrativeArray.map((narrative, i) => {
        const { matchData: m } = misses[i];
        const ref = doc(db, 'narrativeCache', `${attendee.id}_${m.sponsor.id}`);
        return setDoc(ref, { narrative: sanitize(narrative), cachedAt: new Date() });
      })
    );

    const result = new Array(topMatches.length);
    hits.forEach(({ idx, narrative }) => result[idx] = { ...narrative, matchScore: topMatches[idx].score ?? 85 });
    narrativeArray.forEach((narrative, i) => result[misses[i].idx] = narrative);
    return result;

  } catch (error) {
    // FALLBACK: individual calls in parallel
    console.warn('⚠️ Batch failed — falling back to individual calls:', error.message);
    const narratives = [];
    for (const { matchData: m } of misses) {
      const narrative = await generateNarrative(attendee, m.sponsor, attendeeAnalysis, m.score);
      narratives.push(narrative);
    }

    // Save fallback results to Firestore cache too
    await Promise.all(
      narratives.map((narrative, i) => {
        const { matchData: m } = misses[i];
        const ref = doc(db, 'narrativeCache', `${attendee.id}_${m.sponsor.id}`);
        return setDoc(ref, { narrative: sanitize(narrative), cachedAt: new Date() });
      })
    );

    const result = new Array(topMatches.length);
    hits.forEach(({ idx, narrative }) => result[idx] = { ...narrative, matchScore: topMatches[idx].score ?? 85 });
    narratives.forEach((narrative, i) => result[misses[i].idx] = narrative);
    return result;
  }
}
