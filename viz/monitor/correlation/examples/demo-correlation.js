#!/usr/bin/env node

/**
 * Session Correlation Demo
 * 
 * Demonstrates the session correlation system by monitoring
 * for new agent spawns and correlating them with copilot sessions.
 * 
 * Usage:
 *   node examples/demo-correlation.js
 */

const { startCorrelation } = require('../correlate-session');

console.log('='.repeat(60));
console.log('Session Correlation Demo');
console.log('='.repeat(60));
console.log('');
console.log('Monitoring for new agent spawns...');
console.log('Press Ctrl+C to stop');
console.log('');

const watcher = startCorrelation(
  (agentSessionId, copilotUuid, metadata) => {
    console.log('');
    console.log('✅ CORRELATION SUCCESSFUL');
    console.log('-'.repeat(60));
    console.log(`Agent Session:    ${agentSessionId}`);
    console.log(`Copilot Session:  ${copilotUuid}`);
    console.log(`Project:          ${metadata.project_dir}`);
    console.log(`Spawned:          ${metadata.spawned_at}`);
    console.log('-'.repeat(60));
    console.log('');
  },
  {
    correlationDelay: 10000 // Wait 10s for copilot to initialize
  }
);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('');
  console.log('Shutting down...');
  await watcher.stop();
  process.exit(0);
});
