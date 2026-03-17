import { db } from './firebase.js';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { buildSponsorText, buildAttendeeText, generateEmbedding } from './embeddingService.js';

// Builds a predictable sponsor ID
export function buildSponsorId(eventId, companyName) {
  const normalized = companyName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')       // spaces → underscores
    .replace(/[\/\\.#[\]]/g, '') // strip Firestore-invalid chars: / \ . # [ ]
    .replace(/_+/g, '_');        // collapse any double underscores
  return `${eventId}_${normalized}`;
}

// Builds a predictable attendee ID — hashed email is unique per person
export function buildAttendeeId(eventId, email) {
  const normalized = email.toLowerCase().trim();
  // Simple hash — not cryptographic, just opaque
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `${eventId}_${Math.abs(hash)}`;
}

// Returns true if newly created, false if it already existed (duplicate)
export async function upsertAttendee(eventId, attendeeData) {
  const id = buildAttendeeId(eventId, attendeeData.email);
  const ref = doc(db, 'attendees', id);
  const existing = await getDoc(ref);
  const isNew = !existing.exists();
  await setDoc(ref, {
    eventId,
    ...attendeeData,
    ...(isNew ? { embedding: null, createdAt: new Date() } : {}),
    updatedAt: new Date()
  }, { merge: true });
  return isNew; // true = new, false = duplicate
}

// Returns true if newly created, false if it already existed (duplicate)
export async function upsertSponsor(eventId, sponsorData) {
  const id = buildSponsorId(eventId, sponsorData.companyName);
  const ref = doc(db, 'sponsors', id);
  const existing = await getDoc(ref);
  const isNew = !existing.exists();
  let embedding = null;
  if (isNew || !existing.data()?.embedding) {
    const text = buildSponsorText(sponsorData);
    embedding = await generateEmbedding(text);
  }
  await setDoc(ref, {
    eventId,
    ...sponsorData,
    ...(isNew ? { createdAt: new Date(), embedding } : {}),
    ...(embedding ? { embedding } : {}),
    updatedAt: new Date()
  }, { merge: true });
  return isNew; // true = new, false = duplicate
}