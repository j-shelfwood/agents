import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import SessionCorrelator from '../correlation/session-correlator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('SessionCorrelator', () => {
  let tempDir;
  let correlator;

  beforeEach(async () => {
    // Create temporary directory for test session files
    tempDir = path.join(os.tmpdir(), `copilot-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    correlator = new SessionCorrelator(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('findCopilotSession', () => {
    test('finds matching session by timestamp and project directory', async () => {
      const sessionUuid = 'test-uuid-12345';
      const spawnTime = '2025-11-14T18:00:00.000Z';
      const projectDir = '/Users/test/project';

      // Create mock session file
      const sessionContent = [
        JSON.stringify({
          type: 'session.start',
          data: { sessionId: sessionUuid },
          timestamp: '2025-11-14T18:00:02.000Z' // Within 5s window
        }),
        JSON.stringify({
          type: 'tool.execution_start',
          data: {
            toolName: 'view',
            arguments: { path: `${projectDir}/file.js` }
          }
        })
      ].join('\n');

      await fs.writeFile(
        path.join(tempDir, `${sessionUuid}.jsonl`),
        sessionContent
      );

      const metadata = {
        session_id: 'agent-test-1234',
        spawned_at: spawnTime,
        project_dir: projectDir
      };

      const result = await correlator.findCopilotSession(metadata);
      expect(result).toBe(sessionUuid);
    });

    test('rejects session when timestamp outside window', async () => {
      const sessionUuid = 'test-uuid-12345';
      const spawnTime = '2025-11-14T18:00:00.000Z';
      const projectDir = '/Users/test/project';

      const sessionContent = [
        JSON.stringify({
          type: 'session.start',
          data: { sessionId: sessionUuid },
          timestamp: '2025-11-14T18:00:10.000Z' // 10s difference, outside window
        }),
        JSON.stringify({
          type: 'tool.execution_start',
          data: {
            toolName: 'view',
            arguments: { path: `${projectDir}/file.js` }
          }
        })
      ].join('\n');

      await fs.writeFile(
        path.join(tempDir, `${sessionUuid}.jsonl`),
        sessionContent
      );

      const metadata = {
        session_id: 'agent-test-1234',
        spawned_at: spawnTime,
        project_dir: projectDir
      };

      const result = await correlator.findCopilotSession(metadata);
      expect(result).toBeNull();
    });

    test('rejects session when project directory does not match', async () => {
      const sessionUuid = 'test-uuid-12345';
      const spawnTime = '2025-11-14T18:00:00.000Z';

      const sessionContent = [
        JSON.stringify({
          type: 'session.start',
          data: { sessionId: sessionUuid },
          timestamp: '2025-11-14T18:00:02.000Z'
        }),
        JSON.stringify({
          type: 'tool.execution_start',
          data: {
            toolName: 'view',
            arguments: { path: '/Users/test/other-project/file.js' } // Different project
          }
        })
      ].join('\n');

      await fs.writeFile(
        path.join(tempDir, `${sessionUuid}.jsonl`),
        sessionContent
      );

      const metadata = {
        session_id: 'agent-test-1234',
        spawned_at: spawnTime,
        project_dir: '/Users/test/project'
      };

      const result = await correlator.findCopilotSession(metadata);
      expect(result).toBeNull();
    });

    test('handles multiple sessions and finds correct match', async () => {
      const correctUuid = 'correct-uuid';
      const wrongUuid1 = 'wrong-uuid-1';
      const wrongUuid2 = 'wrong-uuid-2';
      const spawnTime = '2025-11-14T18:00:00.000Z';
      const projectDir = '/Users/test/project';

      // Wrong session (different time)
      await fs.writeFile(
        path.join(tempDir, `${wrongUuid1}.jsonl`),
        JSON.stringify({
          type: 'session.start',
          data: { sessionId: wrongUuid1 },
          timestamp: '2025-11-14T17:50:00.000Z'
        }) + '\n'
      );

      // Wrong session (different project)
      await fs.writeFile(
        path.join(tempDir, `${wrongUuid2}.jsonl`),
        [
          JSON.stringify({
            type: 'session.start',
            data: { sessionId: wrongUuid2 },
            timestamp: '2025-11-14T18:00:02.000Z'
          }),
          JSON.stringify({
            type: 'tool.execution_start',
            data: {
              toolName: 'view',
              arguments: { path: '/Users/test/other/file.js' }
            }
          })
        ].join('\n')
      );

      // Correct session
      await fs.writeFile(
        path.join(tempDir, `${correctUuid}.jsonl`),
        [
          JSON.stringify({
            type: 'session.start',
            data: { sessionId: correctUuid },
            timestamp: '2025-11-14T18:00:03.000Z'
          }),
          JSON.stringify({
            type: 'tool.execution_start',
            data: {
              toolName: 'view',
              arguments: { path: `${projectDir}/file.js` }
            }
          })
        ].join('\n')
      );

      const metadata = {
        session_id: 'agent-test-1234',
        spawned_at: spawnTime,
        project_dir: projectDir
      };

      const result = await correlator.findCopilotSession(metadata);
      expect(result).toBe(correctUuid);
    });
  });

  describe('getRecentSessions', () => {
    test('returns session files from last 24 hours', async () => {
      const recentFile = 'recent-session.jsonl';
      await fs.writeFile(path.join(tempDir, recentFile), '{}');

      const sessions = await correlator.getRecentSessions();
      expect(sessions).toContain(path.join(tempDir, recentFile));
    });

    test('filters out non-jsonl files', async () => {
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'text');
      await fs.writeFile(path.join(tempDir, 'session.jsonl'), '{}');

      const sessions = await correlator.getRecentSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatch(/session\.jsonl$/);
    });
  });

  describe('isSessionActive', () => {
    test('returns true for recently modified session', async () => {
      const sessionUuid = 'active-session';
      await fs.writeFile(
        path.join(tempDir, `${sessionUuid}.jsonl`),
        '{}'
      );

      const result = await correlator.isSessionActive(sessionUuid);
      expect(result).toBe(true);
    });

    test('returns false for non-existent session', async () => {
      const result = await correlator.isSessionActive('nonexistent');
      expect(result).toBe(false);
    });
  });
});
