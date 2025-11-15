# Agent Visualization Server

REST API + Server-Sent Events server for real-time agent monitoring.

## Architecture

The server provides two primary functions:

1. **REST API** - Query historical session data from SQLite database
2. **Server-Sent Events (SSE)** - Stream real-time events as they occur

```
MonitorDaemon (writes to DB) → EventStore (SQLite) ← Server (reads from DB)
                                                          ↓
                                                    Web Dashboard
```

## Usage

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start

# Test endpoints
npm test
```

## API Endpoints

### Sessions

**GET `/api/sessions`**

List all agent sessions.

Query parameters:
- `status` - Filter by status (`running`, `stopped`, `crashed`)
- `project_dir` - Filter by project directory

Response:
```json
{
  "success": true,
  "count": 2,
  "sessions": [
    {
      "id": "agent-myapp-1234",
      "copilot_session_id": "d984ce1a-...",
      "project_dir": "/Users/shelfwood/Projects/myapp",
      "spawned_at": "2025-11-14T20:23:00Z",
      "status": "running",
      "importance": "normal",
      "last_activity": "2025-11-14T20:45:00Z"
    }
  ]
}
```

**GET `/api/sessions/:id`**

Get single session details.

Response:
```json
{
  "success": true,
  "session": { /* session object */ }
}
```

### Events

**GET `/api/sessions/:id/events`**

Get events for a session.

Query parameters:
- `event_type` - Filter by type (`tool_start`, `tool_complete`, `file_op`, `command`)
- `tool_name` - Filter by tool name (`bash`, `view`, `edit`, etc.)
- `limit` - Max results (default: 1000)
- `offset` - Pagination offset (default: 0)

Response:
```json
{
  "success": true,
  "count": 150,
  "events": [
    {
      "id": 1,
      "session_id": "agent-myapp-1234",
      "timestamp": "2025-11-14T20:23:05Z",
      "event_type": "tool_start",
      "tool_name": "bash",
      "command": "npm install",
      "command_category": "npm"
    }
  ]
}
```

### Aggregations

**GET `/api/sessions/:id/file-activity`**

Get file operation aggregation for heatmap visualization.

Response:
```json
{
  "success": true,
  "count": 25,
  "files": [
    {
      "session_id": "agent-myapp-1234",
      "file_path": "/Users/shelfwood/Projects/myapp/src/index.ts",
      "total_operations": 15,
      "reads": 8,
      "writes": 5,
      "edits": 2,
      "last_modified": "2025-11-14T20:45:00Z"
    }
  ]
}
```

**GET `/api/sessions/:id/command-stats`**

Get command category statistics.

Response:
```json
{
  "success": true,
  "categories": [
    {
      "session_id": "agent-myapp-1234",
      "command_category": "npm",
      "count": 10,
      "avg_duration": 2500,
      "first_execution": "2025-11-14T20:23:00Z",
      "last_execution": "2025-11-14T20:45:00Z"
    }
  ]
}
```

**GET `/api/sessions/:id/file-tree`**

Build hierarchical file tree from file operations.

Response:
```json
{
  "success": true,
  "tree": {
    "name": "root",
    "type": "directory",
    "children": [
      {
        "name": "src",
        "type": "directory",
        "children": [
          {
            "name": "index.ts",
            "type": "file",
            "operations": 15,
            "reads": 8,
            "writes": 5,
            "edits": 2,
            "lastModified": "2025-11-14T20:45:00Z"
          }
        ]
      }
    ]
  }
}
```

## Server-Sent Events

**GET `/api/events/stream`**

Real-time event stream using Server-Sent Events.

Query parameters:
- `session` - Filter events by session ID

Connection:
```javascript
const eventSource = new EventSource('http://localhost:3001/api/events/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

Event format:
```json
{
  "type": "event",
  "data": {
    "id": 156,
    "session_id": "agent-myapp-1234",
    "timestamp": "2025-11-14T20:45:10Z",
    "event_type": "file_op",
    "file_path": "/path/to/file.ts",
    "operation": "write"
  }
}
```

## Configuration

Environment variables:
- `PORT` - Server port (default: 3001)

Database:
- Path: `../data/viz-data.db`
- Shared with monitor daemon (read-only for server)

## Testing

```bash
# Start server
npm run dev

# In another terminal, run tests
npm test
```

Test script validates:
- All REST endpoints return data
- SSE connection works
- Filtering and pagination
- Error handling

## Integration

The server integrates with:

1. **Monitor Daemon** (`viz/monitor/`) - Writes events to database
2. **Web Dashboard** (`viz/web/`) - Consumes REST API + SSE

The server is read-only - it queries the database but never modifies it. The monitor daemon has exclusive write access.

## Performance

- Database uses WAL mode for concurrent reads
- SSE polling: 1 second interval
- Query limits: Default 1000 events, configurable
- Indexes on: session_id, timestamp, file_path, command_category

## Error Handling

- 404: Session not found
- 500: Database errors (logged to console)
- SSE: Auto-cleanup on client disconnect
- Graceful shutdown: Ctrl+C closes database connection
