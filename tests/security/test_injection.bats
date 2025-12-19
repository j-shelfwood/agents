#!/usr/bin/env bats
# Security tests - Shell injection prevention

# Load test helpers
source "$(dirname "$BATS_TEST_FILENAME")/../helpers/test_helpers.sh"

setup() {
    test_setup
}

teardown() {
    test_teardown
}

# Session name validation tests
@test "security: session name blocks shell command injection" {
    # Create test task file
    TEST_TASK="/tmp/sec-test-task-$$.md"
    create_test_task "$TEST_TASK"

    # Attempt to inject rm command via session name
    MALICIOUS_NAME='test; rm -rf /tmp/injection-test'

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$MALICIOUS_NAME"

    # Should fail with validation error
    [ "$status" -ne 0 ]
    [[ "$output" =~ "Invalid session name" ]]

    rm -f "$TEST_TASK"
}

@test "security: session name blocks backtick command substitution" {
    TEST_TASK="/tmp/sec-test-task-$$.md"
    create_test_task "$TEST_TASK"

    # Attempt backtick command substitution
    MALICIOUS_NAME='test-`whoami`-session'

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$MALICIOUS_NAME"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "Invalid session name" ]]

    rm -f "$TEST_TASK"
}

@test "security: session name blocks dollar command substitution" {
    TEST_TASK="/tmp/sec-test-task-$$.md"
    create_test_task "$TEST_TASK"

    # Attempt $() command substitution
    MALICIOUS_NAME='test-$(whoami)-session'

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$MALICIOUS_NAME"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "Invalid session name" ]]

    rm -f "$TEST_TASK"
}

@test "security: session name blocks pipe injection" {
    TEST_TASK="/tmp/sec-test-task-$$.md"
    create_test_task "$TEST_TASK"

    # Attempt pipe to malicious command
    MALICIOUS_NAME='test | cat /etc/passwd'

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$MALICIOUS_NAME"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "Invalid session name" ]]

    rm -f "$TEST_TASK"
}

@test "security: session name blocks redirect injection" {
    TEST_TASK="/tmp/sec-test-task-$$.md"
    create_test_task "$TEST_TASK"

    # Attempt file redirection
    MALICIOUS_NAME='test > /tmp/hacked'

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$MALICIOUS_NAME"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "Invalid session name" ]]

    rm -f "$TEST_TASK"
}

@test "security: session name blocks ampersand background execution" {
    TEST_TASK="/tmp/sec-test-task-$$.md"
    create_test_task "$TEST_TASK"

    # Attempt background execution
    MALICIOUS_NAME='test & sleep 1000'

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$MALICIOUS_NAME"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "Invalid session name" ]]

    rm -f "$TEST_TASK"
}

@test "security: session name blocks special characters" {
    # Test various special characters
    local special_chars=('<' '>' '|' '&' ';' '$' '`' '"' "'" '\\' '*' '?' '[' ']' '(' ')')

    for char in "${special_chars[@]}"; do
        MALICIOUS_NAME="test${char}name"

        run "$AGENT_CMD" launch /tmp task.md --session "$MALICIOUS_NAME"

        [ "$status" -ne 0 ]
    done
}

@test "security: session name accepts safe alphanumeric-dash-underscore" {
    # Valid session names should work
    local valid_names=('test-agent-123' 'my_test_session' 'agent-2024-01-01' 'TEST_SESSION_1')

    # Create a test task file
    TEST_TASK="/tmp/security-test-task-$$.md"
    create_test_task "$TEST_TASK" "echo 'Safe session test'"

    for name in "${valid_names[@]}"; do
        run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$name"

        # Should succeed
        [ "$status" -eq 0 ]

        # Cleanup
        "$AGENT_CMD" kill "$name" 2>/dev/null || true
    done

    rm -f "$TEST_TASK"
}

@test "security: session name enforces length limit" {
    TEST_TASK="/tmp/sec-test-task-$$.md"
    create_test_task "$TEST_TASK"

    # Generate 101-character name (over limit)
    LONG_NAME=$(printf 'a%.0s' {1..101})

    run "$AGENT_CMD" launch /tmp "$TEST_TASK" --session "$LONG_NAME"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "too long" || "$output" =~ "Invalid session name" ]]

    rm -f "$TEST_TASK"
}

# Path traversal prevention
@test "security: task file path traversal blocked" {
    # Attempt to read /etc/passwd via path traversal
    run "$AGENT_CMD" launch /tmp "../../../../etc/passwd"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "must be within project directory" ]]
}

@test "security: project dir blocks system directories" {
    # Attempt to target /etc
    TEST_TASK="/tmp/security-test-$$.md"
    create_test_task "$TEST_TASK"

    run "$AGENT_CMD" launch /etc "$TEST_TASK"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "system directory|Cannot launch" ]]

    rm -f "$TEST_TASK"
}

@test "security: project dir blocks /bin" {
    TEST_TASK="/tmp/security-test-$$.md"
    create_test_task "$TEST_TASK"

    run "$AGENT_CMD" launch /bin "$TEST_TASK"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "system directory|Cannot launch" ]]

    rm -f "$TEST_TASK"
}

@test "security: project dir blocks /usr" {
    TEST_TASK="/tmp/security-test-$$.md"
    create_test_task "$TEST_TASK"

    run "$AGENT_CMD" launch /usr "$TEST_TASK"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "system directory|Cannot launch" ]]

    rm -f "$TEST_TASK"
}

@test "security: project dir blocks root directory" {
    TEST_TASK="/tmp/security-test-$$.md"
    create_test_task "$TEST_TASK"

    run "$AGENT_CMD" launch / "$TEST_TASK"

    [ "$status" -ne 0 ]
    [[ "$output" =~ "system directory|Cannot launch" ]]

    rm -f "$TEST_TASK"
}

# Metadata injection prevention
@test "security: metadata creation stores values safely as JSON" {
    # Source metadata utilities
    METADATA_SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../agent" && pwd)/agent-metadata"
    source "$METADATA_SCRIPT"

    # Create metadata with potentially malicious values
    SESSION_NAME="safe-test-$$"
    MALICIOUS_PATH="/tmp/test; echo hacked > /tmp/hacked"

    # This should store the value safely in JSON (not execute it)
    METADATA_FILE=$(create_metadata "$SESSION_NAME" "$MALICIOUS_PATH" "" "12345" "normal" "" 60 2>/dev/null)

    # Verify metadata file was created
    [ -f "$METADATA_FILE" ]

    # Check that the path is stored as JSON string (safe)
    CONTENT=$(cat "$METADATA_FILE")
    [[ "$CONTENT" =~ '"project_dir"' ]]

    # Verify the malicious command wasn't executed
    [ ! -f /tmp/hacked ]

    rm -f "$METADATA_FILE"
}
