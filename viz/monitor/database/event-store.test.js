import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventStore } from './event-store.js';
import { unlinkSync, existsSync } from 'fs';

const TEST_DB_PATH = './test-viz-data.db';
const TEST_DB_WAL = './test-viz-data.db-wal';
const TEST_DB_SHM = './test-viz-data.db-shm';

describe('EventStore', () => {
  let store;

  beforeEach(() => {
    // Clean up any existing test database
    [TEST_DB_PATH, TEST_DB_WAL, TEST_DB_SHM].forEach(path => {
      if (existsSync(path)) {
        try {
          unlinkSync(path);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
    
    store = new EventStore(TEST_DB_PATH);
  });

  afterEach(async () => {
    await store.close();
    
    // Clean up test database
    [TEST_DB_PATH, TEST_DB_WAL, TEST_DB_SHM].forEach(path => {
      if (existsSync(path)) {
        try {
          unlinkSync(path);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Database Initialization', () => {
    it('should create database with schema', async () => {
      const healthy = await store.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should create sessions table', async () => {
      const session = await store.createSession({
        id: 'test-session-1',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString()
      });
      
      expect(session).toBeDefined();
      expect(session.id).toBe('test-session-1');
    });
  });

  describe('Session Management', () => {
    it('should create a session', async () => {
      const sessionData = {
        id: 'test-session-1',
        copilot_session_id: 'copilot-uuid-123',
        project_dir: '/Users/test/project',
        task_file: '.claude/tasks/test-task.md',
        spawned_at: new Date().toISOString(),
        spawned_by: 'claude-session-456',
        status: 'running',
        importance: 'high',
        pid: 12345
      };

      const session = await store.createSession(sessionData);
      
      expect(session.id).toBe(sessionData.id);
      expect(session.copilot_session_id).toBe(sessionData.copilot_session_id);
      expect(session.project_dir).toBe(sessionData.project_dir);
      expect(session.status).toBe('running');
      expect(session.importance).toBe('high');
    });

    it('should update a session', async () => {
      await store.createSession({
        id: 'test-session-2',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString()
      });

      const updated = await store.updateSession('test-session-2', {
        status: 'stopped',
        importance: 'critical'
      });

      expect(updated.status).toBe('stopped');
      expect(updated.importance).toBe('critical');
    });

    it('should get a session by id', async () => {
      await store.createSession({
        id: 'test-session-3',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString()
      });

      const session = await store.getSession('test-session-3');
      
      expect(session).toBeDefined();
      expect(session.id).toBe('test-session-3');
    });

    it('should list all sessions', async () => {
      await store.createSession({
        id: 'test-session-4',
        project_dir: '/test/project1',
        spawned_at: new Date().toISOString()
      });

      await store.createSession({
        id: 'test-session-5',
        project_dir: '/test/project2',
        spawned_at: new Date().toISOString()
      });

      const sessions = await store.listSessions();
      
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter sessions by status', async () => {
      await store.createSession({
        id: 'test-session-6',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString(),
        status: 'running'
      });

      await store.createSession({
        id: 'test-session-7',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString(),
        status: 'stopped'
      });

      const running = await store.listSessions({ status: 'running' });
      const stopped = await store.listSessions({ status: 'stopped' });

      expect(running.some(s => s.id === 'test-session-6')).toBe(true);
      expect(stopped.some(s => s.id === 'test-session-7')).toBe(true);
    });
  });

  describe('Event Management', () => {
    beforeEach(async () => {
      await store.createSession({
        id: 'event-test-session',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString()
      });
    });

    it('should insert a single event', async () => {
      const eventId = await store.insertEvent({
        session_id: 'event-test-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: '/test/file.js',
        operation: 'read',
        source: 'jsonl'
      });

      expect(eventId).toBeGreaterThan(0);
    });

    it('should insert event with all fields', async () => {
      const eventId = await store.insertEvent({
        session_id: 'event-test-session',
        copilot_event_id: 'evt-123',
        parent_event_id: 'evt-parent-456',
        timestamp: new Date().toISOString(),
        event_type: 'tool_complete',
        tool_name: 'view',
        tool_call_id: 'call-789',
        tool_arguments: { path: '/test/file.js' },
        file_path: '/test/file.js',
        operation: 'read',
        command: null,
        command_category: null,
        status: 'success',
        duration_ms: 150,
        source: 'jsonl',
        raw_data: { extra: 'metadata' }
      });

      expect(eventId).toBeGreaterThan(0);

      const events = await store.getEvents('event-test-session');
      const event = events.find(e => e.id === eventId);
      
      expect(event.tool_name).toBe('view');
      expect(event.status).toBe('success');
      expect(event.duration_ms).toBe(150);
    });

    it('should get events for a session', async () => {
      await store.insertEvent({
        session_id: 'event-test-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: '/test/file1.js',
        operation: 'read',
        source: 'jsonl'
      });

      await store.insertEvent({
        session_id: 'event-test-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: '/test/file2.js',
        operation: 'write',
        source: 'jsonl'
      });

      const events = await store.getEvents('event-test-session');
      
      expect(events.length).toBe(2);
    });

    it('should filter events by type', async () => {
      await store.insertEvent({
        session_id: 'event-test-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: '/test/file.js',
        operation: 'read',
        source: 'jsonl'
      });

      await store.insertEvent({
        session_id: 'event-test-session',
        timestamp: new Date().toISOString(),
        event_type: 'command',
        command: 'npm install',
        command_category: 'npm',
        source: 'tmux'
      });

      const fileOps = await store.getEvents('event-test-session', { event_type: 'file_op' });
      const commands = await store.getEvents('event-test-session', { event_type: 'command' });

      expect(fileOps.length).toBe(1);
      expect(commands.length).toBe(1);
      expect(fileOps[0].event_type).toBe('file_op');
      expect(commands[0].event_type).toBe('command');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await store.createSession({
        id: 'batch-test-session',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString()
      });
    });

    it('should insert multiple events in batch', async () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        session_id: 'batch-test-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: `/test/file${i}.js`,
        operation: i % 2 === 0 ? 'read' : 'write',
        source: 'jsonl'
      }));

      const ids = await store.insertEvents(events);
      
      expect(ids.length).toBe(100);
      
      const retrieved = await store.getEvents('batch-test-session');
      expect(retrieved.length).toBe(100);
    });

    it('should insert 1000 events in <100ms', async () => {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        session_id: 'batch-test-session',
        timestamp: new Date().toISOString(),
        event_type: 'file_op',
        file_path: `/test/file${i}.js`,
        operation: ['read', 'write', 'edit'][i % 3],
        source: 'jsonl'
      }));

      const start = Date.now();
      await store.insertEvents(events);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      
      const retrieved = await store.getEvents('batch-test-session');
      expect(retrieved.length).toBe(1000);
    });
  });

  describe('Views and Aggregations', () => {
    beforeEach(async () => {
      await store.createSession({
        id: 'view-test-session',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString()
      });

      // Insert test data
      const events = [
        {
          session_id: 'view-test-session',
          timestamp: new Date().toISOString(),
          event_type: 'file_op',
          file_path: '/test/file1.js',
          operation: 'read',
          source: 'jsonl'
        },
        {
          session_id: 'view-test-session',
          timestamp: new Date().toISOString(),
          event_type: 'file_op',
          file_path: '/test/file1.js',
          operation: 'write',
          source: 'jsonl'
        },
        {
          session_id: 'view-test-session',
          timestamp: new Date().toISOString(),
          event_type: 'file_op',
          file_path: '/test/file1.js',
          operation: 'edit',
          source: 'jsonl'
        },
        {
          session_id: 'view-test-session',
          timestamp: new Date().toISOString(),
          event_type: 'file_op',
          file_path: '/test/file2.js',
          operation: 'read',
          source: 'jsonl'
        },
        {
          session_id: 'view-test-session',
          timestamp: new Date().toISOString(),
          event_type: 'command',
          command: 'npm install',
          command_category: 'npm',
          duration_ms: 5000,
          source: 'tmux'
        },
        {
          session_id: 'view-test-session',
          timestamp: new Date().toISOString(),
          event_type: 'command',
          command: 'npm test',
          command_category: 'npm',
          duration_ms: 3000,
          source: 'tmux'
        },
        {
          session_id: 'view-test-session',
          timestamp: new Date().toISOString(),
          event_type: 'command',
          command: 'git status',
          command_category: 'git',
          duration_ms: 100,
          source: 'tmux'
        }
      ];

      await store.insertEvents(events);
    });

    it('should get file activity aggregation', async () => {
      const activity = await store.getFileActivity('view-test-session');
      
      expect(activity.length).toBe(2);
      
      const file1 = activity.find(a => a.file_path === '/test/file1.js');
      expect(file1).toBeDefined();
      expect(file1.total_operations).toBe(3);
      expect(file1.reads).toBe(1);
      expect(file1.writes).toBe(1);
      expect(file1.edits).toBe(1);

      const file2 = activity.find(a => a.file_path === '/test/file2.js');
      expect(file2).toBeDefined();
      expect(file2.total_operations).toBe(1);
      expect(file2.reads).toBe(1);
    });

    it('should get command statistics', async () => {
      const stats = await store.getCommandStats('view-test-session');
      
      expect(stats.length).toBe(2);
      
      const npmStats = stats.find(s => s.command_category === 'npm');
      expect(npmStats).toBeDefined();
      expect(npmStats.count).toBe(2);
      expect(npmStats.avg_duration).toBe(4000);

      const gitStats = stats.find(s => s.command_category === 'git');
      expect(gitStats).toBeDefined();
      expect(gitStats.count).toBe(1);
      expect(gitStats.avg_duration).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      await expect(async () => {
        await store.createSession({
          id: 'invalid-session'
          // Missing required project_dir
        });
      }).rejects.toThrow();
    });

    it('should handle duplicate session IDs', async () => {
      await store.createSession({
        id: 'duplicate-session',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString()
      });

      await expect(async () => {
        await store.createSession({
          id: 'duplicate-session',
          project_dir: '/test/project',
          spawned_at: new Date().toISOString()
        });
      }).rejects.toThrow();
    });

    it('should handle foreign key constraint', async () => {
      await expect(async () => {
        await store.insertEvent({
          session_id: 'non-existent-session',
          timestamp: new Date().toISOString(),
          event_type: 'file_op',
          source: 'jsonl'
        });
      }).rejects.toThrow();
    });
  });

  describe('Utilities', () => {
    it('should pass health check', async () => {
      const healthy = await store.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should close database connection', async () => {
      await store.close();
      
      // Attempting operations after close should fail
      await expect(async () => {
        await store.healthCheck();
      }).rejects.toThrow();
    });
  });
});
