export function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

export function findTopSponsors(attendeeEmbedding, sponsors, topN = 4) {
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