import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Builds a predictable sponsor ID
export function buildSponsorText(sponsorData) {
  let text = sponsorData.companyName?.toLowerCase().trim()+" Domain:"+sponsorData.domain?.toLowerCase().trim()+" Project:"+sponsorData.projectName?.toLowerCase().trim()+" PromotionType:"+(Array.isArray(sponsorData.promotionType) ? sponsorData.promotionType.join(', ') : sponsorData.promotionType || '')+" Team:";
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