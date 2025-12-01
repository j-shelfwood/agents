#!/bin/bash
# Orchestration Pattern Tests
# Validates correct await_agents behavior and pattern usage

set -e

# Detect agent command location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_CMD="$SCRIPT_DIR/../agent/agent"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Cleanup function
cleanup() {
    echo ""
    echo -e "${CYAN}Cleaning up test sessions...${NC}"
    "$AGENT_CMD" list 2>/dev/null | grep "agent-test-" | awk '{print $1}' | while read -r session; do
        "$AGENT_CMD" kill "$session" 2>/dev/null || true
    done
}

trap cleanup EXIT

# Test helper functions
test_start() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}TEST: $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# ============================================================================
# TEST 1: Pre-existing WAITING state detection (race condition fix)
# ============================================================================
test_preexisting_waiting_state() {
    test_start "Pre-existing WAITING state detection"

    # Create a test task that immediately prompts
    TEST_TASK=$(mktemp /tmp/agent-test-task.XXXXXX.md)
    cat > "$TEST_TASK" << 'EOF'
# Test Task: Immediate Prompt

Ask the user: "Should I continue? (y/n)"
EOF

    # Launch agent with task that prompts immediately
    echo "Launching agent with immediate prompt task..."
    SESSION=$("$AGENT_CMD" launch /tmp "$TEST_TASK" --session agent-test-immediate 2>&1 | grep "Session:" | awk '{print $2}')

    if [[ -z "$SESSION" ]]; then
        test_fail "Failed to launch agent"
        rm -f "$TEST_TASK"
        return
    fi

    # Give agent time to reach prompt (but less than typical poll interval)
    sleep 2

    # Now call await - should detect pre-existing WAITING state immediately
    echo "Calling await_agents (should return immediately)..."
    START_TIME=$(date +%s)
    WATCH_OUTPUT=$("$AGENT_CMD" await --sessions "$SESSION" --timeout 10 2>&1 || true)
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo "Watch elapsed time: ${ELAPSED}s"
    echo "Watch output:"
    echo "$WATCH_OUTPUT"

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
    rm -f "$TEST_TASK"

    # Validate results
    if echo "$WATCH_OUTPUT" | grep -q "WAITING_FOR_INPUT"; then
        if echo "$WATCH_OUTPUT" | grep -q "Time:.*0s"; then
            if [[ $ELAPSED -lt 5 ]]; then
                test_pass "Detected pre-existing WAITING state in ${ELAPSED}s"
            else
                test_fail "Detection took too long: ${ELAPSED}s (should be < 5s)"
            fi
        else
            test_fail "Did not report 'Time: 0s (pre-existing state)'"
        fi
    else
        test_fail "Did not detect WAITING_FOR_INPUT status"
    fi
}

# ============================================================================
# TEST 2: Session termination detection
# ============================================================================
test_session_termination_detection() {
    test_start "Session termination detection"

    # Create a test task
    TEST_TASK=$(mktemp /tmp/agent-test-task.XXXXXX.md)
    cat > "$TEST_TASK" << 'EOF'
# Test Task: Quick Completion

Print "Done!" and return to prompt.
EOF

    # Launch agent
    echo "Launching agent with quick task..."
    SESSION=$("$AGENT_CMD" launch /tmp "$TEST_TASK" --session agent-test-terminated 2>&1 | grep "Session:" | awk '{print $2}')

    if [[ -z "$SESSION" ]]; then
        test_fail "Failed to launch agent"
        rm -f "$TEST_TASK"
        return
    fi

    # Give agent time to complete task and return to prompt
    sleep 3

    # Manually terminate the session to test COMPLETED detection
    tmux kill-session -t "$SESSION" 2>/dev/null

    # Now call await - should detect session terminated immediately
    echo "Calling await_agents (should detect termination immediately)..."
    START_TIME=$(date +%s)
    WATCH_OUTPUT=$("$AGENT_CMD" await --sessions "$SESSION" --timeout 10 2>&1 || true)
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo "Watch elapsed time: ${ELAPSED}s"
    echo "Watch output:"
    echo "$WATCH_OUTPUT"

    # Cleanup
    rm -f "$TEST_TASK"

    # Validate results - should detect COMPLETED when session doesn't exist
    if echo "$WATCH_OUTPUT" | grep -q "COMPLETED"; then
        if [[ $ELAPSED -lt 3 ]]; then
            test_pass "Detected session termination in ${ELAPSED}s"
        else
            test_fail "Detection took too long: ${ELAPSED}s (should be < 3s)"
        fi
    else
        test_fail "Did not detect COMPLETED status after termination"
    fi
}

# ============================================================================
# TEST 3: Multi-agent await returns on first state change
# ============================================================================
test_multi_agent_first_change() {
    test_start "Multi-agent await returns on first state change"

    # Create two test tasks
    TASK1=$(mktemp /tmp/agent-test-task1.XXXXXX.md)
    TASK2=$(mktemp /tmp/agent-test-task2.XXXXXX.md)

    cat > "$TASK1" << 'EOF'
# Task 1: Delayed Prompt
Wait 5 seconds, then ask: "Continue? (y/n)"
EOF

    cat > "$TASK2" << 'EOF'
# Task 2: Immediate Prompt
Ask immediately: "Proceed? (y/n)"
EOF

    # Launch both agents
    echo "Launching two agents (one with delayed prompt, one immediate)..."
    SESSION1=$("$AGENT_CMD" launch /tmp "$TASK1" --session agent-test-delayed 2>&1 | grep "Session:" | awk '{print $2}')
    SESSION2=$("$AGENT_CMD" launch /tmp "$TASK2" --session agent-test-immediate 2>&1 | grep "Session:" | awk '{print $2}')

    if [[ -z "$SESSION1" || -z "$SESSION2" ]]; then
        test_fail "Failed to launch agents"
        "$AGENT_CMD" kill "$SESSION1" 2>/dev/null || true
        "$AGENT_CMD" kill "$SESSION2" 2>/dev/null || true
        rm -f "$TASK1" "$TASK2"
        return
    fi

    # Give immediate task time to prompt
    sleep 2

    # Await all agents - should return immediately with SESSION2 waiting
    echo "Awaiting both agents (should return with immediate task)..."
    START_TIME=$(date +%s)
    WATCH_OUTPUT=$("$AGENT_CMD" await --timeout 10 2>&1 || true)
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo "Watch elapsed time: ${ELAPSED}s"
    echo "Watch output:"
    echo "$WATCH_OUTPUT"

    # Cleanup
    "$AGENT_CMD" kill "$SESSION1" 2>/dev/null || true
    "$AGENT_CMD" kill "$SESSION2" 2>/dev/null || true
    rm -f "$TASK1" "$TASK2"

    # Validate results
    if echo "$WATCH_OUTPUT" | grep -q "WAITING_FOR_INPUT"; then
        if [[ $ELAPSED -lt 4 ]]; then
            test_pass "Returned on first state change (immediate task) in ${ELAPSED}s"
        else
            test_fail "Took too long: ${ELAPSED}s (should be < 4s, not wait for delayed task)"
        fi
    else
        test_fail "Did not detect WAITING_FOR_INPUT from immediate task"
    fi
}

# ============================================================================
# TEST 4: Await alias works correctly
# ============================================================================
test_await_alias() {
    test_start "Await command alias"

    # Check if await alias exists
    echo "Testing 'agent await' alias..."

    # Create quick completion task
    TEST_TASK=$(mktemp /tmp/agent-test-task.XXXXXX.md)
    cat > "$TEST_TASK" << 'EOF'
# Test: Await Alias
Complete quickly.
EOF

    SESSION=$("$AGENT_CMD" launch /tmp "$TEST_TASK" --session agent-test-await 2>&1 | grep "Session:" | awk '{print $2}')

    if [[ -z "$SESSION" ]]; then
        test_fail "Failed to launch agent"
        rm -f "$TEST_TASK"
        return
    fi

    sleep 2

    # Use 'await' command
    AWAIT_OUTPUT=$("$AGENT_CMD" await --sessions "$SESSION" --timeout 10 2>&1 || true)

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
    rm -f "$TEST_TASK"

    # Validate
    if echo "$AWAIT_OUTPUT" | grep -q "Awaiting Agent Sessions"; then
        test_pass "Await command works correctly"
    else
        test_fail "Await command did not execute correctly"
    fi
}

# ============================================================================
# TEST 5: Usage hints appear in output
# ============================================================================
test_usage_hints() {
    test_start "Usage hints in await output"

    # Create a simple task
    TEST_TASK=$(mktemp /tmp/agent-test-task.XXXXXX.md)
    cat > "$TEST_TASK" << 'EOF'
# Test: Output Hints
Wait briefly then ask: "Continue?"
EOF

    SESSION=$("$AGENT_CMD" launch /tmp "$TEST_TASK" --session agent-test-hints 2>&1 | grep "Session:" | awk '{print $2}')

    if [[ -z "$SESSION" ]]; then
        test_fail "Failed to launch agent"
        rm -f "$TEST_TASK"
        return
    fi

    sleep 1

    # Capture await output
    WATCH_OUTPUT=$("$AGENT_CMD" await --sessions "$SESSION" --timeout 5 2>&1 || true)

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
    rm -f "$TEST_TASK"

    # Check for usage hints
    if echo "$WATCH_OUTPUT" | grep -q "💡 Tip:"; then
        if echo "$WATCH_OUTPUT" | grep -q "launch → await → handle → await"; then
            test_pass "Usage hints present in output"
        else
            test_fail "Tip emoji found but pattern missing"
        fi
    else
        test_fail "No usage hints in output"
    fi
}

# ============================================================================
# RUN ALL TESTS
# ============================================================================

echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║${NC}  ${GREEN}Agent Orchestration Pattern Tests${NC}                       ${YELLOW}║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"

test_preexisting_waiting_state
test_session_termination_detection
test_multi_agent_first_change
test_await_alias
test_usage_hints

# Summary
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}TEST SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}Total:  ${NC}$TESTS_RUN"
echo -e "${GREEN}Passed: ${NC}$TESTS_PASSED"
echo -e "${RED}Failed: ${NC}$TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
