#!/usr/bin/env node

/**
 * Agent Visualization System - Monitor Daemon
 *
 * Watches for agent activity and streams events to database
 */

import { EventStore } from './database/event-store.js';
import MetadataWatcher from './correlation/metadata-watcher.js';
import SessionCorrelator from './correlation/session-correlator.js';
import JsonlParser from './parsers/jsonl-parser.js';
import { EventTransformer } from './transformers/event-transformer.js';
import chokidar from 'chokidar';
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
    this.agentMetadataDir = options.metadataDir ||
      join(os.homedir(), 'Projects/shelfwood-agents/agent/metadata');

    this.eventStore = null;
    this.metadataWatcher = null;
    this.correlator = null;
    this.activeSessions = new Map(); // sessionId → { parser, watcher, metadata }
  }

  async start() {
    console.log('🚀 Agent Monitor Daemon starting...\n');

    // Initialize database
    this.eventStore = new EventStore(this.dbPath);
    console.log('✓ Database initialized:', this.dbPath);

    // Initialize correlator
    this.correlator = new SessionCorrelator(this.copilotStateDir);
    console.log('✓ Session correlator ready');

    // Start watching for new agent spawns
    this.metadataWatcher = new MetadataWatcher(this.agentMetadataDir);
    this.metadataWatcher.watch(this.onNewAgent.bind(this));
    console.log('✓ Watching for agent spawns:', this.agentMetadataDir);

    // Check for existing active sessions
    const existing = await this.metadataWatcher.getExistingAgents();
    console.log(`\n📊 Found ${existing.length} existing agent sessions\n`);

    for (const metadata of existing) {
      await this.onNewAgent(metadata);
    }

    console.log('✓ Monitor daemon running\n');
    console.log('Press Ctrl+C to stop\n');
    
    // Start periodic retry for failed correlations
    this.startCorrelationRetry();
  }

  startCorrelationRetry() {
    const retryInterval = 60000; // 60 seconds
    
    this.retryTimer = setInterval(async () => {
      try {
        const failedSessions = await this.eventStore.listSessions({ status: 'correlation_failed' });
        
        if (failedSessions.length > 0) {
          console.log(`\n🔄 Retrying correlation for ${failedSessions.length} failed sessions...`);
          
          for (const session of failedSessions) {
            const metadata = {
              session_id: session.id,
              spawned_at: session.spawned_at,
              project_dir: session.project_dir
            };
            
            const copilotUuid = await this.correlator.findCopilotSession(metadata);
            
            if (copilotUuid) {
              console.log(`   ✓ ${session.id} → ${copilotUuid}`);
              
              await this.eventStore.updateSession(session.id, {
                copilot_session_id: copilotUuid,
                status: 'running'
              });
              
              await this.monitorCopilotSession(session.id, copilotUuid, metadata);
            }
          }
        }
      } catch (error) {
        console.error('Error in correlation retry:', error.message);
      }
    }, retryInterval);
    
    console.log(`🔄 Correlation retry enabled (every ${retryInterval/1000}s)\n`);
  }

  async onNewAgent(metadata) {
    const { session_id, spawned_at, project_dir } = metadata;

    console.log(`\n🆕 New agent detected: ${session_id}`);
    console.log(`   Project: ${project_dir}`);
    console.log(`   Spawned: ${spawned_at}`);

    try {
      // Create or get existing session
      let session = await this.eventStore.createSession({
        id: session_id,
        project_dir: project_dir,
        spawned_at: spawned_at,
        spawned_by: metadata.spawned_by || 'manual',
        status: 'running',
        importance: metadata.importance || 'normal',
        pid: metadata.pid
      });

      // Skip if already correlated
      if (session.copilot_session_id) {
        console.log(`   ℹ️  Already correlated to: ${session.copilot_session_id}`);
        
        // Resume monitoring if not already active
        if (!this.activeSessions.has(session_id)) {
          await this.monitorCopilotSession(session_id, session.copilot_session_id, metadata);
        }
        return;
      }

      // Wait for copilot to initialize
      console.log(`   Waiting 10s for Copilot initialization...`);
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Correlate to copilot session
      const copilotUuid = await this.correlator.findCopilotSession(metadata);

      if (!copilotUuid) {
        console.log(`   ⚠️  No Copilot session found for ${session_id}`);
        await this.eventStore.updateSession(session_id, {
          status: 'correlation_failed'
        });
        return;
      }

      console.log(`   ✓ Correlated to Copilot: ${copilotUuid}`);

      // Update session with copilot UUID
      await this.eventStore.updateSession(session_id, {
        copilot_session_id: copilotUuid
      });

      // Start monitoring copilot session file
      await this.monitorCopilotSession(session_id, copilotUuid, metadata);
    } catch (error) {
      await this.handleError(`onNewAgent(${session_id})`, error);
    }
  }

  async monitorCopilotSession(sessionId, copilotUuid, metadata) {
    const jsonlPath = join(this.copilotStateDir, `${copilotUuid}.jsonl`);

    console.log(`   📡 Monitoring: ${copilotUuid}.jsonl`);

    try {
      // Create JSONL parser
      const parser = new JsonlParser(jsonlPath);
      const transformer = new EventTransformer();

      // Process existing events
      const existingEvents = await parser.readAllEvents();
      console.log(`   📥 Processing ${existingEvents.length} existing events...`);

      const transformedEvents = [];
      let duplicatesSkipped = 0;
      
      for (const event of existingEvents) {
        let transformed = null;
        
        if (event.type === 'tool.execution_start') {
          transformed = transformer.transformToolStart(event, sessionId);
        } else if (event.type === 'tool.execution_complete') {
          transformed = transformer.transformToolComplete(event, sessionId);
        }
        
        if (transformed && transformed.copilot_event_id) {
          // Check if event already exists
          const existing = await this.eventStore.getEventByCopilotId(
            sessionId,
            transformed.copilot_event_id
          );
          
          if (!existing) {
            transformedEvents.push(transformed);
          } else {
            duplicatesSkipped++;
          }
        }
      }

      if (transformedEvents.length > 0) {
        await this.eventStore.insertEvents(transformedEvents);
        console.log(`   ✓ Inserted ${transformedEvents.length} events (${duplicatesSkipped} duplicates skipped)`);
      } else if (duplicatesSkipped > 0) {
        console.log(`   ⊘ All ${duplicatesSkipped} events already processed`);
      }

      // Watch for new events
      const watcher = chokidar.watch(jsonlPath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      });

      watcher.on('change', async () => {
        try {
          const newEvents = await parser.readNewEvents();

          if (newEvents.length === 0) return;

          const transformed = [];
          for (const event of newEvents) {
            let t = null;
            
            if (event.type === 'tool.execution_start') {
              t = transformer.transformToolStart(event, sessionId);
            } else if (event.type === 'tool.execution_complete') {
              t = transformer.transformToolComplete(event, sessionId);
            }
            
            if (t && t.copilot_event_id) {
              // Check for duplicates in live events too
              const existing = await this.eventStore.getEventByCopilotId(
                sessionId,
                t.copilot_event_id
              );
              
              if (!existing) {
                transformed.push(t);
              }
            }
          }

          if (transformed.length > 0) {
            await this.eventStore.insertEvents(transformed);
            console.log(`   📊 ${sessionId}: +${transformed.length} events`);
          }
        } catch (error) {
          console.error(`   ❌ Error processing events for ${sessionId}:`, error.message);
        }
      });

      // Store active session
      this.activeSessions.set(sessionId, {
        parser,
        watcher,
        metadata,
        copilotUuid
      });
    } catch (error) {
      await this.handleError(`monitorCopilotSession(${sessionId})`, error);
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

    // Stop retry timer
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      console.log('   ✓ Stopped correlation retry');
    }

    // Stop all watchers
    for (const [sessionId, { watcher }] of this.activeSessions) {
      await watcher.close();
      console.log(`   ✓ Stopped monitoring ${sessionId}`);
    }

    if (this.metadataWatcher) {
      this.metadataWatcher.stop();
      console.log('   ✓ Stopped metadata watcher');
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
