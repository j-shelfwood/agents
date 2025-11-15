import fs from 'fs';
import readline from 'readline';

/**
 * Incremental JSONL file reader with position tracking
 */
export class JsonlParser {
  constructor(filePath) {
    this.filePath = filePath;
    this.position = 0;
  }

  /**
   * Read new events since last position
   * @returns {Promise<Array>} Array of parsed events
   */
  async readNewEvents() {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const stats = fs.statSync(this.filePath);
    
    // No new data since last read
    if (stats.size === this.position) {
      return [];
    }

    // File was truncated or replaced
    if (stats.size < this.position) {
      this.position = 0;
    }

    const events = [];
    const stream = fs.createReadStream(this.filePath, {
      start: this.position,
      encoding: 'utf8'
    });

    let buffer = '';
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        buffer += chunk;
      });

      stream.on('end', () => {
        const lines = buffer.split('\n');
        
        // Process complete lines only
        const completeLines = buffer.endsWith('\n') ? lines : lines.slice(0, -1);
        
        for (const line of completeLines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line);
              events.push(event);
            } catch (error) {
              // Skip malformed JSON lines
              console.warn(`Failed to parse JSONL line: ${error.message}`);
            }
          }
        }

        // Update position only for complete lines
        if (buffer.endsWith('\n')) {
          this.position = stats.size;
        } else {
          // Keep position before incomplete line
          const incompleteLineLength = lines[lines.length - 1].length;
          this.position = stats.size - incompleteLineLength;
        }

        resolve(events);
      });

      stream.on('error', reject);
    });
  }

  /**
   * Read all events from file
   * @returns {Promise<Array>} Array of all parsed events
   */
  async readAllEvents() {
    this.reset();
    return this.readNewEvents();
  }

  /**
   * Get current file position
   * @returns {number} Current byte position
   */
  getPosition() {
    return this.position;
  }

  /**
   * Reset to beginning
   */
  reset() {
    this.position = 0;
  }

  /**
   * Filter events by type
   * @param {Array} events - Array of events
   * @param {string|Array<string>} types - Event type(s) to filter
   * @returns {Array} Filtered events
   */
  filterByType(events, types) {
    const typeArray = Array.isArray(types) ? types : [types];
    return events.filter(event => typeArray.includes(event.type));
  }

  /**
   * Watch for file changes (basic implementation for integration with chokidar)
   * @param {Function} onNewEvents - Callback for new events
   * @returns {fs.FSWatcher} File watcher instance
   */
  watch(onNewEvents) {
    return fs.watch(this.filePath, async (eventType) => {
      if (eventType === 'change') {
        const newEvents = await this.readNewEvents();
        if (newEvents.length > 0) {
          onNewEvents(newEvents);
        }
      }
    });
  }
}

export default JsonlParser;
