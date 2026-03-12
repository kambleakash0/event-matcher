// Builds a predictable sponsor ID
export function buildSponsorText(sponsorData) {
  let text = sponsorData.companyName?.toLowerCase().trim()+" Domain:"+sponsorData.domain?.toLowerCase().trim()+" Project:"+sponsorData.projectName?.toLowerCase().trim()+" PromotionType:"+(Array.isArray(sponsorData.promotionType) ? sponsorData.promotionType.join(', ') : sponsorData.promotionType || '')+" Team:";
  for (const attendee of sponsorData.attendingTeam || []) {
    const role = attendee.split('-')[1];
    if (role) text += role.toLowerCase().trim() + ",";
  };
  console.log("Sponsor Text: ", text);
  return text;
}

// Builds a predictable attendee ID
export function buildAttendeeText(attendeeData) {
  let text = attendeeData.name?.toLowerCase().trim()+", "+attendeeData.jobTitle?.toLowerCase().trim()+" at "+attendeeData.company?.toLowerCase().trim()+" Intent:"+attendeeData.intent?.join(',').toLowerCase().trim();
  console.log("Attendee Text: ", text);
  return text;
}

export async function generateEmbedding(text) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: {
        parts: [{ text }]
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API failed: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding.values; // array of ~768 numbers
}