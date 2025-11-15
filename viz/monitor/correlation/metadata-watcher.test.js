import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import MetadataWatcher from '../correlation/metadata-watcher.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('MetadataWatcher', () => {
  let tempDir;
  let watcher;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `metadata-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    watcher = new MetadataWatcher(tempDir);
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('watch', () => {
    test('detects new JSON file creation', async () => {
      const metadata = {
        session_id: 'agent-test-1234',
        project_dir: '/test/project',
        spawned_at: new Date().toISOString()
      };

      const promise = new Promise((resolve) => {
        watcher.watch((receivedMetadata) => {
          expect(receivedMetadata).toEqual(metadata);
          resolve();
        });
      });

      // Give watcher time to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await fs.writeFile(
        path.join(tempDir, 'agent-test-1234.json'),
        JSON.stringify(metadata)
      );

      await promise;
    }, 10000);

    test('ignores non-JSON files', async () => {
      let callCount = 0;

      watcher.watch((receivedMetadata) => {
        callCount++;
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'text');
      await fs.writeFile(path.join(tempDir, '.gitkeep'), '');
      
      // Wait to ensure no events fired
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(callCount).toBe(0);
    }, 10000);

    test('parses JSON content correctly', async () => {
      const metadata = {
        session_id: 'agent-complex-test',
        project_dir: '/test/project',
        spawned_at: '2025-11-14T18:00:00Z',
        status: 'running',
        pid: 12345
      };

      const promise = new Promise((resolve) => {
        watcher.watch((receivedMetadata) => {
          expect(receivedMetadata.session_id).toBe('agent-complex-test');
          expect(receivedMetadata.pid).toBe(12345);
          expect(receivedMetadata.status).toBe('running');
          resolve();
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      
      await fs.writeFile(
        path.join(tempDir, 'agent-complex-test.json'),
        JSON.stringify(metadata)
      );

      await promise;
    }, 10000);
  });

  describe('getExistingAgents', () => {
    test('reads all existing JSON files', async () => {
      const metadata1 = { session_id: 'agent-1' };
      const metadata2 = { session_id: 'agent-2' };

      await fs.writeFile(
        path.join(tempDir, 'agent-1.json'),
        JSON.stringify(metadata1)
      );
      await fs.writeFile(
        path.join(tempDir, 'agent-2.json'),
        JSON.stringify(metadata2)
      );

      const agents = await watcher.getExistingAgents();
      
      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.session_id).sort()).toEqual(['agent-1', 'agent-2']);
    });

    test('ignores non-JSON files', async () => {
      await fs.writeFile(path.join(tempDir, 'agent-1.json'), JSON.stringify({ session_id: 'agent-1' }));
      await fs.writeFile(path.join(tempDir, 'readme.txt'), 'text');

      const agents = await watcher.getExistingAgents();
      
      expect(agents).toHaveLength(1);
      expect(agents[0].session_id).toBe('agent-1');
    });

    test('returns empty array for empty directory', async () => {
      const agents = await watcher.getExistingAgents();
      expect(agents).toEqual([]);
    });
  });

  describe('stop', () => {
    test('stops watching without errors', async () => {
      await expect(watcher.stop()).resolves.not.toThrow();
    });

    test('can be called multiple times', async () => {
      await watcher.stop();
      await expect(watcher.stop()).resolves.not.toThrow();
    });
  });
});
