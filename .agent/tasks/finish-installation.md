# Task: Create Installation System Files

## Objective
Create install.sh, package.json, and bin/agent - execute immediately, no verification loops.

## Context
- Project root: /Users/shelfwood/Projects/shelfwood-agents
- Config system exists: src/lib/config.sh
- Need: install.sh, package.json, bin/agent

## Requirements

Create these 3 files using the Write tool directly:

### 1. install.sh (see task file reorg-05 for full script)
Create executable install.sh with:
- Dependency checking (tmux, node, copilot)
- Directory creation ($HOME/.local/share/copilot-agent)
- File copying (agent/* → install location)
- Config generation
- PATH setup instructions

### 2. package.json
```json
{
  "name": "copilot-agent-orchestrator",
  "version": "1.0.0",
  "description": "Autonomous agent orchestration for GitHub Copilot CLI",
  "bin": {
    "agent": "./bin/agent"
  },
  "scripts": {
    "test": "bash tests/orchestration-patterns.sh"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yourusername/agents.git"
  },
  "keywords": ["copilot", "agent", "orchestration", "mcp", "autonomous"],
  "author": "Shelfwood",
  "license": "MIT"
}
```

### 3. bin/agent
```bash
#!/bin/bash
# Wrapper for agent command
if [[ -n "${AGENT_HOME}" ]]; then
    AGENT_DIR="$AGENT_HOME/src/commands"
elif [[ -f "$HOME/.local/share/copilot-agent/src/commands/agent" ]]; then
    AGENT_DIR="$HOME/.local/share/copilot-agent/src/commands"
else
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$SCRIPT_DIR/../agent/agent" ]]; then
        AGENT_DIR="$SCRIPT_DIR/../agent"
    else
        echo "Error: Cannot find agent installation" >&2
        exit 1
    fi
fi
exec "$AGENT_DIR/agent" "$@"
```

## Success Criteria
- 3 files created
- install.sh and bin/agent are executable

## Completion
Report: "Installation system complete: install.sh, package.json, bin/agent created"
