import { describe, test, expect } from 'vitest';
import { withinTimeWindow, parseTimestamp, sleep } from '../correlation/time-utils.js';

describe('Time Utilities', () => {
  describe('withinTimeWindow', () => {
    test('returns true when timestamps are within window', () => {
      const time1 = '2025-11-14T18:00:00.000Z';
      const time2 = '2025-11-14T18:00:04.000Z';
      expect(withinTimeWindow(time1, time2, 5000)).toBe(true);
    });

    test('returns true when timestamps are exactly at boundary', () => {
      const time1 = '2025-11-14T18:00:00.000Z';
      const time2 = '2025-11-14T18:00:05.000Z';
      expect(withinTimeWindow(time1, time2, 5000)).toBe(true);
    });

    test('returns false when timestamps exceed window', () => {
      const time1 = '2025-11-14T18:00:00.000Z';
      const time2 = '2025-11-14T18:00:06.000Z';
      expect(withinTimeWindow(time1, time2, 5000)).toBe(false);
    });

    test('handles negative time differences', () => {
      const time1 = '2025-11-14T18:00:05.000Z';
      const time2 = '2025-11-14T18:00:00.000Z';
      expect(withinTimeWindow(time1, time2, 5000)).toBe(true);
    });

    test('works with Date objects', () => {
      const time1 = new Date('2025-11-14T18:00:00.000Z');
      const time2 = new Date('2025-11-14T18:00:03.000Z');
      expect(withinTimeWindow(time1, time2, 5000)).toBe(true);
    });
  });

  describe('parseTimestamp', () => {
    test('parses ISO timestamp to milliseconds', () => {
      const timestamp = '2025-11-14T18:00:00.000Z';
      const result = parseTimestamp(timestamp);
      expect(result).toBe(new Date(timestamp).getTime());
    });

    test('handles timestamps with milliseconds', () => {
      const timestamp = '2025-11-14T18:00:00.123Z';
      const result = parseTimestamp(timestamp);
      expect(result).toBe(1763173200123);
    });
  });

  describe('sleep', () => {
    test('resolves after specified delay', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow small variance
      expect(elapsed).toBeLessThan(200);
    });
  });
});
