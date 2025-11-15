/**
 * Session Correlation Integration
 * 
 * High-level function that combines metadata watcher and correlator
 * to automatically detect and correlate new agent spawns.
 */

import MetadataWatcher from './metadata-watcher.js';
import SessionCorrelator from './session-correlator.js';
import { sleep } from './time-utils.js';

/**
 * Monitor for new agent spawns and correlate them with copilot sessions
 * 
 * Usage:
 *   const watcher = startCorrelation((agentSession, copilotUuid, metadata) => {
 *     console.log(`Agent ${agentSession} → Copilot ${copilotUuid}`);
 *   });
 * 
 *   // Later, to stop:
 *   watcher.stop();
 * 
 * @param {Function} onCorrelated - Callback (sessionId, copilotUuid, metadata)
 * @param {Object} options - Configuration options
 * @param {string} options.metadataDir - Agent metadata directory path
 * @param {string} options.copilotStateDir - Copilot session state directory path
 * @param {number} options.correlationDelay - Delay before correlation attempt (ms)
 * @returns {MetadataWatcher} Watcher instance (call .stop() to stop monitoring)
 */
function startCorrelation(onCorrelated, options = {}) {
  const {
    metadataDir = '~/projects/shelfwood-agents/agent/metadata',
    copilotStateDir = '~/.copilot/session-state',
    correlationDelay = 10000 // 10 seconds
  } = options;

  const watcher = new MetadataWatcher(metadataDir);
  const correlator = new SessionCorrelator(copilotStateDir);

  watcher.watch(async (metadata) => {
    console.log(`[CORRELATION] New agent spawn detected: ${metadata.session_id}`);
    
    // Wait for copilot to initialize and start creating events
    console.log(`[CORRELATION] Waiting ${correlationDelay}ms for copilot initialization...`);
    await sleep(correlationDelay);

    try {
      const copilotUuid = await correlator.findCopilotSession(metadata);

      if (copilotUuid) {
        console.log(`[CORRELATION] Match found: ${metadata.session_id} → ${copilotUuid}`);
        onCorrelated(metadata.session_id, copilotUuid, metadata);
      } else {
        console.warn(`[CORRELATION] No copilot session found for ${metadata.session_id}`);
        console.warn(`[CORRELATION] - Spawned at: ${metadata.spawned_at}`);
        console.warn(`[CORRELATION] - Project dir: ${metadata.project_dir}`);
      }
    } catch (error) {
      console.error(`[CORRELATION] Error correlating ${metadata.session_id}:`, error);
    }
  });

  console.log('[CORRELATION] Session correlation monitoring started');
  
  return watcher;
}

/**
 * Correlate a single agent session (one-time correlation)
 * 
 * @param {Object} agentMetadata - Agent metadata object
 * @param {Object} options - Configuration options
 * @param {string} options.copilotStateDir - Copilot session state directory path
 * @returns {Promise<string|null>} Copilot session UUID or null
 */
async function correlateSingleSession(agentMetadata, options = {}) {
  const {
    copilotStateDir = '~/.copilot/session-state'
  } = options;

  const correlator = new SessionCorrelator(copilotStateDir);
  return await correlator.findCopilotSession(agentMetadata);
}

export {
  startCorrelation,
  correlateSingleSession
};
