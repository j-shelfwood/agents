# Task: Rename agent-spawn to agent-launch

## Objective
Rename the primary agent script file from `agent-spawn` to `agent-launch` and update all internal references from "spawn" to "launch" terminology.

## Context
- File to rename: agent/agent-spawn → agent/agent-launch
- This is the main bash script for launching new agent sessions
- The script creates metadata files with `spawned_at` and `spawned_by` fields - these are past-tense timestamps and should NOT be changed

## Critical Distinction
**CHANGE these:**
- Filename: `agent-spawn` → `agent-launch`
- Command references in help text: "agent spawn" → "agent launch"
- Header comments: "agent spawn - Spawn..." → "agent launch - Launch..."
- Usage text: "agent spawn <args>" → "agent launch <args>"
- Example commands in help
- Output messages: "Spawning Agent" → "Launching Agent"
- Success messages: "Agent spawned" → "Agent launched"

**DO NOT CHANGE these:**
- Metadata field names: `spawned_at`, `spawned_by` (these are past-tense timestamps)
- Any references to metadata fields in the code

## Discovery Hints
Review the file structure:
```bash
cat agent/agent-spawn | head -50
```

Find all "spawn" references:
```bash
rg -i "spawn" agent/agent-spawn
```

Check metadata field usage:
```bash
rg "spawned_at|spawned_by" agent/agent-spawn
```

## Requirements
1. Rename file from `agent/agent-spawn` to `agent/agent-launch`
2. Line 2: Update comment "agent spawn - Spawn Agent Session" to "agent launch - Launch Agent Session"
3. Line 20-23: Update usage function header and command examples
4. Line 25: Change "agent spawn <project-dir>" to "agent launch <project-dir>"
5. Lines 36-38: Update example commands from "agent spawn" to "agent launch"
6. Line 81: Update error message "agent spawn <project-dir>" to "agent launch <project-dir>"
7. Line 155: Update output header "Spawning Agent" to "Launching Agent"
8. Line 208: Update success message "Agent spawned with task" to "Agent launched with task"
9. Line 210: Update message "Agent spawned (waiting for input)" to "Agent launched (waiting for input)"
10. Keep metadata field names `spawned_at` and `spawned_by` unchanged (lines 58, 178)
11. Ensure file permissions remain executable (755)

## Success Criteria
- File renamed from `agent-spawn` to `agent-launch`
- All command references use "launch" terminology
- Metadata fields `spawned_at` and `spawned_by` remain unchanged
- File is executable: `test -x agent/agent-launch && echo "OK"`
- Script runs without errors: `bash -n agent/agent-launch`
