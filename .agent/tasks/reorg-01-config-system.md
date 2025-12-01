# Task: Create Configuration System

## Objective
Create XDG-compliant configuration system to replace hardcoded paths throughout the project.

## Discovery Phase (Agent MUST execute these first)
Before making ANY changes, agent must verify project structure:

```bash
# Verify we're in correct directory
pwd
ls -la

# Check existing structure
ls -la agent/
ls -la mcp-servers/agent/

# Identify any existing config files
find . -name "config.sh" -o -name ".env*" 2>/dev/null
```

**Agent must report verification results before proceeding.**

## Context
- Project root: /Users/shelfwood/Projects/shelfwood-agents
- Target: Create src/lib/config.sh (NEW file)
- Integration: Will be sourced by all agent-* scripts
- Pattern: XDG Base Directory specification

## Requirements
Agent must implement the following systematically:

1. Create src/lib/ directory structure
2. Create src/lib/config.sh with the following features:
   - XDG_CONFIG_HOME support (default: ~/.config)
   - XDG_DATA_HOME support (default: ~/.local/share)
   - AGENT_HOME variable (default: $XDG_DATA_HOME/copilot-agent)
   - AGENT_METADATA_DIR variable (default: $AGENT_HOME/metadata)
   - AGENT_METADATA_ARCHIVE_DIR variable (default: $AGENT_METADATA_DIR/archive)
   - AGENT_BIN_DIR variable (for future use)
   - COPILOT_BIN detection function (search NVM, PATH)
   - AGENT_SYSTEM_INSTRUCTIONS_PATH (optional, default: empty)
   - Config file loading from ~/.config/copilot-agent/config

3. Include helpful comments explaining each variable
4. Make config.sh idempotent (can be sourced multiple times safely)
5. Create directory initialization function (ensure metadata dirs exist)

## Implementation Pattern

```bash
#!/bin/bash
# Configuration system for copilot-agent orchestration
# Follows XDG Base Directory specification

# XDG Base Directories (with fallbacks)
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

# Agent installation directories
export AGENT_HOME="${AGENT_HOME:-$XDG_DATA_HOME/copilot-agent}"
export AGENT_METADATA_DIR="${AGENT_METADATA_DIR:-$AGENT_HOME/metadata}"
export AGENT_METADATA_ARCHIVE_DIR="${AGENT_METADATA_ARCHIVE_DIR:-$AGENT_METADATA_DIR/archive}"

# Optional: System instructions file (e.g., for Obsidian integration)
export AGENT_SYSTEM_INSTRUCTIONS_PATH="${AGENT_SYSTEM_INSTRUCTIONS_PATH:-}"

# Load user configuration if exists
AGENT_CONFIG_FILE="$XDG_CONFIG_HOME/copilot-agent/config"
if [[ -f "$AGENT_CONFIG_FILE" ]]; then
    source "$AGENT_CONFIG_FILE"
fi

# Function to find copilot binary
find_copilot_binary() {
    # ... detection logic ...
}

# Function to ensure directories exist
init_agent_directories() {
    mkdir -p "$AGENT_METADATA_DIR"
    mkdir -p "$AGENT_METADATA_ARCHIVE_DIR"
}
```

## Verification Commands (Agent MUST run these before completion)
After implementation, agent must verify:

```bash
# Verify file created
ls -la src/lib/config.sh
test -f src/lib/config.sh && echo "✓ config.sh exists"

# Test sourcing config
bash -c "source src/lib/config.sh && echo AGENT_HOME=\$AGENT_HOME"

# Verify variables are set
bash -c "source src/lib/config.sh && test -n \"\$AGENT_METADATA_DIR\" && echo \"✓ Variables set\""

# Check no syntax errors
bash -n src/lib/config.sh && echo "✓ No syntax errors"
```

## Success Criteria
- [x] src/lib/ directory created
- [x] src/lib/config.sh file created with all variables
- [x] XDG-compliant paths defined
- [x] Config file can be sourced without errors
- [x] All variables export correctly
- [x] Verification commands pass

## Completion Confirmation
Agent must report:
1. File created: src/lib/config.sh
2. Variables defined: AGENT_HOME, AGENT_METADATA_DIR, etc.
3. Verification: All test commands passed
