/**
 * Matching Cache
 * In-memory cache to reduce redundant API calls during batch matching
 * Especially useful when:
 * - Re-matching same attendees
 * - Multiple attendees with similar profiles
 * - Recovering from errors mid-batch
 */

class MatchingCache {
  constructor() {
    this.attendeeAnalyses = new Map(); // attendeeId -> analysis object
    this.sponsorScores = new Map();     // "profileHash:sponsorId" -> score object
    this.sessionStart = Date.now();
  }
  
  // ========== AGENT 1 CACHING ==========
  
  /**
   * Get cached attendee analysis
   * @param {string} attendeeId - Unique attendee ID
   * @returns {Object|null} Cached analysis or null
   */
  getAttendeeAnalysis(attendeeId) {
    const cached = this.attendeeAnalyses.get(attendeeId);
    if (cached) {
      console.log(`💾 Cache HIT: Attendee ${attendeeId}`);
    }
    return cached;
  }
  
  /**
   * Cache attendee analysis
   * @param {string} attendeeId - Unique attendee ID
   * @param {Object} analysis - Agent 1 analysis result
   */
  setAttendeeAnalysis(attendeeId, analysis) {
    this.attendeeAnalyses.set(attendeeId, {
      ...analysis,
      cachedAt: Date.now()
    });
    console.log(`💾 Cached: Attendee ${attendeeId}`);
  }
  
  // ========== AGENT 2 CACHING ==========
  
  /**
   * Generate profile hash for similar attendee matching
   * Attendees with same profile can reuse sponsor scores
   */
  _generateProfileHash(attendeeAnalysis) {
    return [
      attendeeAnalysis.primaryGoal,
      attendeeAnalysis.roleLevel,
      attendeeAnalysis.technicalProfile,
      ...(attendeeAnalysis.mustHaves || []).sort()
    ].join('|');
  }
  
  /**
   * Get cached sponsor score for an attendee profile
   * @param {Object} attendeeAnalysis - From Agent 1
   * @param {string} sponsorId - Sponsor unique ID
   * @returns {Object|null} Cached score or null
   */
  getSponsorScore(attendeeAnalysis, sponsorId) {
    const profileHash = this._generateProfileHash(attendeeAnalysis);
    const key = `${profileHash}:${sponsorId}`;
    const cached = this.sponsorScores.get(key);
    
    if (cached) {
      // Only use cache if less than 1 hour old
      const age = Date.now() - cached.cachedAt;
      if (age < 3600000) { // 1 hour
        console.log(`💾 Cache HIT: Sponsor score for profile ${profileHash.slice(0, 20)}...`);
        return cached.score;
      } else {
        // Remove stale cache
        this.sponsorScores.delete(key);
      }
    }
    
    return null;
  }
  
  /**
   * Cache sponsor score for an attendee profile
   * @param {Object} attendeeAnalysis - From Agent 1
   * @param {string} sponsorId - Sponsor unique ID
   * @param {Object} score - Score object from Agent 2
   */
  setSponsorScore(attendeeAnalysis, sponsorId, score) {
    const profileHash = this._generateProfileHash(attendeeAnalysis);
    const key = `${profileHash}:${sponsorId}`;
    
    this.sponsorScores.set(key, {
      score,
      cachedAt: Date.now()
    });
  }
  
  // ========== CACHE MANAGEMENT ==========
  
  /**
   * Clear all caches
   */
  clear() {
    const stats = this.getStats();
    this.attendeeAnalyses.clear();
    this.sponsorScores.clear();
    this.sessionStart = Date.now();
    
    console.log('🗑️  Cache cleared:', stats);
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      attendeesAnalyzed: this.attendeeAnalyses.size,
      sponsorScoresCached: this.sponsorScores.size,
      sessionDurationMinutes: Math.round((Date.now() - this.sessionStart) / 60000),
      estimatedAPISaved: this.attendeeAnalyses.size * 0.0001 + 
                         this.sponsorScores.size * 0.00005
    };
  }
  
  /**
   * Remove stale cache entries (older than 1 hour)
   */
  pruneStale() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    let pruned = 0;
    
    // Prune attendee analyses
    for (const [key, value] of this.attendeeAnalyses.entries()) {
      if (now - value.cachedAt > maxAge) {
        this.attendeeAnalyses.delete(key);
        pruned++;
      }
    }
    
    // Prune sponsor scores
    for (const [key, value] of this.sponsorScores.entries()) {
      if (now - value.cachedAt > maxAge) {
        this.sponsorScores.delete(key);
        pruned++;
      }
    }
    
    if (pruned > 0) {
      console.log(`🗑️  Pruned ${pruned} stale cache entries`);
    }
    
    return pruned;
  }
  
  /**
   * Get detailed cache report
   */
  getDetailedReport() {
    const stats = this.getStats();
    
    return {
      ...stats,
      cacheHitPotential: {
        attendeeAnalyses: this.attendeeAnalyses.size,
        sponsorScores: this.sponsorScores.size,
        totalEntriesCached: this.attendeeAnalyses.size + this.sponsorScores.size
      },
      memorySizeEstimate: this._estimateMemorySize(),
      recommendations: this._generateRecommendations()
    };
  }
  
  _estimateMemorySize() {
    // Rough estimate: ~1KB per attendee analysis, ~100 bytes per sponsor score
    const attendeeKB = this.attendeeAnalyses.size * 1;
    const sponsorKB = this.sponsorScores.size * 0.1;
    return `${(attendeeKB + sponsorKB).toFixed(2)} KB`;
  }
  
  _generateRecommendations() {
    const recs = [];
    
    if (this.sponsorScores.size === 0) {
      recs.push('Consider enabling sponsor score caching for better performance');
    }
    
    if (this.attendeeAnalyses.size > 100) {
      recs.push('Large cache detected - consider clearing after batch completion');
    }
    
    const sessionHours = (Date.now() - this.sessionStart) / 3600000;
    if (sessionHours > 2) {
      recs.push('Long session detected - cache may contain stale data');
    }
    
    return recs.length > 0 ? recs : ['Cache is healthy'];
  }
}

// Singleton instance
export const matchingCache = new MatchingCache();

// Auto-prune every 15 minutes
setInterval(() => {
  matchingCache.pruneStale();
}, 900000);

// Export class for testing
export { MatchingCache };
