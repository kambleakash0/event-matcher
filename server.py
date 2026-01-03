#!/usr/bin/env python3
"""
Event Matcher MCP Server
Matches attendees to sponsors using Claude's reasoning
"""

import json
from contextlib import contextmanager
from mcp.server.fastmcp import FastMCP
from db.base import get_db
from db import crud
from utils.importer import process_file

# Initialize MCP server
mcp = FastMCP("event-matcher")


# ============== CORE TOOLS ==============


@mcp.tool()
def get_attendees() -> str:
    """Get all registered attendees for the event."""
    with get_db() as db:
        attendees = crud.get_attendees(db)
        if not attendees:
            return "No attendees found."

        # Serialize for output
        data = []
        for a in attendees:
            data.append(
                {
                    "full_name": a.name,
                    "email": a.email,
                    "company": a.company,
                    "job_title": a.job_title,
                    "goals": a.goals,
                    "github": a.github_url,
                }
            )
        return json.dumps(data, indent=2)


@mcp.tool()
def get_sponsors() -> str:
    """Get all sponsors/exhibitors for the event."""
    with get_db() as db:
        sponsors = crud.get_sponsors(db)
        if not sponsors:
            return "No sponsors found."

        # Serialize
        data = []
        for s in sponsors:
            data.append(
                {
                    "sponsor_name": s.name,
                    "company_domain": s.domain,
                    "what_are_they_promoting_at_this_event": s.promoting,
                    "project_or_product_name": s.products,
                    "who_is_attending_from_the_company": s.reps,
                    "event_page_url": s.event_page_url,
                }
            )
        return json.dumps(data, indent=2)


@mcp.tool()
def get_event_summary() -> str:
    """Get overview of event - attendee count, sponsor count, goals distribution."""
    with get_db() as db:
        attendees = crud.get_attendees(db)
        sponsors = crud.get_sponsors(db)

        summary = {
            "total_attendees": len(attendees),
            "total_sponsors": len(sponsors),
            "attendees": [
                {
                    "name": a.name,
                    "company": a.company or "N/A",
                    "title": a.job_title or "N/A",
                }
                for a in attendees
            ],
            "sponsors": [{"name": s.name, "promoting": s.promoting} for s in sponsors],
        }
        return json.dumps(summary, indent=2)


# ============== MATCHING TOOLS ==============


@mcp.tool()
def match_attendee(attendee_name: str) -> str:
    """
    Find the best sponsor matches for a specific attendee.

    USE THIS WHEN: User asks "best sponsors for [name]", "who should [name] visit",
    "match [name]", or any question about recommending sponsors to an attendee.

    Args:
        attendee_name: Full or partial name of the attendee

    Returns:
        Attendee profile + all sponsors + matching criteria for you to reason through.
        YOU MUST analyze and return top 3 sponsors with scores and reasoning.
    """
    with get_db() as db:
        # Find attendee (case-insensitive partial match)
        all_attendees = crud.get_attendees(db)
        matched = None
        for a in all_attendees:
            if attendee_name.lower() in a.name.lower():
                matched = a
                break

        if not matched:
            available = [a.name for a in all_attendees]
            return (
                f"No attendee found matching '{attendee_name}'.\n\nAvailable attendees:\n"
                + "\n".join(f"- {name}" for name in available)
            )

        sponsors = crud.get_sponsors(db)

        # Serialize data for the prompt
        attendee_data = {
            "full_name": matched.name,
            "company": matched.company,
            "job_title": matched.job_title,
            "goals": matched.goals,
        }

        sponsors_data = [
            {
                "sponsor_name": s.name,
                "domain": s.domain,
                "promoting": s.promoting,
                "products": s.products,
                "reps": s.reps,
            }
            for s in sponsors
        ]

        result = {
            "attendee": attendee_data,
            "all_sponsors": sponsors_data,
            "YOUR_TASK": """
ANALYZE THIS ATTENDEE AND RANK THE BEST SPONSORS FOR THEM.

MATCHING CRITERIA (use these in order of importance):

1. GOAL ALIGNMENT (Most Important)
   - "job hunting" → sponsors with "hiring" in their promotions
   - "learn something new" → sponsors with "research", "open-source" 
   - "networking" → sponsors with senior attendees (Director, VP, Head)
   - "grow business opportunities" → sponsors with "product", "enterprise"

2. BACKGROUND FIT
   - PhD/Student/Researcher → research-focused sponsors
   - Engineer → technical product sponsors  
   - Senior title → match with senior sponsor reps
   - Their company domain → related sponsor domains

3. CONVERSATION POTENTIAL
   - Can they have a meaningful conversation?
   - Shared interests or complementary needs?

OUTPUT FORMAT (follow exactly):

## Best Matches for [Attendee Name]
**Background:** [Their title] at [Company]  
**Looking for:** [Their goals]

### 1. [Sponsor Name] — Score: X/10
**Why:** [2-3 sentences explaining the match]  
**Talk to:** [Person name and title from sponsor]  
**Conversation starter:** "[Specific opening line they could use]"

### 2. [Sponsor Name] — Score: X/10
**Why:** [2-3 sentences]  
**Talk to:** [Person]  
**Conversation starter:** "[Opening line]"

### 3. [Sponsor Name] — Score: X/10
**Why:** [2-3 sentences]  
**Talk to:** [Person]  
**Conversation starter:** "[Opening line]"
""",
        }

        return json.dumps(result, indent=2)


@mcp.tool()
def match_all_attendees() -> str:
    """
    Generate sponsor recommendations for ALL attendees.

    USE THIS WHEN: User asks "match everyone", "recommendations for all",
    "generate all matches", or wants a full report.

    Returns:
        All attendees + all sponsors + instructions to generate complete matching report.
    """
    with get_db() as db:
        attendees = crud.get_attendees(db)
        sponsors = crud.get_sponsors(db)

        if not attendees:
            return "No attendees found."
        if not sponsors:
            return "No sponsors found."

        # Serialize
        att_data = [
            {
                "name": a.name,
                "title": a.job_title,
                "company": a.company,
                "goals": a.goals,
            }
            for a in attendees
        ]
        sp_data = [
            {"name": s.name, "domain": s.domain, "promoting": s.promoting}
            for s in sponsors
        ]

        result = {
            "all_attendees": att_data,
            "all_sponsors": sp_data,
            "YOUR_TASK": """
GENERATE MATCHES FOR EVERY ATTENDEE.

For EACH attendee, provide their top 3 sponsor recommendations.

MATCHING CRITERIA:
1. GOAL ALIGNMENT: Match their goals to sponsor offerings
   - job hunting ↔ hiring
   - learn something new ↔ research, open-source
   - networking ↔ senior reps attending
   - grow business ↔ product, enterprise

2. BACKGROUND FIT: Match their role/domain to sponsor domain

3. SENIORITY MATCH: Connect similar levels when possible

OUTPUT FORMAT FOR EACH ATTENDEE:

---
## [Attendee Name] — [Title] at [Company]
**Goals:** [their goals]

1. **[Sponsor]** (9/10) - [One line reason]
2. **[Sponsor]** (8/10) - [One line reason]  
3. **[Sponsor]** (7/10) - [One line reason]

---

Generate this for ALL attendees in the list.
""",
        }

        return json.dumps(result, indent=2)


@mcp.tool()
def find_attendees_for_sponsor(sponsor_name: str) -> str:
    """
    Find which attendees a sponsor should prioritize talking to.

    USE THIS WHEN: User asks "who should [sponsor] talk to", "best attendees for [sponsor]",
    or any question from the sponsor's perspective.

    Args:
        sponsor_name: Full or partial name of the sponsor company

    Returns:
        Sponsor profile + all attendees + instructions to find best matches.
    """
    with get_db() as db:
        sponsors = crud.get_sponsors(db)
        matched = None
        for s in sponsors:
            if sponsor_name.lower() in s.name.lower():
                matched = s
                break

        if not matched:
            available = [s.name for s in sponsors]
            return (
                f"No sponsor found matching '{sponsor_name}'.\n\nAvailable sponsors:\n"
                + "\n".join(f"- {name}" for name in available)
            )

        attendees = crud.get_attendees(db)

        # Serialize
        sponsor_data = {
            "name": matched.name,
            "promoting": matched.promoting,
            "products": matched.products,
        }

        att_data = [
            {
                "name": a.name,
                "company": a.company,
                "title": a.job_title,
                "goals": a.goals,
            }
            for a in attendees
        ]

        result = {
            "sponsor": sponsor_data,
            "all_attendees": att_data,
            "YOUR_TASK": """
FIND THE BEST ATTENDEES FOR THIS SPONSOR TO PRIORITIZE.

Based on what this sponsor is promoting, rank which attendees they should seek out.

MATCHING LOGIC:
- Promoting "hiring" → prioritize attendees with "job hunting" goal
- Promoting "research"/"open-source" → prioritize PhDs, researchers, learners
- Promoting "product" → prioritize engineers evaluating tools, business folks
- Promoting "enterprise" → prioritize senior roles, founders, decision makers

OUTPUT FORMAT:

## Top Attendees for [Sponsor Name]
**You're promoting:** [their offerings]

### Priority Attendees:

1. **[Attendee Name]** — [Title] at [Company]
   - **Why target them:** [2 sentences]
   - **Talking point:** [What to discuss with them]

2. **[Attendee Name]** — [Title] at [Company]
   - **Why target them:** [2 sentences]
   - **Talking point:** [What to discuss]

3. **[Attendee Name]** — [Title] at [Company]
   - **Why target them:** [2 sentences]
   - **Talking point:** [What to discuss]
""",
        }

        return json.dumps(result, indent=2)


@mcp.tool()
def compare_sponsors_for_attendee(
    attendee_name: str, sponsor1: str, sponsor2: str
) -> str:
    """
    Compare two specific sponsors for an attendee.

    USE THIS WHEN: User asks "should [attendee] visit [sponsor1] or [sponsor2]",
    "compare [sponsor1] vs [sponsor2] for [attendee]"

    Args:
        attendee_name: Name of the attendee
        sponsor1: First sponsor to compare
        sponsor2: Second sponsor to compare
    """
    with get_db() as db:
        attendees = crud.get_attendees(db)

        attendee = None
        for a in attendees:
            if attendee_name.lower() in a.name.lower():
                attendee = a
                break

        if not attendee:
            return f"Attendee '{attendee_name}' not found."

        sponsors = crud.get_sponsors(db)
        s1, s2 = None, None
        for s in sponsors:
            if sponsor1.lower() in s.name.lower():
                s1 = s
            if sponsor2.lower() in s.name.lower():
                s2 = s

        if not s1:
            return f"Sponsor '{sponsor1}' not found."
        if not s2:
            return f"Sponsor '{sponsor2}' not found."

        result = {
            "attendee": {
                "name": attendee.name,
                "title": attendee.job_title,
                "company": attendee.company,
                "goals": attendee.goals,
            },
            "sponsor_1": {"name": s1.name, "promoting": s1.promoting, "reps": s1.reps},
            "sponsor_2": {"name": s2.name, "promoting": s2.promoting, "reps": s2.reps},
            "YOUR_TASK": """
COMPARE THESE TWO SPONSORS FOR THIS ATTENDEE.

Analyze which sponsor is a better match and why.

OUTPUT FORMAT:

## [Sponsor1] vs [Sponsor2] for [Attendee Name]

### [Attendee Name]'s Profile
- **Role:** [title] at [company]
- **Goals:** [their goals]

### [Sponsor 1] — Score: X/10
**Pros:**
- [advantage 1]
- [advantage 2]

**Cons:**
- [disadvantage or limitation]

### [Sponsor 2] — Score: X/10
**Pros:**
- [advantage 1]
- [advantage 2]

**Cons:**
- [disadvantage or limitation]

### Verdict
**Winner: [Sponsor Name]**
[2-3 sentence explanation of why this sponsor is the better choice for this attendee]
""",
        }

        return json.dumps(result, indent=2)


@mcp.tool()
def add_attendee(
    full_name: str,
    email: str,
    company: str,
    job_title: str,
    goals: str,
    github: str = None,
) -> str:
    """
    Add a new attendee to the event.

    Args:
        full_name: Full name of the attendee
        email: Email address
        company: Current company
        job_title: Job title
        goals: Comma-separated goals (e.g., "networking, learn something new, job hunting")
        github: Optional GitHub URL
    """
    # Parse goals
    goal_list = [g.strip() for g in goals.split(",")]

    attendee_data = {
        "full_name": full_name,
        "email": email,
        "current_company": company,
        "job_title": job_title,
        "what_are_you_hoping_to_get_from_this_event": goal_list,
        "github": github,
    }

    with get_db() as db:
        if crud.get_attendee_by_email(db, email):
            return f"Error: Attendee with email {email} already exists."

        crud.create_attendee(db, attendee_data)

    return f"Added attendee: {full_name} ({job_title} at {company})\nGoals: {goal_list}"


@mcp.tool()
def add_sponsor(
    name: str, domain: str, promoting: str, products: str, reps: str
) -> str:
    """
    Add a new sponsor to the event.

    Args:
        name: Sponsor company name
        domain: What the company does (e.g., "AI research", "Cloud infrastructure")
        promoting: Comma-separated promotions (e.g., "hiring, product, research")
        products: Comma-separated products/projects (e.g., "Claude, API")
        reps: Comma-separated reps attending as "Name:Title" (e.g., "John Doe:CTO, Jane Smith:Engineer")
    """
    # Parse inputs
    promo_list = [p.strip() for p in promoting.split(",")]

    rep_list = []
    for rep in reps.split(","):
        if ":" in rep:
            name_part, title = rep.strip().split(":", 1)
            rep_list.append({"name": name_part.strip(), "title": title.strip()})

    sponsor_data = {
        "sponsor_name": name,
        "company_domain": domain,
        "what_are_they_promoting_at_this_event": promo_list,
        "project_or_product_name": products,
        "who_is_attending_from_the_company": rep_list,
        "event_page_url": f"https://event.com/sponsors/{name.lower().replace(' ', '-')}",
    }

    with get_db() as db:
        # Check if exists? schema doesn't match on name unique constraint typically but let's assume valid
        crud.create_sponsor(db, sponsor_data)

    return f"Added sponsor: {name}\nDomain: {domain}\nPromoting: {promo_list}\nReps: {rep_list}"


@mcp.tool()
def import_data_from_file(filepath: str, data_type: str) -> str:
    """
    Import attendees or sponsors from an Excel/CSV file.

    Args:
        filepath: Absolute path to the .xlsx or .csv file
        data_type: Must be either 'attendee' or 'sponsor'
    """
    if data_type not in ["attendee", "sponsor"]:
        return "Error: data_type must be 'attendee' or 'sponsor'"

    # Use 'with' to automatically handle the session opening/closing
    with get_db() as db:
        try:
            result = process_file(db, filepath, data_type)

            # Format output
            output = [f"Import Complete for {data_type}s."]
            output.append(f"✅ Successfully imported: {result['success_count']}")

            if result.get("errors"):
                output.append("\n⚠️ Errors encountered:")
                for err in result["errors"]:
                    output.append(f"- {err}")

            if "error" in result:
                return f"Critical Error: {result['error']}"

            return "\n".join(output)
        except Exception as e:
            return f"System Error: {str(e)}"


if __name__ == "__main__":
    mcp.run()
