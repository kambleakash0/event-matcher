/**
 * Enhanced EventDetailPage with BOTH Single and Batch Matching
 * 
 * This is a drop-in replacement for your existing EventDetailPage.jsx
 * Features:
 * - Single attendee matching (your existing flow)
 * - Batch matching for all attendees
 * - Progress tracking for both modes
 * - All existing functionality preserved
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { runMatching } from '../services/gemini';
import './EventDetailPage.css';
import { sendMatchEmail } from '../services/email';

function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [activeTab, setActiveTab] = useState('attendees');
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matchResult, setMatchResult] = useState(null);
  const [matching, setMatching] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // NEW: Batch matching state
  const [batchMatching, setBatchMatching] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [currentAttendee, setCurrentAttendee] = useState(null);
  const [batchResults, setBatchResults] = useState({ success: [], failed: [] });
  const [showBatchModal, setShowBatchModal] = useState(false);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (!eventDoc.exists()) {
        navigate('/admin/dashboard');
        return;
      }
      setEvent({ id: eventDoc.id, ...eventDoc.data() });

      const attendeesQuery = query(
        collection(db, 'attendees'),
        where('eventId', '==', eventId)
      );
      const attendeesSnapshot = await getDocs(attendeesQuery);
      setAttendees(attendeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const sponsorsQuery = query(
        collection(db, 'sponsors'),
        where('eventId', '==', eventId)
      );
      const sponsorsSnapshot = await getDocs(sponsorsQuery);
      setSponsors(sponsorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  // EXISTING: Single attendee matching
  const handleRunMatching = async (attendee) => {
    setMatching(true);
    setMatchResult(null);

    try {
      const result = await runMatching(attendee, sponsors, event);
      setMatchResult(result);
      setShowModal(true);

      await addDoc(collection(db, 'matches'), {
        eventId,
        attendeeId: attendee.id,
        attendeeName: attendee.name || '',
        attendeeEmail: attendee.email || '',
        attendeeSummary: result.attendeeSummary || '',
        sponsorMatches: result.sponsorMatches || [],
        schedule: result.schedule || [],
        proTips: result.proTips || [],
        afterEvent: result.afterEvent || [],
        emailSubject: result.subject || '',
        emailStatus: 'pending',
        createdAt: new Date()
      });

    } catch (error) {
      console.error('Matching error:', error);
      alert('Error: ' + error.message);
    } finally {
      setMatching(false);
    }
  };

  // NEW: Batch matching for all attendees
  const handleBatchMatching = async () => {
    if (batchMatching) return;
    if (attendees.length === 0) {
      alert('No attendees to match!');
      return;
    }
    
    const confirmMsg = `Start batch matching for ${attendees.length} attendees?\n\n` +
                      `Estimated time: ${Math.ceil(attendees.length * 0.15)} minutes\n` +
                      `This will process all attendees automatically.`;
    
    if (!window.confirm(confirmMsg)) return;
    
    setBatchMatching(true);
    setBatchProgress({ current: 0, total: attendees.length });
    setBatchResults({ success: [], failed: [] });
    setCurrentAttendee(null);
    
    const BATCH_SIZE = 5; // Process 5 at a time
    const startTime = Date.now();
    const results = { success: [], failed: [] };
    
    try {
      for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
        const batch = attendees.slice(i, i + BATCH_SIZE);
        console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(attendees.length / BATCH_SIZE)}`);
        
        const batchPromises = batch.map(async (attendee) => {
          setCurrentAttendee(attendee.name);
          
          try {
            console.log(`\n🎯 Matching: ${attendee.name}`);
            
            const result = await runMatching(attendee, sponsors, event);
            
            await addDoc(collection(db, 'matches'), {
              eventId,
              attendeeId: attendee.id,
              attendeeName: attendee.name || '',
              attendeeEmail: attendee.email || '',
              attendeeSummary: result.attendeeSummary || '',
              sponsorMatches: result.sponsorMatches || [],
              schedule: result.schedule || [],
              proTips: result.proTips || [],
              afterEvent: result.afterEvent || [],
              emailSubject: result.subject || '',
              emailStatus: 'pending',
              createdAt: new Date()
            });
            
            console.log(`✅ Success: ${attendee.name}`);
            
            return { 
              success: true, 
              attendee,
              topMatches: result.sponsorMatches?.slice(0, 3).map(m => m.sponsor) || []
            };
            
          } catch (error) {
            console.error(`❌ Failed: ${attendee.name}`, error);
            return { 
              success: false, 
              attendee, 
              error: error.message 
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        results.success.push(...batchResults.filter(r => r.success));
        results.failed.push(...batchResults.filter(r => !r.success));
        
        setBatchResults(results);
        setBatchProgress(prev => ({ 
          ...prev, 
          current: Math.min(prev.current + BATCH_SIZE, prev.total) 
        }));
        
        // Rate limiting: Wait 1 second between batches
        if (i + BATCH_SIZE < attendees.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('\n' + '='.repeat(60));
      console.log(`🎉 BATCH MATCHING COMPLETE`);
      console.log(`   ✅ Successful: ${results.success.length}/${attendees.length}`);
      console.log(`   ❌ Failed: ${results.failed.length}`);
      console.log(`   ⏱️  Duration: ${duration}s`);
      console.log('='.repeat(60));
      
      setShowBatchModal(true);
      
    } catch (error) {
      console.error('Batch matching error:', error);
      alert(`Batch matching error: ${error.message}`);
    } finally {
      setBatchMatching(false);
      setCurrentAttendee(null);
    }
  };

  const handleSelectAttendee = (attendee) => {
    setSelectedAttendee(attendee);
    setMatchResult(null);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const closeBatchModal = () => {
    setShowBatchModal(false);
  };

  const handleSendEmail = async () => {
    if (!selectedAttendee || !matchResult || !event) {
      alert('Missing required data');
      return;
    }
    
    try {
      await sendMatchEmail(selectedAttendee, matchResult, event);
      alert('Email sent!');
      setShowModal(false);
    } catch (err) {
      console.error('Email error:', err);
      alert('Error: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="event-detail-container">
        <div className="loading-state">Loading event...</div>
      </div>
    );
  }

  return (
    <div className="event-detail-container">
      {/* Sidebar */}
      <aside className="detail-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">⚡</span>
          <span className="sidebar-title">Event Connect</span>
        </div>
        <nav className="sidebar-nav">
          <a href="/admin/dashboard" className="nav-item">
            <span>📊</span> Dashboard
          </a>
          <a href="/upload" className="nav-item">
            <span>➕</span> Add Event
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="detail-main">
        {/* Header with BOTH buttons */}
        <div className="detail-header">
          <button className="back-btn" onClick={() => navigate('/admin/dashboard')}>
            ← Back
          </button>
          <div className="event-info">
            <h1>{event?.name}</h1>
            <div className="event-meta">
              <span className="meta-item">📅 {event?.date}</span>
              <span className="meta-item">👥 {attendees.length} Attendees</span>
              <span className="meta-item">🏢 {sponsors.length} Sponsors</span>
              <span className={`status-badge status-${event?.status}`}>
                {event?.status?.replace('_', ' ')}
              </span>
            </div>
          </div>
          
          {/* NEW: Batch Match Button */}
          <button
            className="btn-primary batch-match-btn"
            onClick={handleBatchMatching}
            disabled={batchMatching || attendees.length === 0}
          >
            <span style={{ fontSize: '18px' }}>
              {batchMatching ? '⏳' : '🚀'}
            </span>
            {batchMatching ? 'Matching...' : `Match All (${attendees.length})`}
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'attendees' ? 'active' : ''}`}
              onClick={() => { setActiveTab('attendees'); setSelectedAttendee(null); }}
            >
              Attendees ({attendees.length})
            </button>
            <button
              className={`tab ${activeTab === 'sponsors' ? 'active' : ''}`}
              onClick={() => { setActiveTab('sponsors'); setSelectedAttendee(null); }}
            >
              Sponsors ({sponsors.length})
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="content-area">
          {/* List Panel */}
          <div className="list-panel">
            {activeTab === 'attendees' ? (
              attendees.length === 0 ? (
                <div className="empty-state">No attendees found</div>
              ) : (
                <div className="list">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className={`list-item ${selectedAttendee?.id === attendee.id ? 'selected' : ''}`}
                      onClick={() => handleSelectAttendee(attendee)}
                    >
                      <div className="item-avatar">
                        {attendee.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="item-info">
                        <span className="item-name">{attendee.name}</span>
                        <span className="item-subtitle">{attendee.jobTitle} at {attendee.company}</span>
                      </div>
                      <div className="item-arrow">→</div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              sponsors.length === 0 ? (
                <div className="empty-state">No sponsors found</div>
              ) : (
                <div className="list">
                  {sponsors.map((sponsor) => (
                    <div key={sponsor.id} className="list-item sponsor-item">
                      <div className="item-avatar sponsor-avatar">
                        {sponsor.companyName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="item-info">
                        <span className="item-name">{sponsor.companyName}</span>
                        <span className="item-subtitle">{sponsor.domain}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Detail Panel - SINGLE ATTENDEE MATCHING */}
          {selectedAttendee && activeTab === 'attendees' && (
            <div className="detail-panel">
              <div className="panel-header">
                <h2>Attendee Details</h2>
                <button className="close-btn" onClick={() => setSelectedAttendee(null)}>×</button>
              </div>

              <div className="panel-content">
                <div className="profile-header">
                  <div className="profile-avatar">
                    {selectedAttendee.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="profile-info">
                    <h3>{selectedAttendee.name}</h3>
                    <p>{selectedAttendee.jobTitle}</p>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Contact</h4>
                  <div className="detail-row">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{selectedAttendee.email}</span>
                  </div>
                  {selectedAttendee.githubUrl && (
                    <div className="detail-row">
                      <span className="detail-label">GitHub</span>
                      <a href={selectedAttendee.githubUrl} target="_blank" rel="noreferrer" className="detail-link">
                        View Profile
                      </a>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4>Professional</h4>
                  <div className="detail-row">
                    <span className="detail-label">Company</span>
                    <span className="detail-value">{selectedAttendee.company}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Role</span>
                    <span className="detail-value">{selectedAttendee.jobTitle}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Intent</h4>
                  <div className="intent-tags">
                    {selectedAttendee.intent?.map((intent, idx) => (
                      <span key={idx} className="intent-tag">{intent}</span>
                    ))}
                  </div>
                </div>

                <div className="panel-actions">
                  <button 
                    className="btn-primary match-btn"
                    onClick={() => handleRunMatching(selectedAttendee)}
                    disabled={matching}
                  >
                    {matching ? '⏳ Generating...' : '🤖 Run Matching'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* EXISTING: Single Match Results Modal */}
      {showModal && matchResult && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <span className="modal-icon">🎯</span>
                <div>
                  <h2>Match Results</h2>
                  <p>Personalized recommendations for {selectedAttendee?.name}</p>
                </div>
              </div>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <div className="modal-body">
              {matchResult.attendeeSummary && (
                <div className="modal-section">
                  <h3>👤 About You</h3>
                  <p className="attendee-summary">{matchResult.attendeeSummary}</p>
                </div>
              )}

              <div className="modal-section">
                <h3>🏢 Top Sponsor Matches</h3>
                <div className="sponsor-matches-grid">
                  {matchResult.sponsorMatches?.map((match, idx) => (
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
                            {match.theirRole && <span className="contact-role">({match.theirRole})</span>}
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
              </div>

              {matchResult.schedule?.length > 0 && (
                <div className="modal-section">
                  <h3>📅 Suggested Schedule</h3>
                  <div className="schedule-timeline">
                    {matchResult.schedule.map((item, idx) => (
                      <div key={idx} className="schedule-card">
                        <div className="schedule-time">{item.time}</div>
                        <div className="schedule-details">
                          <div className="schedule-activity">{item.activity}</div>
                          {item.reason && <div className="schedule-reason">{item.reason}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matchResult.proTips?.length > 0 && (
                <div className="modal-section">
                  <h3>💡 Pro Tips</h3>
                  <ul className="tips-list">
                    {matchResult.proTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {matchResult.afterEvent?.length > 0 && (
                <div className="modal-section">
                  <h3>📝 After the Event</h3>
                  <ul className="after-event-list">
                    {matchResult.afterEvent.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>
                Close
              </button>
              <button className="btn-primary" onClick={handleSendEmail}>
                📧 Send Email to {selectedAttendee?.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Batch Progress Indicator (Floating) */}
      {(batchMatching || batchProgress.current > 0) && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          minWidth: '320px',
          zIndex: 1000
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              {batchMatching ? '🔄 Batch Matching' : '✅ Complete'}
            </h3>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: '600',
              color: batchMatching ? '#3b82f6' : '#10b981'
            }}>
              {Math.round((batchProgress.current / batchProgress.total) * 100)}%
            </span>
          </div>
          
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '12px'
          }}>
            <div style={{
              width: `${(batchProgress.current / batchProgress.total) * 100}%`,
              height: '100%',
              backgroundColor: batchMatching ? '#3b82f6' : '#10b981',
              transition: 'width 0.3s ease'
            }} />
          </div>
          
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            <div>{batchProgress.current} / {batchProgress.total} attendees</div>
            {currentAttendee && (
              <div style={{ 
                marginTop: '4px',
                color: '#374151',
                fontWeight: '500'
              }}>
                Processing: {currentAttendee}
              </div>
            )}
          </div>
          
          {batchResults.success.length > 0 && (
            <div style={{ 
              fontSize: '13px', 
              display: 'flex', 
              gap: '12px',
              paddingTop: '8px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <span style={{ color: '#10b981' }}>
                ✅ {batchResults.success.length} success
              </span>
              {batchResults.failed.length > 0 && (
                <span style={{ color: '#ef4444' }}>
                  ❌ {batchResults.failed.length} failed
                </span>
              )}
            </div>
          )}
          
          {!batchMatching && batchProgress.current > 0 && (
            <button 
              onClick={() => setBatchProgress({ current: 0, total: 0 })}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '8px',
                backgroundColor: '#f3f4f6',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* NEW: Batch Results Modal */}
      {showBatchModal && (
        <div className="modal-overlay" onClick={closeBatchModal}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <span className="modal-icon">🎉</span>
                <div>
                  <h2>Batch Matching Complete!</h2>
                  <p>Results for {batchProgress.total} attendees</p>
                </div>
              </div>
              <button className="modal-close" onClick={closeBatchModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="modal-section">
                <h3>📊 Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                  <div style={{ 
                    padding: '16px', 
                    backgroundColor: '#f0fdf4', 
                    borderRadius: '8px',
                    border: '1px solid #86efac'
                  }}>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#16a34a' }}>
                      {batchResults.success.length}
                    </div>
                    <div style={{ fontSize: '14px', color: '#166534', marginTop: '4px' }}>
                      Successful Matches
                    </div>
                  </div>
                  
                  {batchResults.failed.length > 0 && (
                    <div style={{ 
                      padding: '16px', 
                      backgroundColor: '#fef2f2', 
                      borderRadius: '8px',
                      border: '1px solid #fca5a5'
                    }}>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc2626' }}>
                        {batchResults.failed.length}
                      </div>
                      <div style={{ fontSize: '14px', color: '#991b1b', marginTop: '4px' }}>
                        Failed
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {batchResults.success.length > 0 && (
                <div className="modal-section">
                  <h3>✅ Successfully Matched</h3>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {batchResults.success.map((result, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                          {result.attendee.name}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>
                          {result.attendee.email}
                        </div>
                        {result.topMatches && result.topMatches.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '6px' }}>
                            Top matches: {result.topMatches.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {batchResults.failed.length > 0 && (
                <div className="modal-section">
                  <h3>❌ Failed Matches</h3>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {batchResults.failed.map((result, idx) => (
                      <div key={idx} style={{
                        padding: '12px',
                        backgroundColor: '#fef2f2',
                        borderRadius: '6px',
                        marginBottom: '8px'
                      }}>
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                          {result.attendee.name}
                        </div>
                        <div style={{ fontSize: '13px', color: '#dc2626' }}>
                          Error: {result.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-primary" onClick={closeBatchModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventDetailPage;
