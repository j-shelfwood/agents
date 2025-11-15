import { describe, it, beforeEach } from 'vitest';
import { expect } from 'vitest';
import JsonlParser from '../parsers/jsonl-parser.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_FILE = path.join(__dirname, 'sample-session.jsonl');

describe('JsonlParser', () => {
  let parser;

  beforeEach(() => {
    parser = new JsonlParser(SAMPLE_FILE);
  });

  describe('readAllEvents', () => {
    it('should parse complete JSONL file', async () => {
      const events = await parser.readAllEvents();
      
      expect(events.length).toBe(7);
      expect(events[0].type).toBe('session.start');
      expect(events[1].type).toBe('tool.execution_start');
      expect(events[2].type).toBe('tool.execution_complete');
    });

    it('should parse event data correctly', async () => {
      const events = await parser.readAllEvents();
      
      const sessionStart = events[0];
      expect(sessionStart.data.sessionId).toBe('test-session-123');
      expect(sessionStart.id).toBe('session-uuid-1');
      
      const toolStart = events[1];
      expect(toolStart.data.toolName).toBe('view');
      expect(toolStart.data.toolCallId).toBe('toolu_001');
      expect(toolStart.data.arguments.path).toBe('/Users/shelfwood/Projects/myapp/src/index.ts');
    });
  });

  describe('readNewEvents', () => {
    it('should track file position', async () => {
      const firstRead = await parser.readNewEvents();
      expect(firstRead.length).toBe(7);
      
      const position = parser.getPosition();
      expect(position).toBeGreaterThan(0);
      
      // Second read should return nothing (no new data)
      const secondRead = await parser.readNewEvents();
      expect(secondRead.length).toBe(0);
    });

    it('should only read new events after position update', async () => {
      // Read first 3 lines
      const stats = fs.statSync(SAMPLE_FILE);
      const content = fs.readFileSync(SAMPLE_FILE, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      
      // Manually set position to after first line
      const firstLineLength = lines[0].length + 1; // +1 for newline
      parser.position = firstLineLength;
      
      const events = await parser.readNewEvents();
      expect(events.length).toBe(6); // Should read remaining 6 events
      expect(events[0].type).toBe('tool.execution_start');
    });
  });

  describe('filterByType', () => {
    it('should filter events by single type', async () => {
      const events = await parser.readAllEvents();
      const filtered = parser.filterByType(events, 'tool.execution_start');
      
      expect(filtered.length).toBe(3);
      filtered.forEach(event => {
        expect(event.type).toBe('tool.execution_start');
      });
    });

    it('should filter events by multiple types', async () => {
      const events = await parser.readAllEvents();
      const filtered = parser.filterByType(events, ['tool.execution_start', 'tool.execution_complete']);
      
      expect(filtered.length).toBe(6);
    });
  });

  describe('reset', () => {
    it('should reset position to beginning', async () => {
      await parser.readAllEvents();
      expect(parser.getPosition()).toBeGreaterThan(0);
      
      parser.reset();
      expect(parser.getPosition()).toBe(0);
      
      const events = await parser.readNewEvents();
      expect(events.length).toBe(7);
    });
  });

  describe('error handling', () => {
    it('should skip malformed JSON lines', async () => {
      const testFile = path.join(__dirname, 'malformed.jsonl');
      fs.writeFileSync(testFile, '{"type":"valid"}\n{invalid json}\n{"type":"also-valid"}\n');
      
      const testParser = new JsonlParser(testFile);
      const events = await testParser.readAllEvents();
      
      expect(events.length).toBe(2);
      expect(events[0].type).toBe('valid');
      expect(events[1].type).toBe('also-valid');
      
      fs.unlinkSync(testFile);
    });

    it('should return empty array for non-existent file', async () => {
      const testParser = new JsonlParser('/nonexistent/file.jsonl');
      const events = await testParser.readNewEvents();
      
      expect(events.length).toBe(0);
    });
  });
});
