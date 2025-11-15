# Session Correlation System

Links agent session names to copilot session UUIDs by matching spawn timestamps and verifying project directories.

## Components

### 1. `time-utils.js`
Time-related utility functions for timestamp comparison and delays.

**Functions:**
- `withinTimeWindow(time1, time2, windowMs)` - Check if timestamps are within window
- `parseTimestamp(isoString)` - Parse ISO timestamp to milliseconds
- `sleep(ms)` - Async sleep utility

### 2. `session-correlator.js`
Core correlation logic that matches agent sessions to copilot sessions.

**Class:** `SessionCorrelator`

**Methods:**
- `findCopilotSession(agentMetadata)` - Find copilot UUID for agent session
- `getRecentSessions()` - Get recent copilot sessions (last 24 hours)
- `isSessionActive(sessionUuid)` - Check if session is still active

**Algorithm:**
1. Match spawn timestamp ±5 seconds
2. Verify project directory from file operations
3. Return copilot session UUID

### 3. `metadata-watcher.js`
Monitors agent metadata directory for new agent spawns.

**Class:** `MetadataWatcher`

**Methods:**
- `watch(onNewAgent)` - Watch for new metadata files
- `getExistingAgents()` - Read all existing metadata files
- `stop()` - Stop watching

### 4. `correlate-session.js`
High-level integration that combines watcher and correlator.

**Functions:**
- `startCorrelation(onCorrelated, options)` - Start monitoring and correlating
- `correlateSingleSession(agentMetadata, options)` - One-time correlation

## Usage

### Continuous Monitoring

```javascript
const { startCorrelation } = require('./correlate-session');

const watcher = startCorrelation(
  (agentSessionId, copilotUuid, metadata) => {
    console.log(`Agent ${agentSessionId} → Copilot ${copilotUuid}`);
  }
);

// Later, to stop:
await watcher.stop();
```

### One-Time Correlation

```javascript
const { correlateSingleSession } = require('./correlate-session');

const agentMetadata = {
  session_id: 'agent-myapp-1234',
  spawned_at: '2025-11-14T18:08:23Z',
  project_dir: '/Users/me/projects/myapp'
};

const copilotUuid = await correlateSingleSession(agentMetadata);
console.log('Copilot session:', copilotUuid);
```

### Demo Script

```bash
node examples/demo-correlation.js
```

## Configuration

All functions accept optional configuration:

```javascript
startCorrelation(onCorrelated, {
  metadataDir: '~/projects/shelfwood-agents/agent/metadata',
  copilotStateDir: '~/.copilot/session-state',
  correlationDelay: 10000  // Wait 10s for copilot initialization
});
```

## Testing

Run tests with Jest:

```bash
npm test
```

**Test files:**
- `tests/time-utils.test.js` - Time utility functions
- `tests/session-correlator.test.js` - Correlation logic
- `tests/metadata-watcher.test.js` - File system watcher

## Implementation Notes

- **Timestamp matching:** ±5 second window to account for initialization time
- **Project verification:** Critical for accuracy - prevents false positives
- **Wait delay:** 10 seconds after agent spawn for copilot to create events
- **File operations:** Checks `view`, `edit`, `create` tool executions

## Dependencies

- `chokidar` - File system watching
- Built-in Node.js modules: `fs`, `path`, `os`

## Architecture

```
correlate-session.js (Integration)
    ├── metadata-watcher.js (Detect new agents)
    │   └── chokidar (File watching)
    └── session-correlator.js (Match sessions)
        └── time-utils.js (Timestamp comparison)
```

## Error Handling

- Invalid JSONL: Warns and continues to next session
- Missing files: Returns null instead of throwing
- Parse errors: Logs warning, continues processing
- Watcher errors: Logged to console.error
