import { MonitorDaemon } from '../index.js';
import { EventStore } from '../database/event-store.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Integration test: Spawn real agent and verify event capture
 */
async function testIntegration() {
  console.log('🧪 Integration Test: Monitor Daemon\n');

  const testDbPath = join(__dirname, 'integration-test.db');

  try {
    // Clean up previous test
    await fs.unlink(testDbPath).catch(() => {});

    console.log('1. Starting monitor daemon...');
    const daemon = new MonitorDaemon({ dbPath: testDbPath });
    await daemon.start();

    console.log('\n2. Spawning test agent...');
    // TODO: Spawn actual agent via MCP or CLI
    // const agentSession = await spawnTestAgent();

    console.log('\n3. Waiting for events (30s)...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('\n4. Verifying captured events...');
    const eventStore = new EventStore(testDbPath);

    const sessions = await eventStore.listSessions();
    console.log(`   Sessions: ${sessions.length}`);

    if (sessions.length > 0) {
      const events = await eventStore.getEvents(sessions[0].id);
      console.log(`   Events: ${events.length}`);

      const fileActivity = await eventStore.getFileActivity(sessions[0].id);
      console.log(`   File operations: ${fileActivity.length}`);

      const commandStats = await eventStore.getCommandStats(sessions[0].id);
      console.log(`   Command categories: ${commandStats.length}`);
    }

    await daemon.stop();
    eventStore.close();

    console.log('\n✓ Integration test complete\n');
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    throw error;
  } finally {
    await fs.unlink(testDbPath).catch(() => {});
  }
}

testIntegration();
