/**
 * Smart Sponsor Pre-filtering
 * Reduces API calls by 60-80% using heuristic scoring
 * before expensive LLM scoring
 */

/**
 * Pre-filter sponsors using simple heuristics
 * @param {Object} attendeeAnalysis - From Agent 1
 * @param {Array} sponsors - All event sponsors
 * @param {Number} maxResults - Max sponsors to pass to Agent 2 (default 10)
 * @returns {Array} Top candidates for LLM scoring
 */
export function preFilterSponsors(attendeeAnalysis, sponsors, maxResults = 10) {
  console.log(`📊 Pre-filtering ${sponsors.length} sponsors...`);
  
  const scored = sponsors.map(sponsor => ({
    sponsor,
    score: calculateRelevanceScore(attendeeAnalysis, sponsor)
  }));
  
  // Sort by score and take top candidates
  const filtered = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(maxResults, sponsors.length))
    .map(s => s.sponsor);
  
  console.log(`   ✅ Reduced to ${filtered.length} candidates (saved ${sponsors.length - filtered.length} API calls)`);
  
  return filtered;
}

/**
 * Calculate heuristic relevance score
 * Based on keywords, intent matching, and role fit
 */
function calculateRelevanceScore(attendeeAnalysis, sponsor) {
  let score = 0;
  
  const goals = [
    attendeeAnalysis.primaryGoal, 
    ...(attendeeAnalysis.secondaryGoals || [])
  ];
  const promos = (sponsor.promotionType || []).map(p => p.toLowerCase());
  const domain = (sponsor.domain || '').toLowerCase();
  const projectName = (sponsor.projectName || '').toLowerCase();
  
  // Intent matching (0-40 points)
  goals.forEach(goal => {
    const lowerGoal = goal.toLowerCase();
    
    if (lowerGoal.includes('job') || lowerGoal.includes('career')) {
      if (promos.some(p => p.includes('hir') || p.includes('career') || p.includes('job') || p.includes('recruit'))) {
        score += 40;
      }
    }
    
    if (lowerGoal.includes('learn') || lowerGoal.includes('education')) {
      if (promos.some(p => p.includes('product') || p.includes('tech') || p.includes('workshop') || p.includes('training')) ||
          domain.includes('education') || domain.includes('training') || domain.includes('learning')) {
        score += 35;
      }
    }
    
    if (lowerGoal.includes('network')) {
      if (promos.some(p => p.includes('network') || p.includes('community') || p.includes('connect'))) {
        score += 30;
      }
    }
    
    if (lowerGoal.includes('partner') || lowerGoal.includes('collab')) {
      if (promos.some(p => p.includes('partner') || p.includes('collab') || p.includes('alliance'))) {
        score += 40;
      }
    }
    
    if (lowerGoal.includes('funding') || lowerGoal.includes('investment')) {
      if (promos.some(p => p.includes('fund') || p.includes('invest') || p.includes('capital')) ||
          domain.includes('vc') || domain.includes('investor')) {
        score += 45;
      }
    }
  });
  
  // Technical fit (0-30 points)
  if (attendeeAnalysis.technicalProfile === 'technical') {
    const techKeywords = [
      'developer', 'software', 'tech', 'ai', 'cloud', 'data', 
      'engineering', 'api', 'platform', 'infrastructure'
    ];
    
    const hasTechMatch = techKeywords.some(keyword => 
      domain.includes(keyword) || projectName.includes(keyword)
    );
    
    if (hasTechMatch) {
      score += 30;
    }
  }
  
  // Role level matching (0-20 points)
  const sponsorTeam = sponsor.attendingTeam || [];
  const attendeeRoleLevel = attendeeAnalysis.roleLevel || '';
  
  if (attendeeRoleLevel.toLowerCase().includes('senior') || 
      attendeeRoleLevel.toLowerCase().includes('director') ||
      attendeeRoleLevel.toLowerCase().includes('vp')) {
    
    const hasSeniorReps = sponsorTeam.some(member => {
      const title = (member.title || '').toLowerCase();
      return title.includes('director') || 
             title.includes('vp') || 
             title.includes('head') ||
             title.includes('chief') ||
             title.includes('founder');
    });
    
    if (hasSeniorReps) {
      score += 20;
    }
  }
  
  // Must-have keywords (0-10 points each, max 30)
  let mustHavePoints = 0;
  (attendeeAnalysis.mustHaves || []).forEach(keyword => {
    if (!keyword) return;
    
    const lowerKeyword = keyword.toLowerCase();
    if (domain.includes(lowerKeyword) || 
        projectName.includes(lowerKeyword) ||
        promos.some(p => p.includes(lowerKeyword))) {
      mustHavePoints += 10;
    }
  });
  score += Math.min(30, mustHavePoints);
  
  // Company size/type preference (0-10 points)
  // Large companies get bonus for job hunting
  if (goals.some(g => g.toLowerCase().includes('job'))) {
    const isLargeCompany = 
      (sponsor.attendingTeam || []).length >= 3 ||
      domain.includes('enterprise') ||
      ['technology', 'consulting', 'financial services'].some(t => domain.includes(t));
    
    if (isLargeCompany) {
      score += 10;
    }
  }
  
  return Math.min(100, score);
}

/**
 * Export relevance score for debugging/analysis
 */
export function explainRelevanceScore(attendeeAnalysis, sponsor) {
  const score = calculateRelevanceScore(attendeeAnalysis, sponsor);
  
  return {
    companyName: sponsor.companyName,
    score: score,
    breakdown: {
      primaryGoal: attendeeAnalysis.primaryGoal,
      sponsorDomain: sponsor.domain,
      promotionTypes: sponsor.promotionType
    }
  };
}
