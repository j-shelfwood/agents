# Task: Create Documentation and Examples for Public Release

## Objective
Create comprehensive documentation including Claude Code slash command example and update README for public distribution.

## Discovery Phase (Agent MUST execute these first)
Before making ANY changes, agent must verify structure:

```bash
# Check current documentation
ls -la docs/
cat docs/ORCHESTRATION_PATTERNS.md | head -20

# Verify orchestrate.md exists
ls -la ~/.claude/commands/orchestrate.md
wc -l ~/.claude/commands/orchestrate.md

# Check README current state
head -50 README.md

# Verify project root
pwd
ls -la
```

**Agent must report documentation inventory before proceeding.**

## Context
- Source file: ~/.claude/commands/orchestrate.md (486 lines)
- Target structure: docs/examples/claude-code/
- Files to create: 2 new files (orchestrate.md copy + README.md)
- Files to update: README.md (remove personal paths)
- Pattern: Example templates for user installation

## Requirements
Agent must implement the following systematically:

1. Create docs/examples/claude-code/ directory structure

2. Copy orchestrate.md to new location:
   ```bash
   mkdir -p docs/examples/claude-code
   cp ~/.claude/commands/orchestrate.md docs/examples/claude-code/orchestrate.md
   ```

3. Create docs/examples/claude-code/README.md with content:
   ```markdown
   # Claude Code Slash Command: /orchestrate

   This directory contains a slash command for Claude Code that demonstrates
   best practices for using the copilot-agent MCP server.

   ## What is /orchestrate?

   The `/orchestrate` command transforms Claude Code into a strategic orchestrator
   that manages multiple autonomous GitHub Copilot CLI agents in parallel.

   ## Prerequisites

   - copilot-agent MCP server installed and configured
   - Claude Code with MCP support
   - GitHub Copilot CLI v0.0.361+

   ## Installation

   Copy the slash command to your Claude Code commands directory:

   ```bash
   mkdir -p ~/.claude/commands
   cp orchestrate.md ~/.claude/commands/
   ```

   Verify installation:
   ```bash
   ls -la ~/.claude/commands/orchestrate.md
   ```

   ## Usage

   In Claude Code, use the slash command followed by your orchestration request:

   ```
   /orchestrate Add error handling to all API endpoints
   /orchestrate Refactor authentication system across 3 modules
   /orchestrate Add tests to all utility functions
   ```

   ## How It Works

   The slash command enforces a structured workflow:

   1. **Discovery**: Claude enumerates all files needing modification
   2. **Task Decomposition**: Breaks work into parallelizable units
   3. **Task File Creation**: Writes detailed specifications
   4. **Agent Spawning**: Launches multiple agents in parallel
   5. **Blocking Supervision**: Monitors agents using await_agents()
   6. **Verification**: Confirms all work completed successfully
   7. **Synthesis**: Reports results to you

   ## Documentation

   For complete orchestration patterns and examples, see:
   - [ORCHESTRATION_PATTERNS.md](../../ORCHESTRATION_PATTERNS.md)
   - [Main README](../../../README.md)

   ## Customization

   You can customize this slash command by editing orchestrate.md to:
   - Adjust timeout values
   - Modify task file templates
   - Add project-specific patterns
   - Change verification requirements

   ## Troubleshooting

   **Slash command not recognized:**
   - Verify file is in ~/.claude/commands/
   - Restart Claude Code
   - Check file has .md extension

   **Agents fail to spawn:**
   - Verify MCP server is configured in Claude Code settings
   - Check copilot CLI is installed (v0.0.361+)
   - Run `agent doctor` to verify system health

   **await_agents() finds no sessions:**
   - Agents may have failed on spawn
   - Check tmux sessions: `tmux list-sessions`
   - Review copilot logs for errors
   ```

4. Update README.md to remove personal paths:
   - Remove alias example showing ~/projects/shelfwood-agents
   - Remove example paths with /Users/shelfwood
   - Add "Installation" section linking to installation guide
   - Add "Platform Support" section
   - Update MCP configuration example to use placeholders

5. Verify no personal references remain in documentation:
   - No ~/.shelfwood paths
   - No /Users/shelfwood paths
   - No Obsidian references (make optional in docs)

## Verification Commands (Agent MUST run these before completion)
After implementation, agent must verify:

```bash
# Verify directory structure created
ls -la docs/examples/claude-code/
test -d docs/examples/claude-code && echo "✓ Directory exists"

# Verify orchestrate.md copied
test -f docs/examples/claude-code/orchestrate.md && echo "✓ orchestrate.md exists"
wc -l docs/examples/claude-code/orchestrate.md

# Verify README created
test -f docs/examples/claude-code/README.md && echo "✓ README exists"
wc -l docs/examples/claude-code/README.md

# Verify no personal paths in main README
grep "/Users/shelfwood\|\.shelfwood\|~/projects/shelfwood" README.md && echo "❌ Personal paths found" || echo "✓ No personal paths"

# Check orchestrate.md integrity
diff ~/.claude/commands/orchestrate.md docs/examples/claude-code/orchestrate.md && echo "✓ Files identical"
```

## Success Criteria
- [x] docs/examples/claude-code/ directory created
- [x] orchestrate.md copied to examples directory
- [x] docs/examples/claude-code/README.md created with installation guide
- [x] Main README.md updated (personal paths removed)
- [x] No ~/.shelfwood references in documentation
- [x] No /Users/shelfwood references in documentation
- [x] orchestrate.md file integrity verified (matches source)
- [x] All verification commands pass

## Completion Confirmation
Agent must report:
1. Files created: 2 (orchestrate.md, README.md in examples/)
2. Files updated: 1 (main README.md)
3. Personal paths removed: Verified with grep
4. Verification: All test commands passed
