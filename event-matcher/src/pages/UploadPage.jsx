import { useState } from 'react';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import './UploadPage.css';

function UploadPage() {
  const [eventUrl, setEventUrl] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [fetchingEvent, setFetchingEvent] = useState(false);
  const [eventFetched, setEventFetched] = useState(false);
  
  const [attendeesData, setAttendeesData] = useState([]);
  const [sponsorsData, setSponsorsData] = useState([]);
  const [attendeesFileName, setAttendeesFileName] = useState('');
  const [sponsorsFileName, setSponsorsFileName] = useState('');
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch event details from URL (Meetup, Eventbrite, etc.)
  const fetchEventDetails = async () => {
    if (!eventUrl.trim()) {
      setStatus({ type: 'error', message: 'Please enter an event URL' });
      return;
    }

    setFetchingEvent(true);
    setStatus({ type: '', message: '' });

    try {
      // This is a mock implementation - you'll need to implement the actual fetching logic
      // Options:
      // 1. Use a backend proxy to scrape the page
      // 2. Use APIs from Meetup, Eventbrite if available
      // 3. Use a third-party service like Diffbot
      
      // For now, we'll simulate an API call
      const response = await fetch('/api/fetch-event-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: eventUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch event details');
      }

      const eventData = await response.json();
      
      setEventName(eventData.name || '');
      setEventDate(eventData.date || '');
      setEventDescription(eventData.description || '');
      setEventLocation(eventData.location || '');
      setEventFetched(true);
      setStatus({ type: 'success', message: 'Event details fetched successfully!' });

    } catch (error) {
      console.error('Error fetching event:', error);
      // If the API doesn't exist yet, allow manual entry
      setStatus({ 
        type: 'warning', 
        message: 'Could not auto-fetch event details. Please enter manually below.' 
      });
      setEventFetched(true); // Allow manual entry
    } finally {
      setFetchingEvent(false);
    }
  };

  // Handle CSV file upload for attendees
  const handleAttendeesUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAttendeesFileName(file.name);
    setStatus({ type: '', message: '' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setStatus({ type: 'error', message: 'Attendees CSV is empty' });
          return;
        }
        setAttendeesData(results.data);
        setStatus({ type: 'success', message: `Loaded ${results.data.length} attendees` });
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        setStatus({ type: 'error', message: 'Failed to parse attendees CSV' });
      }
    });
  };

  // Handle CSV file upload for sponsors
  const handleSponsorsUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSponsorsFileName(file.name);
    setStatus({ type: '', message: '' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          setStatus({ type: 'error', message: 'Sponsors CSV is empty' });
          return;
        }
        setSponsorsData(results.data);
        setStatus({ type: 'success', message: `Loaded ${results.data.length} sponsors` });
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        setStatus({ type: 'error', message: 'Failed to parse sponsors CSV' });
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    // Validation
    if (!eventName || !eventDate) {
      setStatus({ type: 'error', message: 'Event name and date are required' });
      return;
    }

    if (attendeesData.length === 0) {
      setStatus({ type: 'error', message: 'Please upload attendees CSV file' });
      return;
    }

    if (sponsorsData.length === 0) {
      setStatus({ type: 'error', message: 'Please upload sponsors CSV file' });
      return;
    }

    setLoading(true);

    try {
      // 1. Create event
      const eventRef = await addDoc(collection(db, 'events'), {
        name: eventName,
        date: eventDate,
        description: eventDescription || '',
        location: eventLocation || '',
        sourceUrl: eventUrl || '',
        status: 'upcoming',
        attendeeCount: attendeesData.length,
        sponsorCount: sponsorsData.length,
        createdAt: new Date()
      });

      const eventId = eventRef.id;

      // 2. Batch write attendees + sponsors
      const batch = writeBatch(db);

      // Add attendees
      attendeesData.forEach((attendee) => {
        const ref = doc(collection(db, 'attendees'));
        batch.set(ref, {
          eventId,
          name: attendee.full_name || attendee.name || '',
          email: attendee.email || '',
          githubUrl: attendee.github || attendee.github_url || null,
          linkedIn: attendee.linkedin || attendee.linkedin_url || null,
          company: attendee.current_company || attendee.company || '',
          jobTitle: attendee.job_title || attendee.title || '',
          intent: parseArrayField(attendee.what_are_you_hoping_to_get_from_this_event || attendee.intent || ''),
          createdAt: new Date()
        });
      });

      // Add sponsors
      sponsorsData.forEach((sponsor) => {
        const ref = doc(collection(db, 'sponsors'));
        batch.set(ref, {
          eventId,
          companyName: sponsor.sponsor_name || sponsor.company_name || '',
          domain: sponsor.company_domain || sponsor.domain || '',
          promotionType: parseArrayField(sponsor.what_are_they_promoting_at_this_event || sponsor.promotion || ''),
          projectName: sponsor.project_or_product_name || sponsor.project_name || '',
          attendingTeam: parseArrayField(sponsor.who_is_attending_from_the_company || sponsor.team || ''),
          eventPageUrl: sponsor.event_page_url || sponsor.page_url || null,
          createdAt: new Date()
        });
      });

      await batch.commit();

      setStatus({ 
        type: 'success', 
        message: `Event created with ${attendeesData.length} attendees and ${sponsorsData.length} sponsors!`
      });

      // Redirect after 2 seconds
      setTimeout(() => navigate('/admin/dashboard'), 2000);

    } catch (error) {
      console.error('Error creating event:', error);
      setStatus({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to parse array fields from CSV
  const parseArrayField = (field) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    
    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [field];
    } catch {
      // If not JSON, split by common delimiters
      return field.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    }
  };

  return (
    <div className="upload-container">
      <aside className="upload-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">⚡</span>
          <span className="sidebar-title">Event Connect</span>
        </div>
        <nav className="sidebar-nav">
          <a href="/admin/dashboard" className="nav-item">
            <span>📊</span> Dashboard
          </a>
          <a href="/upload" className="nav-item active">
            <span>➕</span> Add Event
          </a>
        </nav>
      </aside>

      <main className="upload-main">
        <div className="upload-header">
          <h1>Create New Event</h1>
          <p>Fetch event details from a URL and upload attendee/sponsor data via CSV</p>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {status.message && (
            <div className={`status-message ${status.type}`}>
              {status.type === 'success' ? '✓' : status.type === 'error' ? '✗' : '⚠'} {status.message}
            </div>
          )}

          {/* Event URL Section */}
          <div className="form-section">
            <h2>Event Source</h2>
            <p className="section-description">
              Paste a link from Meetup, Eventbrite, or other event platforms to auto-populate event details
            </p>
            <div className="url-input-group">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Event URL</label>
                <input
                  type="url"
                  value={eventUrl}
                  onChange={(e) => setEventUrl(e.target.value)}
                  placeholder="https://www.meetup.com/your-event-link"
                  disabled={eventFetched}
                />
              </div>
              <button 
                type="button"
                onClick={fetchEventDetails}
                className="btn-fetch"
                disabled={fetchingEvent || eventFetched}
              >
                {fetchingEvent ? 'Fetching...' : eventFetched ? 'Fetched ✓' : 'Fetch Details'}
              </button>
            </div>
          </div>

          {/* Event Details Section */}
          <div className="form-section">
            <h2>Event Details</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Event Name *</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="AI Dev Meetup - January 2026"
                  required
                />
              </div>
              <div className="form-group">
                <label>Event Date *</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="San Francisco, CA"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="Event description..."
                rows={3}
              />
            </div>
          </div>

          {/* Attendees CSV Upload Section */}
          <div className="form-section">
            <div className="section-header">
              <h2>Attendees Data</h2>
              {attendeesData.length > 0 && (
                <span className="csv-status valid">
                  ✓ {attendeesData.length} attendees loaded
                </span>
              )}
            </div>
            <p className="section-description">
              Upload a CSV file with attendee information (columns: full_name, email, github, linkedin, current_company, job_title, etc.)
            </p>
            <div className="form-group">
              <label htmlFor="attendees-upload" className="file-upload-label">
                <span className="upload-icon">📄</span>
                <span>{attendeesFileName || 'Choose CSV File'}</span>
              </label>
              <input
                id="attendees-upload"
                type="file"
                accept=".csv"
                onChange={handleAttendeesUpload}
                className="file-input"
                required
              />
            </div>
          </div>

          {/* Sponsors CSV Upload Section */}
          <div className="form-section">
            <div className="section-header">
              <h2>Sponsors Data</h2>
              {sponsorsData.length > 0 && (
                <span className="csv-status valid">
                  ✓ {sponsorsData.length} sponsors loaded
                </span>
              )}
            </div>
            <p className="section-description">
              Upload a CSV file with sponsor information (columns: sponsor_name, company_domain, project_or_product_name, etc.)
            </p>
            <div className="form-group">
              <label htmlFor="sponsors-upload" className="file-upload-label">
                <span className="upload-icon">📄</span>
                <span>{sponsorsFileName || 'Choose CSV File'}</span>
              </label>
              <input
                id="sponsors-upload"
                type="file"
                accept=".csv"
                onChange={handleSponsorsUpload}
                className="file-input"
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => navigate('/admin/dashboard')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading || attendeesData.length === 0 || sponsorsData.length === 0}
            >
              {loading ? 'Creating Event...' : 'Create Event'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default UploadPage;
