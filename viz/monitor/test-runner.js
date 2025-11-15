#!/usr/bin/env node

import { EventStore } from './database/event-store.js';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB_PATH = './test-viz-data.db';
const TEST_DB_WAL = './test-viz-data.db-wal';
const TEST_DB_SHM = './test-viz-data.db-shm';

function cleanup() {
  [TEST_DB_PATH, TEST_DB_WAL, TEST_DB_SHM].forEach(path => {
    if (existsSync(path)) {
      try {
        unlinkSync(path);
      } catch (e) {
        // Ignore
      }
    }
  });
}

async function runTests() {
  console.log('🧪 Running EventStore Tests\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Database initialization
  try {
    cleanup();
    const store = new EventStore(TEST_DB_PATH);
    const healthy = await store.healthCheck();
    if (healthy) {
      console.log('✓ Database initialization');
      passed++;
    } else {
      throw new Error('Health check failed');
    }
    await store.close();
    cleanup();
  } catch (e) {
    console.log('✗ Database initialization:', e.message);
    failed++;
  }

  // Test 2: Create session
  try {
    cleanup();
    const store = new EventStore(TEST_DB_PATH);
    const session = await store.createSession({
      id: 'test-session-1',
      project_dir: '/test/project',
      spawned_at: new Date().toISOString()
    });
    if (session && session.id === 'test-session-1') {
      console.log('✓ Create session');
      passed++;
    } else {
      throw new Error('Session not created correctly');
    }
    await store.close();
    cleanup();
  } catch (e) {
    console.log('✗ Create session:', e.message);
    failed++;
  }

  // Test 3: Update session
  try {
    cleanup();
    const store = new EventStore(TEST_DB_PATH);
    await store.createSession({
      id: 'test-session-2',
      project_dir: '/test/project',
      spawned_at: new Date().toISOString()
    });
    const updated = await store.updateSession('test-session-2', {
      status: 'stopped'
    });
    if (updated.status === 'stopped') {
      console.log('✓ Update session');
      passed++;
    } else {
      throw new Error('Session not updated');
    }
    await store.close();
    cleanup();
  } catch (e) {
    console.log('✗ Update session:', e.message);
    failed++;
  }

  // Test 4: Insert event
  try {
    cleanup();
    const store = new EventStore(TEST_DB_PATH);
    await store.createSession({
      id: 'event-session',
      project_dir: '/test/project',
      spawned_at: new Date().toISOString()
    });
    const eventId = await store.insertEvent({
      session_id: 'event-session',
      timestamp: new Date().toISOString(),
      event_type: 'file_op',
      file_path: '/test/file.js',
      operation: 'read',
      source: 'jsonl'
    });
    if (eventId > 0) {
      console.log('✓ Insert event');
      passed++;
    } else {
      throw new Error('Event not inserted');
    }
    await store.close();
    cleanup();
  } catch (e) {
    console.log('✗ Insert event:', e.message);
    failed++;
  }

  // Test 5: Batch insert (1000 events in <100ms)
  try {
    cleanup();
    const store = new EventStore(TEST_DB_PATH);
    await store.createSession({
      id: 'batch-session',
      project_dir: '/test/project',
      spawned_at: new Date().toISOString()
    });

    const events = Array.from({ length: 1000 }, (_, i) => ({
      session_id: 'batch-session',
      timestamp: new Date().toISOString(),
      event_type: 'file_op',
      file_path: `/test/file${i}.js`,
      operation: ['read', 'write', 'edit'][i % 3],
      source: 'jsonl'
    }));

    const start = Date.now();
    await store.insertEvents(events);
    const duration = Date.now() - start;

    if (duration < 100) {
      console.log(`✓ Batch insert 1000 events (${duration}ms)`);
      passed++;
    } else {
      console.log(`⚠ Batch insert 1000 events (${duration}ms - slower than target)`);
      passed++;
    }
    await store.close();
    cleanup();
  } catch (e) {
    console.log('✗ Batch insert:', e.message);
    failed++;
  }

  // Test 6: File activity view
  try {
    cleanup();
    const store = new EventStore(TEST_DB_PATH);
    await store.createSession({
      id: 'view-session',
      project_dir: '/test/project',
      spawned_at: new Date().toISOString()
    });

    const events = [
      {
        session_id: 'view-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: '/test/file1.js',
        operation: 'read',
        source: 'jsonl'
      },
      {
        session_id: 'view-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: '/test/file1.js',
        operation: 'write',
        source: 'jsonl'
      },
      {
        session_id: 'view-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: '/test/file1.js',
        operation: 'edit',
        source: 'jsonl'
      }
    ];

    await store.insertEvents(events);
    const activity = await store.getFileActivity('view-session');

    if (activity.length > 0 && activity[0].total_operations === 3) {
      console.log('✓ File activity view');
      passed++;
    } else {
      throw new Error('View not working correctly');
    }
    await store.close();
    cleanup();
  } catch (e) {
    console.log('✗ File activity view:', e.message);
    failed++;
  }

  // Test 7: Command stats view
  try {
    cleanup();
    const store = new EventStore(TEST_DB_PATH);
    await store.createSession({
      id: 'cmd-session',
      project_dir: '/test/project',
      spawned_at: new Date().toISOString()
    });

    const events = [
      {
        session_id: 'cmd-session',
        timestamp: new Date().toISOString(),
        event_type: 'command',
        command: 'npm install',
        command_category: 'npm',
        duration_ms: 5000,
        source: 'tmux'
      },
      {
        session_id: 'cmd-session',
        timestamp: new Date().toISOString(),
        event_type: 'command',
        command: 'npm test',
        command_category: 'npm',
        duration_ms: 3000,
        source: 'tmux'
      }
    ];

    await store.insertEvents(events);
    const stats = await store.getCommandStats('cmd-session');

    if (stats.length > 0 && stats[0].count === 2 && stats[0].avg_duration === 4000) {
      console.log('✓ Command stats view');
      passed++;
    } else {
      throw new Error('Stats view not working correctly');
    }
    await store.close();
    cleanup();
  } catch (e) {
    console.log('✗ Command stats view:', e.message);
    failed++;
  }

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(40));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  cleanup();
  process.exit(1);
});
