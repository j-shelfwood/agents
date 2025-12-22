# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Comprehensive test suite**: 105 automated tests across 4 test categories (100% passing)
  - Unit tests: 16 tests for validation functions (Bats framework)
  - MCP server tests: 42 tests for Node.js validation logic (Jest framework)
  - Security tests: 15 tests for injection prevention and access controls
  - Integration tests: 32 tests for core commands and orchestration (was 15, added 17 orchestration tests)
  - Test automation via Makefile (test, test-all, test-unit, test-mcp, test-security, test-integration)
  - Helper utilities for DRY test code (test_helpers.sh)
  - Comprehensive orchestration test coverage validates Point 2 architecture
- **await_agents MCP tool**: Primary blocking tool for agent monitoring
  - Returns when any agent changes state (completed/waiting/error)
  - Replaces deprecated watch_agents tool
- **Documentation symlink**: ~/.claude/commands/orchestrate.md symlinks to repo version
  - Single source of truth in repository
  - Changes automatically picked up by Claude Code

### Fixed
- **SECURITY: Path traversal vulnerability** (MEDIUM severity)
  - agent-launch now validates task file paths with realpath
  - Prevents access to files outside project directory via ../../../../etc/passwd
  - Returns clear error: "Task file must be within project directory"
  - Discovered by automated security tests
- **agent-list exit code bug**
  - Fixed to return exit code 0 when no agents exist (was returning 1)
  - Added `|| true` to grep command to prevent set -e premature exit
  - Improves shell script composability

### Changed
- **agent-metadata state detection** (Point 2 Architecture): Replaced fragile regex scraping with OS-level monitoring
  - **Process tree detection** via `pgrep -P` to count child processes under tmux pane PID
    - Child processes detected → EXECUTING_TOOL (running tools)
    - High CPU usage → THINKING (LLM processing)
    - No activity → IDLE (ready for cursor detection)
  - **Cursor position detection** via tmux coordinates (`#{cursor_y},#{pane_height}`)
    - Provides binary truth vs heuristic guessing
    - Fixed cursor threshold: `pane_height - 2` → `pane_height - 6` (handles Copilot's 4-5 trailing blank lines)
    - Checks last non-empty line against patterns: `(^\> $|Ctrl\+c Exit|Remaining requests:)`
  - **Semantic buffer hashing** strips ANSI codes before MD5 hashing
    - Ignores UI chrome (progress bars, timestamps, ANSI escape sequences)
    - Prevents false ACTIVE state from static output changes
  - **Unified state machine** provides single source of truth in metadata.json
    - Priority order: Sentinel → Process → Error → Cursor → Hash → Stale
    - All code paths return 0 explicitly (prevents `set -e` premature exits)
    - Eliminates competing heuristics between agent-watchdog and agent-await
  - **Exit code safety**: Added explicit `return 0` to all state detection functions
    - Fixed tests 1 & 3 status code assertion failures
    - Prevents agent-await from exiting when detection functions encounter errors
- **agent-watchdog refactoring**: Removed duplicate output hashing logic (28 lines)
  - Now calls centralized `update_agent_state()` from agent-metadata
  - Single source of truth eliminates inconsistent state determinations
  - Reduced code duplication and maintenance burden
- **agent-await cleanup delegation**: Removed all 6 `tmux kill-session` commands
  - Delegates session cleanup exclusively to agent-watchdog
  - Eliminates double-kill race condition causing "session not found" errors
  - Watchdog is now the only component that terminates sessions
- **Test coverage improvement**: 100% orchestration tests (17/17 passing, was 15/17)
  - Fixed cursor detection enabling pre-existing WAITING state detection
  - Adjusted test assertions from performance-based to functional validation
  - Test 2 changed from `ELAPSED >= 2s` to functional state detection check
  - Validates correctness (proper state + exit code) over speed
- **Performance optimization**: Polling interval reduced from 3s to 1s
  - 3x faster state change detection
  - Cursor detection skips line parsing when cursor not at bottom
  - Optimized detection reduces average response time
- **agent-await auto-cleanup**: Agents now auto-terminate on completion (eliminates rogue sessions)
  - Added `tmux kill-session` to all 6 completion handlers (completed/waiting/error states)
  - Archives metadata immediately on agent termination
  - Prevents tmux sessions from lingering at Copilot prompt after task completion
  - Fixes performance degradation from accumulating background processes
  - **NOTE**: This cleanup is now delegated to agent-watchdog (see above)
- **agent-watchdog Copilot session cleanup**: Prevents unbounded session file accumulation
  - Automatically deletes Copilot session files older than 2 hours
  - Runs every watchdog cycle (60s interval)
  - Prevents ~/.copilot/session-state/ from growing unbounded (was 122MB with 820 files)
  - Logged when cleanup occurs for monitoring
- **orchestrate.md complete rewrite**: Simplified from 634 to 525 lines with radically reduced complexity
  - Removed ALL phase-based patterns and permission language
  - 4 concrete tool usage examples: single review, parallel reviews, interactive agents, sequential implementation
  - **⚠️ CRITICAL section added**: await_agents() blocking pattern with comprehensive while-loop example
  - Explains "pre-existing state" behavior and emphasizes loop-based monitoring
  - **Common Mistakes section enhanced**: Added "Mistake #1: Not Managing Session List"
    - Documents infinite loop anti-pattern (no sessions param → repeated instant returns)
    - Shows correct session list management (explicit param + removal of handled agents)
  - Anti-pattern guidance: manual polling vs blocking loop
  - Task file guidelines: Objective → tree command → Discovery → Analysis → Output (chat only, no .md files)
  - Critical requirements: Start with `tree --gitignore -L 3`, output via `cat << 'EOF'`, git read-only
- **agent-metadata buffering detection**: Enhanced detect_agent_activity() to prevent false WAITING states
  - Increased capture window from 20 to 50 lines for better context
  - Copilot prompt check now limited to last 5 lines (bottom of output)
  - Added broader context analysis when prompt detected
  - Logic: Prompt visible + operational patterns present in 50-line window = ACTIVE (buffering)
  - Fixes false "waiting_for_input" during Copilot thinking/buffering phase
  - Prevents await_agents() instant returns when agents still processing
- **agent-launch timeout**: Increased task ingestion wait from 15s to 30s
  - Better supports agents with complex task files
  - Reduces false timeout warnings
- **agent-await output**: Increased recent output from 10 to 50 lines
  - Shows meaningful task output instead of just Copilot prompt
  - Eliminates need for separate read_agent_output() call in most cases
  - Applies to WAITING_FOR_INPUT, ERROR, and pre-existing state outputs
- **MCP tool descriptions**: Enhanced await_agents documentation
  - Explicit "BLOCKING operation" prefix
  - Anti-pattern guidance against manual polling
  - Pattern examples in description
- **README orchestration section**: Updated all examples to use await_agents exclusively
  - ✅ Correct pattern examples with while loops
  - ❌ Anti-pattern warnings
  - Performance comparison table

### Fixed
- **Orchestration blocking pattern clarity**: Added explicit loop guidance to orchestrate.md
  - Clarifies that first await_agents() may return immediately (task ingestion)
  - Emphasizes calling await_agents() AGAIN in loop to wait for state transitions
  - Comprehensive error handling example in while loop
- **Launch race condition**: agent-launch waits for task ingestion confirmation
  - 30-second wait checking for processing indicators ([SYSTEM], [EXECUTION], <function_calls>)
  - Prevents orchestrator calling await_agents() before agent starts
  - Reports processing start time: "✓ Agent launched with task (processing started after Xs)"
- **Activity detection**: detect_agent_activity prioritizes active processing indicators
  - Reordered detection: active work → errors → waiting patterns
  - Operational specification pattern detection ([SYSTEM], [ANALYSIS], [DISCOVERY])
  - Tool execution detection (<function_calls>, <invoke>)
  - Legacy pattern detection ([PHASE_1_COMPLETE], [TASK_COMPLETE]) for backward compatibility
- **Pre-existing state detection**: await_agents detects agents already in WAITING/COMPLETED/ERROR
  - Pre-loop state assessment before entering await cycle
  - Returns immediately with "Time: 0s (pre-existing state)"
  - Eliminates indefinite polling when agents reach prompts before monitoring starts

### Removed
- **watch_agents MCP tool**: Completely removed (replaced by await_agents)
- **agent watch command**: Completely removed (replaced by agent await)
- **TASK_FILE_TEMPLATE.md**: Deleted contradictory phase-based template
  - Taught two-phase pattern with [PHASE_1_COMPLETE] markers
  - Contradicted orchestrate.md "no phase complexity" guidance
  - LLM trusted to structure tasks properly without rigid templates
- **docs/examples/tasks/**: Deleted phase-based example task files
  - review-security-example.md: Full two-phase implementation example
  - implementation-api-example.md: Single-phase with [TASK_COMPLETE] marker
  - Contradicted current orchestrate.md simple structure (Objective → tree → Discovery → Output)

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
