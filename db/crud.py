from sqlalchemy.orm import Session
from . import models

def get_attendees(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Attendee).offset(skip).limit(limit).all()

def get_attendee_by_email(db: Session, email: str):
    return db.query(models.Attendee).filter(models.Attendee.email == email).first()

def create_attendee(db: Session, attendee_data: dict):
    db_attendee = models.Attendee(
        name=attendee_data["full_name"],
        email=attendee_data["email"],
        company=attendee_data.get("current_company"),
        job_title=attendee_data.get("job_title"),
        goals=attendee_data.get("what_are_you_hoping_to_get_from_this_event", []),
        github_url=attendee_data.get("github")
    )
    db.add(db_attendee)
    db.commit()
    db.refresh(db_attendee)
    return db_attendee

def get_sponsors(db: Session):
    return db.query(models.Sponsor).all()

def create_sponsor(db: Session, sponsor_data: dict):
    db_sponsor = models.Sponsor(
        name=sponsor_data["sponsor_name"],
        domain=sponsor_data["company_domain"],
        promoting=sponsor_data.get("what_are_they_promoting_at_this_event", []),
        products=sponsor_data.get("project_or_product_name"),
        reps=sponsor_data.get("who_is_attending_from_the_company", []),
        event_page_url=sponsor_data.get("event_page_url")
    )
    db.add(db_sponsor)
    db.commit()
    db.refresh(db_sponsor)
    return db_sponsor