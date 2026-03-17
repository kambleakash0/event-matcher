import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Builds a predictable sponsor ID
export function buildSponsorText(sponsorData) {
  const companyName = (sponsorData.companyName ?? '').toLowerCase().trim();
  const domain = (sponsorData.domain ?? '').toLowerCase().trim();
  const projectName = (sponsorData.projectName ?? '').toLowerCase().trim();
  const promotionTypeText = Array.isArray(sponsorData.promotionType)
    ? sponsorData.promotionType.join(', ')
    : (sponsorData.promotionType || '');

  let text = `${companyName} Domain:${domain} Project:${projectName} PromotionType:${promotionTypeText} Team:`;
  for (const attendee of sponsorData.attendingTeam || []) {
    if (typeof attendee === 'object') {
      if (attendee.title) text += attendee.title.toLowerCase().trim() + ",";
    } else {
      const role = attendee.split('-')[1];
      if (role) text += role.toLowerCase().trim() + ",";
    }
  }
  console.log("Sponsor Text: ", text);
  return text;
}

// Builds a predictable attendee ID
export function buildAttendeeText(analysis = {}, attendeeData = {}) {
  const parts = [];

  if (analysis.summary) {
    parts.push(analysis.summary);
  }

  if (analysis.primaryGoal) {
    parts.push(`Goal: ${analysis.primaryGoal}`);
  }

  if (analysis.roleLevel) {
    parts.push(`Level: ${analysis.roleLevel}`);
  }

  if (analysis.technicalProfile) {
    parts.push(`Profile: ${analysis.technicalProfile}`);
  }

  if (Array.isArray(analysis.mustHaves) && analysis.mustHaves.length > 0) {
    parts.push(`Keywords: ${analysis.mustHaves.join(', ')}`);
  }

  if (attendeeData.company) {
    parts.push(`Company: ${attendeeData.company}`);
  }

  return parts.join(' ');
}

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

export async function generateEmbedding(text) {
  return await embeddings.embedQuery(text);
}