import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import './HomePage.css';

// Fallback dummy events in case Firestore is empty
const FALLBACK_EVENTS = [
  {
    id: 'evt_abc123',
    name: 'AI Dev Meetup: December Edition',
    date: 'Dec 25, 2024',
    location: 'San Francisco, CA',
    attendees: 20,
    sponsors: 7,
    image: '🤖',
    tags: ['Machine Learning', 'Networking']
  }
];

// Emoji mapping based on event name keywords
const getEventEmoji = (name) => {
  const lowerName = name?.toLowerCase() || '';
  if (lowerName.includes('ai') || lowerName.includes('ml') || lowerName.includes('machine')) return '🤖';
  if (lowerName.includes('web3') || lowerName.includes('blockchain') || lowerName.includes('crypto')) return '🛡️';
  if (lowerName.includes('saas') || lowerName.includes('startup') || lowerName.includes('founder')) return '🚀';
  if (lowerName.includes('security') || lowerName.includes('cyber')) return '🔒';
  if (lowerName.includes('data') || lowerName.includes('analytics')) return '📊';
  if (lowerName.includes('mobile') || lowerName.includes('app')) return '📱';
  if (lowerName.includes('cloud') || lowerName.includes('devops')) return '☁️';
  if (lowerName.includes('design') || lowerName.includes('ux')) return '🎨';
  return '⚡';
};

function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentEvents();
  }, []);

  const fetchRecentEvents = async () => {
    try {
      // Fetch the 6 most recent events
      const eventsQuery = query(
        collection(db, 'events'),
        orderBy('createdAt', 'desc'),
        limit(6)
      );

      const snapshot = await getDocs(eventsQuery);

      if (snapshot.empty) {
        setEvents(FALLBACK_EVENTS);
      } else {
        const fetchedEvents = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const eventData = { id: doc.id, ...doc.data() };

            // Fetch attendee count for this event
            const attendeesQuery = query(
              collection(db, 'attendees'),
              // Note: You might need to add a where clause if attendees have eventId
            );

            // Fetch sponsor count for this event
            const sponsorsQuery = query(
              collection(db, 'sponsors'),
              // Note: You might need to add a where clause if sponsors have eventId
            );

            // For now, use the counts if they exist in the event document
            // or default values
            return {
              id: eventData.id,
              name: eventData.name || 'Untitled Event',
              date: eventData.date || 'TBA',
              location: eventData.location || 'Location TBA',
              attendees: eventData.attendeeCount || 0,
              sponsors: eventData.sponsorCount || 0,
              image: getEventEmoji(eventData.name),
              tags: eventData.tags || ['Networking'],
              status: eventData.status || 'upcoming'
            };
          })
        );

        setEvents(fetchedEvents);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents(FALLBACK_EVENTS);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <nav className="navbar">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          Event Connect
        </div>
        <div className="nav-links">
          <Link to="/my-matches" className="nav-link nav-link-highlight">
            🎯 My Matches
          </Link>
          <Link to="/admin/dashboard" className="nav-link">Admin Portal</Link>
        </div>
      </nav>

      <main className="hero">
        <div className="hero-content">
          <span className="badge">Next-Gen Event Intelligence</span>
          <h1>Turn Every Interaction into an Opportunity</h1>
          <p className="hero-subtitle">
            Generic sponsor lists lead to missed connections. Event Connect uses
            advanced AI to align attendee professional goals with sponsor offerings.
          </p>
          <div className="hero-buttons">
            <Link to="/admin/dashboard" className="btn btn-primary">Launch Admin Dashboard</Link>
            <Link to="/my-matches" className="btn btn-accent">
              🎯 View My Matches
            </Link>
            <a href="#events" className="btn btn-secondary">View Upcoming Events</a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-card">
            <div className="match-header">
              <h3>Live Match Preview</h3>
              <p>Contextual Alignment Engine</p>
            </div>
            <div className="match-demo">
              <div className="demo-attendee">
                <div className="demo-info">
                  <span className="label">ATTENDEE</span>
                  <span>Software Engineer (ML)</span>
                  <small>Goal: Career Growth</small>
                </div>
              </div>
              <div className="demo-arrow">
                <div className="pulse-line"></div>
                <span className="ai-tag">AI Analysis</span>
              </div>
              <div className="demo-sponsor">
                <div className="demo-info">
                  <span className="label">SPONSOR MATCH</span>
                  <span>CloudScale AI</span>
                  <small>Offering: Senior ML Roles</small>
                </div>
              </div>
              <div className="demo-score">94% Strategic Fit</div>
            </div>
          </div>
        </div>
      </main>

      {/* Upcoming Events Section */}
      <section id="events" className="upcoming-events">
        <div className="section-header">
          <h2>Active Intelligence Hub</h2>
          <p>Discover events utilizing our AI Matching technology.</p>
        </div>

        {loading ? (
          <div className="events-loading">
            <div className="loading-spinner-small"></div>
            <p>Loading events...</p>
          </div>
        ) : (
          <div className="events-grid">
            {events.map((event) => (
              <div key={event.id} className="event-card">
                <div className="event-card-image">{event.image}</div>
                {event.status && (
                  <span className={`event-status-badge status-${event.status}`}>
                    {event.status.replace('_', ' ')}
                  </span>
                )}
                <div className="event-card-content">
                  <div className="event-date">{event.date}</div>
                  <h3>{event.name}</h3>
                  <p className="event-location">📍 {event.location}</p>
                  <div className="event-stats">
                    <span>👥 {event.attendees} Attendees</span>
                    <span>🏢 {event.sponsors} Sponsors</span>
                  </div>
                  <div className="event-tags">
                    {event.tags.map(tag => <span key={tag} className="mini-tag">{tag}</span>)}
                  </div>
                  <Link to={`/event/${event.id}`} className="event-link">
                    AI Matching Enabled 🤖 →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="no-events">
            <p>No events available yet. Check back soon!</p>
          </div>
        )}
      </section>

      {/* Call to Action for Matches */}
      <section className="cta-matches">
        <div className="cta-content">
          <span className="cta-icon">🎯</span>
          <h2>Already Registered for an Event?</h2>
          <p>View your personalized sponsor matches and networking recommendations.</p>
          <Link to="/my-matches" className="btn btn-primary btn-large">
            View My Match Results
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="features">
        <div className="section-header">
          <h2>Precision Networking, Simplified</h2>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Intelligent Intake</h3>
            <p>We analyze attendee intent—hiring, learning, or growth—against real sponsor data.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Contextual Matching</h3>
            <p>Our AI understands professional context to provide the 'Why' behind every match.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h3>Personalized Roadmaps</h3>
            <p>Attendees receive a curated guide before the event, ensuring a plan of action.</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>&copy; 2024 Event Connect | Built for Professional Synergy</p>
      </footer>
    </div>
  );
}

export default HomePage;
