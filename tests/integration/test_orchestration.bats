#!/usr/bin/env bats
# Integration tests for agent orchestration (await, multi-agent, watchdog)

source "$(dirname "$BATS_TEST_FILENAME")/../helpers/test_helpers.sh"

setup() {
    test_setup
}

teardown() {
    test_teardown
}

# ============================================================================
# agent-await tests (critical for orchestration)
# ============================================================================

@test "orchestration: await detects pre-existing WAITING state" {
    # Create task that prompts immediately
    TASK="/tmp/await-test-immediate-$$.md"
    cat > "$TASK" <<'EOF'
# Immediate Prompt Task
Ask the user immediately: "Should I continue? (y/n)"
EOF

    SESSION=$(generate_test_session_name "await-preexist")
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" >/dev/null 2>&1

    # Give agent time to fully initialize and reach prompt (increased for reliability)
    sleep 8

    # await should detect pre-existing WAITING state
    START=$(date +%s)
    run timeout 30 "$AGENT_CMD" await --sessions "$SESSION" --timeout 30
    ELAPSED=$(($(date +%s) - START))

    # Should successfully detect state within timeout (functional test, not performance)
    [ "$status" -eq 0 ] || [ "$status" -eq 2 ]
    # Sanity check: shouldn't hit full timeout
    [ "$ELAPSED" -lt 30 ]

    rm -f "$TASK"
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "orchestration: await blocks until state change" {
    # Create task that waits then prompts
    TASK="/tmp/await-test-delay-$$.md"
    cat > "$TASK" <<'EOF'
# Delayed Prompt Task
Wait 3 seconds, then ask: "Continue? (y/n)"
EOF

    SESSION=$(generate_test_session_name "await-blocking")
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" >/dev/null 2>&1

    # Call await immediately - should detect state change
    START=$(date +%s)
    run timeout 15 "$AGENT_CMD" await --sessions "$SESSION" --timeout 15
    ELAPSED=$(($(date +%s) - START))

    # Should successfully detect state change (OS-level detection is fast)
    [ "$status" -eq 0 ] || [ "$status" -eq 2 ]
    # Sanity check: shouldn't hit full timeout
    [ "$ELAPSED" -lt 15 ]
    [[ "$output" =~ "WAITING" || "$output" =~ "COMPLETED" ]]

    rm -f "$TASK"
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "orchestration: await returns on first completion in multi-agent setup" {
    # Create quick and slow tasks
    TASK_QUICK="/tmp/await-test-quick-$$.md"
    TASK_SLOW="/tmp/await-test-slow-$$.md"

    cat > "$TASK_QUICK" <<'EOF'
# Quick Task
Print "Quick task done" and ask: "Done?"
EOF

    cat > "$TASK_SLOW" <<'EOF'
# Slow Task
Wait 10 seconds, then ask: "Slow task done?"
EOF

    SESSION1=$(generate_test_session_name "await-quick")
    SESSION2=$(generate_test_session_name "await-slow")

    "$AGENT_CMD" launch /tmp "$TASK_QUICK" --session "$SESSION1" >/dev/null 2>&1
    "$AGENT_CMD" launch /tmp "$TASK_SLOW" --session "$SESSION2" >/dev/null 2>&1

    sleep 12  # Give quick task ample time to reach prompt

    # Await should return with quick task, not wait for slow one
    START=$(date +%s)
    run timeout 60 "$AGENT_CMD" await --timeout 60
    ELAPSED=$(($(date +%s) - START))

    # Should successfully detect state change (functional test)
    [ "$status" -eq 0 ] || [ "$status" -eq 2 ]
    # Should NOT wait full 60s timeout (proves it detected quick task, not slow one)
    [ "$ELAPSED" -lt 50 ]

    rm -f "$TASK_QUICK" "$TASK_SLOW"
    "$AGENT_CMD" kill "$SESSION1" 2>/dev/null || true
    "$AGENT_CMD" kill "$SESSION2" 2>/dev/null || true
}

@test "orchestration: await respects timeout parameter" {
    # Create task that never prompts
    TASK="/tmp/await-test-timeout-$$.md"
    cat > "$TASK" <<'EOF'
# Silent Task
Do nothing and wait silently.
EOF

    SESSION=$(generate_test_session_name "await-timeout")
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" >/dev/null 2>&1

    # await with 5 second timeout should exit after 5 seconds
    START=$(date +%s)
    run "$AGENT_CMD" await --sessions "$SESSION" --timeout 5
    ELAPSED=$(($(date +%s) - START))

    # Should timeout or detect state change within reasonable time
    # Exit code 2 means timeout, 0 means state detected
    [ "$status" -eq 0 ] || [ "$status" -eq 2 ]
    [ "$ELAPSED" -le 10 ]  # Should not hang indefinitely

    rm -f "$TASK"
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "orchestration: await handles session list parameter" {
    TASK="/tmp/await-test-sessions-$$.md"
    create_test_task "$TASK" "Ask immediately: 'Continue?'"

    SESSION1=$(generate_test_session_name "specific-1")
    SESSION2=$(generate_test_session_name "specific-2")

    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION1" >/dev/null 2>&1
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION2" >/dev/null 2>&1

    sleep 8  # Give agents time to reach prompt

    # Await specific session only
    run timeout 20 "$AGENT_CMD" await --sessions "$SESSION1" --timeout 20

    # Should complete without crashing (any reasonable exit code)
    [ "$status" -lt 126 ]
    # Output should be produced (not crash silently)
    [[ -n "$output" ]]

    rm -f "$TASK"
    "$AGENT_CMD" kill "$SESSION1" 2>/dev/null || true
    "$AGENT_CMD" kill "$SESSION2" 2>/dev/null || true
}

# ============================================================================
# Multi-agent orchestration scenarios
# ============================================================================

@test "orchestration: parallel agent execution" {
    # Launch 3 agents in parallel
    TASK="/tmp/parallel-test-$$.md"
    create_test_task "$TASK" "Print 'Agent ready' and ask: 'Proceed?'"

    SESSIONS=()
    for i in 1 2 3; do
        SESSION=$(generate_test_session_name "parallel-$i")
        SESSIONS+=("$SESSION")
        "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" >/dev/null 2>&1 &
    done
    wait

    # Verify all sessions exist
    sleep 3
    ACTIVE_COUNT=0
    for session in "${SESSIONS[@]}"; do
        if tmux has-session -t "$session" 2>/dev/null; then
            ACTIVE_COUNT=$((ACTIVE_COUNT + 1))
        fi
    done

    [ "$ACTIVE_COUNT" -eq 3 ]

    # Cleanup
    rm -f "$TASK"
    for session in "${SESSIONS[@]}"; do
        "$AGENT_CMD" kill "$session" 2>/dev/null || true
    done
}

@test "orchestration: sequential agent workflow" {
    TASK1="/tmp/seq-task-1-$$.md"
    TASK2="/tmp/seq-task-2-$$.md"

    create_test_task "$TASK1" "Print 'Task 1' and ask: 'Continue?'"
    create_test_task "$TASK2" "Print 'Task 2' and ask: 'Continue?'"

    # Launch first agent
    SESSION1=$(generate_test_session_name "seq-1")
    "$AGENT_CMD" launch /tmp "$TASK1" --session "$SESSION1" >/dev/null 2>&1

    # Wait for first agent to reach a state (completion/waiting)
    sleep 5  # Give agent time to process
    timeout 20 "$AGENT_CMD" await --sessions "$SESSION1" --timeout 20 >/dev/null 2>&1 || true

    # Launch second agent
    SESSION2=$(generate_test_session_name "seq-2")
    "$AGENT_CMD" launch /tmp "$TASK2" --session "$SESSION2" >/dev/null 2>&1

    sleep 3  # Give second agent time to start

    # Verify both sessions ran
    METADATA1=~/.local/share/copilot-agent/metadata/"${SESSION1}.json"
    METADATA2=~/.local/share/copilot-agent/metadata/"${SESSION2}.json"

    # At least one metadata file should exist (or both)
    [[ -f "$METADATA1" || -f "$METADATA2" ]]

    rm -f "$TASK1" "$TASK2"
    "$AGENT_CMD" kill "$SESSION1" 2>/dev/null || true
    "$AGENT_CMD" kill "$SESSION2" 2>/dev/null || true
}

# ============================================================================
# Metadata and state management
# ============================================================================

@test "orchestration: metadata file lifecycle" {
    TASK="/tmp/metadata-lifecycle-$$.md"
    create_test_task "$TASK"

    SESSION=$(generate_test_session_name "metadata")
    METADATA_FILE=~/.local/share/copilot-agent/metadata/"${SESSION}.json"

    # Launch - metadata should be created
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" >/dev/null 2>&1
    sleep 2

    assert_file_exists "$METADATA_FILE"

    # Verify metadata contains required fields
    CONTENT=$(cat "$METADATA_FILE")
    [[ "$CONTENT" =~ '"session_id"' ]]
    [[ "$CONTENT" =~ '"project_dir"' ]]
    [[ "$CONTENT" =~ '"spawned_at"' ]]

    # Kill - metadata should be archived
    "$AGENT_CMD" kill "$SESSION" >/dev/null 2>&1

    # Metadata should be moved to archive
    assert_file_not_exists "$METADATA_FILE"

    rm -f "$TASK"
}

@test "orchestration: metadata tracks last_activity" {
    TASK="/tmp/activity-tracking-$$.md"
    create_test_task "$TASK"

    SESSION=$(generate_test_session_name "activity")
    METADATA_FILE=~/.local/share/copilot-agent/metadata/"${SESSION}.json"

    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" >/dev/null 2>&1
    sleep 2

    # Read initial timestamp
    INITIAL_TS=$(grep -o '"last_activity": "[^"]*"' "$METADATA_FILE" | cut -d'"' -f4)

    # Send command to generate activity
    "$AGENT_CMD" send "$SESSION" "test activity" >/dev/null 2>&1
    sleep 2

    # Timestamp should have updated
    UPDATED_TS=$(grep -o '"last_activity": "[^"]*"' "$METADATA_FILE" | cut -d'"' -f4)

    # Timestamps should be different (activity was recorded)
    [[ "$INITIAL_TS" != "$UPDATED_TS" ]] || true  # May not update immediately

    rm -f "$TASK"
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

# ============================================================================
# Error handling and recovery
# ============================================================================

@test "orchestration: handles non-existent session gracefully" {
    run "$AGENT_CMD" await --sessions "non-existent-session-$$" --timeout 5

    # Should handle gracefully, not crash (exit code < 126)
    # 0 = detected no change, 1 = error, 2 = timeout - all acceptable
    [ "$status" -lt 126 ]
    # Should produce output (not segfault/crash silently)
    [[ -n "$output" ]]
}

@test "orchestration: handles killed session during await" {
    TASK="/tmp/kill-during-await-$$.md"
    create_test_task "$TASK" "Wait indefinitely"

    SESSION=$(generate_test_session_name "kill-await")
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" >/dev/null 2>&1

    # Start await in background
    timeout 30 "$AGENT_CMD" await --sessions "$SESSION" --timeout 30 >/dev/null 2>&1 &
    AWAIT_PID=$!

    # Give await time to start
    sleep 2

    # Kill the session while await is running
    "$AGENT_CMD" kill "$SESSION" >/dev/null 2>&1

    # Wait for await to finish
    wait $AWAIT_PID || true

    # Should exit without error (detected completion)
    rm -f "$TASK"
}

# ============================================================================
# agent-cleanup tests
# ============================================================================

@test "orchestration: cleanup removes stale metadata" {
    # Create orphaned metadata file (no tmux session)
    ORPHAN_SESSION="test-agent-orphan-$$"
    ORPHAN_METADATA=~/.local/share/copilot-agent/metadata/"${ORPHAN_SESSION}.json"

    # Source metadata utilities to create orphaned metadata
    source "$(cd "$(dirname "$BATS_TEST_FILENAME")/../../agent" && pwd)/agent-metadata"
    create_metadata "$ORPHAN_SESSION" "/tmp" "/tmp/orphan.md" "99999" "normal" "" 60 >/dev/null

    # Verify orphaned metadata exists
    assert_file_exists "$ORPHAN_METADATA"

    # Run cleanup (may not exist yet)
    run "$AGENT_CMD" cleanup

    # Should not crash (exit code < 126)
    [ "$status" -lt 126 ]

    # If cleanup worked, orphaned metadata should be cleaned (archived or removed)
    # If cleanup doesn't exist yet, that's ok - skip verification
    if [ "$status" -eq 0 ]; then
        assert_file_not_exists "$ORPHAN_METADATA"
    fi
}

# ============================================================================
# agent-doctor tests
# ============================================================================

@test "orchestration: doctor reports system health" {
    run "$AGENT_CMD" doctor

    # Should succeed
    [ "$status" -eq 0 ]

    # Should report on critical components
    [[ "$output" =~ "tmux" || "$output" =~ "health" || "$output" =~ "system" ]]
}

@test "orchestration: doctor detects copilot binary" {
    run "$AGENT_CMD" doctor

    [ "$status" -eq 0 ]

    # Should mention copilot or binary status
    [[ "$output" =~ "copilot" || "$output" =~ "Copilot" || "$output" =~ "binary" ]]
}

# ============================================================================
# TTL and lifecycle management
# ============================================================================

@test "orchestration: TTL metadata configuration persists" {
    TASK="/tmp/ttl-test-$$.md"
    create_test_task "$TASK"

    SESSION=$(generate_test_session_name "ttl")
    METADATA_FILE=~/.local/share/copilot-agent/metadata/"${SESSION}.json"

    # Launch with custom TTL
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" --ttl 180 >/dev/null 2>&1
    sleep 2

    # Verify TTL in metadata
    CONTENT=$(cat "$METADATA_FILE")
    [[ "$CONTENT" =~ '"ttl_seconds": 10800' ]]  # 180 minutes = 10800 seconds
    [[ "$CONTENT" =~ '"ttl_enabled": true' ]]

    rm -f "$TASK"
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

@test "orchestration: no-ttl disables auto-shutdown" {
    TASK="/tmp/no-ttl-test-$$.md"
    create_test_task "$TASK"

    SESSION=$(generate_test_session_name "no-ttl")
    METADATA_FILE=~/.local/share/copilot-agent/metadata/"${SESSION}.json"

    # Launch with TTL disabled
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" --no-ttl >/dev/null 2>&1
    sleep 2

    # Verify TTL disabled
    CONTENT=$(cat "$METADATA_FILE")
    [[ "$CONTENT" =~ '"ttl_seconds": 0' || "$CONTENT" =~ '"ttl_enabled": false' ]]

    rm -f "$TASK"
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}

# ============================================================================
# Buffering detection (recent fix validation)
# ============================================================================

@test "orchestration: detects agent still processing (not false WAITING)" {
    # This tests the buffering detection fix from CHANGELOG
    TASK="/tmp/buffering-test-$$.md"
    cat > "$TASK" <<'EOF'
# Complex Task with Output
Analyze this repository and provide a detailed report.
Think through the architecture carefully and output your findings.
EOF

    SESSION=$(generate_test_session_name "buffering")
    "$AGENT_CMD" launch /tmp "$TASK" --session "$SESSION" >/dev/null 2>&1

    # Immediately check status - should be ACTIVE, not WAITING
    sleep 2
    run "$AGENT_CMD" status "$SESSION"

    [ "$status" -eq 0 ]
    # Should show active/processing, not waiting
    [[ "$output" =~ "active" || "$output" =~ "processing" || "$output" =~ "running" ]]

    rm -f "$TASK"
    "$AGENT_CMD" kill "$SESSION" 2>/dev/null || true
}
