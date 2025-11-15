#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "MonitorDaemon Integration Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup existing database
if [ -f viz/data/viz-data.db ]; then
  cp viz/data/viz-data.db viz/data/viz-data.db.backup
  echo "✓ Database backed up"
fi

# Clear database for fresh test
rm -f viz/data/viz-data.db
echo "✓ Database cleared for fresh test"

# Start daemon for 30 seconds
echo ""
echo "Starting MonitorDaemon for 30 seconds..."
timeout 30 node viz/monitor/index.js 2>&1 | tee /tmp/monitor-integration-test.log || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verification Results"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for errors
echo ""
echo "1. Error Check:"
if grep -q "UNIQUE constraint" /tmp/monitor-integration-test.log; then
  echo "✗ UNIQUE constraint errors found"
  grep "UNIQUE constraint" /tmp/monitor-integration-test.log
  exit 1
else
  echo "✓ No UNIQUE constraint errors"
fi

# Check database state
echo ""
echo "2. Database State:"
sqlite3 viz/data/viz-data.db "
  SELECT
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN copilot_session_id IS NOT NULL THEN 1 END) as correlated_sessions,
    COUNT(CASE WHEN copilot_session_id IS NULL THEN 1 END) as uncorrelated_sessions
  FROM sessions;
" | while IFS='|' read -r total correlated uncorrelated; do
  echo "   Total sessions: $total"
  echo "   Correlated: $correlated"
  echo "   Uncorrelated: $uncorrelated"

  if [ "$correlated" -gt 0 ]; then
    echo "   ✓ Sessions successfully correlated"
  else
    echo "   ⚠️  No sessions correlated (may need more time or active agents)"
  fi
done

echo ""
echo "3. Event Capture:"
EVENT_COUNT=$(sqlite3 viz/data/viz-data.db "SELECT COUNT(*) FROM events;")
echo "   Events captured: $EVENT_COUNT"

if [ "$EVENT_COUNT" -gt 0 ]; then
  echo "   ✓ Events successfully captured from JSONL files"

  # Show event breakdown
  echo ""
  echo "   Event type breakdown:"
  sqlite3 viz/data/viz-data.db "
    SELECT event_type, COUNT(*) as count
    FROM events
    GROUP BY event_type
    ORDER BY count DESC;
  " | sed 's/^/     /'
else
  echo "   ⚠️  No events captured yet"
  echo "      (Correlation may need more time or no matching sessions)"
fi

echo ""
echo "4. JSONL Files Available:"
JSONL_COUNT=$(ls ~/.copilot/session-state/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
echo "   JSONL files: $JSONL_COUNT"
echo "   Most recent: $(ls -t ~/.copilot/session-state/*.jsonl 2>/dev/null | head -1)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
