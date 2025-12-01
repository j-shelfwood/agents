# Task: Complete Bash Scripts Migration

## Objective
Update all 15 agent-* bash scripts to source config.sh - no verification loops, just execute and complete.

## Context
- Configuration file exists: src/lib/config.sh
- Target: agent/agent* (15 scripts)
- Pattern: Add source line after shebang, before any code

## Requirements

For EACH of the 15 scripts in agent/:

1. Add after shebang (#!/bin/bash) and before any other code:
```bash
# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../src/lib/config.sh"
```

2. For agent/agent-metadata specifically:
   - Remove line: `METADATA_DIR="$HOME/.shelfwood/agent/metadata"`
   - Remove line: `METADATA_ARCHIVE_DIR="$HOME/.shelfwood/agent/metadata/archive"`
   - Keep the variables but let config.sh set them
   - Add after sourcing config: `init_agent_directories`

3. For agent/agent-await specifically:
   - Remove line: `AGENT_CMD="$HOME/.shelfwood/agent/agent"`
   - Remove it completely (not needed with config.sh)

4. For agent/agent-launch specifically:
   - Find: `SYSTEM_INSTRUCTIONS="$HOME/Obsidian/..."`
   - Replace with: `SYSTEM_INSTRUCTIONS="$AGENT_SYSTEM_INSTRUCTIONS_PATH"`
   - Add conditional check: `if [[ -n "$SYSTEM_INSTRUCTIONS" && -f "$SYSTEM_INSTRUCTIONS" ]]; then`

5. For agent/agent-doctor specifically:
   - Remove: `METADATA_DIR="$HOME/.shelfwood/agent/metadata"`
   - Remove: `METADATA_ARCHIVE_DIR="$HOME/.shelfwood/agent/metadata/archive"`
   - Let config.sh provide these

## Success Criteria
- All 15 scripts source config.sh
- No hardcoded paths remain
- Scripts can execute

## Completion
Report: "All 15 scripts updated with config.sh sourcing"
