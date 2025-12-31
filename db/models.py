from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .base import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    date = Column(DateTime)
    meetup_id = Column(String, unique=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    matches = relationship("Match", back_populates="event")

class Attendee(Base):
    __tablename__ = "attendees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    company = Column(String)
    job_title = Column(String)
    goals = Column(JSON)  # Stores ["networking", "hiring"]
    # Added github_url to preserve data from your existing JSON files
    github_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    matches = relationship("Match", back_populates="attendee")

class Sponsor(Base):
    __tablename__ = "sponsors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    domain = Column(String)
    promoting = Column(JSON)  # Stores ["hiring", "product"]
    products = Column(Text)
    reps = Column(JSON)       # Stores [{"name": "...", "title": "..."}]
    event_page_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    matches = relationship("Match", back_populates="sponsor")

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    attendee_id = Column(Integer, ForeignKey("attendees.id"))
    sponsor_id = Column(Integer, ForeignKey("sponsors.id"))
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    score = Column(Integer)
    reasons = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    attendee = relationship("Attendee", back_populates="matches")
    sponsor = relationship("Sponsor", back_populates="matches")
    event = relationship("Event", back_populates="matches")
