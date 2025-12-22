# Shelfwood Agents

Autonomous agent orchestration system for GitHub Copilot CLI.

## Overview

This repository contains the infrastructure for managing and monitoring autonomous coding agents powered by GitHub Copilot CLI. It consists of two main components:

1. **Agent Management System** (`agent/`) - Bash scripts for launching, monitoring, and controlling agent sessions
2. **MCP Server** (`mcp-servers/agent/`) - Model Context Protocol server for Claude Code integration

## Architecture

```
shelfwood-agents/
├── agent/                      # Agent management CLI
│   ├── agent                   # Main command dispatcher
│   ├── agent-launch            # Launch new agent sessions
│   ├── agent-list              # List active agents
│   ├── agent-await             # Monitor for state changes
│   ├── agent-status            # Check agent state
│   ├── agent-read              # View agent output
│   ├── agent-send              # Send input to agent
│   ├── agent-approve           # Quick y/n responses
│   ├── agent-kill              # Terminate agents
│   ├── agent-cleanup           # Clean up stale sessions
│   ├── agent-resume            # Resume crashed sessions
│   ├── agent-info              # Detailed session info
│   ├── agent-attach            # Interactive tmux attachment
│   ├── agent-metadata          # Metadata management utilities
│   └── metadata/               # Agent session metadata
│
└── mcp-servers/
    └── agent/                  # MCP server for agent orchestration
        ├── index.js            # Main MCP server
        └── package.json        # Dependencies
```

## Installation

### 1. Install Dependencies

```bash
# MCP Server
cd mcp-servers/agent
npm install
```

### 2. Configure Shell Alias

Add to your shell configuration (e.g., `~/.zshrc` or `~/.bashrc`):

```bash
alias agent="/path/to/shelfwood-agents/agent/agent"
```

Replace `/path/to/shelfwood-agents` with your actual installation path.

### 3. Configure Claude Code

Add to Claude Code MCP settings (`mcp_settings.json`):

```json
{
  "mcpServers": {
    "agent": {
      "command": "node",
      "args": [
        "/absolute/path/to/shelfwood-agents/mcp-servers/agent/index.js"
      ],
      "type": "stdio"
    }
  }
}
```

Replace `/absolute/path/to/shelfwood-agents` with your actual installation path.

## Usage

### Basic Commands

```bash
# Launch a new agent
agent launch ~/projects/myapp tasks/refactor.md

# List all active agents
agent list

# Check agent status
agent status agent-myapp-1234

# Read agent output
agent read agent-myapp-1234

# Send message to agent
agent send agent-myapp-1234 "Use Pest framework"

# Wait for state changes (blocks until agent needs attention)
agent await  # Recommended (watch is deprecated)

# Kill agent
agent kill agent-myapp-1234
```

### MCP Tools (from Claude Code)

```javascript
// Launch agent programmatically
mcp__agent__launch_agent({
  project_dir: "/path/to/your/project",
  task_file: "/path/to/your/project/tasks/refactor.md",
  session_name: "refactor-auth"  // optional
});

// Await agents (blocks until state change)
mcp__agent__await_agents({
  timeout: 300,     // 5 minutes
  interval: 3       // check every 3s
});

// List agents
mcp__agent__list_agents();

// Read output
mcp__agent__read_agent_output({
  session_name: "refactor-auth",
  lines: 50
});

// Send input
mcp__agent__send_to_agent({
  session_name: "refactor-auth",
  message: "Use dependency injection"
});

// Quick approve
mcp__agent__approve_agent_prompt({
  session_name: "refactor-auth",
  approve: true  // or false
});

// Kill agent
mcp__agent__kill_agent({
  session_name: "refactor-auth"
});

// Health check
mcp__agent__health_check();
```

## Agent System Design

### Philosophy

- **Autonomous execution** - Agents run without manual confirmation when properly configured
- **Built for automation** - Designed to be orchestrated by Claude Code
- **Git safety guardrails** - Blocks commit/push/merge operations (--deny-tool)
- **Systematic workflows** - Encourages discovery-driven development
- **Explicit directives** - Task files must specify autonomous execution mode

**📘 See [AUTONOMOUS_EXECUTION.md](docs/AUTONOMOUS_EXECUTION.md) for complete guide on enabling autonomous agent behavior.**

### Session Lifecycle

1. **Spawn** - Create detached tmux session with Copilot CLI
2. **Monitor** - Watch for state changes (completion, errors, waiting for input)
3. **Interact** - Send commands or approve actions as needed
4. **Complete** - Review work and terminate session

### Orchestration Patterns

#### ✅ Correct: Event-Driven Monitoring

Use `await_agents()` for efficient event-driven monitoring:

```javascript
// Launch multiple agents in parallel
mcp__agent__launch_agent({project_dir: "/path/a", task_file: "task1.md"});
mcp__agent__launch_agent({project_dir: "/path/b", task_file: "task2.md"});
mcp__agent__launch_agent({project_dir: "/path/c", task_file: "task3.md"});

// Await blocks until first state change (WAITING, COMPLETED, ERROR)
const result1 = mcp__agent__await_agents({timeout: 600});
// → Returns immediately when any agent needs attention

// Handle the specific agent that triggered
mcp__agent__send_to_agent({session_name: "agent-a-123", message: "Continue"});

// Await next event
const result2 = mcp__agent__await_agents({timeout: 600});
// → Returns when another agent changes state

mcp__agent__kill_agent({session_name: "agent-b-456"});

// Continue until all agents handled
const result3 = mcp__agent__await_agents({timeout: 600});
```

#### ❌ Wrong: Manual Polling Anti-Pattern

```javascript
// DON'T DO THIS - wastes resources and misses events!
mcp__agent__launch_agent({...});

// ❌ Manual polling is inefficient
sleep(30);
mcp__agent__check_agent_status({session_name: "..."});
sleep(30);
mcp__agent__check_agent_status({session_name: "..."});
// ... repeating indefinitely

// ✅ Instead: Use await_agents() - it blocks until state change
mcp__agent__await_agents({timeout: 600});
```

**Why `await_agents()` is better:**
- **Event-driven**: Returns immediately when state changes (not on fixed intervals)
- **Resource efficient**: Single blocking call vs repeated polling
- **Handles race conditions**: Detects pre-existing states automatically
- **Multi-agent support**: Monitors all agents simultaneously

**📚 See [docs/examples/claude-code/orchestrate.md](docs/examples/claude-code/orchestrate.md) for comprehensive patterns and examples.**

### Metadata Tracking

Each agent session has metadata stored in `agent/metadata/<session-name>.json`:

```json
{
  "session_id": "agent-myapp-1234",
  "project_dir": "/path/to/project",
  "task_file": "/path/to/task.md",
  "spawned_at": "2025-11-14T18:08:23Z",
  "spawned_by": "claude-code-session-id",
  "status": "running",
  "importance": "normal",
  "pid": 12345,
  "last_activity": "2025-11-14T18:10:00Z",
  "last_output_hash": "a1b2c3d4...",
  "consecutive_stale_checks": 0,
  "ttl_seconds": 3600,
  "ttl_enabled": true
}
```

**Status values:**
- `running` - Agent actively processing
- `waiting_for_input` - Agent at prompt (detected via cursor position)
- `completed` - Task finished (detected via sentinel file or output patterns)
- `error` - Error state detected in output
- `stuck` - No activity for extended period (>= 5 stale checks)
- `active` - Default state while processing

## Testing

Run automated test suite to validate system behavior:

```bash
# Run all tests (105 tests across 4 categories)
make test

# Or run specific test suites
make test-unit          # 16 validation tests
make test-mcp           # 42 Node.js MCP server tests
make test-security      # 15 injection prevention tests
make test-integration   # 32 core command + orchestration tests

# Run tests individually
bats tests/integration/test_orchestration.bats  # 17 orchestration tests
bats tests/integration/test_core_commands.bats  # 15 core command tests
```

Tests validate:
- ✅ Pre-existing state detection (race condition fix)
- ✅ Event-driven monitoring vs manual polling
- ✅ Multi-agent parallel orchestration
- ✅ Command aliases (`await` = `watch`)
- ✅ Usage hints in output

## Contributing

This is a personal infrastructure project. If you find it useful, feel free to fork and adapt to your needs.

## License

MIT
