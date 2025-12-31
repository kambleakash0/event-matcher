# Event Matcher MCP Server

An MCP server that connects Claude Desktop to your event attendee and sponsor data, enabling AI-powered matching and recommendations.

## What This Does

Claude Desktop accesses a local SQLite database to:

- Semantically match attendees to relevant sponsors
- Provide reasoning for each recommendation
- Manage event data (attendees, sponsors, matches) via persistent storage

## Quick Setup

### 1. Install Dependencies

```bash
cd event-matcher
pip install -r requirements.txt
```

### 2. Initialize the Database

This project uses SQLite with Alembic for migrations. You must initialize the database before running the server.

```bash
# Apply database migrations (creates the tables)
alembic upgrade head

# Seed the database with initial sample data
python seed.py
```

### 3. Configure Claude Desktop

Find your Claude Desktop config file:

- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this to your config (update the path to point to your virtual environment python and the server script):

```json
{
  "mcpServers": {
    "event-matcher": {
      "command": "/ABSOLUTE/PATH/TO/.../bin/python",
      "args": ["/ABSOLUTE/PATH/TO/.../server.py"]
    }
  }
}
```

### 4. Restart Claude Desktop

Close and reopen Claude Desktop. You should see the MCP tools available.

---

## Available Tools

| Tool | Description |
| ------ | ------------- |
| `get_attendees()` | Returns all attendee profiles from DB |
| `get_sponsors()` | Returns all sponsor information from DB |
| `match_attendee(name)` | AI analysis of best sponsors for an attendee |
| `find_attendees_for_sponsor(name)` | AI analysis of best targets for a sponsor |
| `add_attendee(...)` | Add a new attendee to the database |
| `add_sponsor(...)` | Add a new sponsor to the database |

---

## Development

### Project Structure

- `db/`: Database models (SQLAlchemy) and CRUD operations
- `alembic/`: Database migration scripts
- `tests/`: Pytest suite
- `server.py`: MCP server entry point
- `seed.py`: Script to populate DB with initial data

### Running Tests

```bash
pytest
```

### Database Management

If you modify `db/models.py`, generate a new migration:

```bash
alembic revision --autogenerate -m "description of change"
alembic upgrade head
```

---

## Troubleshooting

### "unable to open database file"

- Ensure `db/base.py` is using an absolute path for `DATABASE_URL`.
- Restart Claude Desktop to pick up code changes.

### MCP not connecting?

- Check the absolute paths in your config.
- Ensure you ran `alembic upgrade head`.

---
