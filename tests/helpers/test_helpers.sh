#!/bin/bash
# Test helper functions
# Source this file in test suites for common utilities

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Agent command location
AGENT_CMD="${AGENT_CMD:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../agent" && pwd)/agent}"

# Test session prefix
TEST_SESSION_PREFIX="test-agent-"

# Cleanup all test sessions
cleanup_test_sessions() {
    local pattern="${1:-test-agent-}"

    # Kill all test tmux sessions
    tmux list-sessions 2>/dev/null | grep "^${pattern}" | cut -d: -f1 | while read -r session; do
        tmux kill-session -t "$session" 2>/dev/null || true
    done

    # Clean up test metadata files
    if [[ -d ~/.local/share/copilot-agent/metadata ]]; then
        find ~/.local/share/copilot-agent/metadata -name "${pattern}*.json" -delete 2>/dev/null || true
    fi

    # Clean up test task files
    rm -f /tmp/test-task-*.md /tmp/agent-test-*.md 2>/dev/null || true
}

# Generate unique test session name
generate_test_session_name() {
    local suffix="${1:-$(date +%s%N | md5sum | cut -c1-8)}"
    echo "${TEST_SESSION_PREFIX}${suffix}"
}

# Create a simple test task file
create_test_task() {
    local task_file="$1"
    local content="${2:-Print 'Test task completed' and return to prompt}"

    cat > "$task_file" <<EOF
# Test Task

$content
EOF
    echo "$task_file"
}

# Wait for tmux session to exist
wait_for_session() {
    local session="$1"
    local max_wait="${2:-10}"
    local waited=0

    while [[ $waited -lt $max_wait ]]; do
        if tmux has-session -t "$session" 2>/dev/null; then
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    return 1
}

# Wait for session to disappear
wait_for_session_gone() {
    local session="$1"
    local max_wait="${2:-10}"
    local waited=0

    while [[ $waited -lt $max_wait ]]; do
        if ! tmux has-session -t "$session" 2>/dev/null; then
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done

    return 1
}

# Assert file exists
assert_file_exists() {
    local file="$1"
    local message="${2:-File should exist: $file}"

    if [[ ! -f "$file" ]]; then
        echo "ASSERTION FAILED: $message" >&2
        return 1
    fi
    return 0
}

# Assert file does not exist
assert_file_not_exists() {
    local file="$1"
    local message="${2:-File should not exist: $file}"

    if [[ -f "$file" ]]; then
        echo "ASSERTION FAILED: $message" >&2
        return 1
    fi
    return 0
}

# Assert string contains substring
assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-String should contain: $needle}"

    if [[ ! "$haystack" =~ $needle ]]; then
        echo "ASSERTION FAILED: $message" >&2
        echo "  Expected to find: $needle" >&2
        echo "  In string: $haystack" >&2
        return 1
    fi
    return 0
}

# Assert command succeeds
assert_success() {
    local exit_code="$1"
    local message="${2:-Command should succeed (exit code 0)}"

    if [[ $exit_code -ne 0 ]]; then
        echo "ASSERTION FAILED: $message" >&2
        echo "  Exit code: $exit_code" >&2
        return 1
    fi
    return 0
}

# Assert command fails
assert_failure() {
    local exit_code="$1"
    local message="${2:-Command should fail (non-zero exit code)}"

    if [[ $exit_code -eq 0 ]]; then
        echo "ASSERTION FAILED: $message" >&2
        return 1
    fi
    return 0
}

# Setup function - call at beginning of test
test_setup() {
    cleanup_test_sessions
}

# Teardown function - call at end of test
test_teardown() {
    cleanup_test_sessions
}
