# Event Matcher MCP Server

An MCP server that connects Claude Desktop to your event attendee and sponsor data, enabling AI-powered matching and recommendations.

## What This Does

Claude Desktop reads your attendee and sponsor data, then:
- Semantically matches attendees to relevant sponsors
- Provides reasoning for each recommendation
- Considers job titles, goals, company backgrounds, and sponsor offerings

## Quick Setup

### 1. Install Dependencies

```bash
cd event-matcher
pip install -r requirements.txt
```

### 2. Configure Claude Desktop

Find your Claude Desktop config file:
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this to your config (update the path!):

```json
{
  "mcpServers": {
    "event-matcher": {
      "command": "python",
      "args": ["/Users/anmolpatil/Downloads/event-matcher/server.py"]
    }
  }
}
```

### 3. Restart Claude Desktop

Close and reopen Claude Desktop. You should see the MCP tools available.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `get_attendees()` | Returns all attendee profiles |
| `get_sponsors()` | Returns all sponsor information |
| `get_attendee_by_name(name)` | Search for specific attendee |
| `get_sponsor_by_name(name)` | Search for specific sponsor |
| `get_event_summary()` | Overview of event stats |

---

## Example Prompts for Claude Desktop

### Generate All Matches

```
Look at all the attendees and sponsors for this event. 
For each attendee, recommend their top 3 sponsors to visit.

For each recommendation, explain:
1. Why this sponsor is relevant to them
2. Who they should talk to at the booth
3. What specifically they should ask about

Format as a clear report I can send to attendees.
```

### Match a Specific Attendee

```
Get the profile for Michael Chen and recommend which sponsors 
he should visit. He's a PhD student, so focus on research 
opportunities and learning.
```

### Sponsor Perspective

```
I'm from Nvidia. Look at the attendee list and tell me which 
attendees I should prioritize talking to, and what topics 
would resonate with each of them.
```

### Event Overview

```
Give me a summary of this event - who's attending, what they're 
looking for, and which sponsors are best positioned to meet 
attendee needs. Flag any gaps.
```

### Generate Personalized Emails

```
For each attendee, draft a short personalized email (3-4 sentences) 
with their top sponsor recommendations. Keep it friendly and specific.
```

---

## Customizing Your Data

### Add More Attendees

Edit `data/attendees.json`:

```json
{
  "full_name": "New Person",
  "email": "email@example.com",
  "github": "https://github.com/username",
  "linkedin": null,
  "current_company": "Company Name",
  "job_title": "Their Title",
  "what_are_you_hoping_to_get_from_this_event": ["networking", "learn something new"]
}
```

### Add More Sponsors

Edit `data/sponsors.json`:

```json
{
  "sponsor_name": "Company Name",
  "company_domain": "What they do",
  "what_are_they_promoting_at_this_event": ["product", "hiring", "research"],
  "project_or_product_name": "Specific products/projects",
  "who_is_attending_from_the_company": [
    {"name": "Person Name", "title": "Their Title"}
  ],
  "event_page_url": "https://example.com/booth"
}
```

---

## How Claude Does the Matching

Claude uses semantic understanding to match based on:

| Attendee Signal | Matched To |
|-----------------|------------|
| "PhD Student" | Research-focused sponsors |
| "job hunting" | Sponsors promoting "hiring" |
| "grow business" | Product/enterprise sponsors |
| "learn something new" | Open-source, research sponsors |
| Senior job title | Connect with senior sponsor reps |

No explicit rules needed—Claude understands these relationships naturally.

---

## Next Steps (Future Improvements)

1. **Connect to Luma API** - Auto-pull registration data
2. **GitHub scraping** - Enrich profiles with repo data  
3. **Feedback loop** - Collect "was this helpful?" to improve
4. **Meeting scheduling** - Add calendar integration

---

## Troubleshooting

**MCP not connecting?**
- Check the path in your config is absolute (full path)
- Make sure Python is in your PATH
- Restart Claude Desktop completely

**No data showing?**
- Verify `data/attendees.json` and `data/sponsors.json` exist
- Check JSON is valid (no trailing commas)

**Need help?**
Just ask Claude to debug: "Can you check if the event-matcher MCP is working? Try getting the event summary."
