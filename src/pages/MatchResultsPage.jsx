import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import './MatchResultsPage.css';

// Chat API call (using same providers as your gemini.js)
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;

async function sendChatMessage(messages, matchContext) {
  const systemPrompt = `You are a helpful AI assistant for Event Connect. You help attendees get the most out of their event experience.

Here is the attendee's match data for context:
${JSON.stringify(matchContext, null, 2)}

Help them with questions about:
- Their sponsor matches and why they were recommended
- How to approach sponsors and start conversations
- Tips for networking at the event
- Follow-up strategies after the event

Be friendly, concise, and actionable in your responses.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "I understand. I'm ready to help the attendee with their event experience!" }] },
          ...messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          }))
        ]
      })
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
}

function MatchResultsPage() {
  const navigate = useNavigate();
  const [matchResult, setMatchResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! 👋 I\'m your Event Connect assistant. Ask me anything about your matches or how to make the most of the event!' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchLatestMatch();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const response = await sendChatMessage([...messages, userMessage], matchResult);
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