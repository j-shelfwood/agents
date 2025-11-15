import chokidar from 'chokidar';
import JsonlParser from '../parsers/jsonl-parser.js';
import path from 'path';
import fs from 'fs';

/**
 * JSONL-First Session Watcher
 * 
 * Monitors ~/.copilot/session-state/*.jsonl files directly
 * Eliminates need for correlation with agent metadata
 */
export class JsonlWatcher {
  constructor(copilotStateDir) {
    this.copilotStateDir = copilotStateDir;
    this.watcher = null;
    this.processedSessions = new Set();
    this.parsers = new Map(); // sessionId -> parser
  }

  /**
   * Start watching for JSONL files
   * @param {Function} onNewSession - Callback: ({ sessionId, events, metadata, isUpdate })
   */
  async watch(onNewSession) {
    // Process existing files on startup (backfill)
    await this.processExistingFiles(onNewSession);

    // Watch for new/modified files
    this.watcher = chokidar.watch(`${this.copilotStateDir}/*.jsonl`, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher.on('add', async (filePath) => {
      await this.processJsonlFile(filePath, onNewSession, { isUpdate: false });
    });

    this.watcher.on('change', async (filePath) => {
      await this.processJsonlFile(filePath, onNewSession, { isUpdate: true });
    });
  }

  /**
   * Process all existing JSONL files (historical backfill)
   */
  async processExistingFiles(callback) {
    if (!fs.existsSync(this.copilotStateDir)) {
      console.log(`   ⚠️  Copilot state directory not found: ${this.copilotStateDir}`);
      return;
    }

    const files = fs.readdirSync(this.copilotStateDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    console.log(`\n📂 Processing ${jsonlFiles.length} existing JSONL files...`);

    for (const file of jsonlFiles) {
      const filePath = path.join(this.copilotStateDir, file);
      await this.processJsonlFile(filePath, callback, { isUpdate: false });
    }
  }

  /**
   * Process a single JSONL file
   */
  async processJsonlFile(filePath, callback, options = {}) {
    const sessionId = path.basename(filePath, '.jsonl');

    try {
      // Get or create parser for this session
      let parser = this.parsers.get(sessionId);
      if (!parser) {
        parser = new JsonlParser(filePath);
        this.parsers.set(sessionId, parser);
      }

      // Read events (all for new files, incremental for updates)
      const events = options.isUpdate 
        ? await parser.readNewEvents()
        : await parser.readAllEvents();

      // Skip if no events (empty file or no new data)
      if (events.length === 0) {
        return;
      }

      // Extract metadata from events
      const metadata = this.extractMetadata(sessionId, filePath, events);

      // Mark as processed
      this.processedSessions.add(sessionId);

      // Invoke callback
      await callback({
        sessionId,
        events,
        metadata,
        isUpdate: options.isUpdate
      });

    } catch (error) {
      console.error(`   ❌ Error processing ${sessionId}:`, error.message);
    }
  }

  /**
   * Extract session metadata from JSONL events
   */
  extractMetadata(sessionId, filePath, events) {
    // Find session.start event
    const sessionStart = events.find(e => e.type === 'session.start');
    
    // Extract tool events for project directory inference
    const toolEvents = events.filter(e => 
      e.type === 'tool.execution_start' || 
      e.type === 'tool.execution_complete'
    );

    // Determine project directory from file paths
    const projectDir = this.extractProjectDir(toolEvents);

    // Determine session status based on file modification time
    const status = this.inferStatus(filePath);

    return {
      session_id: sessionStart?.data?.sessionId || sessionId,
      spawned_at: sessionStart?.data?.startTime || this.getFileCreationTime(filePath),
      project_dir: projectDir || 'unknown',
      status: status
    };
  }

  /**
   * Extract most common project directory from tool events
   */
  extractProjectDir(toolEvents) {
    const dirCounts = new Map();

    for (const event of toolEvents) {
      // Try multiple path locations in event data
      const filePath = 
        event.data?.arguments?.path ||
        event.data?.path ||
        event.data?.arguments?.file_path ||
        null;

      if (filePath && typeof filePath === 'string' && filePath.startsWith('/')) {
        // Extract base project directory (first 4 path segments)
        const segments = filePath.split('/').filter(Boolean);
        if (segments.length >= 3) {
          const dir = '/' + segments.slice(0, 3).join('/');
          dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
        }
      }
    }

    // Return most common directory
    if (dirCounts.size === 0) {
      return null;
    }

    let maxCount = 0;
    let mostCommonDir = null;
    for (const [dir, count] of dirCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDir = dir;
      }
    }

    return mostCommonDir;
  }

  /**
   * Infer session status from file modification time
   */
  inferStatus(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const lastModified = stats.mtime.getTime();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);

      return lastModified > oneHourAgo ? 'running' : 'completed';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get file creation time as fallback for spawned_at
   */
  getFileCreationTime(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.birthtime.toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  /**
   * Stop watching
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.parsers.clear();
    this.processedSessions.clear();
  }
}

export default JsonlWatcher;
