#!/usr/bin/env bats
# Unit tests for validation functions

# Source agent-metadata to get validate_session_name function
setup() {
    export SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../agent" && pwd)"
    source "$SCRIPT_DIR/../src/lib/config.sh"
    source "$SCRIPT_DIR/agent-metadata"
}

# Test validate_session_name function directly
@test "unit: validate_session_name accepts valid alphanumeric-dash-underscore" {
    run validate_session_name "agent-myapp-123"
    [ "$status" -eq 0 ]

    run validate_session_name "test_session_name"
    [ "$status" -eq 0 ]

    run validate_session_name "ValidSessionName123"
    [ "$status" -eq 0 ]
}

@test "unit: validate_session_name rejects empty string" {
    run validate_session_name ""
    [ "$status" -eq 1 ]
    [[ "$output" =~ "required" ]]
}

@test "unit: validate_session_name rejects semicolon" {
    run validate_session_name "test;rm-rf"
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects backtick" {
    run validate_session_name 'test`whoami`'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects dollar sign" {
    run validate_session_name 'test$var'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects pipe" {
    run validate_session_name 'test|pipe'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects ampersand" {
    run validate_session_name 'test&background'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects angle brackets" {
    run validate_session_name 'test>redirect'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]

    run validate_session_name 'test<input'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects quotes" {
    run validate_session_name "test'quote"
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]

    run validate_session_name 'test"doublequote'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects parentheses" {
    run validate_session_name 'test(paren)'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects brackets" {
    run validate_session_name 'test[bracket]'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects backslash" {
    run validate_session_name 'test\escape'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name rejects spaces" {
    run validate_session_name 'test session name'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}

@test "unit: validate_session_name enforces max length" {
    # Create 101-character string
    LONG_NAME=$(printf 'a%.0s' {1..101})

    run validate_session_name "$LONG_NAME"
    [ "$status" -eq 1 ]
    [[ "$output" =~ "too long" ]]
}

@test "unit: validate_session_name accepts max length boundary" {
    # Create exactly 100-character string
    MAX_NAME=$(printf 'a%.0s' {1..100})

    run validate_session_name "$MAX_NAME"
    [ "$status" -eq 0 ]
}

@test "unit: validate_session_name rejects wildcard characters" {
    run validate_session_name 'test*wildcard'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]

    run validate_session_name 'test?wildcard'
    [ "$status" -eq 1 ]
    [[ "$output" =~ "Invalid session name" ]]
}
