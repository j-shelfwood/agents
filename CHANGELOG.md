# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **await_agents tool**: Primary (and only) MCP tool for agent monitoring
- **await command**: Primary (and only) CLI command (`agent await`) for monitoring agents
- **Orchestration patterns documentation**: Comprehensive guide at `docs/ORCHESTRATION_PATTERNS.md`
  - Event-driven vs manual polling patterns
  - Real-world examples (wave-based refactoring, error recovery)
  - Common mistakes and migration guide
  - Tool selection matrix
- **Test suite**: Orchestration pattern validation tests (`tests/orchestration-patterns.sh`)
  - Pre-existing state detection tests
  - Multi-agent monitoring tests
  - Alias verification tests
- **Usage hints**: In-terminal guidance for await command
  - Tip message: "await blocks until state change. No manual polling needed!"
  - Pattern reminder: "launch → await → handle → await → repeat"
- **Enhanced error messages**: Better guidance when no active sessions found
  - Shows how to launch agents from CLI and Claude Code

### Changed
- **MCP tool descriptions**: Enhanced clarity for await_agents
  - Explicit "BLOCKING operation" prefix
  - Anti-pattern guidance: "Use this INSTEAD of manual polling loops"
  - Pattern example in description
- **README orchestration section**: Updated to prioritize await_agents
  - All examples use await_agents (not watch_agents)
  - ✅ Correct pattern examples
  - ❌ Anti-pattern warnings
  - Performance comparison table
  - Link to comprehensive documentation
- **CLI help text**: Reordered to show await first, watch marked deprecated
- **Documentation patterns**: All guides updated to use await_agents as primary tool

### Fixed
- **agent-await race condition**: Pre-existing waiting states now detected immediately
  - Added pre-loop state assessment before entering await cycle
  - Fixes scenario where agents reach permission prompts before await starts
  - Returns immediately with "Time: 0s (pre-existing state)" instead of polling indefinitely
  - Applies to COMPLETED, WAITING_FOR_INPUT, and ERROR states

### Removed
- **watch_agents MCP tool**: Removed completely (replaced by await_agents)
  - No deprecation period - immediate replacement
  - Clean break for clearer API semantics
- **agent watch command**: Removed completely (replaced by agent await)
  - Script renamed from agent-watch to agent-await
  - Internal implementation calls `agent await` instead of `agent watch`

### Documentation
- New `docs/ORCHESTRATION_PATTERNS.md` with complete orchestration guide
  - All examples use await_agents exclusively
  - No mention of watch_agents (removed completely)
- Updated README with testing section
- Enhanced CLI help text with await as only command
- Updated `/orchestrate` slash command to use await_agents
- Updated system instructions (agent-orchestration.md, TASK-TOOL-BLOCKING.md) to use await_agents

## [1.0.0] - 2025-11-16

### Added
- Agent management CLI (13 bash commands)
- MCP server for Claude Code integration
- Metadata tracking system for agent sessions
- Support for launching, monitoring, and controlling GitHub Copilot CLI agents
- Automatic session correlation and state tracking
- Interactive and non-interactive operation modes

### Changed
- Relocated visualization system to separate glance project

### Infrastructure
- MIT License
- EditorConfig for code consistency
- Basic repository structure and documentation
