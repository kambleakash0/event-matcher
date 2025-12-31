from db import crud

def test_create_attendee(db):
    attendee_data = {
        "full_name": "Test User",
        "email": "test@example.com",
        "current_company": "Test Corp",
        "job_title": "Engineer",
        "what_are_you_hoping_to_get_from_this_event": ["networking"],
        "github": "https://github.com/test"
    }
    
    attendee = crud.create_attendee(db, attendee_data)
    
    assert attendee.name == "Test User"
    assert attendee.email == "test@example.com"
    assert attendee.id is not None

def test_get_attendee_by_email(db):
    attendee_data = {
        "full_name": "Test User",
        "email": "unique@example.com",
        "what_are_you_hoping_to_get_from_this_event": []
    }
    crud.create_attendee(db, attendee_data)
    
    fetched = crud.get_attendee_by_email(db, "unique@example.com")
    assert fetched is not None
    assert fetched.name == "Test User"

def test_create_sponsor(db):
    sponsor_data = {
        "sponsor_name": "Big Tech",
        "company_domain": "AI",
        "what_are_they_promoting_at_this_event": ["hiring"],
        "project_or_product_name": "Cloud",
        "who_is_attending_from_the_company": [],
        "event_page_url": "http://example.com"
    }
    
    sponsor = crud.create_sponsor(db, sponsor_data)
    assert sponsor.name == "Big Tech"
    assert sponsor.promoting == ["hiring"]