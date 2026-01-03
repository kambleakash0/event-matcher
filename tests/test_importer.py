import pandas as pd
import pytest
from utils.importer import process_file
from db import crud


def test_import_attendees(db, tmp_path):
    # Create a dummy CSV file
    d = {
        "Name": ["Alice", "Bob"],
        "Email": ["alice@test.com", "bob@test.com"],
        "Company": ["A Corp", "B Corp"],
        "Title": ["Dev", "Manager"],
        "Goals": ["learning", "hiring, networking"],
        "Github": ["", ""],
    }
    df = pd.DataFrame(data=d)
    file_path = tmp_path / "attendees.csv"
    df.to_csv(file_path, index=False)

    # Run import
    result = process_file(db, str(file_path), "attendee")

    assert result["success_count"] == 2
    assert len(result["errors"]) == 0

    # Verify DB
    alice = crud.get_attendee_by_email(db, "alice@test.com")
    assert alice is not None
    assert alice.goals == ["learning"]


def test_import_validation_error(db, tmp_path):
    # Create invalid data (missing email)
    d = {"Name": ["No Email Guy"], "Email": [None], "Company": ["Fail Corp"]}
    df = pd.DataFrame(data=d)
    file_path = tmp_path / "bad.csv"
    df.to_csv(file_path, index=False)

    result = process_file(db, str(file_path), "attendee")

    assert result["success_count"] == 0
    assert len(result["errors"]) == 1
    assert "Missing Name or Email" in result["errors"][0]
