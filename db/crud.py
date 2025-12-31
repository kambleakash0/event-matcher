from sqlalchemy.orm import Session
from . import models

# --- ATTENDEES ---
def get_attendee(db: Session, attendee_id: int):
    return db.query(models.Attendee).filter(models.Attendee.id == attendee_id).first()

def get_attendee_by_email(db: Session, email: str):
    return db.query(models.Attendee).filter(models.Attendee.email == email).first()

def get_attendees(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Attendee).offset(skip).limit(limit).all()

def create_attendee(db: Session, attendee: dict):
    db_attendee = models.Attendee(
        name=attendee["full_name"],
        email=attendee["email"],
        company=attendee.get("current_company"),
        job_title=attendee.get("job_title"),
        goals=attendee.get("what_are_you_hoping_to_get_from_this_event", []),
        github_url=attendee.get("github")
    )
    db.add(db_attendee)
    db.commit()
    db.refresh(db_attendee)
    return db_attendee

# --- SPONSORS ---
def get_sponsor(db: Session, sponsor_id: int):
    return db.query(models.Sponsor).filter(models.Sponsor.id == sponsor_id).first()

def get_sponsors(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Sponsor).offset(skip).limit(limit).all()

def create_sponsor(db: Session, sponsor: dict):
    db_sponsor = models.Sponsor(
        name=sponsor["sponsor_name"],
        domain=sponsor["company_domain"],
        promoting=sponsor.get("what_are_they_promoting_at_this_event", []),
        products=sponsor.get("project_or_product_name"),
        reps=sponsor.get("who_is_attending_from_the_company", []),
        event_page_url=sponsor.get("event_page_url")
    )
    db.add(db_sponsor)
    db.commit()
    db.refresh(db_sponsor)
    return db_sponsor

# --- MATCHES ---
def create_match(db: Session, match_data: dict):
    db_match = models.Match(
        attendee_id=match_data["attendee_id"],
        sponsor_id=match_data["sponsor_id"],
        score=match_data["score"],
        reasons=match_data["reasons"]
    )
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return db_match