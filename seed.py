import json
import sys
from pathlib import Path

# Add current directory to path so we can import 'db'
sys.path.append(str(Path(__file__).parent))

from db.base import SessionLocal
from db import crud

DATA_DIR = Path(__file__).parent / "data"

def load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        print(f"Warning: {filename} not found.")
        return []
    with open(path, "r") as f:
        return json.load(f)

def seed():
    db = SessionLocal()
    
    print("🌱 Seeding database...")

    # 1. Seed Attendees
    attendees = load_json("attendees.json")
    count_a = 0
    for a in attendees:
        # Check if exists to avoid duplicates
        if not crud.get_attendee_by_email(db, a["email"]):
            crud.create_attendee(db, a)
            count_a += 1
    print(f"   - Added {count_a} attendees")

    # 2. Seed Sponsors
    sponsors = load_json("sponsors.json")
    count_s = 0
    existing_sponsors = {s.name for s in crud.get_sponsors(db)}
    
    for s in sponsors:
        if s["sponsor_name"] not in existing_sponsors:
            crud.create_sponsor(db, s)
            count_s += 1
    print(f"   - Added {count_s} sponsors")

    db.close()
    print("✅ Seeding complete!")

if __name__ == "__main__":
    seed()