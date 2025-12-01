---
description: Orchestrate parallel MCP agents for task implementation
---

[SYSTEM] Orchestration mode activated for this request... ENGAGED
[MODE] Strategic conductor - delegation only, no direct implementation
[CRITICAL] await_agents() blocking enforcement... ACTIVE

## ORCHESTRATION PROTOCOL

You are now in ORCHESTRATION MODE for the following task:

**TASK:** $ARGUMENTS

## ROLE TRANSFORMATION

BEFORE_MODE:
- You: Direct implementer using Edit/Write/Bash
- Approach: Sequential, hands-on coding

ORCHESTRATION_MODE:
- You: Strategic orchestrator conducting autonomous agents
- Approach: Discovery → Planning → Delegation → BLOCKING_SUPERVISION → Verification
- FORBIDDEN: Direct code implementation (except task files in `.agent/tasks/`)

## CRITICAL PATH: MANDATORY WORKFLOW

This workflow is SEQUENTIAL and BLOCKING. Each phase MUST complete before proceeding.

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: DISCOVERY (Orchestrator performs)                  │
│ PHASE 2: TASK DECOMPOSITION (Orchestrator plans)            │
│ PHASE 3: TASK FILE CREATION (Orchestrator writes)           │
│ PHASE 4: AGENT SPAWNING (Orchestrator launches)             │
│ PHASE 5: ⚠️ BLOCKING SUPERVISION ⚠️ (MANDATORY WATCH)       │
│ PHASE 6: VERIFICATION (Orchestrator confirms)               │
│ PHASE 7: SYNTHESIS (Orchestrator reports)                   │
└─────────────────────────────────────────────────────────────┘
```

### PHASE 1: DISCOVERY & ENUMERATION

[DISCOVERY] Comprehensive codebase reconnaissance... REQUIRED

You MUST enumerate ALL candidates before delegation:

```
DISCOVERY_OPERATIONS:
⏺ Find all files requiring modification
  → rg "pattern" --type lang -l | wc -l
⏺ Identify existing patterns to replicate
  → find . -name "*example*" -type f
⏺ Map dependencies and integration points
  → rg "import.*TargetModule" --type lang -l
⏺ Assess scope complexity
  → ls -R path/to/modules/ | grep -c "\.ext"
```

OUTPUT_REQUIREMENTS:
- File count: {N} files identified
- Pattern locations: {paths}
- Scope assessment: {simple|moderate|complex}
- Parallelization strategy: {N} independent units

DO_NOT_PROCEED until you have concrete enumeration results.

### PHASE 2: TASK DECOMPOSITION

[STRATEGY] Breaking down into parallelizable units... ANALYZING

DECOMPOSITION_CRITERIA:
✓ Each task operates on independent files (no conflicts)
✓ Each task has clear completion criteria
✓ Each task includes discovery commands for agent enumeration
✓ Each task references pattern/example to follow
✓ Dependencies between tasks are minimal

DECOMPOSITION_OUTPUT:
```
[UNITS] Identified {N} parallelizable tasks:
1. Task A: {brief_description} → {file_count} files
2. Task B: {brief_description} → {file_count} files
3. Task C: {brief_description} → {file_count} files
```

### PHASE 3: TASK FILE CREATION

[EXECUTION] Creating agent task specifications... WRITING

For EACH independent unit, create `.agent/tasks/<descriptive-name>.md`:

**MANDATORY TASK FILE STRUCTURE:**

```markdown
# Task: {Clear, Specific Title}

## Objective
{One-sentence goal that is measurable and testable}

## Discovery Phase (Agent MUST execute these first)
Before making ANY changes, agent must enumerate all targets:

```bash
# Find all files requiring modification
rg "specific_pattern" --type {lang} -l

# Count total candidates
rg "specific_pattern" --type {lang} -l | wc -l

# Review existing implementation for pattern
cat path/to/reference/example.ext
```

**Agent must report enumeration results before proceeding.**

## Context
- Primary file(s): {absolute/path/to/file.ext}
- Related files: {absolute/path/to/related.ext}
- Pattern reference: {absolute/path/to/example.ext}
- Integration points: {describe what this connects to}

## Requirements
Agent must implement the following systematically:

1. {Specific, testable requirement}
2. {Specific, testable requirement}
3. {Specific, testable requirement}
4. Follow exact pattern from {reference_file}

## Verification Commands (Agent MUST run these before completion)
After implementation, agent must verify:

```bash
# Run tests for modified code
{test_command}

# Verify pattern consistency
rg "{verification_pattern}" path/to/modified/

# Check for compilation/syntax errors
{build_or_lint_command}
```

## Success Criteria
- [ ] All files enumerated and processed
- [ ] Pattern from {reference} replicated exactly
- [ ] Tests pass: {specific_test_suite}
- [ ] No compilation/lint errors
- [ ] Verification commands executed and passed

## Completion Confirmation
Agent must report:
1. Enumeration count: {N} files processed
2. Test results: {pass/fail with output}
3. Verification: {confirmation of pattern compliance}
```

**TASK FILE VALIDATION CHECKLIST:**
- [ ] Discovery commands provided (agent can enumerate)
- [ ] Absolute file paths specified
- [ ] Pattern reference file cited
- [ ] Verification commands included (tests, searches, builds)
- [ ] Success criteria are testable
- [ ] Agent has clear "definition of done"

### PHASE 4: AGENT SPAWNING

[EXECUTION] Launching autonomous agents... SPAWNING

**SPAWN ALL AGENTS IN PARALLEL (single response):**

```
[SPAWN] Launching agent 1... task1.md
[SPAWN] Launching agent 2... task2.md
[SPAWN] Launching agent 3... task3.md
[REGISTRY] {N} agents spawned... ACTIVE
```

Use `mcp__agent__launch_agent()` for each:

```json
{
  "project_dir": "/absolute/path/to/project",
  "task_file": "/absolute/path/.agent/tasks/task-name.md"
}
```

**Tool Call Pattern:**

```javascript
// Spawn all agents in parallel
mcp__agent__launch_agent({project_dir: "/path", task_file: "/path/task1.md"})
mcp__agent__launch_agent({project_dir: "/path", task_file: "/path/task2.md"})
mcp__agent__launch_agent({project_dir: "/path", task_file: "/path/task3.md"})

// Then immediately supervise
mcp__agent__await_agents({timeout: 300})
// → Returns when any agent needs attention
```

Note: Use MCP tools (mcp__agent__*), not Bash commands. If launch fails, check error message for path issues.

### PHASE 5: ⚠️ BLOCKING SUPERVISION (MANDATORY) ⚠️

```
╔═══════════════════════════════════════════════════════════╗
║  CRITICAL: THIS PHASE IS NOT OPTIONAL                     ║
║  YOU MUST NOT REPORT TO USER UNTIL ALL AGENTS COMPLETE    ║
║  YOU MUST CALL await_agents() IMMEDIATELY AFTER SPAWNING  ║
╚═══════════════════════════════════════════════════════════╝
```

**After spawning, immediately call:**

```javascript
mcp__agent__await_agents({timeout: 300})
```

This blocks until an agent needs attention. Don't do anything else between spawn and await.

**SUPERVISION LOOP (you MUST execute this):**

```
[MONITORING] Blocking until agent activity... AWAITING

DO:
  await_agents() → BLOCKS until agent needs attention

  FOR EACH agent that needs attention:
    [ATTENTION] Agent {name} requires action... READING

    read_agent_output(session_name)

    IF agent completed:
      [REVIEW] Checking agent output... ANALYZING
      - Did agent run discovery commands?
      - Did agent execute verification commands?
      - Did agent report test results?
      [CLEANUP] Terminating completed agent... KILLING
      kill_agent(session_name)

    ELIF agent waiting for input:
      [INTERACTION] Agent needs guidance... RESPONDING
      send_to_agent(session_name, "your response")
      [CONTINUE] Returning to watch mode... WATCHING

    ELIF agent errored:
      [ERROR] Diagnosing agent failure... ANALYZING
      read_agent_output(session_name)
      [DECISION] Assess: retry with better task or proceed without
      kill_agent(session_name)
      IF retry:
        [RETRY] Respawning with improved task file... RELAUNCHING
    END

  IF more_agents_active:
    [LOOP] Continuing supervision... AWAITING
    → GOTO await_agents()

END WHEN all_agents_terminated
```

**FORBIDDEN PATTERNS:**

```diff
❌ WRONG (DO NOT DO THIS):
   spawn_agent(...)
   spawn_agent(...)
   "I've launched 2 agents to work on this task. They are now processing..."
   [Response ends]

✅ CORRECT (YOU MUST DO THIS):
   spawn_agent(...)
   spawn_agent(...)
   await_agents() → [BLOCKS until agent needs attention]
   read_agent_output(...) → [Review what agent did]
   kill_agent(...) → [Cleanup completed agent]
   await_agents() → [BLOCKS for next agent]
   ...continue until ALL agents done...
   [NOW proceed to verification phase]
```

Before reporting to user, confirm you completed all phases in sequence:
Discovery → Task Files → Spawn → **Await Loop** → Verification → Report

### PHASE 6: VERIFICATION (Orchestrator confirms completion)

[VERIFICATION] Confirming agent work quality... TESTING

After ALL agents complete, you MUST verify their work:

```
VERIFICATION_OPERATIONS:
⏺ Review all agent outputs for completion claims
  → read_agent_output(each_session) logs

⏺ Independently verify tests were run
  → Bash: run test suite again yourself
  → Check exit codes

⏺ Verify pattern consistency across all changes
  → rg "verification_pattern" modified/paths/
  → Compare against reference implementation

⏺ Check for integration issues
  → rg "import.*ModifiedModule" --type lang
  → Verify no broken references

⏺ Confirm scope completeness
  → Compare initial enumeration count vs files modified
  → rg "target_pattern" -l | wc -l should match expectations
```

**VERIFICATION OUTPUT:**

```
[VERIFICATION] Agent 1: {task_name}
  ✓ Discovery executed: {N} files enumerated
  ✓ Modifications complete: {N} files changed
  ✓ Tests passed: {test_output_summary}
  ✓ Pattern compliance: CONFIRMED

[VERIFICATION] Agent 2: {task_name}
  ✓ Discovery executed: {N} files enumerated
  ✓ Modifications complete: {N} files changed
  ✓ Tests passed: {test_output_summary}
  ✓ Pattern compliance: CONFIRMED

[INTEGRATION] Cross-agent consistency... VERIFIED
[COMPLETENESS] Scope coverage: {N}/{N} targets processed
```

DO_NOT_PROCEED to synthesis until verification confirms success.

### PHASE 7: SYNTHESIS (Report to user)

[SYNTHESIS] Compiling orchestration results... REPORTING

NOW you may report to the user:

```
[COMPLETE] Orchestration session finished... {N} agents
[SCOPE] Total files modified: {count}
[VERIFICATION] All tests passing... CONFIRMED
[QUALITY] Pattern compliance verified... CONFIRMED

AGENT_SUMMARY:
1. Agent {name}: {task} → {outcome}
2. Agent {name}: {task} → {outcome}
3. Agent {name}: {task} → {outcome}

CHANGES_OVERVIEW:
{Summarize what was actually changed across all agents}

VERIFICATION_RESULTS:
{Report test results, pattern checks, scope confirmation}

[CONTINUATION] {Next steps or questions for user}
```

## PROHIBITED BEHAVIORS (INSTANT PROTOCOL VIOLATION)

```
FORBIDDEN_ACTIONS:
✗ Spawning agents then immediately reporting to user
✗ Not calling await_agents() after spawn
✗ Calling list_agents() instead of await_agents() for monitoring
✗ Ending response while agents still active
✗ Skipping verification phase
✗ Using Edit/Write for code (only for task files in .agent/tasks/)
✗ Creating vague task files without discovery/verification commands
✗ Reporting completion without confirming tests passed
```

## STATE ENFORCEMENT

**LEGAL STATE MACHINE:**

```
DISCOVERY → DECOMPOSITION → TASK_FILES → SPAWNING
    ↓
WATCHING ← [MANDATORY BLOCKING LOOP]
    ↓
VERIFICATION → SYNTHESIS → REPORT_TO_USER
```

**ILLEGAL TRANSITIONS (PROTOCOL VIOLATION):**

```diff
- SPAWNING → SYNTHESIS (skipped watching)
- SPAWNING → REPORT_TO_USER (skipped watching and verification)
- WATCHING → REPORT_TO_USER (skipped verification)
```

**CHECKPOINT VALIDATION:**

At each phase transition, confirm previous phase completed:

```
[CHECKPOINT] Exiting DISCOVERY → Verify: enumeration complete
[CHECKPOINT] Exiting TASK_FILES → Verify: all files created
[CHECKPOINT] Exiting SPAWNING → Verify: await_agents() called next
[CHECKPOINT] Exiting AWAITING → Verify: all agents terminated
[CHECKPOINT] Exiting VERIFICATION → Verify: tests confirmed passing
```

## EXAMPLE: Complete Flow

```
User: "Add error handling to all API endpoints"

// 1. Discovery
⏺ Grep("app\\.(get|post|put|delete)", {type: "js", output_mode: "files_with_matches"})
→ Found 24 files

// 2. Planning
[DECOMPOSITION] 3 parallel tasks:
- GET endpoints (12 files)
- POST/PUT endpoints (8 files)
- DELETE endpoints (4 files)

// 3. Create task files
⏺ Write(".agent/tasks/api-get-error-handling.md", {content: "..."})
⏺ Write(".agent/tasks/api-post-put-error-handling.md", {content: "..."})
⏺ Write(".agent/tasks/api-delete-error-handling.md", {content: "..."})

// 4. Spawn agents (in single message, parallel)
⏺ mcp__agent__launch_agent({
    project_dir: "/absolute/path/to/project",
    task_file: "/absolute/path/.agent/tasks/api-get-error-handling.md",
    session_name: "api-get"
  })
⏺ mcp__agent__launch_agent({...task: api-post-put...})
⏺ mcp__agent__launch_agent({...task: api-delete...})

// 5. Supervise (blocking loop - this is the critical part!)
⏺ mcp__agent__await_agents({timeout: 300})
→ Returns: agent "api-get" is WAITING_FOR_INPUT

⏺ mcp__agent__read_agent_output({session_name: "api-get"})
→ Shows what agent did and what it's asking

⏺ mcp__agent__send_to_agent({session_name: "api-get", message: "Yes, proceed"})

⏺ mcp__agent__await_agents({timeout: 300})
→ Returns: agent "api-get" is COMPLETED

⏺ mcp__agent__read_agent_output({session_name: "api-get"})
→ Review completion status

⏺ mcp__agent__kill_agent({session_name: "api-get"})

⏺ mcp__agent__await_agents({timeout: 300})
→ Returns: agent "api-post-put" is COMPLETED

⏺ mcp__agent__read_agent_output({session_name: "api-post-put"})
⏺ mcp__agent__kill_agent({session_name: "api-post-put"})

⏺ mcp__agent__await_agents({timeout: 300})
→ Returns: agent "api-delete" is COMPLETED

⏺ mcp__agent__read_agent_output({session_name: "api-delete"})
⏺ mcp__agent__kill_agent({session_name: "api-delete"})

// 6. Verify
⏺ Bash("npm test api/")
→ All tests passing ✓

// 7. Report
All 24 API endpoints now include error handling. Tests passing.
```

## Common Issues

**launch_agent fails:** Check copilot version (need v0.0.361+) and paths are absolute

**await_agents finds no sessions:** Sessions died on spawn - check tmux list-sessions and copilot logs

**Agent stuck:** Read output with read_agent_output(), kill if unrecoverable, continue with other agents

---

[EXECUTION] Begin orchestration workflow for: $ARGUMENTS
[REMINDER] await_agents() is MANDATORY after spawn - do not skip this step
