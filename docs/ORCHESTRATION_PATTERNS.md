# Agent Orchestration Patterns

## Core Principle: Event-Driven Monitoring

The agent system uses **event-driven monitoring** via `await_agents()`.

> **⚠️ DEPRECATION NOTICE**: `await_agents()` is deprecated. Use `await_agents()` instead.
> `await_agents()` will be removed in v2.0.0.

### Golden Rule

**ALWAYS use `await_agents()` after launching agents. NEVER manually poll.**

## Pattern: Parallel Agent Execution

```javascript
// ✅ CORRECT PATTERN

// 1. Launch all agents first (parallel spawn)
mcp__agent__launch_agent({project_dir: "/path/a", task_file: "task1.md"});
mcp__agent__launch_agent({project_dir: "/path/b", task_file: "task2.md"});
mcp__agent__launch_agent({project_dir: "/path/c", task_file: "task3.md"});

// 2. Event loop: watch → handle → repeat
let active_agents = 3;
while (active_agents > 0) {
  // BLOCKS until any agent needs attention
  const result = mcp__agent__await_agents({timeout: 600});

  // Result format example:
  // "Session: agent-a-123
  //  Status: WAITING_FOR_INPUT
  //  Time: 45s since watch started"

  // 3. Handle the specific agent that triggered
  if (result.includes("WAITING_FOR_INPUT")) {
    const session = extract_session_name(result);
    mcp__agent__send_to_agent({
      session_name: session,
      message: "Continue with option A"
    });
  } else if (result.includes("COMPLETED")) {
    const session = extract_session_name(result);
    mcp__agent__read_agent_output({session_name: session, lines: 100});
    mcp__agent__kill_agent({session_name: session});
    active_agents--;
  } else if (result.includes("ERROR")) {
    const session = extract_session_name(result);
    mcp__agent__read_agent_output({session_name: session, lines: 200});
    // Analyze error and decide action (retry, kill, modify task)
    mcp__agent__kill_agent({session_name: session});
    active_agents--;
  }
}
```

## Anti-Pattern: Manual Polling

### ❌ NEVER DO THIS

```javascript
// WRONG: Manual polling loop
mcp__agent__launch_agent({project_dir: "/path", task_file: "task.md"});

// ❌ Fixed delays waste resources
sleep(45);
mcp__agent__check_agent_status({session_name: "agent-123"});
mcp__agent__check_agent_status({session_name: "agent-123"});
mcp__agent__check_agent_status({session_name: "agent-123"});

sleep(30);
mcp__agent__check_agent_status({session_name: "agent-123"});
mcp__agent__read_agent_output({session_name: "agent-123"});

// ... repeating indefinitely
```

### Why This is Wrong

| Issue | Impact |
|-------|--------|
| **Missed events** | State changes between checks go unnoticed |
| **Resource waste** | Polling every N seconds vs event-driven notification |
| **Race conditions** | Agent might be waiting while you sleep |
| **Complexity** | Manual loop vs single blocking call |
| **Timing problems** | Fixed delays either too short (CPU waste) or too long (latency) |

## await_agents() Behavior

### Blocking Semantics

```bash
agent await --timeout 300 --interval 3
```

**Execution flow:**
1. **T+0**: Start monitoring, capture initial state
2. **T+0**: Check for pre-existing states (COMPLETED, WAITING, ERROR)
3. **If found**: Return immediately with "Time: 0s (pre-existing state)"
4. **Else**: Enter event loop, poll every `interval` seconds
5. **On state change**: Return immediately with details
6. **On timeout**: Return timeout status (exit code 2, not an error)

### Return Triggers

| Trigger | Detection Method | Example |
|---------|------------------|---------|
| **Agent completes** | tmux session terminates | Task finished successfully |
| **Waiting for input** | Prompt pattern detected | `(y/n)?`, `Continue?`, `Choose:` |
| **Agent errors** | Error keywords in output | `error:`, `failed`, `exception` |
| **Timeout reached** | Exceeds `timeout` parameter | All agents still running after 300s |

### Prompt Detection Patterns

The following patterns trigger `WAITING_FOR_INPUT` status:

```regex
\(y/n\)           # Permission prompts
\?$               # Questions ending with ?
continue\?        # Continue prompts
proceed\?         # Proceed confirmations
waiting           # Explicit "waiting" keyword
allow             # Permission requests
confirm           # Confirmation prompts
choose            # Choice prompts
```

### Error Detection Patterns

The following patterns trigger `ERROR` status:

```regex
error:            # Error messages
failed            # Failure indicators
exception         # Exception traces
fatal             # Fatal errors
cannot            # Cannot/unable operations
unable to         # Inability messages
```

## Performance Comparison

| Approach | Detection Latency | CPU Usage | Race Conditions | Multi-Agent |
|----------|-------------------|-----------|-----------------|-------------|
| **await_agents** | <3s (default interval) | Minimal | ✅ Handled | ✅ Yes (monitors all) |
| **Manual polling** | 30-60s (typical) | High | ❌ Vulnerable | ❌ No (one-by-one) |

## Real-World Example: Wave-Based Refactoring

```javascript
// Task: Refactor codebase in 3 waves (dependency order)

// WAVE 1: Core protocol updates (parallel)
mcp__agent__launch_agent({
  project_dir: "/project",
  task_file: "wave1-instrument.md"
});
mcp__agent__launch_agent({
  project_dir: "/project",
  task_file: "wave1-effects.md"
});

// Wait for Wave 1 to complete
console.log("Waiting for Wave 1...");
let wave1_remaining = 2;
while (wave1_remaining > 0) {
  const result = mcp__agent__await_agents({timeout: 600});

  if (result.includes("WAITING_FOR_INPUT")) {
    // Approve any permission requests
    const session = extract_session(result);
    mcp__agent__approve_agent_prompt({session_name: session, approve: true});
  } else if (result.includes("COMPLETED")) {
    wave1_remaining--;
  }
}

// WAVE 2: Arrangement layer (depends on Wave 1)
mcp__agent__launch_agent({
  project_dir: "/project",
  task_file: "wave2-clips.md"
});
mcp__agent__launch_agent({
  project_dir: "/project",
  task_file: "wave2-tracks.md"
});

// Wait for Wave 2
let wave2_remaining = 2;
while (wave2_remaining > 0) {
  const result = mcp__agent__await_agents({timeout: 600});
  // ... handle events
  if (result.includes("COMPLETED")) wave2_remaining--;
}

// WAVE 3: Integration (depends on Wave 2)
mcp__agent__launch_agent({
  project_dir: "/project",
  task_file: "wave3-integration.md"
});

// Final wait
mcp__agent__await_agents({timeout: 900});
console.log("Refactoring complete!");
```

## Tool Selection Guide

| Scenario | Use | NOT |
|----------|-----|-----|
| After launching agents | `await_agents()` | Manual polling with `check_agent_status` |
| Waiting for completion | `await_agents()` (blocks efficiently) | `sleep` + `check_agent_status` loop |
| Multi-agent orchestration | `await_agents()` (monitors all simultaneously) | Individual status checks in sequence |
| One-time status inquiry | `check_agent_status()` (quick snapshot) | `await_agents()` with 1s timeout |
| Quick yes/no approval | `approve_agent_prompt()` | `send_to_agent()` with manual "y"/"n" |

## Migration Guide

### If You're Writing This Pattern

```javascript
sleep(N);
check_agent_status({session_name: "agent-123"});
sleep(N);
check_agent_status({session_name: "agent-123"});
```

### Replace With This

```javascript
await_agents({timeout: N});
// Automatically returns when agent needs attention
// No manual status checks needed
```

### Before → After Example

```javascript
// ❌ BEFORE (inefficient)
launch_agent({...});
sleep(30);
status1 = check_agent_status({session_name: "agent-1"});
sleep(30);
status2 = check_agent_status({session_name: "agent-1"});
if (status2.includes("waiting")) {
  send_to_agent({session_name: "agent-1", message: "yes"});
}
sleep(45);
// ... continues indefinitely

// ✅ AFTER (efficient)
launch_agent({...});
result = await_agents({timeout: 120});
if (result.includes("WAITING_FOR_INPUT")) {
  send_to_agent({session_name: "agent-1", message: "yes"});
}
result = await_agents({timeout: 120});
// Done - no manual checking needed
```

## Common Mistakes

### Mistake 1: Not Using await_agents at All

```javascript
// ❌ WRONG
launch_agent({...});
// ... nothing here, agent runs unmonitored
// User manually checks later
```

**Fix**: Always follow launch with watch.

### Mistake 2: Using await_agents with Constant Timeout Extensions

```javascript
// ❌ WRONG (defeats the purpose)
launch_agent({...});
await_agents({timeout: 60});  // Times out
await_agents({timeout: 60});  // Times out again
await_agents({timeout: 60});  // Times out again
// ... just waiting for time to pass
```

**Fix**: If timing out repeatedly, the agents are actively working. Let them finish. Increase timeout or use `timeout: 0` (infinite).

### Mistake 3: Mixing await_agents with Manual Polling

```javascript
// ❌ WRONG (redundant)
launch_agent({...});
await_agents({timeout: 300});  // Good!
check_agent_status({...});     // Redundant - already know state from await
check_agent_status({...});     // Why are you still polling?
```

**Fix**: Trust await_agents. It returns when state changes. No need for additional checks.

## Advanced: Handling Complex Workflows

### Pattern: Conditional Agent Spawning

```javascript
// Launch initial analysis agent
launch_agent({project_dir: "/app", task_file: "analyze.md"});
const analysis_result = await_agents({timeout: 300});

// Based on analysis, spawn appropriate refactor agents
if (analysis_result.includes("needs_migration")) {
  launch_agent({project_dir: "/app", task_file: "migrate_db.md"});
  launch_agent({project_dir: "/app", task_file: "update_models.md"});
} else {
  launch_agent({project_dir: "/app", task_file: "optimize.md"});
}

// Watch the conditional agents
await_agents({timeout: 600});
```

### Pattern: Error Recovery with Retry

```javascript
let retries = 3;
let success = false;

while (!success && retries > 0) {
  launch_agent({project_dir: "/app", task_file: "flaky_task.md"});
  const result = await_agents({timeout: 180});

  if (result.includes("COMPLETED")) {
    success = true;
  } else if (result.includes("ERROR")) {
    console.log(`Task failed, retries remaining: ${retries - 1}`);
    retries--;
    kill_agent({session_name: extract_session(result)});
  }
}
```

## Summary: The Three Rules

1. **Launch → Watch → Handle → Repeat**
   - Never launch without watching
   - Never manually poll in a loop
   - Always handle state changes immediately

2. **Use `await_agents()` or `await_agents()`**
   - Event-driven, not time-driven
   - Blocks until state change
   - Returns immediately on pre-existing states

3. **Trust the System**
   - Race conditions are handled
   - Pre-existing states are detected
   - Multi-agent monitoring is automatic

---

**See also:**
- `README.md` - Basic usage examples
- `agent/agent-await` - Implementation details
- `mcp-servers/agent/index.js` - MCP tool definitions
