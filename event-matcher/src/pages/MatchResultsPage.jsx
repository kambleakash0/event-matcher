import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import './MatchResultsPage.css';

// const OPENROUTER_KEY = "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";

// const GEMINI_KEY = "AIzaSyBzL3Zfj7ZaSSM2jAmwVT5CK4FYQ8mV1K4";

async function sendChatMessage(messages, matchContext) {
  // Format match context in a clean, readable way
  const formattedContext = `
ATTENDEE PROFILE:
Name: ${matchContext?.attendeeName || 'Unknown'}
Summary: ${matchContext?.attendeeSummary || 'No summary available'}

TOP SPONSOR MATCHES:
${matchContext?.sponsorMatches?.map((match, idx) => `
${idx + 1}. ${match.sponsor} - ${match.matchScore}% Match
   Why this match: ${match.whyYou}
   What they'll gain: ${match.whatYouGain}
   Key contact: ${match.whoToMeet} ${match.theirRole ? `(${match.theirRole})` : ''}
   ${match.whyThisPerson ? `Why this person: ${match.whyThisPerson}` : ''}
   Conversation starter: "${match.conversationStarter}"
   Questions to ask: ${match.questionsToAsk?.join(', ') || 'None listed'}
`).join('\n') || 'No matches available'}

${matchContext?.schedule?.length > 0 ? `
SUGGESTED SCHEDULE:
${matchContext.schedule.map(s => `${s.time} - ${s.activity}${s.reason ? ` (${s.reason})` : ''}`).join('\n')}
` : ''}

${matchContext?.proTips?.length > 0 ? `
PRO TIPS:
${matchContext.proTips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}
` : ''}

${matchContext?.afterEvent?.length > 0 ? `
AFTER EVENT FOLLOW-UP:
${matchContext.afterEvent.map((action, i) => `${i + 1}. ${action}`).join('\n')}
` : ''}
`;

  const systemPrompt = `You are a helpful AI assistant for Event Connect. Keep responses SHORT and conversational (2-4 sentences max unless asked for details).

ATTENDEE CONTEXT:
${formattedContext}

RULES:
- Answer the specific question asked - don't give everything at once
- Be conversational and brief (like texting a friend)
- Only provide detailed lists/formatting if explicitly asked
- Reference match data when relevant
- No long emails, tables, or excessive formatting

Examples:
User: "What's my best match?"
You: "Your best match is DevOps Hub at 85%! They focus on CI/CD pipelines which aligns perfectly with your data engineering work."

User: "Who should I talk to there?"
You: "Talk to their Team Representative - they can walk you through their pipeline demos."`;

  const conversationText = [
    systemPrompt,
    ...messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
  ].join('\n\n') + '\n\nAssistant:';

  const response = await fetch(
    "http://localhost:5001/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: conversationText,  // <-- Now it's defined!
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
          return_full_text: false
        }
      })
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data[0]?.generated_text || "Sorry, I couldn't respond.";
}

// async function sendChatMessage(messages, matchContext) {
//   // Format match context in a clean, readable way
//   const formattedContext = `
// ATTENDEE PROFILE:
// Name: ${matchContext?.attendeeName || 'Unknown'}
// Summary: ${matchContext?.attendeeSummary || 'No summary available'}

// TOP SPONSOR MATCHES:
// ${matchContext?.sponsorMatches?.map((match, idx) => `
// ${idx + 1}. ${match.sponsor} - ${match.matchScore}% Match
//    Why this match: ${match.whyYou}
//    What they'll gain: ${match.whatYouGain}
//    Key contact: ${match.whoToMeet} ${match.theirRole ? `(${match.theirRole})` : ''}
//    ${match.whyThisPerson ? `Why this person: ${match.whyThisPerson}` : ''}
//    Conversation starter: "${match.conversationStarter}"
//    Questions to ask: ${match.questionsToAsk?.join(', ') || 'None listed'}
// `).join('\n') || 'No matches available'}

// ${matchContext?.schedule?.length > 0 ? `
// SUGGESTED SCHEDULE:
// ${matchContext.schedule.map(s => `${s.time} - ${s.activity}${s.reason ? ` (${s.reason})` : ''}`).join('\n')}
// ` : ''}

// ${matchContext?.proTips?.length > 0 ? `
// PRO TIPS:
// ${matchContext.proTips.map((tip, i) => `${i + 1}. ${tip}`).join('\n')}
// ` : ''}

// ${matchContext?.afterEvent?.length > 0 ? `
// AFTER EVENT FOLLOW-UP:
// ${matchContext.afterEvent.map((action, i) => `${i + 1}. ${action}`).join('\n')}
// ` : ''}
// `;

//   const systemPrompt = `You are a helpful AI assistant for Event Connect. Keep responses SHORT and conversational (2-4 sentences max unless asked for details).

//     ATTENDEE CONTEXT:
//     ${formattedContext}

//     RULES:
//     - Answer the specific question asked - don't give everything at once
//     - Be conversational and brief (like texting a friend)
//     - Only provide detailed lists/formatting if explicitly asked
//     - Reference match data when relevant
//     - No emoji spam or excessive formatting

//     Examples:
//     User: "What's my best match?"
//     You: "Your best match is DevOps Hub at 85%! They focus on CI/CD pipelines which aligns perfectly with your data engineering work at DataLake Inc."

//     User: "Who should I talk to there?"
//     You: "Talk to their Team Representative - they can walk you through their latest pipeline demos and discuss partnership opportunities."`;

//   try {
//     const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         "Authorization": `Bearer ${OPENROUTER_KEY}`,
//         "Content-Type": "application/json",
//         "HTTP-Referer": `${window.location.origin}`,
//         "X-Title": "Event Connect"
//       },
//       body: JSON.stringify({
//         model: "qwen/qwen3-coder:free",
//         messages: [
//           { role: "system", content: systemPrompt },
//           ...messages.map(msg => ({
//             role: msg.role,
//             content: msg.content
//           }))
//         ],
//         max_tokens: 200, // ADD THIS - limits response length
//         temperature: 0.7  // ADD THIS - makes it more focused
//       })
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error("OpenRouter error:", response.status, errorText);
//       throw new Error(`OpenRouter returned ${response.status}: ${errorText}`);
//     }

//     const data = await response.json();
//     return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
//   } catch (error) {
//     console.error("Full error:", error);
//     throw error;
//   }

// }
function MatchResultsPage() {
  const navigate = useNavigate();
  const [matchResult, setMatchResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  // const [messages, setMessages] = useState([
  //   { role: 'assistant', content: 'Hi! 👋 I\'m your Event Connect assistant. Ask me anything about your matches or how to make the most of the event!' }
  // ]);
  const [messages, setMessages] = useState(() => {
    // Try to load saved chat history from localStorage
    const savedMessages = localStorage.getItem('eventConnectChat');
    if (savedMessages) {
      try {
        return JSON.parse(savedMessages);
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    // Default greeting if no saved history
    return [
      { role: 'assistant', content: 'Hi! 👋 I\'m your Event Connect assistant. Ask me anything about your matches or how to make the most of the event!' }
    ];
  });
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchLatestMatch();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Save chat history to localStorage whenever messages change
    localStorage.setItem('eventConnectChat', JSON.stringify(messages));
  }, [messages]);

  const fetchLatestMatch = async () => {
    try {
      const matchesQuery = query(
        collection(db, 'matches'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(matchesQuery);

      if (snapshot.empty) {
        setError('No match results found.');
        setLoading(false);
        return;
      }

      const matchDoc = snapshot.docs[0];
      setMatchResult({ id: matchDoc.id, ...matchDoc.data() });
    } catch (err) {
      console.error('Error fetching match:', err);
      setError('Failed to load match results. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleSendMessage = async () => {
    if (!inputValue.trim() || sending) return;

    const userMessage = { role: 'user', content: inputValue.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setSending(true);

    try {
      // Filter out the initial greeting - only send actual conversation
      const conversationHistory = messages.filter(msg =>
        msg.content !== 'Hi! 👋 I\'m your Event Connect assistant. Ask me anything about your matches or how to make the most of the event!'
      );

      // Send the filtered history + new message
      const response = await sendChatMessage(
        [...conversationHistory, userMessage],
        matchResult
      );

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setSending(false);
    }
  };


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="match-results-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your personalized matches...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="match-results-container">
        <div className="error-state">
          <span className="error-icon">⚠️</span>
          <h2>Oops!</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="match-results-container">
      <header className="results-header">
        <div className="header-content">
          <div className="header-title">
            <span className="header-icon">🎯</span>
            <div>
              <h1>Your Match Results</h1>
              <p>Personalized recommendations for {matchResult?.attendeeName}</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={() => navigate('/')}>
            ← Back to Home
          </button>
        </div>
      </header>

      <main className="results-main">
        {/* Attendee Summary */}
        {matchResult?.attendeeSummary && (
          <section className="results-section">
            <div className="section-header">
              <span className="section-icon">👤</span>
              <h2>About You</h2>
            </div>
            <p className="attendee-summary">{matchResult.attendeeSummary}</p>
          </section>
        )}

        {/* Sponsor Matches */}
        {matchResult?.sponsorMatches?.length > 0 && (
          <section className="results-section">
            <div className="section-header">
              <span className="section-icon">🏢</span>
              <h2>Top Sponsor Matches</h2>
            </div>
            <div className="sponsor-matches-grid">
              {matchResult.sponsorMatches.map((match, idx) => (
                <div key={idx} className="sponsor-match-card">
                  <div className="match-card-header">
                    <span className="match-rank">#{idx + 1}</span>
                    <span className="match-name">{match.sponsor}</span>
                    <span className="match-score">{match.matchScore}%</span>
                  </div>

                  <div className="match-section">
                    <strong>Why this is a match for you:</strong>
                    <p>{match.whyYou}</p>
                  </div>

                  <div className="match-section">
                    <strong>What you'll gain:</strong>
                    <p>{match.whatYouGain}</p>
                  </div>

                  {match.whoToMeet && (
                    <div className="match-contact">
                      <div className="contact-header">
                        <span>👤</span>
                        <strong>{match.whoToMeet}</strong>
                        {match.theirRole && (
                          <span className="contact-role">({match.theirRole})</span>
                        )}
                      </div>
                      {match.whyThisPerson && (
                        <p className="why-person">{match.whyThisPerson}</p>
                      )}
                    </div>
                  )}

                  {match.conversationStarter && (
                    <div className="match-section conversation-starter">
                      <strong>💬 Conversation starter:</strong>
                      <p className="starter-text">"{match.conversationStarter}"</p>
                    </div>
                  )}

                  {match.questionsToAsk?.length > 0 && (
                    <div className="match-section">
                      <strong>❓ Questions to ask:</strong>
                      <ul className="questions-list">
                        {match.questionsToAsk.map((q, qIdx) => (
                          <li key={qIdx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Schedule */}
        {matchResult?.schedule?.length > 0 && (
          <section className="results-section">
            <div className="section-header">
              <span className="section-icon">📅</span>
              <h2>Suggested Schedule</h2>
            </div>
            <div className="schedule-timeline">
              {matchResult.schedule.map((item, idx) => (
                <div key={idx} className="schedule-card">
                  <div className="schedule-time">{item.time}</div>
                  <div className="schedule-details">
                    <div className="schedule-activity">{item.activity}</div>
                    {item.reason && (
                      <div className="schedule-reason">{item.reason}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pro Tips */}
        {matchResult?.proTips?.length > 0 && (
          <section className="results-section">
            <div className="section-header">
              <span className="section-icon">💡</span>
              <h2>Pro Tips</h2>
            </div>
            <ul className="tips-list">
              {matchResult.proTips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        {/* After Event */}
        {matchResult?.afterEvent?.length > 0 && (
          <section className="results-section">
            <div className="section-header">
              <span className="section-icon">📝</span>
              <h2>After the Event</h2>
            </div>
            <ul className="after-event-list">
              {matchResult.afterEvent.map((action, idx) => (
                <li key={idx}>{action}</li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="results-footer">
        <p>Generated on {matchResult?.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}</p>
      </footer>

      {/* Floating Chat Button */}
      <button
        className={`floating-chat-btn ${chatOpen ? 'active' : ''}`}
        onClick={() => setChatOpen(!chatOpen)}
      >
        {chatOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      {chatOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <span className="chat-header-icon">🤖</span>
            <div className="chat-header-info">
              <h3>Event Assistant</h3>
              <p>Ask me anything about your matches</p>
            </div>
            <button
              className="chat-clear-btn"
              onClick={() => {
                setMessages([
                  { role: 'assistant', content: 'Hi! 👋 I\'m your Event Connect assistant. Ask me anything about your matches or how to make the most of the event!' }
                ]);
                localStorage.removeItem('eventConnectChat');
              }}
              title="Clear chat history"
            >
              🗑️
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {sending && (
              <div className="chat-message assistant typing">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <input
              type="text"
              className="chat-input"
              placeholder="Ask a question..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending}
            />
            <button
              className="chat-send-btn"
              onClick={handleSendMessage}
              disabled={sending || !inputValue.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchResultsPage;