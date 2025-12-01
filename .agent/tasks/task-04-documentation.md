# Task: Update documentation for spawn → launch terminology

## Objective
Update README.md and CHANGELOG.md to use "launch" terminology instead of "spawn" for all command references and examples.

## Context
- Files to modify:
  - README.md
  - CHANGELOG.md
- Related reference: agent/agent-launch (study command structure)

## Critical Distinction
**CHANGE these:**
- Command examples: "agent spawn" → "agent launch"
- MCP tool name: `spawn_agent` → `launch_agent`
- MCP function: `mcp__agent__spawn_agent` → `mcp__agent__launch_agent`
- Descriptions: "Spawn new agent" → "Launch new agent"
- Lifecycle descriptions: "Spawn - Create..." → "Launch - Create..."
- Text references to spawning actions

**DO NOT CHANGE these:**
- Metadata field documentation: `spawned_at`, `spawned_by` (these are past-tense timestamps)
- Any JSON examples showing metadata fields

## Discovery Hints
Find all spawn references:
```bash
rg -n "spawn" README.md CHANGELOG.md
```

Count occurrences by file:
```bash
rg -c "spawn" README.md CHANGELOG.md
```

See context around each match:
```bash
rg -C 2 "spawn" README.md
```

## Requirements

### File: README.md
1. Line 9: Change "Bash scripts for spawning" to "Bash scripts for launching"
2. Line 18: Change comment "# Spawn new agent sessions" to "# Launch new agent sessions"
3. Line 18: Change filename from "agent-spawn" to "agent-launch"
4. Line 80: Change "# Spawn a new agent" to "# Launch a new agent"
5. Line 81: Change command from "agent spawn" to "agent launch"
6. Line 106: Change function name from `mcp__agent__spawn_agent` to `mcp__agent__launch_agent`
7. Line 159: Change "Spawn - Create detached..." to "Launch - Create detached..."
8. Line 173: Keep metadata field `spawned_at` unchanged in JSON example
9. Line 174: Keep metadata field `spawned_by` unchanged in JSON example

### File: CHANGELOG.md
1. Line 14: Change "Support for spawning" to "Support for launching"

## Success Criteria
- All command examples use "agent launch"
- All MCP tool references use `launch_agent`
- Metadata field names in JSON examples remain unchanged (spawned_at, spawned_by)
- Documentation accurately reflects the new terminology
- Markdown syntax remains valid
