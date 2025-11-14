# Shelfwood Agents Roadmap

## Phase 1: Foundation ✅ COMPLETE

- [x] Agent management CLI (bash scripts)
- [x] MCP server for Claude Code integration
- [x] Metadata tracking system
- [x] Repository organization
- [x] Documentation

## Phase 2: Visualization System (Next)

### Week 1: Data Collection Infrastructure

**Deliverables:**
- [ ] Monitor daemon (`viz/monitor/index.js`)
  - [ ] Session correlator (link agent sessions → copilot sessions)
  - [ ] JSONL parser (parse `~/.copilot/session-state/*.jsonl`)
  - [ ] Event transformer (categorize commands, extract file ops)
  - [ ] Event store (SQLite schema + persistence layer)

**Tech Stack:**
- Node.js (consistency with MCP server)
- chokidar (file watching)
- SQLite (event storage for replay)
- Event-driven architecture

**Database Schema:**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  copilot_session_id TEXT,
  project_dir TEXT,
  spawned_at DATETIME,
  status TEXT
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  session_id TEXT,
  timestamp DATETIME,
  event_type TEXT,      -- 'tool_start', 'tool_complete', 'file_op', 'command'
  tool_name TEXT,
  file_path TEXT,
  operation TEXT,       -- 'read', 'write', 'edit'
  command TEXT,
  command_category TEXT, -- 'git', 'npm', 'brew', etc.
  status TEXT,
  duration_ms INTEGER,
  source TEXT,          -- 'tmux' or 'jsonl'
  raw_data JSON
);
```

### Week 2: Real-time Transport

**Deliverables:**
- [ ] Web server (`viz/server/index.js`)
  - [ ] Express server
  - [ ] Server-Sent Events endpoint (`/api/events/stream`)
  - [ ] REST API for historical data
  - [ ] Event subscription system

**Endpoints:**
```javascript
GET  /api/events/stream              // SSE real-time events
GET  /api/sessions                   // List all sessions
GET  /api/sessions/:id/events        // Session event log
GET  /api/sessions/:id/stats         // Aggregated statistics
GET  /api/sessions/:id/file-tree     // File operation hierarchy
```

### Week 3-4: Web Dashboard

**Deliverables:**
- [ ] React + Vite app (`viz/web/`)
  - [ ] Agent list sidebar (active sessions)
  - [ ] D3.js file tree visualization
  - [ ] Command timeline (Recharts)
  - [ ] Activity heatmap
  - [ ] Session replay controls

**Components:**
```
viz/web/src/
├── components/
│   ├── AgentList.jsx           # Sidebar with active agents
│   ├── FileTree.jsx            # D3 tree with activity colors
│   ├── CommandTimeline.jsx     # Horizontal timeline
│   ├── ActivityHeatmap.jsx     # File modification frequency
│   └── SessionReplay.jsx       # Historical playback UI
├── hooks/
│   ├── useEventStream.js       # SSE connection
│   └── useSessionData.js       # API data fetching
└── utils/
    ├── fileTreeBuilder.js      # Hierarchical data transform
    └── commandCategorizer.js   # Command classification
```

**Visualization Features:**
- **File Tree**: Nodes sized by activity, colored by operation type (read/write/edit)
- **Timeline**: Commands plotted on time axis, categorized by type
- **Heatmap**: Grid of files with color intensity showing modification frequency
- **Replay**: Scrub through session history, see file changes over time

### Week 5: Integration & Polish

**Deliverables:**
- [ ] Daemon auto-start (launchd service)
- [ ] CLI integration (`agent viz start/stop/open`)
- [ ] Performance optimization
- [ ] Error handling & logging
- [ ] User testing & refinement

## Phase 3: Advanced Features (Future)

### Enhanced Monitoring
- [ ] Real-time performance metrics (CPU, memory per agent)
- [ ] Agent health scoring
- [ ] Automatic anomaly detection
- [ ] Slack/webhook notifications

### Collaboration Features
- [ ] Share agent session recordings
- [ ] Export sessions to video (using ttyrec/asciinema)
- [ ] Annotate sessions with comments
- [ ] Compare sessions side-by-side

### AI-Powered Analysis
- [ ] Automatically categorize agent work patterns
- [ ] Suggest similar past sessions when spawning
- [ ] Detect inefficient workflows
- [ ] Generate work summaries from session data

### Developer Experience
- [ ] VS Code extension (view agents in sidebar)
- [ ] Browser extension (monitor from any page)
- [ ] Mobile app (monitor agents on-the-go)
- [ ] ChatGPT plugin (query agent activity)

## Phase 4: Open Source (Potential)

- [ ] Anonymize and sanitize codebase
- [ ] Create public documentation
- [ ] Setup CI/CD pipeline
- [ ] Package for npm/brew
- [ ] Community engagement

## Data Sources Available

### Primary: Copilot Session State (Structured)
Location: `~/.copilot/session-state/<uuid>.jsonl`

Format: JSON Lines (newline-delimited JSON)

Events:
- `session.start` - Session initialization
- `session.info` - Auth, MCP connections
- `user.message` - User prompts
- `assistant.message` - Agent responses + tool requests
- `tool.execution_start` - Tool call initiated
- `tool.execution_complete` - Tool finished with results

**Extractable Data:**
- Tool names (`view`, `shell`, `edit_file`, etc.)
- Tool arguments (file paths, commands, parameters)
- Timestamps (millisecond precision)
- Success/failure status
- Tool output/results
- Parent-child event relationships

### Secondary: tmux Output (Real-time)
Mechanism: `tmux capture-pane -p`

Advantages:
- Near-instant updates (<500ms latency)
- No dependency on Copilot internals

Disadvantages:
- Unstructured text output
- Requires pattern matching
- Less reliable for parsing

Usage: Quick UI updates, reconciled with JSONL later

### Tertiary: Agent Metadata
Location: `~/projects/shelfwood-agents/agent/metadata/<session>.json`

Content:
- Session identification
- Project directory
- Task file path
- Spawn timestamp
- Importance level
- PID

Usage: Correlate copilot sessions to agent sessions

## Technical Decisions

### Why Not WebSockets?
Server-Sent Events (SSE) chosen because:
- Simpler protocol (one-way push)
- Native browser support
- Automatic reconnection
- HTTP/2 compatible
- Sufficient for visualization use case

### Why SQLite?
- Lightweight (no separate database server)
- File-based (portable with project)
- Excellent query performance for analytics
- Built-in with Node.js (via better-sqlite3)
- Perfect for session replay feature

### Why D3.js over Chart.js?
- More flexible for custom visualizations
- Better support for hierarchical data (file trees)
- Powerful force-directed graphs
- Large ecosystem of examples
- Can mix with Recharts for simpler charts

## Success Criteria

### Phase 2 Complete When:
- [x] Monitor daemon running as background service
- [x] All active agent sessions being tracked
- [x] Real-time events flowing to web dashboard
- [x] File tree visualization showing activity
- [x] Command timeline populated
- [x] Session replay functional

### Phase 3 Complete When:
- [ ] Used visualization for 30+ agent sessions
- [ ] Identified 3+ workflow improvements from analytics
- [ ] Shared session recording with team member
- [ ] Zero crashes in 7-day continuous operation

## Notes

- Prioritize real-time monitoring over historical analysis
- Keep visualization performant (60fps animations)
- Maintain backward compatibility with existing agent CLI
- Design for extensibility (plugin system later)
- Document everything for future open-sourcing

---

Last Updated: 2025-11-14
