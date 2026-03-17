import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import './UploadPage.css';

import { upsertAttendee, upsertSponsor } from '../services/firestoreHelpers';

function UploadPage() {
  const [eventUrl, setEventUrl] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
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
      // Fetch the HTML content from the URL
      const proxyUrl = 'https://api.allorigins.win/get?url=';
      const response = await fetch(proxyUrl + encodeURIComponent(eventUrl));
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status}`);
      }
      const data = await response.json();
      const html = data.contents;

      // const html = await response.text();
      
      // Parse the HTML to extract event details
      const eventData = parseEventFromHtml(html, eventUrl);
      
      // Populate form fields
      if (eventData.name) setEventName(eventData.name);
      if (eventData.date) setEventDate(formatDateForInput(eventData.date));
      if (eventData.description) setEventDescription(eventData.description);
      if (eventData.location) setEventLocation(eventData.location);
      if (eventData.startTime) setEventStartTime(eventData.startTime);
      if (eventData.endTime) setEventEndTime(eventData.endTime);

      setEventFetched(true);
      setStatus({ type: 'success', message: 'Event details fetched successfully! Review and edit as needed.' });

    } catch (error) {
      console.error('Error fetching event:', error);
      
      // CORS error - provide helpful message
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        setStatus({ 
          type: 'warning', 
          message: 'Unable to fetch due to browser security (CORS). Please enter event details manually or use a CORS proxy.' 
        });
      } else {
        setStatus({ 
          type: 'warning', 
          message: `Could not auto-fetch event details: ${error.message}. Please enter manually below.` 
        });
      }
      
      setEventFetched(true); // Allow manual entry
    } finally {
      setFetchingEvent(false);
    }
  };

  // Parse HTML content to extract event details
  const parseEventFromHtml = (html, url) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const eventData = {
      name: '',
      date: '',
      location: '',
      description: '',
      startTime: '',
      endTime: ''
    };

    // Strategy 1: Try JSON-LD structured data (schema.org)
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Event') {
          eventData.name = data.name || eventData.name;
          eventData.date = data.startDate || eventData.date;
          eventData.location = data.location?.name || data.location?.address?.addressLocality || eventData.location;
          eventData.description = data.description || eventData.description;
          if (data.startDate) {
            eventData.startTime = data.startDate.substring(11, 16);
          }
          if (data.endDate) {
            eventData.endTime = data.endDate.substring(11, 16);
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    // Strategy 2: Try Open Graph meta tags
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    const ogDescription = doc.querySelector('meta[property="og:description"]');
    
    if (ogTitle && !eventData.name) {
      eventData.name = ogTitle.getAttribute('content');
    }
    
    if (ogDescription && !eventData.description) {
      eventData.description = ogDescription.getAttribute('content');
    }

    // Strategy 3: Try meta description
    const metaDescription = doc.querySelector('meta[name="description"]');
    if (metaDescription && !eventData.description) {
      eventData.description = metaDescription.getAttribute('content');
    }

    // Strategy 4: Try title tag
    if (!eventData.name) {
      const titleTag = doc.querySelector('title');
      if (titleTag) {
        eventData.name = titleTag.textContent.trim();
      }
    }

    // Strategy 5: Try H1 tag
    if (!eventData.name) {
      const h1 = doc.querySelector('h1');
      if (h1) {
        eventData.name = h1.textContent.trim();
      }
    }

    // Strategy 6: Look for date patterns
    if (!eventData.date) {
      const bodyText = doc.body?.textContent || '';
      const datePatterns = [
        /(\w+\s+\d{1,2},?\s+\d{4})/i,  // "January 15, 2024"
        /(\d{4}-\d{2}-\d{2})/i,         // "2024-01-15"
        /(\d{1,2}\/\d{1,2}\/\d{4})/i,   // "01/15/2024"
      ];

      for (const pattern of datePatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          eventData.date = match[1];
          break;
        }
      }
    }

    // Strategy 7: Look for location
    if (!eventData.location) {
      const bodyText = doc.body?.textContent || '';
      const locationKeywords = ['location:', 'venue:', 'where:', 'address:'];
      
      for (const keyword of locationKeywords) {
        const index = bodyText.toLowerCase().indexOf(keyword);
        if (index !== -1) {
          const locationText = bodyText.substring(index + keyword.length, index + keyword.length + 100);
          const locationMatch = locationText.match(/([A-Z][^.!?\n]*)/);
          if (locationMatch) {
            eventData.location = locationMatch[1].trim();
            break;
          }
        }
      }
    }

    // Clean up text
    eventData.name = cleanText(eventData.name);
    eventData.description = cleanText(eventData.description, 500);
    eventData.location = cleanText(eventData.location);

    return eventData;
  };

  // Clean and truncate text
  const cleanText = (text, maxLength = 200) => {
    if (!text) return '';
    let cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength) + '...';
    }
    return cleaned;
  };

  // Format date for input[type="date"]
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (e) {
      return '';
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

  async function processInBatches(items, batchSize, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      const chunkResults = await Promise.all(chunk.map(fn));
      results.push(...chunkResults);

      if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return results;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    // Validation
    if (!eventName || !eventDate) {
      setStatus({ type: 'error', message: 'Event name and date are required' });
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
        startTime: eventStartTime || '',
        endTime: eventEndTime || '',
        sourceUrl: eventUrl || '',
        status: 'upcoming',
        attendeeCount: attendeesData.length,
        sponsorCount: sponsorsData.length,
        createdAt: new Date()
      });

      const eventId = eventRef.id;

      // Add attendees — deduplication via deterministic ID
      await processInBatches(
        attendeesData, 5, attendee =>
          upsertAttendee(eventId, {
            name: attendee.full_name || attendee.name || '',
            email: attendee.email || '',
            githubUrl: attendee.github || attendee.github_url || null,
            linkedIn: attendee.linkedin || attendee.linkedin_url || null,
            company: attendee.current_company || attendee.company || '',
            jobTitle: attendee.job_title || attendee.title || '',
            intent: parseArrayField(attendee.what_are_you_hoping_to_get_from_this_event || attendee.intent || '')
          })
      );

      // Add sponsors — deduplication via deterministic ID
      await processInBatches(
        sponsorsData, 5, sponsor =>
          upsertSponsor(eventId, {
            companyName: sponsor.sponsor_name || sponsor.company_name || '',
            domain: sponsor.company_domain || sponsor.domain || '',
            promotionType: parseArrayField(sponsor.what_are_they_promoting_at_this_event || sponsor.promotion || ''),
            projectName: sponsor.project_or_product_name || sponsor.project_name || '',
            attendingTeam: parseTeamField(sponsor.who_is_attending_from_the_company || sponsor.team || ''),
            eventPageUrl: sponsor.event_page_url || sponsor.page_url || null
          })
      );

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

  const parseTeamField = (field) => {
    if (!field) return [];
    const members = parseArrayField(field);
    return members.map(member => {
      const match = member.match(/^(.+?)\s*[\(\-]\s*(.+?)[\)]?\s*$/);
      if (match) return { name: match[1].trim(), title: match[2].trim() };
      return { name: member.trim(), title: '' };
    });
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
                {fetchingEvent ? '⏳ Fetching...' : eventFetched ? '✓ Fetched' : '🔍 Fetch Details'}
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
            <div className="form-row">
              <div className="form-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={eventStartTime}
                  onChange={(e) => setEventStartTime(e.target.value)}
                  placeholder="10:00 AM"
                />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input
                  type="time"
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                  placeholder="5:00 PM"
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
              disabled={loading}
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
