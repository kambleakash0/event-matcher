import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_vnw9yrk';
const TEMPLATE_ID = 'template_xgb7a0n'; // Your template ID
const PUBLIC_KEY = '6n1ATubBBKB1eKxpk'; // Your public key

emailjs.init(PUBLIC_KEY);

export async function sendMatchEmail(attendee, matchResult, event) {
  // Format sponsor matches
  const sponsorMatchesHtml = matchResult.sponsorMatches
    .map((match, i) => `
      <div style="background: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 16px; border-left: 4px solid #6366f1;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 18px; font-weight: bold; color: #f8fafc;">#${i + 1} ${match.sponsor}</span>
          <span style="background: linear-gradient(135deg, #6366f1, #0ea5e9); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; color: white;">${match.matchScore}% Match</span>
        </div>
        
        <div style="background: #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <p style="color: #6366f1; font-weight: 600; margin: 0 0 4px; font-size: 13px;">💡 WHY THIS IS FOR YOU</p>
          <p style="color: #f8fafc; margin: 0; font-size: 14px; line-height: 1.5;">${match.whyYou}</p>
        </div>
        
        <div style="background: #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <p style="color: #22c55e; font-weight: 600; margin: 0 0 4px; font-size: 13px;">🎯 WHAT YOU'LL GAIN</p>
          <p style="color: #f8fafc; margin: 0; font-size: 14px; line-height: 1.5;">${match.whatYouGain}</p>
        </div>
        
        <div style="background: #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <p style="color: #0ea5e9; font-weight: 600; margin: 0 0 4px; font-size: 13px;">👤 WHO TO MEET</p>
          <p style="color: #f8fafc; margin: 0; font-size: 14px;"><strong>${match.whoToMeet}</strong> - ${match.theirRole}</p>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">${match.whyThisPerson}</p>
        </div>
        
        <div style="background: #1e293b; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <p style="color: #f59e0b; font-weight: 600; margin: 0 0 4px; font-size: 13px;">💬 CONVERSATION STARTER</p>
          <p style="color: #f8fafc; margin: 0; font-size: 14px; font-style: italic;">"${match.conversationStarter}"</p>
        </div>
        
        <div style="background: #1e293b; border-radius: 8px; padding: 12px;">
          <p style="color: #a855f7; font-weight: 600; margin: 0 0 8px; font-size: 13px;">❓ QUESTIONS TO ASK</p>
          <ul style="color: #f8fafc; margin: 0; padding-left: 20px; font-size: 14px;">
            ${match.questionsToAsk?.map(q => `<li style="margin-bottom: 4px;">${q}</li>`).join('') || ''}
          </ul>
        </div>
      </div>
    `)
    .join('');

  // Format schedule
  const scheduleHtml = matchResult.schedule
    .map(item => `
      <div style="display: flex; gap: 16px; padding: 16px; background: #0f172a; border-radius: 8px; margin-bottom: 8px;">
        <div style="min-width: 120px;">
          <span style="color: #6366f1; font-weight: 700; font-size: 14px;">${item.time}</span>
        </div>
        <div>
          <p style="color: #f8fafc; margin: 0 0 4px; font-weight: 600;">${item.activity}</p>
          <p style="color: #94a3b8; margin: 0; font-size: 13px;">${item.reason}</p>
        </div>
      </div>
    `)
    .join('');

  // Format pro tips
  const tipsHtml = matchResult.proTips
    ?.map(tip => `<li style="margin-bottom: 8px; color: #f8fafc;">${tip}</li>`)
    .join('') || '';

  // Format after event
  const afterEventHtml = matchResult.afterEvent
    ?.map(action => `<li style="margin-bottom: 8px; color: #f8fafc;">${action}</li>`)
    .join('') || '';

  const params = {
    to_email: 'anmol.masters.ai@gmail.com',
    subject: matchResult.subject,
    attendee_name: attendee.name,
    event_name: event.name,
    event_date: event.date,
    attendee_summary: matchResult.attendeeSummary || '',
    sponsor_matches: sponsorMatchesHtml,
    schedule: scheduleHtml,
    pro_tips: tipsHtml,
    after_event: afterEventHtml,
  };

  const response = await emailjs.send(SERVICE_ID, TEMPLATE_ID, params);
  return response;
}