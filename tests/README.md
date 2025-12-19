# Agent Test Suite

Automated testing infrastructure for the shelfwood-agents orchestration system.

## Quick Start

```bash
# Install dependencies
npm install -g bats

# Run quick test suite (30 seconds)
make test

# Run all tests (2-3 minutes)
make test-all

# View test summary
cat TEST_SUMMARY.md
```

## Test Organization

```
tests/
├── unit/                # Fast, isolated function tests
├── integration/         # Command lifecycle tests
├── security/            # Injection & vulnerability tests
├── helpers/             # Shared utilities
└── orchestration-patterns.sh  # Existing orchestration tests
```

## Test Categories

### Unit Tests (Fast, No Dependencies)

Test individual functions in isolation.

**Run:**
```bash
make test-unit
# or
bats tests/unit/*.bats
```

**Coverage:**
- Input validation functions
- Session name sanitization
- Configuration parsing
- Metadata utilities

**Duration:** ~5 seconds

### Security Tests (Critical)

Verify protection against injection attacks and vulnerabilities.

**Run:**
```bash
make test-security
# or
bats tests/security/*.bats
```

**Validates:**
- Shell command injection prevention
- Path traversal blocking
- System directory protection
- Special character sanitization

**Duration:** ~15 seconds

**Note:** Test suite will fail if vulnerabilities detected (by design).

### Integration Tests (Requires tmux)

Test complete command workflows and interactions.

**Run:**
```bash
make test-integration
# or
bats tests/integration/*.bats
```

**Tests:**
- agent launch/kill lifecycle
- agent list/status/read commands
- Metadata file creation/deletion
- Tmux session management
- TTL configuration

**Duration:** ~30-60 seconds

## Common Commands

### Run All Tests
```bash
make test-all
```

### Run Specific Test File
```bash
bats tests/unit/test_validation.bats
```

### Run Single Test Case
```bash
bats tests/unit/test_validation.bats -f "rejects semicolon"
```

### Verbose Output
```bash
bats tests/security/test_injection.bats --verbose-run
```

### Clean Test Artifacts
```bash
make clean
```

## Writing New Tests

### Test File Template

```bash
#!/usr/bin/env bats
# Description of what this test file covers

# Load helpers
source "$(dirname "$BATS_TEST_FILENAME")/../helpers/test_helpers.sh"

setup() {
    test_setup
    # Additional setup
}

teardown() {
    # Cleanup
    test_teardown
}

@test "descriptive test name" {
    # Arrange
    SESSION=$(generate_test_session_name "test")

    # Act
    run "$AGENT_CMD" command args

    # Assert
    [ "$status" -eq 0 ]
    [[ "$output" =~ "expected output" ]]

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}
```

### Helper Functions Available

From `tests/helpers/test_helpers.sh`:

**Cleanup:**
- `cleanup_test_sessions()` - Remove all test agents/metadata
- `test_setup()` - Call in setup()
- `test_teardown()` - Call in teardown()

**Utilities:**
- `generate_test_session_name(suffix)` - Generate unique session name
- `create_test_task(file, content)` - Create test task markdown file
- `wait_for_session(session, max_wait)` - Wait for tmux session
- `wait_for_session_gone(session, max_wait)` - Wait for cleanup

**Assertions:**
- `assert_file_exists(file, message)`
- `assert_file_not_exists(file, message)`
- `assert_contains(haystack, needle, message)`
- `assert_success(exit_code, message)`
- `assert_failure(exit_code, message)`

**Variables:**
- `$AGENT_CMD` - Path to agent command
- `$TEST_SESSION_PREFIX` - Prefix for test sessions ("test-agent-")

### Bats Assertions

```bash
# Exit status
[ "$status" -eq 0 ]        # Success
[ "$status" -ne 0 ]        # Failure
[ "$status" -eq 1 ]        # Specific exit code

# String matching
[[ "$output" =~ "pattern" ]]      # Regex match
[[ "$output" == "exact" ]]        # Exact match
[[ "$output" != "not this" ]]     # Not equal

# File operations
[ -f "$file" ]             # File exists
[ ! -f "$file" ]           # File doesn't exist
[ -d "$dir" ]              # Directory exists

# Command execution
run command args           # Capture exit code and output
run -0 command             # Expect success
run -1 command             # Expect failure
```

## Test Best Practices

### 1. Always Clean Up

```bash
@test "my test" {
    SESSION=$(generate_test_session_name "test")

    # Your test logic...

    # ALWAYS cleanup, even if test fails
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}
```

### 2. Use Unique Session Names

```bash
# ❌ Bad - can collide
SESSION="test-session"

# ✅ Good - unique every run
SESSION=$(generate_test_session_name "mytest")
```

### 3. Wait for Async Operations

```bash
# Launch agent
"$AGENT_CMD" launch /tmp task.md --session "$SESSION"

# Wait for tmux session to be ready
wait_for_session "$SESSION" 5

# Now safe to check status
"$AGENT_CMD" status "$SESSION"
```

### 4. Test Error Cases

```bash
@test "command fails for invalid input" {
    run "$AGENT_CMD" command "invalid-input"

    # Verify it fails
    [ "$status" -ne 0 ]

    # Verify error message
    [[ "$output" =~ "Error:" ]]
}
```

### 5. Isolate Tests

Each test should:
- Run independently
- Not depend on other tests
- Clean up after itself
- Use unique names

## Debugging Tests

### Run in Verbose Mode

```bash
bats tests/unit/test_validation.bats --verbose-run
```

### Print Debug Output

```bash
@test "debug example" {
    echo "Debug: value=$value" >&3  # Shows in verbose mode

    run command
    echo "Output: $output" >&3      # Shows command output
}
```

### Run Single Failing Test

```bash
# Find failing test name
bats tests/security/test_injection.bats

# Run just that test
bats tests/security/test_injection.bats -f "path traversal"
```

### Check Test Artifacts

```bash
# View test sessions
agent list | grep test-agent

# View test metadata
ls ~/.local/share/copilot-agent/metadata/test-agent-*

# View test task files
ls /tmp/*test*.md
```

## Continuous Integration

### GitHub Actions (Future)

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install -g bats
      - run: sudo apt-get install -y tmux
      - run: make test-all
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

make test
if [ $? -ne 0 ]; then
    echo "Tests failed. Commit aborted."
    exit 1
fi
```

## Troubleshooting

### "bats: command not found"

```bash
npm install -g bats
```

### "tmux: command not found"

```bash
# macOS
brew install tmux

# Linux
sudo apt-get install tmux
```

### Tests Fail Due to Stale Sessions

```bash
# Clean up manually
make clean

# Or
tmux kill-server  # Kills ALL tmux sessions
```

### Permission Errors

```bash
# Ensure metadata directory writable
chmod 755 ~/.local/share/copilot-agent/metadata

# Ensure agent command executable
chmod +x agent/agent*
```

## Test Coverage Goals

Current: **~25%**
Target: **80%**

### High Priority (0% → 60%)
- [x] Validation functions
- [x] Security injection prevention
- [x] Core command lifecycle
- [ ] MCP server tools
- [ ] agent-await monitoring
- [ ] agent-watchdog lifecycle

### Medium Priority (60% → 80%)
- [ ] Multi-agent orchestration
- [ ] Error recovery scenarios
- [ ] TTL auto-shutdown
- [ ] Metadata state machine

### Low Priority (80% → 95%)
- [ ] Performance benchmarks
- [ ] Edge cases
- [ ] Stress tests

## Contributing

When adding new features:

1. Write tests first (TDD)
2. Run `make test` before committing
3. Add security tests for user input
4. Update TEST_SUMMARY.md

## Resources

- [Bats Documentation](https://bats-core.readthedocs.io/)
- [Bats GitHub](https://github.com/bats-core/bats-core)
- [Testing Bash Scripts](https://www.redhat.com/sysadmin/bash-script-testing)

## Support

For issues with tests:
1. Check TEST_SUMMARY.md for known issues
2. Run with `--verbose-run` for details
3. Clean artifacts with `make clean`
4. Check individual test file comments
