#!/usr/bin/env node

/**
 * Agent Visualization System - Monitor Daemon
 *
 * Watches for agent activity and streams events to database
 */

import { EventStore } from './database/event-store.js';
import JsonlWatcher from './watchers/jsonl-watcher.js';
import { EventTransformer } from './transformers/event-transformer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MonitorDaemon {
  constructor(options = {}) {
    this.dbPath = options.dbPath || join(__dirname, '../data/viz-data.db');
    this.copilotStateDir = join(os.homedir(), '.copilot/session-state');

    this.eventStore = null;
    this.jsonlWatcher = null;
    this.activeSessions = new Map(); // sessionId → { metadata }
  }

  async start() {
    console.log('🚀 Agent Monitor Daemon starting...\n');

    // Initialize database
    this.eventStore = new EventStore(this.dbPath);
    console.log('✓ Database initialized:', this.dbPath);

    // Start watching JSONL files directly
    this.jsonlWatcher = new JsonlWatcher(this.copilotStateDir);
    await this.jsonlWatcher.watch(this.onNewSession.bind(this));
    console.log('✓ Watching Copilot sessions:', this.copilotStateDir);

    console.log('\n✅ Monitor daemon ready - watching for sessions\n');
    console.log('Press Ctrl+C to stop\n');
  }

  async onNewSession({ sessionId, events, metadata, isUpdate }) {
    try {
      if (!isUpdate) {
        console.log(`\n📦 Processing session: ${sessionId}`);
        console.log(`   Project: ${metadata.project_dir}`);
        console.log(`   Events: ${events.length}`);
      }

      // Create or update session in database
      const existingSession = await this.eventStore.getSession(sessionId);

      if (!existingSession) {
        await this.eventStore.createSession({
          id: sessionId,
          spawned_at: metadata.spawned_at,
          project_dir: metadata.project_dir,
          status: metadata.status,
        });
        if (!isUpdate) {
          console.log(`   ✓ Session created`);
        }
      } else if (isUpdate) {
        await this.eventStore.updateSession(sessionId, {
          status: metadata.status,
        });
      }

      // Transform and insert events
      const transformer = new EventTransformer();
      let insertedCount = 0;
      let skippedCount = 0;

      for (const event of events) {
        if (event.type !== 'tool.execution_start' && event.type !== 'tool.execution_complete') {
          continue;
        }

        let transformed = null;
        if (event.type === 'tool.execution_start') {
          transformed = transformer.transformToolStart(event, sessionId);
        } else {
          transformed = transformer.transformToolComplete(event, sessionId);
        }

        if (!transformed || !transformed.copilot_event_id) {
          continue;
        }

        // Check if event already exists
        const existing = await this.eventStore.getEventByCopilotId(
          sessionId,
          transformed.copilot_event_id
        );

        if (!existing) {
          await this.eventStore.insertEvent(transformed);
          insertedCount++;
        } else {
          skippedCount++;
        }
      }

      if (!isUpdate && insertedCount > 0) {
        console.log(`   ✓ Inserted ${insertedCount} events (${skippedCount} duplicates skipped)`);
      } else if (isUpdate && insertedCount > 0) {
        console.log(`   📊 ${sessionId}: +${insertedCount} events`);
      }

      // Track active sessions
      if (metadata.status === 'running' && !this.activeSessions.has(sessionId)) {
        this.activeSessions.set(sessionId, { metadata });
        if (!isUpdate) {
          console.log(`   👀 Live monitoring enabled`);
        }
      }

    } catch (error) {
      console.error(`Error processing session ${sessionId}:`, error.message);
    }
  }

  async handleError(context, error) {
    console.error(`\n❌ Error in ${context}:`, error.message);

    // Log to file
    const logPath = join(__dirname, '../logs/monitor.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${context}: ${error.message}\n${error.stack}\n\n`;

    try {
      await fs.mkdir(dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (logError) {
      // Ignore log errors
    }

    // Continue monitoring (don't crash)
  }

  async stop() {
    console.log('\n🛑 Shutting down monitor daemon...');

    if (this.jsonlWatcher) {
      await this.jsonlWatcher.stop();
      console.log('   ✓ Stopped JSONL watcher');
    }

    if (this.eventStore) {
      this.eventStore.close();
      console.log('   ✓ Closed database');
    }

    console.log('\n✓ Monitor daemon stopped\n');
  }
}

// Main execution
async function main() {
  const daemon = new MonitorDaemon();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await daemon.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await daemon.stop();
    process.exit(0);
  });

  await daemon.start();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

export { MonitorDaemon };
