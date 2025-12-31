# Event Matcher MCP Server

A Model Context Protocol (MCP) server that connects Claude Desktop to a local event database. It enables AI-powered matching between attendees and sponsors, providing reasoning-based recommendations.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.10+**: [Download Python](https://www.python.org/downloads/)
- **Git**: [Download Git](https://git-scm.com/downloads)
- **Claude Desktop App**: [Download Claude](https://claude.ai/download)

## 🚀 Installation Guide

Follow these steps exactly to set up the project on your local machine.

### 1. Clone the Repository

Open your terminal (Command Prompt, PowerShell, or Terminal) and run:

```bash
git clone https://github.com/kambleakash0/event-matcher.git
cd event-matcher
```

### 2. Set Up a Virtual Environment

It's best practice to use a virtual environment to isolate dependencies.

**macOS / Linux:**

```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows:**

```bash
python -m venv venv
venv\Scripts\activate
```

### 3. Install Dependencies

Install the required Python packages:

```bash
pip install -r requirements.txt
```

### 4. Initialize the Database

This project uses a local SQLite database (`event_matcher.db`). You need to create the tables and load initial data.

```bash
# Apply database migrations to create tables
alembic upgrade head

# Seed the database with sample data (from data/*.json)
python seed.py
```

*Note: If you see "Seeding complete!", your database is ready.*

## ⚙️ Configuration

You need to tell Claude Desktop where to find this server.

1. **Locate your config file**:
    - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
    - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Edit the file**: Open it in a text editor (like VS Code or Notepad) and add the `event-matcher` entry.

    **⚠️ IMPORTANT**: You must use **ABSOLUTE paths** to your Python executable and the `server.py` file.

    To find your absolute python path inside the venv:
    - macOS/Linux: `which python`
    - Windows: `where python`

    To find your project path:
    - macOS/Linux: `pwd`
    - Windows: `cd`

    **Config Example:**

    ```json
    {
      "mcpServers": {
        "event-matcher": {
          "command": "/Users/yourname/github/event-matcher/venv/bin/python",
          "args": ["/Users/yourname/github/event-matcher/server.py"]
        }
      }
    }
    ```

3. **Restart Claude Desktop**: Completely quit the application and open it again.

## 💡 Usage

Once connected, you can ask Claude questions like:

- "Who are the attendees?"
- "Recommend sponsors for Michael Chen."
- "I'm a sponsor from Nvidia, who should I talk to?"
- "Compare Google vs Meta for a research student."

### Available Tools

| Tool | Description |
| ------ | ------------- |
| `get_attendees()` | List all attendees |
| `get_sponsors()` | List all sponsors |
| `match_attendee(name)` | AI recommendation of sponsors for a specific attendee |
| `find_attendees_for_sponsor(name)` | AI recommendation of attendees for a specific sponsor |
| `add_attendee(...)` | Register a new attendee |
| `add_sponsor(...)` | Register a new sponsor |

## 🛠 Development

### File Structure

- `server.py`: Main entry point for the MCP server.
- `db/`: Database layer (Models and CRUD).
- `alembic/`: Migration scripts for database schema changes.
- `tests/`: Automated tests.

### Running Tests

To ensure everything is working correctly:

```bash
pytest
```

### Making Schema Changes

If you modify `db/models.py`, update the database:

```bash
alembic revision --autogenerate -m "Describe your change"
alembic upgrade head
```

## ❓ Troubleshooting

### "Unable to open database file"

- Ensure `db/base.py` uses an absolute path for the SQLite DB.
- Check permissions on the `event_matcher.db` file.

### Claude says "No tools available"

- Check the logs: `tail -f ~/Library/Logs/Claude/mcp.log` (macOS).
- Verify the paths in `claude_desktop_config.json` are correct and absolute.
- Ensure you activated the virtual environment before getting the python path.
