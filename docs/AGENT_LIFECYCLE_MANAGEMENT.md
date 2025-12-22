# Agent Lifecycle Management

**Feature:** Inactivity-based auto-shutdown for agent sessions
**Status:** Implemented (Phase 1)
**Date:** December 9, 2025

---

## Overview

Agents now support automatic shutdown after periods of inactivity, preventing zombie session accumulation and resource leaks.

**Key Features:**
- Configurable TTL (time-to-live) per agent
- Background watchdog daemon monitors all agents
- Activity tracking via tmux output changes
- Critical importance exemption
- Manual override with --no-ttl flag

---

## Usage

### Launching Agents with TTL

```bash
# Default TTL: 60 minutes
agent launch ~/projects/myapp tasks/refactor.md

# Custom TTL: 180 minutes (3 hours)
agent launch ~/projects/myapp tasks/long-task.md --ttl 180

# Disable TTL for long-running tasks
agent launch ~/projects/myapp tasks/migration.md --no-ttl

# Critical importance (exempt from auto-kill)
agent launch ~/projects/myapp tasks/production.md --importance critical
```

### Managing Watchdog Daemon

```bash
# Start watchdog (monitors all agents)
agent watchdog start

# Check watchdog status
agent watchdog status

# View watchdog activity log
tail -f ~/.local/share/copilot-agent/watchdog.log

# Stop watchdog
agent watchdog stop

# Restart watchdog
agent watchdog restart
```

---

## How It Works

### 1. TTL Configuration

When launching an agent:
- `--ttl N`: Sets TTL to N minutes (converted to seconds internally)
- `--no-ttl`: Sets TTL to 0 (disabled)
- Default: 60 minutes if not specified

Stored in metadata:
```json
{
  "ttl_seconds": 3600,
  "ttl_enabled": true,
  "last_activity": "2025-12-09T22:30:00Z"
}
```

### 2. Activity Detection

Watchdog monitors agent activity using semantic hashing:
1. Captures tmux pane output
2. Strips ANSI escape codes (colors, formatting)
3. Removes blank lines
4. Computes MD5 hash of clean output
5. Compares hash with previous check
6. If hash changed → activity detected → update `last_activity` timestamp

**Activity triggers:**
- Tool execution output
- Command results
- Agent thinking/response generation
- Meaningful text changes (ignores UI chrome, progress bars, timestamps)

### 3. Inactivity Calculation

```
current_time - last_activity > ttl_seconds → AUTO-KILL
```

Watchdog checks every 60 seconds:
- Calculates `inactive_seconds = now - last_activity`
- If `inactive_seconds > ttl_seconds`: kill agent
- If output changed: reset `last_activity` to now

### 4. Auto-Kill Process

When TTL exceeded:
1. Log: `"Auto-killing {session} (TTL exceeded)"`
2. Kill tmux session: `tmux kill-session -t {session}`
3. Update metadata: `status = "auto_killed_ttl"`
4. Archive metadata to: `~/.local/share/copilot-agent/metadata/archive/`

### 5. Exemptions

Agents NOT auto-killed if:
- `ttl_enabled = false` (launched with --no-ttl)
- `importance = "critical"` (launched with --importance critical)
- `ttl_seconds = 0` (disabled)

---

## Metadata Structure

### Before TTL Feature
```json
{
  "session_id": "agent-myapp-1234",
  "spawned_at": "2025-12-09T20:00:00Z",
  "last_activity": "2025-12-09T20:00:00Z",
  "importance": "normal"
}
```

### With TTL Feature
```json
{
  "session_id": "agent-myapp-1234",
  "spawned_at": "2025-12-09T20:00:00Z",
  "last_activity": "2025-12-09T20:15:00Z",
  "ttl_seconds": 3600,
  "ttl_enabled": true,
  "importance": "normal",
  "output_hash": "a3b2c1d4e5f6...",
  "status": "running"
}
```

**New Fields:**
- `ttl_seconds`: TTL in seconds (TTL_MINUTES * 60)
- `ttl_enabled`: Boolean, false if --no-ttl used
- `output_hash`: MD5 hash of recent tmux output (for activity detection)

**Updated Fields:**
- `last_activity`: Updated when output changes detected
- `status`: Set to "auto_killed_ttl" on auto-shutdown

---

## Watchdog Daemon

### Implementation

**Location:** `agent/agent-watchdog`

**Process Model:**
- Runs as background daemon (nohup bash process)
- PID stored in: `~/.local/share/copilot-agent/watchdog.pid`
- Logs to: `~/.local/share/copilot-agent/watchdog.log`
- Output to: `~/.local/share/copilot-agent/watchdog.out` (errors)

**Check Loop:**
```
Every 60 seconds:
  For each active agent:
    1. Check if tmux session exists
    2. Get current output hash
    3. Compare with stored hash
    4. If changed: update last_activity
    5. Calculate inactivity duration
    6. If exceeded TTL: auto-kill
```

### Log Format

```
[2025-12-09 22:30:57] Watchdog daemon started (PID: 90598, interval: 60s)
[2025-12-09 22:31:57] Agent myapp-1234 - activity detected, TTL reset
[2025-12-09 22:45:00] Agent myapp-5678 inactive for 3720s (TTL: 3600s) - AUTO-KILL
[2025-12-09 22:45:00] Auto-killing myapp-5678 (TTL exceeded)
[2025-12-09 22:46:00] Agent myapp-9012 - tmux session missing, cleaning metadata
```

### Daemon Management

**Start automatically on system boot** (optional):

#### macOS (launchd)
```bash
# Create plist file
cat > ~/Library/LaunchAgents/com.shelfwood.agent-watchdog.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.shelfwood.agent-watchdog</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/your username/.local/share/copilot-agent/bin/agent</string>
        <string>watchdog</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/yourusername/.local/share/copilot-agent/watchdog.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/yourusername/.local/share/copilot-agent/watchdog.err</string>
</dict>
</plist>
EOF

# Load service
launchctl load ~/Library/LaunchAgents/com.shelfwood.agent-watchdog.plist

# Check status
launchctl list | grep agent-watchdog
```

#### Linux (systemd)
```bash
# Create service file
sudo tee /etc/systemd/system/agent-watchdog.service << 'EOF'
[Unit]
Description=Agent Lifecycle Watchdog
After=network.target

[Service]
Type=simple
User=yourusername
ExecStart=/home/yourusername/.local/share/copilot-agent/bin/agent watchdog start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl enable agent-watchdog
sudo systemctl start agent-watchdog

# Check status
sudo systemctl status agent-watchdog
```

---

## Operational Scenarios

### Scenario 1: Forgotten Agent (Solved)

**Before TTL:**
```
User: Launch 5 research agents
[Agents complete work]
User: Gets interrupted, forgets about them
Result: 5 zombie sessions running indefinitely
```

**With TTL:**
```
User: Launch 5 research agents (default 60min TTL)
[Agents complete work at T+10min]
[Agents idle for 60 minutes]
Watchdog: Auto-kills all 5 agents at T+70min
Result: Clean shutdown, no zombies
```

### Scenario 2: Long-Running Task

**Problem:** Migration task needs 3 hours

**Solution:**
```bash
# Option 1: Extended TTL
agent launch ~/project tasks/migration.md --ttl 240  # 4 hours

# Option 2: Disable TTL
agent launch ~/project tasks/migration.md --no-ttl

# Option 3: Critical importance (also disables auto-kill)
agent launch ~/project tasks/migration.md --importance critical
```

### Scenario 3: Debugging Workflow

**Problem:** Need to check agent progress tomorrow

**Solution:**
```bash
# Launch with extended TTL
agent launch ~/project tasks/investigation.md --ttl 1440  # 24 hours

# Check back tomorrow
agent status investigation-session
agent read investigation-session
```

### Scenario 4: Production Critical Agent

**Problem:** Production monitoring agent must never auto-kill

**Solution:**
```bash
agent launch ~/project tasks/monitor-prod.md --importance critical --no-ttl
```

Watchdog will skip this agent entirely.

---

## Backward Compatibility

### Legacy Agents

Agents created before TTL feature:
- Missing `ttl_seconds` and `ttl_enabled` fields
- Watchdog treats as `ttl_enabled = false`
- Never auto-killed (safe default)

### Migration

No migration needed! Existing agents continue running until manually killed.

New agents automatically get TTL (default 60min unless overridden).

---

## Configuration

### Default TTL

Edit `agent/agent-launch` line 69:
```bash
TTL_MINUTES=60  # Change default TTL here
```

### Watchdog Check Interval

Edit `agent/agent-watchdog` line 23:
```bash
CHECK_INTERVAL=60  # Seconds between checks
```

**Note:** Shorter interval = more CPU usage but faster response to inactivity.

---

## Troubleshooting

### Agent killed prematurely

**Symptom:** Agent auto-killed while still working

**Diagnosis:**
```bash
# Check agent metadata
cat ~/.local/share/copilot-agent/metadata/{session}.json | jq '.ttl_seconds, .last_activity'

# Check watchdog log
grep "{session}" ~/.local/share/copilot-agent/watchdog.log
```

**Cause:** Agent thinking without producing output

**Solution:** Launch with longer TTL or --no-ttl

### Watchdog not auto-killing

**Symptom:** Idle agent not killed after TTL

**Diagnosis:**
```bash
# Check watchdog running
agent watchdog status

# Check agent has TTL enabled
cat ~/.local/share/copilot-agent/metadata/{session}.json | jq '.ttl_enabled'

# Check watchdog log for agent
grep "{session}" ~/.local/share/copilot-agent/watchdog.log
```

**Possible causes:**
- Watchdog not running: `agent watchdog start`
- Agent has `ttl_enabled = false`: Expected behavior
- Agent marked `importance = critical`: Expected behavior

### Watchdog daemon crashes

**Diagnosis:**
```bash
# Check watchdog output
cat ~/.local/share/copilot-agent/watchdog.out

# Check for errors
tail -20 ~/.local/share/copilot-agent/watchdog.log
```

**Solution:** Restart watchdog
```bash
agent watchdog restart
```

---

## Future Enhancements (Not Implemented)

### Phase 2: State Machine (Planned)
- `ACTIVE`, `THINKING`, `IDLE`, `STALE` states
- Progressive warnings before auto-kill
- State transition logging

### Phase 3: Checkpoint/Resume (Planned)
- Save conversation history on kill
- Resume from checkpoint
- Preserve work-in-progress

### Phase 4: Advanced Detection (Planned)
- Loop detection (same output repeating)
- Stuck detection (no tool calls for X minutes)
- Smart TTL adjustment based on task type

---

## Summary

**Implemented:** Inactivity-based auto-shutdown (Phase 1)

**Key Benefits:**
- Prevents zombie session accumulation
- Configurable per-agent TTL
- Background monitoring (no manual intervention)
- Backward compatible with existing agents
- Exempt critical/long-running tasks

**Status:** Production ready, watchdog tested and verified

**Next Steps:**
- Monitor watchdog logs for false positives
- Adjust default TTL based on usage patterns
- Consider implementing Phase 2 (state machine) if needed

---

## Version History

**2025-12-09:** Phase 1 implementation complete
- Added TTL parameter to agent-launch
- Created agent-watchdog daemon
- Implemented activity tracking via tmux output hashing
- Tested and verified auto-shutdown functionality
