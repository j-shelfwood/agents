# Visualization System Technical Specification

> **Status:** Discovery complete, ready for implementation
> **Discovery Date:** 2025-11-14
> **Goal:** Real-time monitoring and visualization of agent activity

## Vision

Inspired by [gource.io](https://gource.io), create an interactive visualization system where:
- Agents appear as entities "flying through" project file trees
- File operations trigger visual effects (reads/writes/edits)
- Command execution shows categorized activity (git, npm, brew, etc.)
- Real-time updates as agents work
- Historical replay capability

## Discovery Findings

### Data Sources Available

#### Primary: Copilot Session State (Structured)

**Location:** `~/.copilot/session-state/<session-uuid>.jsonl`

**Format:** JSON Lines (newline-delimited JSON objects)

**Event Types:**
```json
{
  "type": "session.start",
  "data": {
    "sessionId": "d984ce1a-e3c9-40dc-b0d6-908931c224bd",
    "version": 1,
    "producer": "copilot-agent",
    "copilotVersion": "0.0.354",
    "startTime": "2025-11-14T18:08:23.213Z"
  },
  "id": "uuid",
  "timestamp": "2025-11-14T18:08:23.217Z",
  "parentId": null
}

{
  "type": "tool.execution_start",
  "data": {
    "toolCallId": "toolu_vrtx_016et2zEFXpMtiSAg1KuRd5R",
    "toolName": "view",
    "arguments": {
      "path": "/Users/shelfwood/Projects/myapp/src/index.ts"
    }
  },
  "id": "uuid",
  "timestamp": "2025-11-14T18:08:34.380Z",
  "parentId": "parent-uuid"
}

{
  "type": "tool.execution_complete",
  "data": {
    "toolCallId": "toolu_vrtx_016et2zEFXpMtiSAg1KuRd5R",
    "success": true,
    "result": {
      "content": "... file contents ..."
    }
  },
  "id": "uuid",
  "timestamp": "2025-11-14T18:08:34.401Z",
  "parentId": "tool-start-uuid"
}
```

**Complete Event Taxonomy:**
- `session.start` - Session initialization
- `session.info` - Authentication, MCP connections
- `user.message` - User prompts/inputs
- `assistant.message` - Agent responses (includes `toolRequests` array)
- `tool.execution_start` - Tool call initiated
- `tool.execution_complete` - Tool execution finished

**Tool Names Observed:**
- `view` / `read_file` - File reads
- `edit_file` / `write_file` - File modifications
- `shell` / `bash` - Command execution
- `report_intent` - Agent status updates
- MCP tools (custom tool names)

**Extractable Information:**
- ✅ Tool name and arguments
- ✅ File paths (for file operations)
- ✅ Commands (for shell operations)
- ✅ Timestamps (millisecond precision)
- ✅ Success/failure status
- ✅ Tool output/results
- ✅ Event relationships (via parentId)
- ✅ Duration (calculate from start→complete)

#### Secondary: tmux Output (Real-time)

**Mechanism:** `tmux capture-pane -p -S -20`

**Characteristics:**
- Latency: <500ms
- Format: Unstructured text
- Requires pattern matching

**Observable Patterns:**
- `⏺ shell(command)` - Command execution
- `⏺ read_file(path)` - File read
- `✓ Tool completed` - Success
- `✗ Error: ...` - Failure

**Usage:** Fast path for immediate UI updates, later reconciled with JSONL

#### Tertiary: Agent Metadata

**Location:** `~/projects/shelfwood-agents/agent/metadata/<session-name>.json`

**Schema:**
```json
{
  "session_id": "agent-myapp-1234",
  "copilot_session_id": null,  // Linked after correlation
  "project_dir": "/Users/shelfwood/Projects/myapp",
  "task_file": "/path/to/task.md",
  "spawned_at": "2025-11-14T18:08:23Z",
  "spawned_by": "claude-code-session-id",
  "status": "running",
  "importance": "normal",
  "pid": 12345,
  "last_activity": "2025-11-14T18:10:00Z"
}
```

**Usage:** Correlation key to link agent sessions → copilot sessions

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Agent Spawned (tmux session)                                │
│ └─ Metadata created: agent/metadata/<session>.json          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ Copilot CLI Running                                          │
│ └─ Writing to: ~/.copilot/session-state/<uuid>.jsonl        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ Monitor Daemon (viz/monitor/index.js)                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Session Correlator                                      │ │
│ │ - Watches agent/metadata/ for new spawns               │ │
│ │ - Matches spawn timestamp ± 5s to copilot session      │ │
│ │ - Links agent session ID → copilot UUID                │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Dual-Source Event Collection                           │ │
│ │                                                         │ │
│ │ Fast Path (Real-time):                                 │ │
│ │ └─ tmux capture-pane every 500ms                       │ │
│ │ └─ Parse ⏺ markers for preliminary events              │ │
│ │ └─ Emit immediately to UI                              │ │
│ │                                                         │ │
│ │ Canonical Path (Accurate):                             │ │
│ │ └─ Watch ~/.copilot/session-state/*.jsonl (chokidar)  │ │
│ │ └─ Parse structured events on file change              │ │
│ │ └─ Reconcile with tmux events (update/replace)         │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Event Transformer                                       │ │
│ │ - Categorize commands (git, npm, brew, shell, etc.)    │ │
│ │ - Normalize file paths (relative to project)           │ │
│ │ - Calculate durations (start→complete)                 │ │
│ │ - Enrich with agent metadata                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Event Store (SQLite)                                    │ │
│ │ - Persist all events for replay                        │ │
│ │ - Index by session, timestamp, file path               │ │
│ └─────────────────────────────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ Web Server (viz/server/index.js)                            │
│ - Express + Server-Sent Events                              │
│ - REST API for historical data                              │
│ - Event subscription for real-time updates                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ Web Dashboard (viz/web/)                                    │
│ - React + D3.js + Tailwind                                  │
│ - File tree visualization                                   │
│ - Command timeline                                          │
│ - Activity heatmap                                          │
│ - Session replay                                            │
└─────────────────────────────────────────────────────────────┘
```

### Session Correlation Strategy

**Problem:** Agent session name ≠ Copilot session UUID

**Solution:** Timestamp-based matching

```javascript
// When agent spawns
const agentMetadata = {
  session_id: "agent-myapp-1234",
  spawned_at: "2025-11-14T18:08:23.213Z",
  project_dir: "/Users/shelfwood/Projects/myapp"
};

// Wait 5-10 seconds for copilot to create session file
setTimeout(async () => {
  const copilotSessions = await findRecentSessions('~/.copilot/session-state');

  for (const sessionFile of copilotSessions) {
    const sessionData = parseJSONL(sessionFile);
    const sessionStart = sessionData.find(e => e.type === 'session.start');

    // Match on timestamp (±5s) and working directory
    if (withinTimeWindow(sessionStart.timestamp, agentMetadata.spawned_at, 5000)) {
      // Verify working directory matches (check file operations)
      const fileOps = sessionData.filter(e =>
        e.type === 'tool.execution_start' &&
        (e.data.toolName === 'view' || e.data.toolName === 'edit_file')
      );

      const filesInProjectDir = fileOps.some(op =>
        op.data.arguments.path?.startsWith(agentMetadata.project_dir)
      );

      if (filesInProjectDir) {
        // Match found!
        agentMetadata.copilot_session_id = sessionStart.data.sessionId;
        await saveMetadata(agentMetadata);
        return sessionStart.data.sessionId;
      }
    }
  }
}, 10000);
```

## Database Schema

```sql
-- Sessions tracking
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- Agent session name (e.g., "agent-myapp-1234")
  copilot_session_id TEXT UNIQUE,   -- Linked copilot UUID
  project_dir TEXT NOT NULL,
  task_file TEXT,
  spawned_at DATETIME NOT NULL,
  spawned_by TEXT,                  -- Claude Code session ID or "manual"
  status TEXT DEFAULT 'running',    -- 'running', 'stopped', 'crashed'
  importance TEXT DEFAULT 'normal', -- 'normal', 'high', 'critical'
  pid INTEGER,
  last_activity DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Events log
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  copilot_event_id TEXT,            -- Original event ID from JSONL
  parent_event_id TEXT,              -- For tracking event chains

  timestamp DATETIME NOT NULL,
  event_type TEXT NOT NULL,          -- 'tool_start', 'tool_complete', 'file_op', 'command'

  -- Tool execution
  tool_name TEXT,
  tool_call_id TEXT,
  tool_arguments JSON,

  -- File operations
  file_path TEXT,
  operation TEXT,                    -- 'read', 'write', 'edit', 'delete'

  -- Command execution
  command TEXT,
  command_category TEXT,             -- 'git', 'npm', 'brew', 'php', 'shell', 'filesystem'

  -- Status and timing
  status TEXT,                       -- 'pending', 'running', 'success', 'error'
  duration_ms INTEGER,

  -- Source and metadata
  source TEXT NOT NULL,              -- 'tmux' or 'jsonl'
  raw_data JSON,                     -- Original event data for debugging

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_events_session_time ON events(session_id, timestamp);
CREATE INDEX idx_events_file ON events(file_path) WHERE file_path IS NOT NULL;
CREATE INDEX idx_events_command ON events(command_category) WHERE command_category IS NOT NULL;
CREATE INDEX idx_events_tool_call ON events(tool_call_id) WHERE tool_call_id IS NOT NULL;
CREATE INDEX idx_events_type ON events(event_type);

-- File activity aggregation (for heatmap)
CREATE VIEW file_activity AS
SELECT
  session_id,
  file_path,
  COUNT(*) as total_operations,
  SUM(CASE WHEN operation = 'read' THEN 1 ELSE 0 END) as reads,
  SUM(CASE WHEN operation = 'write' THEN 1 ELSE 0 END) as writes,
  SUM(CASE WHEN operation = 'edit' THEN 1 ELSE 0 END) as edits,
  MAX(timestamp) as last_modified
FROM events
WHERE file_path IS NOT NULL
GROUP BY session_id, file_path;

-- Command statistics (for dashboard)
CREATE VIEW command_stats AS
SELECT
  session_id,
  command_category,
  COUNT(*) as count,
  AVG(duration_ms) as avg_duration,
  MIN(timestamp) as first_execution,
  MAX(timestamp) as last_execution
FROM events
WHERE command_category IS NOT NULL
GROUP BY session_id, command_category;
```

## Component Implementation Details

### Monitor Daemon

**File:** `viz/monitor/index.js`

**Responsibilities:**
- Discover new agent spawns
- Correlate agents → copilot sessions
- Parse JSONL events incrementally
- Monitor tmux output for real-time updates
- Transform and store events in SQLite
- Emit events to subscribers

**Key Modules:**
```javascript
import { SessionCorrelator } from './session-correlator.js';
import { JsonlParser } from './jsonl-parser.js';
import { TmuxMonitor } from './tmux-monitor.js';
import { EventStore } from './event-store.js';
import { EventTransformer } from './event-transformer.js';
```

**Startup Sequence:**
1. Initialize SQLite database
2. Watch `~/projects/shelfwood-agents/agent/metadata/*.json`
3. On new file: register session, start correlation
4. After correlation: attach JSONL parser + tmux monitor
5. Stream events to database + subscribers

### Web Server

**File:** `viz/server/index.js`

**Tech Stack:**
- Express.js (HTTP server)
- Server-Sent Events (real-time push)
- better-sqlite3 (database access)

**Endpoints:**
```javascript
// Real-time event stream
GET /api/events/stream
Response: text/event-stream
```
data: {"type":"session_started","session":"agent-myapp-1234"}
data: {"type":"file_op","file":"/path/to/file.ts","operation":"read"}
```

// Historical data
GET /api/sessions
Response: [{ id, project_dir, spawned_at, status, ... }]

GET /api/sessions/:id/events
Response: [{ timestamp, event_type, tool_name, file_path, ... }]

GET /api/sessions/:id/file-tree
Response: {
  name: "myapp",
  children: [
    {
      name: "src",
      children: [...],
      activityCount: 15,
      lastOperation: "write",
      lastTimestamp: "..."
    }
  ]
}

GET /api/sessions/:id/stats
Response: {
  commandsByCategory: { git: 10, npm: 5, shell: 3 },
  filesByActivity: [{ path: "...", operations: 15 }, ...],
  timeline: [{ timestamp: "...", event_type: "..." }, ...]
}
```

### Web Dashboard

**File:** `viz/web/src/App.jsx`

**Component Tree:**
```jsx
<App>
  <Sidebar>
    <AgentList agents={activeAgents} onSelect={setActiveSession} />
  </Sidebar>

  <MainView>
    {view === 'live' && (
      <>
        <FileTree
          events={liveEvents}
          projectDir={session.project_dir}
          highlightRecent={true}
        />
        <CommandTimeline
          events={liveEvents}
          timeWindow="5m"
        />
      </>
    )}

    {view === 'replay' && (
      <SessionReplay
        sessionId={activeSession}
        events={historicalEvents}
        onSeek={setReplayTime}
      />
    )}

    {view === 'heatmap' && (
      <ActivityHeatmap
        files={fileActivity}
        metric="operations"
      />
    )}
  </MainView>
</App>
```

**Key Visualizations:**

#### 1. File Tree (D3.js)
```javascript
// Build hierarchical structure
const hierarchy = d3.hierarchy(fileTreeData);
const tree = d3.tree().size([height, width]);
tree(hierarchy);

// Nodes colored by activity
node.append('circle')
  .attr('r', d => Math.min(10, 3 + d.data.activityCount))
  .attr('fill', d => {
    if (d.data.lastOperation === 'write') return '#ef4444'; // Red
    if (d.data.lastOperation === 'edit') return '#f59e0b';  // Orange
    return '#3b82f6'; // Blue
  })
  .attr('opacity', d => {
    // Fade based on recency (last 1 minute)
    const age = Date.now() - new Date(d.data.lastTimestamp);
    return Math.max(0.3, 1 - (age / 60000));
  });
```

#### 2. Command Timeline (Recharts)
```javascript
<ResponsiveContainer width="100%" height={300}>
  <ScatterChart>
    <XAxis dataKey="timestamp" type="number" domain={['auto', 'auto']} />
    <YAxis dataKey="category" type="category" />
    <Scatter data={commandEvents} fill="#8884d8">
      {commandEvents.map((entry, index) => (
        <Cell key={index} fill={getCategoryColor(entry.category)} />
      ))}
    </Scatter>
  </ScatterChart>
</ResponsiveContainer>
```

#### 3. Activity Heatmap
```javascript
// Grid of files, color intensity = frequency
files.map(file => (
  <div
    key={file.path}
    style={{
      backgroundColor: `rgba(239, 68, 68, ${file.operations / maxOps})`,
      width: cellSize,
      height: cellSize
    }}
    title={`${file.path}: ${file.operations} operations`}
  />
))
```

## Technology Decisions

### Why Server-Sent Events (SSE) over WebSocket?

**Chosen:** SSE

**Reasoning:**
- Simpler protocol (HTTP-based, one-way push)
- Native browser support (`EventSource` API)
- Automatic reconnection
- HTTP/2 compatible
- Sufficient for visualization (no need for bidirectional)
- Easier to debug (standard HTTP tools)

### Why SQLite over PostgreSQL?

**Chosen:** SQLite

**Reasoning:**
- Lightweight (no separate database server)
- File-based (portable with project)
- Excellent query performance for analytics
- Zero configuration
- Perfect for session replay (can copy .db file)
- Built-in JSON support
- `better-sqlite3` has synchronous API (simpler code)

### Why D3.js over Chart.js?

**Chosen:** D3.js (+ Recharts for simple charts)

**Reasoning:**
- More flexible for custom visualizations
- Better support for hierarchical data (file trees)
- Force-directed graphs for complex relationships
- Large ecosystem of examples
- Can use Recharts for standard charts (timelines)
- Industry standard for data visualization

### Why Node.js over Python?

**Chosen:** Node.js

**Reasoning:**
- Consistency with MCP server (already Node.js)
- Better event-driven architecture for real-time
- `chokidar` for file watching (battle-tested)
- Native JSON handling
- Same tech stack for backend + frontend (less context switching)

## Command Categorization Logic

```javascript
function categorizeCommand(command) {
  // Git operations
  if (/^git\s/.test(command)) return 'git';

  // Package managers
  if (/^(npm|yarn|pnpm|bun)\s/.test(command)) return 'npm';
  if (/^(pip|poetry|pipenv)\s/.test(command)) return 'python';
  if (/^composer\s/.test(command)) return 'php';
  if (/^brew\s/.test(command)) return 'brew';

  // Language runtimes
  if (/^(node|deno|bun)\s/.test(command)) return 'nodejs';
  if (/^python\s/.test(command)) return 'python';
  if (/^(php|artisan)\s/.test(command)) return 'php';
  if (/^ruby\s/.test(command)) return 'ruby';

  // Build tools
  if (/^(make|cmake|ninja)\s/.test(command)) return 'build';
  if (/^(webpack|vite|rollup|esbuild)\s/.test(command)) return 'bundler';

  // Testing
  if (/^(jest|vitest|pytest|phpunit|cargo test)\s/.test(command)) return 'test';

  // Filesystem
  if (/^(find|ls|tree|du|df)\s/.test(command)) return 'filesystem';
  if (/^(grep|rg|ag|ack)\s/.test(command)) return 'search';
  if (/^(cat|head|tail|less|more)\s/.test(command)) return 'fileview';

  // System
  if (/^(ps|top|htop|kill)\s/.test(command)) return 'process';
  if (/^(curl|wget|http)\s/.test(command)) return 'network';

  // Default
  return 'shell';
}
```

## Performance Considerations

### Event Processing
- Parse JSONL incrementally (line-by-line)
- Track file read position to avoid re-parsing
- Debounce file watch events (100ms)
- Batch database inserts (100 events)

### UI Rendering
- Virtualize file tree (only render visible nodes)
- Throttle D3 updates (max 10fps for animations)
- Use React.memo for static components
- Implement windowing for timeline (only render visible timespan)

### Database
- Create indexes on frequently queried fields
- Use views for common aggregations
- Implement pagination for large result sets
- Archive old sessions to separate database file

## Testing Strategy

### Unit Tests
- Event parser (JSONL → structured events)
- Command categorizer (command → category)
- File tree builder (flat events → hierarchy)
- Session correlator (timestamp matching)

### Integration Tests
- Monitor daemon (file watch → database)
- Web server (API endpoints + SSE)
- Full pipeline (spawn agent → see in UI)

### Performance Tests
- 1000+ events in single session
- 10+ concurrent agent sessions
- File tree with 10,000+ files
- Timeline with 5,000+ commands

## Deployment

### Development
```bash
# Terminal 1: Monitor daemon
cd ~/projects/shelfwood-agents/viz/monitor
npm run dev

# Terminal 2: Web server
cd ~/projects/shelfwood-agents/viz/server
npm run dev

# Terminal 3: Web UI
cd ~/projects/shelfwood-agents/viz/web
npm run dev
```

### Production
```bash
# Build web UI
cd viz/web && npm run build

# Start everything
cd viz && npm start  # Starts monitor + server, serves built UI
```

### System Service (macOS)
```xml
<!-- ~/Library/LaunchAgents/com.shelfwood.agent-viz.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.shelfwood.agent-viz</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/node</string>
    <string>/Users/shelfwood/projects/shelfwood-agents/viz/monitor/index.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/shelfwood/projects/shelfwood-agents/viz</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/shelfwood/projects/shelfwood-agents/viz/logs/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/shelfwood/projects/shelfwood-agents/viz/logs/stderr.log</string>
</dict>
</plist>
```

## Next Steps for Implementation

1. **Phase 1: Data Collection (Week 1)**
   - [ ] Set up project structure (`viz/monitor`, `viz/server`, `viz/web`)
   - [ ] Implement SQLite schema and event store
   - [ ] Build session correlator
   - [ ] Create JSONL parser with incremental reading
   - [ ] Build event transformer with command categorization
   - [ ] Test with live agent sessions

2. **Phase 2: Real-time Transport (Week 2)**
   - [ ] Set up Express server
   - [ ] Implement SSE endpoint with event subscription
   - [ ] Create REST API for historical data
   - [ ] Test with multiple concurrent subscribers

3. **Phase 3: Web Dashboard (Week 3-4)**
   - [ ] Set up Vite + React + Tailwind
   - [ ] Build agent list sidebar
   - [ ] Implement D3.js file tree visualization
   - [ ] Create command timeline with Recharts
   - [ ] Build activity heatmap
   - [ ] Add session replay controls

4. **Phase 4: Integration (Week 5)**
   - [ ] Add `agent viz` CLI commands
   - [ ] Create launchd service
   - [ ] Performance testing and optimization
   - [ ] Documentation and user guide

## Success Criteria

- [ ] Monitor daemon running continuously without crashes
- [ ] All active agent sessions being tracked
- [ ] Real-time events flowing to web dashboard (<1s latency)
- [ ] File tree visualization showing accurate activity
- [ ] Command timeline populated with categorized commands
- [ ] Session replay functional for historical analysis
- [ ] Performance acceptable with 10+ concurrent agents

---

**Ready for implementation.** This specification contains all technical details needed to build the visualization system.
