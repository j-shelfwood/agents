# Shelfwood Agents

Autonomous agent orchestration system for GitHub Copilot CLI.

## Overview

This repository contains the infrastructure for managing and monitoring autonomous coding agents powered by GitHub Copilot CLI. It consists of two main components:

1. **Agent Management System** (`agent/`) - Bash scripts for spawning, monitoring, and controlling agent sessions
2. **MCP Server** (`mcp-servers/agent/`) - Model Context Protocol server for Claude Code integration

## Architecture

```
shelfwood-agents/
├── agent/                      # Agent management CLI
│   ├── agent                   # Main command dispatcher
│   ├── agent-spawn             # Spawn new agent sessions
│   ├── agent-list              # List active agents
│   ├── agent-watch             # Monitor for state changes
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

### 2. Configure Zsh

The agent command is aliased in `~/.shelfwood/aliases.zsh`:

```bash
alias agent="~/projects/shelfwood-agents/agent/agent"
```

### 3. Configure Claude Code

Add to Claude Code MCP settings (`mcp_settings.json`):

```json
{
  "mcpServers": {
    "agent": {
      "command": "node",
      "args": [
        "/Users/shelfwood/projects/shelfwood-agents/mcp-servers/agent/index.js"
      ],
      "type": "stdio"
    }
  }
}
```

## Usage

### Basic Commands

```bash
# Spawn a new agent
agent spawn ~/projects/myapp tasks/refactor.md

# List all active agents
agent list

# Check agent status
agent status agent-myapp-1234

# Read agent output
agent read agent-myapp-1234

# Send message to agent
agent send agent-myapp-1234 "Use Pest framework"

# Watch for state changes (blocks until agent needs attention)
agent watch

# Kill agent
agent kill agent-myapp-1234
```

### MCP Tools (from Claude Code)

```javascript
// Spawn agent programmatically
mcp__agent__spawn_agent({
  project_dir: "/Users/shelfwood/projects/myapp",
  task_file: "/Users/shelfwood/projects/myapp/tasks/refactor.md",
  session_name: "refactor-auth"  // optional
});

// Watch all agents
mcp__agent__watch_agents({
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

- **Non-interactive by default** - No prompts, no confirmations
- **Built for automation** - Designed to be orchestrated by Claude Code
- **Git safety guardrails** - Blocks commit/push/merge operations
- **Systematic workflows** - Encourages discovery-driven development

### Session Lifecycle

1. **Spawn** - Create detached tmux session with Copilot CLI
2. **Monitor** - Watch for state changes (completion, errors, waiting for input)
3. **Interact** - Send commands or approve actions as needed
4. **Complete** - Review work and terminate session

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
  "last_activity": "2025-11-14T18:10:00Z"
}
```

## Contributing

This is a personal infrastructure project. If you find it useful, feel free to fork and adapt to your needs.

## License

MIT
