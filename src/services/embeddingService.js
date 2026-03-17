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
export function buildAttendeeText(analysis, attendeeData) {
  return [
    analysis.summary,
    `Goal: ${analysis.primaryGoal}`,
    `Level: ${analysis.roleLevel}`,
    `Profile: ${analysis.technicalProfile}`,
    `Keywords: ${(analysis.mustHaves || []).join(', ')}`,
    `Company: ${attendeeData.company}`
  ].filter(Boolean).join(' ');
}

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

export async function generateEmbedding(text) {
  return await embeddings.embedQuery(text);
}