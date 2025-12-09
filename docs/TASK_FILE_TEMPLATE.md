# Task File Template

**Purpose:** Standard format for agent task files to ensure autonomous execution and clean completion.

**Location:** `.agent/tasks/` in project directory

---

## Template Structure

```markdown
# Task: [Clear, Specific Title]

## Objective
[One-sentence description of what to accomplish]

## Execution Mode

**⚡ AUTONOMOUS EXECUTION REQUIRED ⚡**

- ✓ Complete discovery phase and report findings
- ✓ **Immediately proceed to analysis** after discovery
- ✓ Document all findings systematically
- ✓ Generate recommendations/implementation
- ✓ Report completion with deliverables

**DO NOT ask "Should I proceed?"** → Execute immediately after discovery.

**Git operations:** All git operations BLOCKED - [implementation/research/testing] only.

## Discovery Phase

Enumerate scope with systematic commands:

\`\`\`bash
# [Description of what this discovers]
[command 1]

# [Description]
[command 2]

# [Description]
[command 3]
\`\`\`

## Context

**Primary Investigation Files:**
- `/absolute/path/to/file1.ext` (Layer 1: Description)
- `/absolute/path/to/file2.ext` (Layer 2: Description)

**Specific Issue:**
[Detailed problem description with context]

**Related Patterns:**
[Reference similar implementations if applicable]

## Analysis Phase

Based on discovery results:
1. [Analysis requirement 1]
2. [Analysis requirement 2]
3. [Analysis requirement 3]

## Deliverable

[What the agent should produce]:
1. [Deliverable component 1]
2. [Deliverable component 2]
3. [Deliverable component 3]

## Success Criteria

- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]
- [ ] [Testable criterion 3]

## Completion Signal

After generating complete deliverable, execute terminal command:

\`\`\`bash
echo "[TASK_COMPLETE] [Task name] completed successfully"
\`\`\`

This signals task completion and allows agent to exit cleanly.
```

---

## Key Sections Explained

### 1. Execution Mode
**CRITICAL:** Must include "⚡ AUTONOMOUS EXECUTION REQUIRED ⚡" marker

This triggers Copilot's autonomous execution protocol defined in `~/.copilot/copilot-instructions.md`

### 2. Discovery Phase
**Format:** Bash code blocks with commands

Commands execute immediately without confirmation when task is injected.

### 3. Context
**Purpose:** Provide file paths and background

Helps agent understand what it's working with before starting.

### 4. Completion Signal
**REQUIRED:** Terminal command that signals task done

Without this, agents may loop indefinitely trying to refine output.

Pattern: `echo "[TASK_COMPLETE] <message>"`

---

## Task Types

### Research Task
**Goal:** Investigate and document
**Deliverable:** Analysis report with recommendations
**Completion:** After report generation

### Implementation Task
**Goal:** Write code/tests
**Deliverable:** Working implementation
**Completion:** After tests pass

### Refactoring Task
**Goal:** Modify existing code
**Deliverable:** Refactored code following patterns
**Completion:** After verification commands

---

## Anti-Patterns

### ❌ Too Vague
```markdown
# Task: Fix the system
Make it work better.
```

### ❌ Too Prescriptive
```markdown
# Task: Update line 42
Change $this->client->post() to $this->client->get()
```

### ❌ No Completion Signal
```markdown
## Deliverable
Generate report on findings.
[END OF FILE - Agent doesn't know when to stop]
```

### ✅ Just Right
```markdown
# Task: Switch payment verification from POST to GET

## Discovery Phase
\`\`\`bash
rg "client->post.*verify" --type php -n
\`\`\`

## Deliverable
Update PaymentService to use GET for verification endpoint.
Update corresponding tests.

## Completion Signal
\`\`\`bash
echo "[TASK_COMPLETE] Payment verification updated to GET"
\`\`\`
```

---

## Testing Your Task File

Before orchestration, verify:

1. **Execution mode marker present:** `⚡ AUTONOMOUS EXECUTION REQUIRED ⚡`
2. **Discovery commands in code blocks:** Properly formatted bash
3. **Absolute paths provided:** No relative paths in context section
4. **Completion signal included:** echo "[TASK_COMPLETE]" at end
5. **Success criteria clear:** Agent knows what "done" means

Test with single agent before parallel orchestration:
```bash
agent launch ~/projects/myapp .agent/tasks/my-task.md
agent read [session-name]  # Check if discovery executed
agent kill [session-name]
```

---

## Task Delivery Mechanism

Tasks are delivered via **direct content injection** (not file reading):

1. `agent-launch` script reads task file: `$(cat "$TASK_FILE")`
2. Full content injected into Copilot CLI session
3. Triggers task_initialization protocol
4. Discovery commands execute immediately
5. Agent proceeds through phases autonomously
6. Completion signal transitions to COMPLETED state

**Implementation:** `agent/agent-launch:242-264`
**Documentation:** `~/.claude/system-instructions/agent-orchestration.md:842-853`

---

## Version History

**2025-12-09:**
- Added Completion Signal section (required for clean exit)
- Documented autonomous execution markers
- Added task delivery mechanism details

**2025-11-29:**
- Initial template created
- Basic structure defined
