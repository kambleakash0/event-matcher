import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import './AdminDashboard.css';

function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check login
    if (!localStorage.getItem('isLoggedIn')) {
      navigate('/admin');
      return;
    }
    fetchEvents();
  }, [navigate]);

  const fetchEvents = async () => {
    try {
      const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    navigate('/');
  };

  const handleDeleteEvent = async (eventId) => {
    const confirmed = window.confirm('Delete this event and all its attendees and sponsors?');
    if (!confirmed) return;

    const CHUNK_SIZE = 10;

    const batchDelete = async (docs) => {
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        docs.slice(i, i + CHUNK_SIZE).forEach(d => batch.delete(d));
        await batch.commit();
      }
    };

    // Delete attendees
    try {
      // Fetch attendees and sponsors first — we need their IDs
      const [attendeeSnap, sponsorSnap, matchSnap, narrativeCacheSnap] = await Promise.all([
        getDocs(query(collection(db, 'attendees'), where('eventId', '==', eventId))),
        getDocs(query(collection(db, 'sponsors'), where('eventId', '==', eventId))),
        getDocs(query(collection(db, 'matches'), where('eventId', '==', eventId))),
        getDocs(query(collection(db, 'narrativeCache'), where('eventId', '==', eventId)))
      ]);

      const attendeeIds = attendeeSnap.docs.map(d => d.id);

      // Build attendeeAnalysis doc refs
      const attendeeAnalysisRefs = attendeeIds.map(id =>
        doc(db, 'attendeeAnalysis', id)
      );

      // Delete everything in parallel where possible
      await Promise.all([
        batchDelete(attendeeSnap.docs.map(d => d.ref)),
        batchDelete(sponsorSnap.docs.map(d => d.ref)),
        batchDelete(matchSnap.docs.map(d => d.ref)),
        batchDelete(attendeeAnalysisRefs),
        batchDelete(narrativeCacheSnap.docs.map(d => d.ref))
      ]);

      // Delete the event itself last
      await deleteDoc(doc(db, 'events', eventId));

      // Refresh events list
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'status-upcoming';
      case 'matching_done': return 'status-matched';
      case 'emails_sent': return 'status-sent';
      default: return '';
    }
  };

  return (
    <div className="admin-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">⚡</span>
          <span className="sidebar-title">Event Connect</span>
        </div>
        
        <nav className="sidebar-nav">
          <a href="/admin/dashboard" className="nav-item active">
            <span>📊</span> Dashboard
          </a>
          <a href="/upload" className="nav-item">
            <span>➕</span> Add Event
          </a>
          {/* <a href="/upload" className="nav-item">
            <span>📤</span> Upload Data
          </a> */}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="content-header">
          <h1>Dashboard</h1>
          <p>Manage your events and attendee matching</p>
        </header>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <span className="stat-value">{events.length}</span>
              <span className="stat-label">Total Events</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-info">
              <span className="stat-value">
                {events.filter(e => e.status === 'upcoming').length}
              </span>
              <span className="stat-label">Upcoming</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <span className="stat-value">
                {events.filter(e => e.status === 'matching_done').length}
              </span>
              <span className="stat-label">Matched</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📧</div>
            <div className="stat-info">
              <span className="stat-value">
                {events.filter(e => e.status === 'emails_sent').length}
              </span>
              <span className="stat-label">Emails Sent</span>
            </div>
          </div>
        </div>

        {/* Events List */}
        <section className="events-section">
          <div className="section-header">
            <h2>Upcoming Events</h2>
            <button className="add-btn" onClick={() => setShowAddEvent(true)}>
              + Add Event
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <p>No events yet. Create your first event!</p>
              <button className="add-btn" onClick={() => setShowAddEvent(true)}>
                + Add Event
              </button>
            </div>
          ) : (
            <div className="events-table">
              <table>
                <thead>
                  <tr>
                    <th>Event Name</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(event => (
                    <tr key={event.id}>
                      <td className="event-name">{event.name}</td>
                      <td>{event.date}</td>
                      <td>
                        <span className={`status-badge ${getStatusColor(event.status)}`}>
                          {event.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="view-btn"
                          onClick={() => navigate(`/admin/event/${event.id}`)}
                        >
                          View Details
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="modal-overlay" onClick={() => setShowAddEvent(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Event</h2>
              <button className="close-btn" onClick={() => setShowAddEvent(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Go to the Upload page to create a new event with attendee and sponsor data.</p>
              <button 
                className="add-btn" 
                onClick={() => navigate('/upload')}
                style={{ marginTop: '1rem' }}
              >
                Go to Upload Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;