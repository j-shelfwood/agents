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
