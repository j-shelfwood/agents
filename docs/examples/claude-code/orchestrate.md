---
description: Orchestrate parallel MCP agents for task implementation
---

# Agent Orchestration

Orchestrate autonomous GitHub Copilot CLI agents via MCP tools.

## Available MCP Tools

```javascript
// Launch agent with task file
mcp__agent__launch_agent({
  project_dir: "/absolute/path/to/project",
  task_file: "/absolute/path/to/task.md"
})

// Wait for state change (blocking - returns when agent completes/waits/errors)
mcp__agent__await_agents({timeout: 300})

// Read agent output
mcp__agent__read_agent_output({session_name: "agent-name", lines: 50})

// Send message to agent
mcp__agent__send_to_agent({session_name: "agent-name", message: "your instruction"})

// Check agent status
mcp__agent__check_agent_status({session_name: "agent-name"})

// List all active agents
mcp__agent__list_agents()

// Terminate agent (when done)
mcp__agent__kill_agent({session_name: "agent-name"})
```

---

## ⚠️ CRITICAL: await_agents() Blocking Pattern

**await_agents() is BLOCKING** - it waits until an agent state change occurs.

### Understanding "Pre-existing State"

When you call `await_agents()` immediately after launching agents:

1. **First Call** - May return IMMEDIATELY with "pre-existing WAITING_FOR_INPUT"
   - This is NORMAL - agents are at the task ingestion prompt
   - They haven't started processing yet

2. **Call await_agents() AGAIN** - Now it BLOCKS until agents transition states
   - WAITING → ACTIVE (agents start processing)
   - ACTIVE → COMPLETED (agents finish task)
   - ACTIVE → WAITING_FOR_INPUT (agents need user input)
   - ACTIVE → ERROR (agents encounter errors)

3. **Loop continues** - Keep calling await_agents() until all agents complete

### The Correct Loop Pattern

```javascript
// Launch agents
mcp__agent__launch_agent({session_name: "agent1", ...})
mcp__agent__launch_agent({session_name: "agent2", ...})
mcp__agent__launch_agent({session_name: "agent3", ...})

const sessions = ["agent1", "agent2", "agent3"]
const results = {}

// IMPORTANT: This while loop will call await_agents() multiple times
// First call may return immediately (pre-existing state)
// Subsequent calls will BLOCK until state changes
while (sessions.length > 0) {
  // BLOCKS here - waits for ANY agent to change state
  const result = mcp__agent__await_agents({
    sessions: sessions,
    timeout: 600
  })

  // Find which agent(s) need attention
  for (const agent of result.agents) {
    if (agent.state === "COMPLETED") {
      // Agent finished - read output
      const output = mcp__agent__read_agent_output({
        session_name: agent.session,
        lines: 200
      })
      results[agent.session] = output

      // Remove from monitoring list
      sessions = sessions.filter(s => s !== agent.session)

    } else if (agent.state === "WAITING_FOR_INPUT") {
      // Agent needs input - read what it's asking
      const output = mcp__agent__read_agent_output({
        session_name: agent.session,
        lines: 100
      })

      // Respond to agent
      mcp__agent__send_to_agent({
        session_name: agent.session,
        message: "Your response here"
      })
      // Agent stays in sessions list - will await again

    } else if (agent.state === "ERROR") {
      // Agent failed - read error and cleanup
      const output = mcp__agent__read_agent_output({
        session_name: agent.session,
        lines: 200
      })
      results[agent.session] = {error: output}

      mcp__agent__kill_agent({session_name: agent.session})
      sessions = sessions.filter(s => s !== agent.session)
    }
  }

  // Loop back - await_agents() will BLOCK again
}

// All agents completed
return results
```

### ❌ Common Mistakes

**Mistake #1: Not Managing Session List**
```javascript
// ❌ WRONG - No sessions parameter causes infinite loop
mcp__agent__launch_agent({session_name: "agent1", ...})
mcp__agent__launch_agent({session_name: "agent2", ...})

while (true) {
  result = mcp__agent__await_agents({timeout: 600})  // ❌ No sessions param
  // await discovers ALL agents every time
  // Returns same completed agent repeatedly → INFINITE INSTANT RETURNS

  if (result.agents[0].state === "WAITING_FOR_INPUT") {
    // Handle agent but don't remove from metadata
    // Next await() rediscovers it → instant return again
  }
}
```

**FIX:** Always pass explicit sessions list and remove handled agents
```javascript
// ✅ CORRECT - Manage session list explicitly
const sessions = ["agent1", "agent2"]

while (sessions.length > 0) {
  result = mcp__agent__await_agents({
    sessions: sessions,  // ✅ Explicit list
    timeout: 600
  })

  if (result.agents[0].state === "WAITING_FOR_INPUT") {
    sessions = sessions.filter(s => s !== result.agents[0].session)  // ✅ Remove
  }
}
```

**Mistake #2: Manual Polling**
```javascript
// ❌ WRONG - Manual polling defeats blocking behavior
mcp__agent__launch_agent({...})
result = mcp__agent__await_agents({timeout: 300})
// Returns: "pre-existing WAITING_FOR_INPUT"

// ❌ Then manually polling:
output1 = mcp__agent__read_agent_output({...})  // Manual check
sleep(5)
output2 = mcp__agent__read_agent_output({...})  // Manual check
sleep(5)
output3 = mcp__agent__read_agent_output({...})  // Manual check
```

**DO THIS INSTEAD:**
```javascript
// ✅ CORRECT - Trust the blocking behavior
mcp__agent__launch_agent({...})

// Loop - await_agents() will block and wake when state changes
while (agent_active) {
  result = mcp__agent__await_agents({timeout: 300})
  // Only returns when agent CHANGES state

  output = mcp__agent__read_agent_output({...})
  // Process output, respond if needed
}
```

---

## Example 1: Launch Agent for Code Review

```javascript
// User: "Review the authentication system"

// 1. Create task file
Write(".agent/tasks/auth-review.md", `
# Task: Review Authentication System

## Objective
Analyze authentication implementation for security issues

## Project Structure
\`\`\`bash
# Start with tree to understand layout
tree --gitignore -L 3
\`\`\`

## Discovery
\`\`\`bash
# Find authentication files
rg "authenticate|login|auth" --type php -l

# Check password handling
rg "password|bcrypt|Hash::" --type php -n

# Find authorization checks
rg "authorize|can\\(|cannot\\(" --type php -n
\`\`\`

## Analysis
Document findings:
- Security vulnerabilities
- Missing authorization checks
- Password handling issues
- Session management concerns

## Output
Output findings directly in chat. Do NOT write report to .md file.
Use cat/echo for formatted output:

\`\`\`bash
cat << 'EOF'
# Authentication Review Results

## Critical Issues
- [List issues]

## Recommendations
- [List recommendations]
EOF
\`\`\`
`)

// 2. Launch agent
mcp__agent__launch_agent({
  project_dir: "/Users/you/projects/myapp",
  task_file: "/Users/you/projects/myapp/.agent/tasks/auth-review.md"
})

// 3. Wait for completion
result = mcp__agent__await_agents({timeout: 300})

// 4. Read findings
findings = mcp__agent__read_agent_output({
  session_name: "agent-myapp-1234567",
  lines: 200
})

// 5. Present to user
"Authentication review complete.

Findings:
[findings summary]

Agent still running with full codebase context.
What would you like to do next?"
```

---

## Example 2: Parallel Code Reviews

```javascript
// User: "3 agents to review different parts of the codebase"

// 1. Create task files for different domains
Write(".agent/tasks/review-backend.md", "Review backend architecture...")
Write(".agent/tasks/review-frontend.md", "Review frontend components...")
Write(".agent/tasks/review-database.md", "Review database queries...")

// 2. Launch all agents in parallel
mcp__agent__launch_agent({project_dir: "/project", task_file: ".agent/tasks/review-backend.md"})
mcp__agent__launch_agent({project_dir: "/project", task_file: ".agent/tasks/review-frontend.md"})
mcp__agent__launch_agent({project_dir: "/project", task_file: ".agent/tasks/review-database.md"})

// 3. Wait for any agent to complete
while (agents_remaining > 0) {
  result = mcp__agent__await_agents({timeout: 300})

  // Extract session name from result
  session = extract_session_from_result(result)

  // Read output
  output = mcp__agent__read_agent_output({session_name: session, lines: 200})

  // Store findings
  findings[session] = output
  agents_remaining--
}

// 4. Present all findings
"All 3 reviews complete:
- Backend: [summary]
- Frontend: [summary]
- Database: [summary]

All agents preserved with context. Next action?"
```

---

## Example 3: Agent Conversation

```javascript
// Agent finds issue and needs clarification

// 1. Launch agent
mcp__agent__launch_agent({project_dir: "/project", task_file: "tasks/refactor.md"})

// 2. Agent completes and waits
result = mcp__agent__await_agents({timeout: 300})
// Returns: "WAITING_FOR_INPUT"

// 3. Read what agent is asking
output = mcp__agent__read_agent_output({session_name: "agent-123", lines: 50})
// "Found 3 different approaches to error handling. Which pattern should I use?"

// 4. Respond to agent
mcp__agent__send_to_agent({
  session_name: "agent-123",
  message: "Use the try-catch pattern from BookingService.php"
})

// 5. Agent continues working
result = mcp__agent__await_agents({timeout: 300})
```

---

## Example 4: Sequential Implementation

```javascript
// User: "Implement error handling across all services"

// 1. Launch agent with implementation task
Write(".agent/tasks/add-error-handling.md", `
# Task: Add Error Handling

## Objective
Add try-catch blocks to all service classes

## Project Structure
\`\`\`bash
tree --gitignore -L 3
\`\`\`

## Discovery
\`\`\`bash
# Find service files
find domain/ -name "*Service.php"

# Check current error handling
rg "try \\{" domain/ --type php -l
\`\`\`

## Implementation
For each service file:
1. Identify methods that need error handling
2. Wrap in try-catch blocks
3. Log errors appropriately
4. Return error responses

## Output
Output summary directly in chat (do NOT write .md file):

\`\`\`bash
cat << 'EOF'
# Error Handling Implementation

## Files Modified
- domain/Booking/Services/BookingService.php
- domain/Payment/Services/PaymentService.php
[... list all modified files]

## Changes Made
- Added try-catch to 15 service methods
- Added error logging with context
- Standardized error response format
EOF
\`\`\`

## Git Safety
- You can read git history: git log, git diff
- You CANNOT commit: git commits are blocked
`)

mcp__agent__launch_agent({project_dir: "/project", task_file: "tasks/add-error-handling.md"})

// 2. Monitor progress
result = mcp__agent__await_agents({timeout: 600})

// 3. Read results
output = mcp__agent__read_agent_output({session_name: "agent-123", lines: 300})

// 4. User reviews changes, then commits manually
"Agent completed error handling implementation.

Changes made to 15 service files.
Review the changes with git diff and commit when ready."
```

---

## Task File Guidelines

**Simple structure:**

```markdown
# Task: {What to do}

## Objective
{Clear goal}

## Project Structure
\`\`\`bash
# ALWAYS start with tree to understand project layout
tree --gitignore -L 3
\`\`\`

## Discovery
\`\`\`bash
# Commands to find relevant files/patterns
rg "pattern" --type lang -l
find path/ -name "*.ext"
\`\`\`

## Analysis/Implementation
{What to analyze or implement}

## Output
**IMPORTANT:** Output report directly in chat. Do NOT write to .md files.

Generate report as terminal output:
- Use echo/cat for formatted output
- Include findings, metrics, recommendations
- Structured markdown in terminal
```

**Critical Requirements:**

1. **Start with tree command:**
   ```bash
   tree --gitignore -L 3  # ALWAYS first command
   ```

2. **Output reports in chat, NOT files:**
   - ❌ DON'T: Write reports to .md files
   - ✅ DO: Output reports directly as terminal/chat messages
   - Use `cat << 'EOF'` for formatted multi-line output

3. **Git Safety:**
   - Agents CAN: `git log`, `git diff`, `git show`
   - Agents CANNOT: `git commit`, `git push`, `git merge`
   - These are blocked by `--deny-tool` flags

**Keep it simple:**
- No phase complexity
- Clear discovery commands
- Specific objective
- Output directly to chat

---

## Common Patterns

### Pattern: Wait and Read
```javascript
// Launch
mcp__agent__launch_agent({...})

// Wait for completion
mcp__agent__await_agents({timeout: 300})

// Read results
mcp__agent__read_agent_output({session_name: "...", lines: 200})
```

### Pattern: Supervise Multiple Agents
```javascript
// Launch N agents
for (task of tasks) {
  mcp__agent__launch_agent({task_file: task})
}

// Collect results as they complete
while (completed < total) {
  result = mcp__agent__await_agents({timeout: 300})
  session = extract_session(result)
  findings[session] = mcp__agent__read_agent_output({session_name: session})
  completed++
}
```

### Pattern: Interactive Agent
```javascript
// Launch
mcp__agent__launch_agent({...})

// Wait for question
result = mcp__agent__await_agents({timeout: 300})

// Read question
question = mcp__agent__read_agent_output({session_name: "..."})

// Answer
mcp__agent__send_to_agent({session_name: "...", message: "answer"})

// Continue monitoring
result = mcp__agent__await_agents({timeout: 300})
```

---

## Key Points

1. **Launch and forget** - Agents run autonomously in tmux sessions

2. **await_agents() is BLOCKING** - It waits until state changes occur
   - First call after launch may return immediately ("pre-existing state")
   - **Call await_agents() AGAIN** in a loop - subsequent calls will block
   - Returns only when agents transition states (WAITING→ACTIVE→COMPLETED)
   - ❌ DON'T manually poll with read_agent_output() in a loop
   - ✅ DO trust the blocking behavior and call await_agents() repeatedly

3. **Use while loops** - Call await_agents() multiple times until all agents complete
   - Pattern: `while (sessions.length > 0) { await_agents() }`
   - Each iteration handles one state change
   - Loop automatically continues monitoring remaining agents

4. **Read output to see results** - Use read_agent_output after await_agents returns

5. **Send messages for clarification** - If agent asks questions, respond via send_to_agent
   - After responding, call await_agents() again to continue monitoring

6. **Git is read-only** - Agents can analyze git history but cannot commit
   - Blocked tools: git commit, git push, git merge

7. **Keep agents alive** - They maintain codebase context, useful for follow-up tasks

8. **Kill when done** - Use kill_agent when agent no longer needed

---

Now: Apply these patterns to the user's request.
