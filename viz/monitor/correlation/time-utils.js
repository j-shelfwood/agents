/**
 * Time Utilities for Session Correlation
 * 
 * Handles timestamp parsing and comparison for matching
 * agent spawns with copilot session creation events.
 */

/**
 * Check if two timestamps are within a specified time window
 * 
 * @param {string|Date} time1 - First timestamp (ISO string or Date)
 * @param {string|Date} time2 - Second timestamp (ISO string or Date)
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} True if timestamps are within window
 */
function withinTimeWindow(time1, time2, windowMs) {
  const t1 = new Date(time1).getTime();
  const t2 = new Date(time2).getTime();
  return Math.abs(t1 - t2) <= windowMs;
}

/**
 * Parse ISO timestamp to milliseconds since epoch
 * 
 * @param {string} isoString - ISO 8601 timestamp string
 * @returns {number} Milliseconds since epoch
 */
function parseTimestamp(isoString) {
  return new Date(isoString).getTime();
}

/**
 * Sleep for specified milliseconds
 * 
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export {
  withinTimeWindow,
  parseTimestamp,
  sleep
};
