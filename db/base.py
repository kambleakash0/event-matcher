from pathlib import Path
from sqlalchemy import create_engine
from contextlib import contextmanager
from sqlalchemy.orm import sessionmaker, declarative_base

# 1. Get the absolute path of the project root
# (This file is in db/base.py, so .parent.parent gets us to the root)
BASE_DIR = Path(__file__).resolve().parent.parent

# 2. Construct the absolute path to the database file
DB_PATH = BASE_DIR / "event_matcher.db"

# 3. Create the connection string
# Note: SQLite needs 4 slashes for absolute paths on Mac/Linux (sqlite:////path)
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
