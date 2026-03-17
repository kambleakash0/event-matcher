export function cosineSimilarity(a, b) {
  // Defensive checks to avoid NaN/Infinity from invalid inputs
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return 0;
  }
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  // Require equal lengths so we never read b[i] as undefined
  if (a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let sumSqA = 0;
  let sumSqB = 0;
  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    dot += valA * valB;
    sumSqA += valA * valA;
    sumSqB += valB * valB;
  }

  const magA = Math.sqrt(sumSqA);
  const magB = Math.sqrt(sumSqB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  const raw = dot / (magA * magB);
  if (!Number.isFinite(raw)) {
    return 0;
  }

  // Clamp to valid cosine range [-1, 1]
  return Math.max(-1, Math.min(1, raw));
}

export function findTopSponsors(attendeeEmbedding, sponsors, topN = 4) {
  const missing = sponsors.filter(s => !s.embedding || s.embedding.length === 0);
    if (missing.length > 0) {
      console.warn(`⚠️ ${missing.length} sponsor(s) skipped — no embedding: ${missing.map(s => s.companyName).join(', ')}`);
    }
  // Implementation for finding top sponsors based on embedding similarity
    return sponsors
    .filter(sponsor => sponsor.embedding && sponsor.embedding.length > 0)
    .map(sponsor => ({
      sponsor: sponsor,
      score: Math.round(cosineSimilarity(attendeeEmbedding, sponsor.embedding) * 100)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
};