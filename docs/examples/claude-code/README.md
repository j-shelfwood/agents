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

**Recommended: Symlink for single source of truth**

```bash
# From this directory (docs/examples/claude-code/)
mkdir -p ~/.claude/commands
ln -sf $(pwd)/orchestrate.md ~/.claude/commands/orchestrate.md
```

This ensures changes to the repo version are automatically used by Claude Code.

**Alternative: Manual copy**

```bash
mkdir -p ~/.claude/commands
cp orchestrate.md ~/.claude/commands/
```

Note: With manual copy, you must copy again after each update.

Verify installation:
```bash
ls -la ~/.claude/commands/orchestrate.md
# Should show: orchestrate.md -> /path/to/shelfwood-agents/docs/examples/claude-code/orchestrate.md
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
- [orchestrate.md](./orchestrate.md) - Agent orchestration patterns and examples
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
