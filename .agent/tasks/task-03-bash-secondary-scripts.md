# Task: Update spawn references in secondary bash scripts

## Objective
Update all secondary bash scripts to use "launch" terminology instead of "spawn" in command references, examples, and help text while preserving metadata field names.

## Context
- Files to modify:
  - agent/agent (main dispatcher)
  - agent/agent-resume
  - agent/agent-await
  - agent/agent-list
  - agent/agent-doctor
- Related reference file: agent/agent-launch (study the pattern)

## Critical Distinction
**CHANGE these:**
- Command examples: "agent spawn" → "agent launch"
- Help text references to spawn command
- Comments referencing "Spawning" actions
- Filename references: "agent-spawn" → "agent-launch"

**DO NOT CHANGE these:**
- Metadata field names: `spawned_at`, `spawned_by`, `SPAWNED_AT`, `SPAWNED_SECONDS`
- Variable names containing these metadata field names
- Past-tense timestamp references

## Discovery Hints
Find all affected files:
```bash
rg -l "spawn" agent/agent agent/agent-resume agent/agent-await agent/agent-list agent/agent-doctor
```

See spawn references by file:
```bash
rg -n "spawn" agent/agent agent/agent-resume agent/agent-await agent/agent-list agent/agent-doctor
```

Distinguish metadata vs command references:
```bash
rg "spawned_at|spawned_by|SPAWNED_" agent/agent-resume
```

## Requirements

### File: agent/agent (main dispatcher)
1. Line 24: Change help text "spawn <project-dir> [task-file]" to "launch <project-dir> [task-file]"
2. Line 38: Change example "agent spawn ~/projects/myapp" to "agent launch ~/projects/myapp"

### File: agent/agent-resume
1. Line 38: Change "Spawns new session" to "Launches new session"
2. Line 172: Change comment "Spawn new session using agent spawn" to "Launch new session using agent launch"
3. Line 173: Change variable name `SPAWN_ARGS` to `LAUNCH_ARGS`
4. Line 173: Change array content from `"spawn"` to `"launch"`
5. Lines 176, 178: Update array to reference "launch" not "spawn"
6. Line 182: Update error message to reference "launch"
7. Line 219: Update comment to use "launch"
8. Keep metadata fields: SPAWNED_AT, SPAWNED_SECONDS unchanged

### File: agent/agent-await
1. Lines 63-66: Change example commands from "agent spawn" to "agent launch"

### File: agent/agent-list
1. Line 37: Change help text "agent spawn" to "agent launch"
2. Line 66: Change no-agents message "agent spawn" to "agent launch"
3. Keep metadata references: SPAWNED_AT, SPAWNED_SECONDS unchanged (lines 84-93)

### File: agent/agent-doctor
1. Line 70: Change comment "will start on first spawn" to "will start on first launch"
2. Line 142: Change comment "will be created on first spawn" to "will be created on first launch"
3. Line 161: Change array element from `"agent-spawn"` to `"agent-launch"`

## Success Criteria
- All command examples use "agent launch" instead of "agent spawn"
- All filename references point to "agent-launch"
- Metadata fields remain unchanged (spawned_at, spawned_by, SPAWNED_AT, SPAWNED_SECONDS)
- All scripts pass syntax check: `for f in agent/agent*; do bash -n "$f" || echo "Failed: $f"; done`
- Follows pattern established in agent/agent-launch
