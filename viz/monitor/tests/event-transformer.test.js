import { describe, it, beforeEach } from 'vitest';
import { expect } from 'vitest';
import EventTransformer from '../transformers/event-transformer.js';

describe('EventTransformer', () => {
  let transformer;
  const sessionId = 'test-session-123';
  const projectDir = '/Users/shelfwood/Projects/myapp';

  beforeEach(() => {
    transformer = new EventTransformer(projectDir);
  });

  describe('transformToolStart', () => {
    it('should transform tool.execution_start event', () => {
      const jsonlEvent = {
        type: 'tool.execution_start',
        data: {
          toolCallId: 'toolu_001',
          toolName: 'view',
          arguments: {
            path: '/Users/shelfwood/Projects/myapp/src/index.ts'
          }
        },
        id: 'tool-start-001',
        timestamp: '2025-11-14T18:08:34.380Z',
        parentId: 'parent-uuid-1'
      };

      const result = transformer.transformToolStart(jsonlEvent, sessionId);

      expect(result.session_id).toBe(sessionId);
      expect(result.copilot_event_id).toBe('tool-start-001');
      expect(result.parent_event_id).toBe('parent-uuid-1');
      expect(result.timestamp).toBe('2025-11-14T18:08:34.380Z');
      expect(result.event_type).toBe('tool_start');
      expect(result.tool_name).toBe('view');
      expect(result.tool_call_id).toBe('toolu_001');
      expect(result.status).toBe('running');
      expect(result.source).toBe('jsonl');
      expect(result.raw_data).toEqual(jsonlEvent);
    });

    it('should extract file operation from view tool', () => {
      const jsonlEvent = {
        type: 'tool.execution_start',
        data: {
          toolCallId: 'toolu_001',
          toolName: 'view',
          arguments: {
            path: '/Users/shelfwood/Projects/myapp/src/index.ts'
          }
        },
        id: 'tool-start-001',
        timestamp: '2025-11-14T18:08:34.380Z',
        parentId: 'parent-uuid-1'
      };

      const result = transformer.transformToolStart(jsonlEvent, sessionId);

      expect(result.file_path).toBe('src/index.ts');
      expect(result.operation).toBe('read');
    });

    it('should extract command from bash tool', () => {
      const jsonlEvent = {
        type: 'tool.execution_start',
        data: {
          toolCallId: 'toolu_002',
          toolName: 'bash',
          arguments: {
            command: 'git status'
          }
        },
        id: 'tool-start-002',
        timestamp: '2025-11-14T18:09:00.000Z',
        parentId: 'parent-uuid-2'
      };

      const result = transformer.transformToolStart(jsonlEvent, sessionId);

      expect(result.command).toBe('git status');
      expect(result.command_category).toBe('git');
    });
  });

  describe('transformToolComplete', () => {
    it('should transform successful completion', () => {
      const jsonlEvent = {
        type: 'tool.execution_complete',
        data: {
          toolCallId: 'toolu_001',
          success: true,
          result: { content: 'file contents' }
        },
        id: 'tool-complete-001',
        timestamp: '2025-11-14T18:08:34.401Z',
        parentId: 'tool-start-001'
      };

      const result = transformer.transformToolComplete(jsonlEvent, sessionId);

      expect(result.event_type).toBe('tool_complete');
      expect(result.status).toBe('success');
      expect(result.tool_call_id).toBe('toolu_001');
    });

    it('should transform failed completion', () => {
      const jsonlEvent = {
        type: 'tool.execution_complete',
        data: {
          toolCallId: 'toolu_002',
          success: false
        },
        id: 'tool-complete-002',
        timestamp: '2025-11-14T18:09:00.150Z',
        parentId: 'tool-start-002'
      };

      const result = transformer.transformToolComplete(jsonlEvent, sessionId);

      expect(result.status).toBe('error');
    });
  });

  describe('extractFileOperation', () => {
    it('should extract read operation', () => {
      const result = transformer.extractFileOperation({
        toolName: 'view',
        arguments: { path: '/Users/shelfwood/Projects/myapp/src/index.ts' }
      });

      expect(result.file_path).toBe('src/index.ts');
      expect(result.operation).toBe('read');
    });

    it('should extract edit operation', () => {
      const result = transformer.extractFileOperation({
        toolName: 'edit_file',
        arguments: { path: '/Users/shelfwood/Projects/myapp/src/utils.js' }
      });

      expect(result.file_path).toBe('src/utils.js');
      expect(result.operation).toBe('edit');
    });

    it('should extract write operation', () => {
      const result = transformer.extractFileOperation({
        toolName: 'write_file',
        arguments: { path: '/Users/shelfwood/Projects/myapp/src/new.js' }
      });

      expect(result.file_path).toBe('src/new.js');
      expect(result.operation).toBe('write');
    });

    it('should return null for non-file tools', () => {
      const result = transformer.extractFileOperation({
        toolName: 'bash',
        arguments: { command: 'ls' }
      });

      expect(result).toBe(null);
    });

    it('should return null when path is missing', () => {
      const result = transformer.extractFileOperation({
        toolName: 'view',
        arguments: {}
      });

      expect(result).toBe(null);
    });
  });

  describe('extractCommand', () => {
    it('should extract shell command', () => {
      const result = transformer.extractCommand({
        toolName: 'shell',
        arguments: { command: 'npm install' }
      });

      expect(result.command).toBe('npm install');
      expect(result.category).toBe('npm');
    });

    it('should extract bash command', () => {
      const result = transformer.extractCommand({
        toolName: 'bash',
        arguments: { command: 'git status' }
      });

      expect(result.command).toBe('git status');
      expect(result.category).toBe('git');
    });

    it('should return null for non-shell tools', () => {
      const result = transformer.extractCommand({
        toolName: 'view',
        arguments: { path: '/some/path' }
      });

      expect(result).toBe(null);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration in milliseconds', () => {
      const startEvent = {
        timestamp: '2025-11-14T18:08:34.380Z'
      };
      const completeEvent = {
        timestamp: '2025-11-14T18:08:34.401Z'
      };

      const duration = transformer.calculateDuration(startEvent, completeEvent);
      expect(duration).toBe(21);
    });

    it('should handle longer durations', () => {
      const startEvent = {
        timestamp: '2025-11-14T18:08:00.000Z'
      };
      const completeEvent = {
        timestamp: '2025-11-14T18:09:00.150Z'
      };

      const duration = transformer.calculateDuration(startEvent, completeEvent);
      expect(duration).toBe(60150);
    });
  });

  describe('mergeEvents', () => {
    it('should merge start and complete events with duration', () => {
      const startEvent = {
        session_id: sessionId,
        copilot_event_id: 'start-001',
        timestamp: '2025-11-14T18:08:34.380Z',
        event_type: 'tool_start',
        tool_name: 'view',
        status: 'running'
      };

      const completeEvent = {
        timestamp: '2025-11-14T18:08:34.401Z',
        status: 'success'
      };

      const merged = transformer.mergeEvents(startEvent, completeEvent);

      expect(merged.event_type).toBe('tool_execution');
      expect(merged.status).toBe('success');
      expect(merged.duration_ms).toBe(21);
      expect(merged.tool_name).toBe('view');
    });
  });
});
