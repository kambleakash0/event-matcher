import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import { db } from './firebaseAdmin.js';

const MatchState = Annotation.Root({
  attendee:         Annotation,
  sponsors:         Annotation,
  event:            Annotation,
  attendeeAnalysis: Annotation({ reducer: (_, b) => b, default: () => null }),
  topMatches:       Annotation({ reducer: (_, b) => b, default: () => [] }),
  narratives:       Annotation({ reducer: (_, b) => b, default: () => [] }),
  schedule:         Annotation({ reducer: (_, b) => b, default: () => [] }),
  tips:             Annotation({ reducer: (_, b) => b, default: () => null }),
});

const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 500,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_KEY
  }
});

function fallbackAnalysis(attendee) {
  const intent = Array.isArray(attendee.intent) ? attendee.intent : [attendee.intent || 'networking'];
  const role = (attendee.jobTitle || '').toLowerCase();

  let primaryGoal = 'networking';
  if (intent.some(i => i?.toLowerCase().includes('job'))) primaryGoal = 'job_hunting';
  else if (intent.some(i => i?.toLowerCase().includes('learn'))) primaryGoal = 'learning';
  else if (intent.some(i => i?.toLowerCase().includes('partner'))) primaryGoal = 'partnerships';
  else if (intent.some(i => i?.toLowerCase().includes('fund'))) primaryGoal = 'funding';
  
  let roleLevel = 'mid';
  if (role.includes('senior') || role.includes('lead')) roleLevel = 'senior';
  else if (role.includes('junior') || role.includes('intern')) roleLevel = 'junior';
  else if (role.includes('director') || role.includes('vp') || role.includes('chief')) roleLevel = 'executive';
  
  const technical = ['engineer', 'developer', 'architect', 'programmer'].some(k => role.includes(k));
  
  return {
    primaryGoal,
    secondaryGoals: intent.slice(1, 2),
    roleLevel,
    technicalProfile: technical ? 'technical' : 'business',
    mustHaves: intent.slice(0, 2),
    summary: `${attendee.jobTitle} at ${attendee.company}, focused on ${primaryGoal.replace('_', ' ')}`
  };
}

async function analyzeAttendee(state) {
  const { attendee } = state;
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

  const chain = prompt.pipe(model).pipe(new JsonOutputParser());

  const ref = db.collection('attendeeAnalysis').doc(attendee.id);
    const cached = await ref.get();
    if (cached.exists) {
      const cachedAt = cached.data().cachedAt?.toDate();
      const updatedAt = attendee.updatedAt?.toDate();
      if (!updatedAt || cachedAt > updatedAt) {
        return { attendeeAnalysis: cached.data() };
      }
    }
    try {
      const analysis = await chain.invoke({
        jobTitle: attendee.jobTitle,
        company: attendee.company,
        intent: Array.isArray(attendee.intent) ? attendee.intent.join(', ') : attendee.intent
      });

      // Cache to Firestore
      await ref.set({ ...analysis, cachedAt: new Date() }, { merge: true });

      return { attendeeAnalysis: analysis };
    } catch (error) {
      console.warn('Agent 1 LLM failed, using fallback:', error.message);
      const analysis = fallbackAnalysis(attendee);
      await ref.set({ ...analysis, cachedAt: new Date() }, { merge: true });
      return { attendeeAnalysis: analysis };
    }
}

async function findMatches(state) {
  const { sponsors, attendee } = state;

  const cosineSimilarity = (a, b) => {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  };

  try {
    const attendeeEmbedding = attendee.embedding || (await db.collection('attendees').doc(attendee.id).get()).data()?.embedding;

    if (attendeeEmbedding) {
      const scored = sponsors
        .filter(s => s.embedding)
        .map(s => ({ sponsor: s, score: Math.round(cosineSimilarity(attendeeEmbedding, s.embedding) * 100) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      if (scored.length > 0) {
        console.log('Agent 2: using embeddings');
        return { topMatches: scored };
      }
    }

    // No embedding found — fallback to first 4 sponsors
    console.warn('Agent 2: no embedding found, using fallback');
    return { topMatches: sponsors.slice(0, 4).map(s => ({ sponsor: s, score: 75 })) };

  } catch (error) {
    console.warn('Agent 2 failed, using fallback:', error.message);
    return { topMatches: sponsors.slice(0, 4).map(s => ({ sponsor: s, score: 75 })) };
  }
}

function fallbackNarrative(sponsor, attendee, attendeeAnalysis, score) {
  const team = sponsor.attendingTeam?.[0];
  const teamName = typeof team === 'object' ? team?.name || 'Team rep' : team?.split(/[(-]/)?.[0]?.trim() || 'Team rep';
  const teamTitle = typeof team === 'object' ? team?.title || 'Team member' : team?.match(/[(-](.+)/)?.[1]?.replace(')', '').trim() || 'Team member';
  return {
    sponsor: sponsor.companyName,
    matchScore: score ?? 70,
    whyYou: `${sponsor.companyName} aligns with your ${attendeeAnalysis.primaryGoal.replace('_', ' ')} goal as ${attendee.jobTitle}.`,
    whatYouGain: `Explore ${sponsor.promotionType?.[0] || 'opportunities'} at ${sponsor.companyName}.`,
    whoToMeet: teamName,
    theirRole: teamTitle,
    whyThisPerson: `${teamName} can share insights about ${sponsor.companyName}.`,
    conversationStarter: `Hi, I'm ${attendee.name}. I'm interested in what ${sponsor.companyName} is working on.`,
    questionsToAsk: [`What is ${sponsor.companyName} currently focused on?`, 'What opportunities are available?']
  };
}

async function generateNarratives(state) {
  const { attendee, attendeeAnalysis, topMatches } = state;

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

  const chain = prompt.pipe(model).pipe(new JsonOutputParser());

  // Check cache for each sponsor
  const hits = [];
  const misses = [];

  await Promise.all(topMatches.map(async (match, idx) => {
    const ref = db.collection('narrativeCache').doc(`${attendee.id}_${match.sponsor.id}`);
    const cached = await ref.get();
    if (cached.exists) {
      const cachedAt = cached.data().cachedAt?.toDate();
      const attendeeUpdatedAt = attendee.updatedAt?.toDate ? attendee.updatedAt.toDate() : null;
      const sponsorUpdatedAt = match.sponsor.updatedAt?.toDate ? match.sponsor.updatedAt.toDate() : null;
      if ((!attendeeUpdatedAt || cachedAt > attendeeUpdatedAt) && (!sponsorUpdatedAt || cachedAt > sponsorUpdatedAt)) {
        hits.push({ idx, narrative: { ...cached.data().narrative, matchScore: match.score ?? 85 } });
        return;
      }
    }
    misses.push({ idx, match });
  }));

  if (misses.length === 0) {
    console.log('Agent 3: all narratives from cache');
    const result = new Array(topMatches.length);
    hits.forEach(({ idx, narrative }) => result[idx] = narrative);
    return { narratives: result };
  }

  // LLM calls for cache misses — parallel, each with fallback
  const newNarratives = await Promise.all(misses.map(async ({ match }) => {
    const team = match.sponsor.attendingTeam?.[0];
    const teamName = typeof team === 'object' ? team?.name || 'Team rep' : team?.split(/[(-]/)?.[0]?.trim() || 'Team rep';
    const teamTitle = typeof team === 'object' ? team?.title || 'Team member' : team?.match(/[(-](.+)/)?.[1]?.replace(')', '').trim() || 'Team member';

    try {
      const narrative = await chain.invoke({
        attendeeName: attendee.name,
        attendeeJobTitle: attendee.jobTitle,
        attendeePrimaryGoal: attendeeAnalysis.primaryGoal,
        sponsorCompanyName: match.sponsor.companyName,
        sponsorDomain: match.sponsor.domain || '',
        sponsorAttendingTeamName: teamName,
        sponsorAttendingTeamTitle: teamTitle
      });

      const result = { sponsor: match.sponsor.companyName, matchScore: match.score ?? 85, ...narrative };

      // Save to cache
      await db.collection('narrativeCache')
        .doc(`${attendee.id}_${match.sponsor.id}`)
        .set({ narrative, cachedAt: new Date() });

      return result;

    } catch (error) {
      console.warn(`Narrative fallback for ${match.sponsor.companyName}:`, error.message);
      return fallbackNarrative(match.sponsor, attendee, attendeeAnalysis, match.score);
    }
  }));

  const result = new Array(topMatches.length);
  hits.forEach(({ idx, narrative }) => result[idx] = narrative);
  newNarratives.forEach((narrative, i) => result[misses[i].idx] = narrative);
  return { narratives: result };
}

function formatHour(hour24) {
  const display = hour24 > 12 ? hour24 - 12 : hour24;
  const period = hour24 < 12 ? 'AM' : 'PM';
  return `${display}:00 ${period}`;
}

function formatBlock(startMins, durationMins) {
  const endMins = startMins + durationMins;
  const startHour24 = Math.floor(startMins / 60);
  const startMin = startMins % 60;
  const endHour24 = Math.floor(endMins / 60);
  const endMin = endMins % 60;
  const startDisplay = startHour24 > 12 ? startHour24 - 12 : startHour24;
  const endDisplay = endHour24 > 12 ? endHour24 - 12 : endHour24;
  const startPeriod = startHour24 < 12 ? 'AM' : 'PM';
  const endPeriod = endHour24 < 12 ? 'AM' : 'PM';
  return `${startDisplay}:${startMin.toString().padStart(2,'0')} ${startPeriod} - ${endDisplay}:${endMin.toString().padStart(2,'0')} ${endPeriod}`;
}

export function createScheduleNode(state) {
  const { topMatches, event } = state;
  const schedule = [];
  
  // Extract event timing with fallbacks
  let startHour = 9; // Default 9 AM
  let endHour = 17; // Default 5 PM
  
  // Try to parse start time
  if (event.startTime || event.start_time) {
    const timeStr = event.startTime || event.start_time;
    const match = timeStr.match(/(\d+)/);
    if (match) {
      startHour = parseInt(match[1]);
      if (timeStr.toLowerCase().includes('pm') && startHour < 12) {
        startHour += 12;
      }
    }
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

  const totalMinutes = (endHour - startHour) * 60;
  const sponsorCount = Math.min(topMatches.length, 4);
  const minutesPerSponsor = Math.floor(totalMinutes / (sponsorCount + 1)); // +1 for buffer
  
  let currentMinute = startHour * 60;
  const endMinute = endHour * 60;

  if (!topMatches || topMatches.length === 0) {
    return {
      schedule: [{
        time: `${formatHour(startHour)} - ${formatHour(endHour)}`,
        activity: "Open networking",
        reason: "No specific sponsor matches — use this time to explore and connect"
      }]
    };
  }
  
  // Visit top priority sponsors first
  topMatches.slice(0, Math.min(2, topMatches.length)).forEach((match, i) => {
    if (currentMinute + minutesPerSponsor <= endMinute) {
      schedule.push({
        time: formatBlock(currentMinute, minutesPerSponsor),
        activity: `Visit ${match.sponsor.companyName} booth`,
        reason: i === 0 
          ? "Your top match - visit first when you're most energized"
          : "High-priority match while you're still fresh"
      });
      currentMinute += minutesPerSponsor;
    }
  });
  
  // Add networking break if time permits
  const BREAK_MINS = 30;
  if (totalMinutes > 240 && currentMinute + BREAK_MINS <= endMinute) {
    schedule.push({
      time: formatBlock(currentMinute, BREAK_MINS),
      activity: "Networking break / Coffee",
      reason: "Process what you've learned and prepare for next conversations"
    });
    currentMinute += BREAK_MINS;
  }
  
  // Add remaining sponsors if time permits
  topMatches.slice(2, 4).forEach((match) => {
    if (currentMinute + minutesPerSponsor <= endMinute) {
      schedule.push({
        time: formatBlock(currentMinute, minutesPerSponsor),
        activity: `Visit ${match.sponsor.companyName} booth`,
        reason: "Strong match - good time to explore their offerings"
      });
      currentMinute += minutesPerSponsor;
    }
  });
  
  // Add follow-up time towards the end
  if (currentMinute + minutesPerSponsor <= endMinute) {
    schedule.push({
      time: formatBlock(currentMinute, minutesPerSponsor),
      activity: "Follow-up conversations / Ask remaining questions",
      reason: "Revisit sponsors to clarify or discuss next steps"
    });
  }
  
  return { schedule };
}

function generateTemplateTips(attendeeAnalysis, topMatches) {
  const tips = { proTips: [], afterEvent: [] };

  // Safely derive a readable sponsor name from the match shape { sponsor, score }
  const getSponsorName = (match) => {
    if (!match || !match.sponsor) return null;
    const sponsor = match.sponsor;
    if (typeof sponsor === 'string') {
      return sponsor;
    }
    if (typeof sponsor === 'object') {
      return sponsor.companyName || sponsor.name || String(sponsor);
    }
    return String(sponsor);
  };
  
  const primaryGoal = attendeeAnalysis.primaryGoal;
  const roleLevel = attendeeAnalysis.roleLevel;
  const technical = attendeeAnalysis.technicalProfile;
  const topSponsor = getSponsorName(topMatches[0]) || 'your top matches';
  const secondSponsor = getSponsorName(topMatches[1]) || 'key sponsors';
  // In this code path, `topMatches` does not contain `whoToMeet`, so keep this generic
  const topPerson = 'team representatives';
  
  // Generate goal-specific tips
  switch (primaryGoal) {
    case 'job_hunting':
    case 'intern':
      tips.proTips = [
        `Bring 5-10 printed copies of your resume to hand to ${topSponsor} and ${secondSponsor}`,
        `Research ${topSponsor}'s open positions before the event - they scored ${topMatches[0]?.score}/100 for you`,
        `Prepare a 30-second elevator pitch highlighting your ${roleLevel}-level experience in ${technical === 'technical' ? 'technical' : 'your'} field`,
        `Ask ${topPerson} at ${topSponsor} about team structure and growth opportunities, not just job descriptions`
      ];
      tips.afterEvent = [
        `Send personalized LinkedIn connection requests to ${topPerson} and other ${topSponsor} representatives within 24 hours`,
        `Follow up via email with ${topSponsor} and ${secondSponsor} referencing specific conversation points within 48 hours`,
        `Apply to any mentioned positions at ${topMatches.slice(0, 3).map(getSponsorName).join(', ')} and reference your conversations in cover letters`
      ];
      break;
      
    case 'learning':
      tips.proTips = [
        `Prepare specific technical questions about ${topSponsor}'s ${technical === 'technical' ? 'technology stack and architecture' : 'products and approach'}`,
        `Take detailed notes when talking to ${topPerson} at ${topSponsor} - they're your highest match at ${topMatches[0]?.score}/100`,
        `Ask ${topSponsor} and ${secondSponsor} for documentation, tutorials, or demo access to explore after the event`,
        `Focus on understanding how ${topMatches.slice(0, 2).map(getSponsorName).join(' and ')} solve problems in their domain`
      ];
      tips.afterEvent = [
        `Review and organize your notes from ${topSponsor}, ${secondSponsor}, and ${getSponsorName(topMatches[2]) || 'other sponsors'} while details are fresh`,
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

async function generateTips(state) {
  const { attendeeAnalysis, narratives, topMatches } = state;
  const matchesSummary = narratives.map((n, i) =>
  `${i + 1}. ${n.sponsor} (Score: ${n.matchScore}/100)\n   Why: ${n.whyYou?.substring(0, 100)}...\n   Meet: ${n.whoToMeet} (${n.theirRole})`
).join('\n\n');
  const prompt = ChatPromptTemplate.fromTemplate(`Generate specific actionable event tips. Return JSON only.

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

  const chain = prompt.pipe(model).pipe(new JsonOutputParser());
  try{
    const tips = await chain.invoke({
      primaryGoal: attendeeAnalysis.primaryGoal,
      secondaryGoals: attendeeAnalysis.secondaryGoals?.join(', ') || 'None',
      roleLevel: attendeeAnalysis.roleLevel,
      technicalProfile: attendeeAnalysis.technicalProfile,
      summary: attendeeAnalysis.summary,
      matchesSummary,
      sponsorNames: narratives.map(n => n.sponsor).join(', '),
      contactNames: narratives.map(n => n.whoToMeet).filter(Boolean).join(', ')
    });
    return { tips };
  } catch (error) {
    console.error('Error generating tips:', error);
    return { tips: generateTemplateTips(attendeeAnalysis, topMatches) };
  }
}

const graph = new StateGraph(MatchState)
  .addNode('analyzeAttendee', analyzeAttendee)
  .addNode('findMatches', findMatches)
  .addNode('generateNarratives', generateNarratives)
  .addNode('createSchedule', createScheduleNode)
  .addNode('generateTips', generateTips)
  .addEdge('__start__', 'analyzeAttendee')
  .addEdge('analyzeAttendee', 'findMatches')
  .addEdge('findMatches', 'generateNarratives')
  .addEdge('generateNarratives', 'createSchedule')
  .addEdge('generateNarratives', 'generateTips')
  .addEdge('createSchedule', '__end__')
  .addEdge('generateTips', '__end__')
  .compile();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { attendee, sponsors, event } = req.body;
  if (!attendee || !sponsors || !event) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const result = await graph.invoke({ attendee, sponsors, event });
    return res.status(200).json({
      attendeeSummary: result.attendeeAnalysis?.summary,
      sponsorMatches: result.narratives,
      schedule: result.schedule || [],
      proTips: result.tips?.proTips || [],
      afterEvent: result.tips?.afterEvent || [],
      subject: `Your personalized guide for ${event?.name}`
    });
  } catch (error) {
    console.error('Graph error:', error);
    return res.status(500).json({ error: error.message });
  }
}