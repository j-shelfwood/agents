#!/usr/bin/env bats
# Integration tests for core agent commands

# Load test helpers
source "$(dirname "$BATS_TEST_FILENAME")/../helpers/test_helpers.sh"

setup() {
    test_setup

    # Create reusable test task
    export TEST_TASK="/tmp/integration-test-task-$$.md"
    create_test_task "$TEST_TASK" "Print 'Integration test task' and wait for input"
}

teardown() {
    rm -f "$TEST_TASK"
    test_teardown
}

# agent launch tests
@test "integration: agent launch creates tmux session" {
    SESSION=$(generate_test_session_name "launch")

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION"

    # Should succeed
    [ "$status" -eq 0 ]

    # Tmux session should exist
    tmux has-session -t "$SESSION"

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "integration: agent launch creates metadata file" {
    SESSION=$(generate_test_session_name "metadata")

    "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" >/dev/null 2>&1

    # Metadata file should exist
    assert_file_exists ~/.local/share/copilot-agent/metadata/"${SESSION}.json"

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "integration: agent launch rejects duplicate session name" {
    SESSION=$(generate_test_session_name "duplicate")

    # Launch first agent
    "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" >/dev/null 2>&1

    # Attempt to launch with same name
    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION"

    # Should fail
    [ "$status" -ne 0 ]
    [[ "$output" =~ "already exists" ]]

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

# agent list tests
@test "integration: agent list shows active sessions" {
    SESSION=$(generate_test_session_name "list")

    "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" >/dev/null 2>&1

    # Wait for session to be established
    wait_for_session "$SESSION" 5

    run "$AGENT_CMD" list

    # Should succeed
    [ "$status" -eq 0 ]

    # Should contain our session
    [[ "$output" =~ "$SESSION" ]]

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "integration: agent list returns empty when no agents running" {
    # Ensure no test agents running
    cleanup_test_sessions

    run "$AGENT_CMD" list

    # Should succeed even with no agents
    [ "$status" -eq 0 ]

    # Should not contain test sessions
    ! [[ "$output" =~ "test-agent-" ]]
}

# agent status tests
@test "integration: agent status shows session information" {
    SESSION=$(generate_test_session_name "status")

    "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" >/dev/null 2>&1

    wait_for_session "$SESSION" 5

    run "$AGENT_CMD" status "$SESSION"

    # Should succeed
    [ "$status" -eq 0 ]

    # Should contain session name
    [[ "$output" =~ "$SESSION" ]]

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "integration: agent status fails for non-existent session" {
    run "$AGENT_CMD" status "non-existent-session-$$"

    # Should fail
    [ "$status" -ne 0 ]
}

# agent read tests
@test "integration: agent read captures output" {
    SESSION=$(generate_test_session_name "read")

    "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" >/dev/null 2>&1

    # Wait for agent to process task
    sleep 3

    run "$AGENT_CMD" read "$SESSION"

    # Should succeed
    [ "$status" -eq 0 ]

    # Should have output
    [[ -n "$output" ]]

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "integration: agent read respects line limit" {
    SESSION=$(generate_test_session_name "read-limit")

    "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" >/dev/null 2>&1

    sleep 2

    run "$AGENT_CMD" read "$SESSION" 5

    # Should succeed
    [ "$status" -eq 0 ]

    # Should contain output (not testing exact line count as headers/formatting vary)
    [[ -n "$output" ]]
    [[ "$output" =~ "Session:" || "$output" =~ "last 5 lines" ]]

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

# agent kill tests
@test "integration: agent kill terminates session" {
    SESSION=$(generate_test_session_name "kill")

    "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" >/dev/null 2>&1

    wait_for_session "$SESSION" 5

    run "$AGENT_CMD" kill "$SESSION"

    # Should succeed
    [ "$status" -eq 0 ]

    # Session should be gone
    ! tmux has-session -t "$SESSION" 2>/dev/null

    # Metadata should be archived
    assert_file_not_exists ~/.local/share/copilot-agent/metadata/"${SESSION}.json"
}

@test "integration: agent kill fails gracefully for non-existent session" {
    run "$AGENT_CMD" kill "non-existent-session-$$"

    # Should fail but not crash
    [ "$status" -ne 0 ]
    [[ "$output" =~ "not found" ]]
}

# agent send tests
@test "integration: agent send delivers message to session" {
    SESSION=$(generate_test_session_name "send")

    "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" >/dev/null 2>&1

    wait_for_session "$SESSION" 5

    run "$AGENT_CMD" send "$SESSION" "test message"

    # Should succeed
    [ "$status" -eq 0 ]

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

# Lifecycle test
@test "integration: complete agent lifecycle (launch -> status -> kill)" {
    SESSION=$(generate_test_session_name "lifecycle")

    # Launch
    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION"
    [ "$status" -eq 0 ]

    # Wait for establishment
    wait_for_session "$SESSION" 5

    # Status check
    run "$AGENT_CMD" status "$SESSION"
    [ "$status" -eq 0 ]

    # Read output
    run "$AGENT_CMD" read "$SESSION"
    [ "$status" -eq 0 ]

    # Kill
    run "$AGENT_CMD" kill "$SESSION"
    [ "$status" -eq 0 ]

    # Verify cleanup
    ! tmux has-session -t "$SESSION" 2>/dev/null
}

# TTL configuration test
@test "integration: agent launch accepts TTL configuration" {
    SESSION=$(generate_test_session_name "ttl")

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" --ttl 120

    # Should succeed
    [ "$status" -eq 0 ]

    # Verify metadata contains TTL settings
    METADATA_FILE=~/.local/share/copilot-agent/metadata/"${SESSION}.json"
    if [ -f "$METADATA_FILE" ]; then
        CONTENT=$(cat "$METADATA_FILE")
        [[ "$CONTENT" =~ '"ttl_seconds":' ]]
    fi

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "integration: agent launch accepts --no-ttl flag" {
    SESSION=$(generate_test_session_name "no-ttl")

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$SESSION" --no-ttl

    # Should succeed
    [ "$status" -eq 0 ]

    # Verify metadata shows TTL disabled
    METADATA_FILE=~/.local/share/copilot-agent/metadata/"${SESSION}.json"
    if [ -f "$METADATA_FILE" ]; then
        CONTENT=$(cat "$METADATA_FILE")
        [[ "$CONTENT" =~ '"ttl_seconds": 0' || "$CONTENT" =~ '"ttl_enabled": false' ]]
    fi

    # Cleanup
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}
