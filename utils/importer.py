import pandas as pd
import json
import re
from sqlalchemy.orm import Session
from db import crud, models

# Define expected columns
ATTENDEE_COLS = ["Name", "Email", "Company", "Title", "Goals", "Github"]
SPONSOR_COLS = ["Name", "Domain", "Promoting", "Products", "Reps", "Website"]


def validate_email(email):
    pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    return re.match(pattern, email) is not None


def parse_list_field(field_value):
    """Convert 'item1, item2' string to ['item1', 'item2'] list"""
    if pd.isna(field_value) or field_value == "":
        return []
    return [x.strip() for x in str(field_value).split(",")]


def parse_reps(field_value):
    """Convert 'John:CEO, Jane:CTO' to [{'name': 'John', 'title': 'CEO'}, ...]"""
    if pd.isna(field_value) or field_value == "":
        return []

    reps = []
    items = str(field_value).split(",")
    for item in items:
        if ":" in item:
            name, title = item.split(":", 1)
            reps.append({"name": name.strip(), "title": title.strip()})
    return reps


def process_file(db: Session, filepath: str, file_type: str):
    """
    Args:
        file_type: 'attendee' or 'sponsor'
    """
    results = {"success_count": 0, "errors": []}

    # 1. Load Data
    try:
        if filepath.endswith(".csv"):
            df = pd.read_csv(filepath)
        elif filepath.endswith(".xlsx"):
            df = pd.read_excel(filepath)
        else:
            return {"error": "Unsupported file format. Use .csv or .xlsx"}
    except Exception as e:
        return {"error": f"Could not read file: {str(e)}"}

    # 2. Process Rows
    for index, row in df.iterrows():
        row_num = index + 2  # Excel row number (1-based + header)

        try:
            if file_type == "attendee":
                # Validation
                if pd.isna(row.get("Name")) or pd.isna(row.get("Email")):
                    results["errors"].append(f"Row {row_num}: Missing Name or Email")
                    continue

                email = str(row["Email"]).strip()
                if not validate_email(email):
                    results["errors"].append(
                        f"Row {row_num}: Invalid email format '{email}'"
                    )
                    continue

                if crud.get_attendee_by_email(db, email):
                    results["errors"].append(
                        f"Row {row_num}: Email '{email}' already exists"
                    )
                    continue

                # Prepare Data
                attendee_data = {
                    "full_name": row["Name"],
                    "email": email,
                    "current_company": row.get("Company"),
                    "job_title": row.get("Title"),
                    "what_are_you_hoping_to_get_from_this_event": parse_list_field(
                        row.get("Goals")
                    ),
                    "github": (
                        row.get("Github") if not pd.isna(row.get("Github")) else None
                    ),
                }
                crud.create_attendee(db, attendee_data)
                results["success_count"] += 1

            elif file_type == "sponsor":
                # Validation
                if pd.isna(row.get("Name")):
                    results["errors"].append(f"Row {row_num}: Missing Sponsor Name")
                    continue

                name = str(row["Name"]).strip()

                # Check duplicate by name (simple check)
                existing = (
                    db.query(models.Sponsor).filter(models.Sponsor.name == name).first()
                )
                if existing:
                    results["errors"].append(
                        f"Row {row_num}: Sponsor '{name}' already exists"
                    )
                    continue

                # Prepare Data
                sponsor_data = {
                    "sponsor_name": name,
                    "company_domain": row.get("Domain"),
                    "what_are_they_promoting_at_this_event": parse_list_field(
                        row.get("Promoting")
                    ),
                    "project_or_product_name": row.get("Products"),
                    "who_is_attending_from_the_company": parse_reps(row.get("Reps")),
                    "event_page_url": row.get("Website"),
                }
                crud.create_sponsor(db, sponsor_data)
                results["success_count"] += 1

        except Exception as e:
            results["errors"].append(f"Row {row_num}: Unexpected error - {str(e)}")

    return results
