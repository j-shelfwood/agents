# Task: Rename MCP Tool from spawn_agent to launch_agent

## Objective
Refactor MCP server to rename the `spawn_agent` tool to `launch_agent` including all function names, method names, variable names, and documentation references.

## Context
- File to modify: mcp-servers/agent/index.js
- This is a Node.js MCP server that exposes agent orchestration tools to Claude Code
- The file uses Node.js `spawn` from `child_process` module - DO NOT change these imports or calls

## Critical Distinction
**CHANGE these "spawn" references:**
- Tool name: `spawn_agent` → `launch_agent`
- Function name: `spawnAgent` → `launchAgent`
- Function name: `spawnWithTimeout` → `launchWithTimeout`
- Variable name: `spawnArgs` → `launchArgs`
- Command arguments: `['spawn']` → `['launch']`
- Help text and descriptions mentioning "spawn"
- Error messages mentioning "spawn_agent"

**DO NOT CHANGE these:**
- `import { exec, spawn } from 'child_process';` - This is Node.js spawn, keep as-is
- Any direct calls to `spawn(cmd, args)` - These are Node.js spawn calls
- The word "spawn" when it appears in `spawn(AGENT_CMD, ...)` calls

## Discovery Hints
Enumerate all spawn references in the file:
```bash
rg -n "spawn" mcp-servers/agent/index.js
```

Count occurrences:
```bash
rg "spawn" mcp-servers/agent/index.js -c
```

## Requirements
1. Line 42: Rename function `spawnWithTimeout` to `launchWithTimeout`
2. Line 94: Update help text from `spawn_agent()` to `launch_agent()`
3. Line 144: Change tool name from `'spawn_agent'` to `'launch_agent'`
4. Line 145: Change description from "Spawn a new..." to "Launch a new..."
5. Line 293: Change case statement from `'spawn_agent'` to `'launch_agent'`
6. Line 294: Change method call from `spawnAgent` to `launchAgent`
7. Line 328: Rename async function from `spawnAgent` to `launchAgent`
8. Line 337: Change variable from `spawnArgs` to `launchArgs` AND array content from `['spawn']` to `['launch']`
9. Line 345: Update comment "60s timeout for spawn" to "60s timeout for launch"
10. Line 355: Change success message "Agent spawned successfully" to "Agent launched successfully"
11. Line 360: Change error context from `'spawn_agent'` to `'launch_agent'`
12. DO NOT modify Node.js `spawn` function imports or calls

## Success Criteria
- All MCP tool references use `launch_agent` instead of `spawn_agent`
- All internal function names use `launch` terminology
- Node.js `child_process.spawn` imports and calls remain unchanged
- File passes syntax validation: `node -c mcp-servers/agent/index.js`
- All 11 requirements above are implemented
