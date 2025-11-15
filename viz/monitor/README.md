# Agent Monitor Daemon

Real-time event collection daemon for agent visualization system.

## Architecture

The monitor daemon integrates four subsystems:

1. **Session Correlation** (`correlation/`)
   - Watches for new agent spawns
   - Links agent sessions to Copilot UUIDs

2. **Event Parsing** (`parsers/`)
   - Reads Copilot JSONL session state
   - Incremental file position tracking

3. **Event Transformation** (`transformers/`)
   - Categorizes commands (git, npm, shell, etc.)
   - Normalizes file paths
   - Extracts file operations

4. **Data Persistence** (`database/`)
   - SQLite event store
   - Indexed for fast queries
   - Aggregation views

## Usage

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start

# Run tests
npm test

# Integration test
npm run test:integration
```

## Event Flow

```
Agent Spawn
    ↓
MetadataWatcher detects new .json file
    ↓
SessionCorrelator matches to Copilot UUID
    ↓
JsonlParser reads session-state/<uuid>.jsonl
    ↓
EventTransformer categorizes events
    ↓
EventStore persists to SQLite
    ↓
(Repeat for new events)
```

## Monitoring Output

```
🚀 Agent Monitor Daemon starting...

✓ Database initialized: ../data/viz-data.db
✓ Session correlator ready
✓ Watching for agent spawns: .../agent/metadata

📊 Found 2 existing agent sessions

🆕 New agent detected: viz-track-a-database
   Project: /Users/shelfwood/Projects/shelfwood-agents
   Spawned: 2025-11-14T20:23:00Z
   Waiting 10s for Copilot initialization...
   ✓ Correlated to Copilot: d984ce1a-e3c9-40dc-b0d6-908931c224bd
   📡 Monitoring: d984ce1a-e3c9-40dc-b0d6-908931c224bd.jsonl
   📥 Processing 247 existing events...
   ✓ Inserted 89 events
   📊 viz-track-a-database: +12 events
   📊 viz-track-a-database: +8 events

✓ Monitor daemon running

Press Ctrl+C to stop
```

## Database Queries

```javascript
import { EventStore } from './database/event-store.js';

const store = new EventStore('./data/viz-data.db');
store.initialize();

// List all sessions
const sessions = await store.listSessions();

// Get events for session
const events = await store.getEvents('viz-track-a-database');

// File activity heatmap
const fileActivity = await store.getFileActivity('viz-track-a-database');

// Command statistics
const commandStats = await store.getCommandStats('viz-track-a-database');

store.close();
```

## Configuration

Environment variables:

- `VIZ_DB_PATH` - Database file path (default: `../data/viz-data.db`)
- `VIZ_METADATA_DIR` - Agent metadata directory
- `VIZ_COPILOT_DIR` - Copilot session-state directory

## Testing

Unit tests for individual components in `tests/`:
- `jsonl-parser.test.js`
- `event-transformer.test.js`
- `command-categorizer.test.js`
- `path-normalizer.test.js`

Integration test (`tests/integration.test.js`):
- Spawns real agent
- Verifies event capture
- Validates database persistence
