# Autonomous Execution Guide

## Overview

GitHub Copilot CLI agents launched via this orchestration system support **fully autonomous execution** when properly configured. This guide explains how autonomous execution works and how to enable it in your task files.

## How Autonomous Execution Works

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER                    STATUS        MECHANISM             │
├─────────────────────────────────────────────────────────────┤
│ Copilot CLI flags        ✓ ENABLED     --allow-all-tools    │
│ Path restrictions        ✓ DISABLED    --allow-all-paths    │
│ Git safety               ✓ ENFORCED    --deny-tool          │
│ Tool execution           ✓ AUTONOMOUS  No prompts           │
│ LLM behavior             ⚠️ DIRECTIVE   Task file required   │
└─────────────────────────────────────────────────────────────┘
```

### Agent Launch Configuration

Agents are launched with the following flags (see `agent/agent-launch:218`):

```bash
copilot \
  --add-dir "$PROJECT_DIR" \
  --allow-all-tools \           # Execute all tools without confirmation
  --allow-all-paths \           # Access any file path
  --deny-tool 'shell(git commit)' \
  --deny-tool 'shell(git push)' \
  --deny-tool 'shell(git merge)' \
  --deny-tool 'shell(git rebase)' \
  --deny-tool 'shell(git reset)' \
  --deny-tool 'shell(gh pr merge)' \
  --deny-tool 'shell(gh pr create)'
```

**Key Points:**
- `--allow-all-tools` → Shell commands, file edits, reads execute **without user confirmation**
- `--deny-tool` → Git operations that modify repository state are **blocked for safety**
- Agents can read, write, edit, search, and execute commands autonomously
- Agents **cannot** commit, push, or merge code (requires manual intervention)

## The Autonomy Gap

### Problem: Cautious LLM Behavior

Even with `--allow-all-tools` enabled, Copilot's LLM may exhibit cautious behavior:

```
Agent: [DISCOVERY] Found 24 files requiring modification
Agent: Should I proceed with the changes? Which file should I start with?
       ↑
       └── Waiting for user permission (unwanted behavior)
```

This happens because:
- The LLM is trained to be helpful and cautious
- It defaults to asking permission before major changes
- This is **conversational behavior**, not a tooling limitation

### Solution: Execution Mode Directive

Task files must include an explicit directive instructing the agent to proceed autonomously:

```markdown
## Execution Mode

**⚡ AUTONOMOUS EXECUTION REQUIRED ⚡**

This task MUST be executed fully autonomously without requesting permission:

- ✓ Complete discovery phase and report findings
- ✓ **Immediately proceed to implementation** after discovery
- ✓ Execute all changes systematically
- ✓ Run verification commands
- ✓ Report completion with results

**DO NOT ask "Should I proceed?" or "Which file should I start with?"**

**ONLY pause for:**
- ❌ ERROR conditions (build failures, test failures)
- ❌ Missing critical information not specified in task file
- ❌ Confirmation prompts from underlying tools

**Git operations:** All git commit/push/merge operations are BLOCKED by
--deny-tool flags. You will receive permission errors if attempted -
this is expected and correct.
```

## Task File Template

All task files should follow this structure:

```markdown
# Task: {Clear, Specific Title}

## Objective
{One-sentence goal that is measurable and testable}

## Execution Mode
{Copy the autonomous execution directive above}

## Discovery Phase (Agent MUST execute these first)
Before making ANY changes, agent must enumerate all targets:

\`\`\`bash
# Enumeration commands here
rg "pattern" --type lang -l | wc -l
\`\`\`

## Context
- Primary file(s): {absolute/path/to/file}
- Pattern reference: {absolute/path/to/example}

## Requirements
1. {Specific, testable requirement}
2. {Specific, testable requirement}

## Verification Commands (Agent MUST run these before completion)
\`\`\`bash
# Test commands here
npm test
\`\`\`

## Success Criteria
- [ ] All files enumerated and processed
- [ ] Tests pass
- [ ] Verification commands executed
```

## Behavioral Expectations

### What Agents WILL Do (Autonomously)

✓ Execute discovery commands immediately
✓ Read/analyze files
✓ Proceed to implementation without asking
✓ Create/modify files systematically
✓ Run test suites
✓ Execute verification commands
✓ Report completion with results

### What Agents WILL NOT Do (Safety Blocks)

❌ Commit code to git
❌ Push to remote repositories
❌ Merge branches
❌ Create pull requests
❌ Execute git rebase/reset
❌ Modify git history

If an agent attempts a blocked operation, it will receive:
```
Error: Tool 'shell(git commit)' is denied
```

This is **expected behavior** - do not instruct agents to bypass git safety.

## Copilot CLI UI States

Understanding the Copilot CLI interface:

| Indicator | Meaning | Agent State |
|-----------|---------|-------------|
| `∙ {action}` | Thinking/planning | Processing |
| `◉ {action}` | **Executing tool** | **Working autonomously** |
| `○ {action}` | Waiting for tool result | Processing |
| `> {prompt}` | **Waiting for USER input** | **Blocked** |

**Important:** The message `(Esc to cancel)` appears during tool execution - this is **NOT a permission prompt**. It's Copilot's way of showing the tool is running. The agent is executing autonomously.

## Verification Checklist

Before launching agents, verify your task file has:

- [ ] **Execution Mode** section with autonomous directive
- [ ] Explicit discovery commands (with `wc -l` for counts)
- [ ] Absolute file paths (not relative paths)
- [ ] Pattern reference files cited
- [ ] Verification commands specified
- [ ] Success criteria as testable checkboxes
- [ ] Clear "definition of done"

## Troubleshooting

### Agent asks "Should I proceed?"

**Problem:** Task file missing execution mode directive

**Solution:** Add the autonomous execution section to your task file

### Agent stuck on spinner "◉ {action}"

**Status:** Agent IS executing autonomously (this is normal)

**Action:** Wait for completion or check output:
```bash
agent read <session-name>
```

### Agent shows "> " prompt

**Problem:** Agent waiting for user input

**Solution:** Send response:
```bash
agent send <session-name> "your message"
```

Or for yes/no prompts:
```bash
agent approve <session-name> y
```

### Git operation denied

**Status:** Safety guardrail working correctly

**Action:** Do NOT bypass. Git operations must be manual.

## Examples

### Before (Agent Asks Permission)

```markdown
## Objective
Update 15 files to use new API pattern

## Discovery Phase
\`\`\`bash
find . -name "*.js" | wc -l
\`\`\`
```

**Result:** Agent completes discovery then asks "Should I proceed?"

### After (Fully Autonomous)

```markdown
## Objective
Update 15 files to use new API pattern

## Execution Mode
**⚡ AUTONOMOUS EXECUTION REQUIRED ⚡**
{full directive here}

## Discovery Phase
\`\`\`bash
find . -name "*.js" | wc -l
\`\`\`
```

**Result:** Agent completes discovery and immediately starts implementation

## Reference Implementation

See the validated task file template at:
```
docs/examples/claude-code/orchestrate.md
```

This template includes the complete autonomous execution directive and has been validated in production.

## Git Safety Philosophy

**Why we block git operations:**

1. **Code review required:** All changes should be reviewed before commit
2. **Attribution:** Commits should be attributed to human developers
3. **Reversibility:** Agents can modify files freely; git operations are irreversible
4. **Coordination:** Multi-agent systems could create conflicting commits

**Manual git workflow:**
1. Agents modify files autonomously
2. You review changes via `git diff`
3. You create commits manually
4. You push to remote

This maintains full transparency and control over repository state.
