import { buildAttendeeText, generateEmbedding } from './embeddingService.js';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getAttendeeAnalysis } from './agent1.js';
import { getTopRelevantSponsors } from './agent2.js';
import { generateMultipleNarratives } from './agent3.js';
import { createEventSchedule } from './agent4.js';
import { generateTipsAndFollowup } from './agent5.js';

export async function runMatching(attendee, sponsors, event) {
  let attendeeWithEmbedding = attendee;

  if (!attendee.embedding) {
    try {
      const {
        name,
        title,
        company,
        intent,
        interests,
        goals
      } = attendee || {};

      const fallbackParts = [name, title, company, intent, interests, goals].filter(Boolean);
      const text = fallbackParts.length > 0
        ? fallbackParts.join(' • ')
        : buildAttendeeText({}, attendee);

      const embedding = await generateEmbedding(text);
      attendeeWithEmbedding = { ...attendee, embedding };
      await setDoc(doc(db, 'attendees', attendee.id), { embedding }, { merge: true });
    } catch (e) {
      console.warn('Embedding generation failed:', e.message);
    }
  }

  // Try Vercel endpoint first
  try {
    const response = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendee: attendeeWithEmbedding, sponsors, event })
    });

    if (response.ok) {
      return response.json();
    }

    console.warn('Vercel endpoint failed, falling back to local agents');
  } catch (e) {
    console.warn('Vercel unreachable, falling back to local agents:', e.message);
  }

  // Fallback: run agents locally
  const attendeeAnalysis = await getAttendeeAnalysis(attendeeWithEmbedding);
  const topMatches = await getTopRelevantSponsors(attendeeAnalysis, sponsors, 4, attendeeWithEmbedding.embedding);
  const narratives = topMatches.length > 0
    ? await generateMultipleNarratives(attendeeWithEmbedding, topMatches, attendeeAnalysis)
    : [];
  const [schedule, tips] = await Promise.all([
    createEventSchedule(narratives, attendeeAnalysis, event),
    generateTipsAndFollowup(attendeeAnalysis, narratives, attendeeWithEmbedding)
  ]);

  return {
    attendeeSummary: attendeeAnalysis.summary,
    sponsorMatches: narratives,
    schedule,
    proTips: tips?.proTips || [],
    afterEvent: tips?.afterEvent || [],
    subject: `Your personalized guide for ${event?.name}`
  };
}