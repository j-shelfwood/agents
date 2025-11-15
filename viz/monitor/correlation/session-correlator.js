/**
 * Session Correlator
 * 
 * Links agent session names to copilot session UUIDs by matching
 * spawn timestamps and verifying project directories.
 */

import { promises as fs } from 'fs';
import { statSync } from 'fs';
import path from 'path';
import os from 'os';
import { withinTimeWindow } from './time-utils.js';

class SessionCorrelator {
  /**
   * @param {string} copilotStateDir - Path to copilot session state directory
   */
  constructor(copilotStateDir = '~/.copilot/session-state') {
    this.copilotStateDir = copilotStateDir.replace('~', os.homedir());
  }

  /**
   * Find copilot session UUID for an agent session
   * 
   * Algorithm from VISUALIZATION_SPEC.md:212-248:
   * 1. Match spawn timestamp ±5 seconds
   * 2. Verify project directory from file operations
   * 3. Return copilot session UUID
   * 
   * @param {Object} agentMetadata - Agent metadata object
   * @param {string} agentMetadata.session_id - Agent session ID
   * @param {string} agentMetadata.spawned_at - ISO timestamp of spawn
   * @param {string} agentMetadata.project_dir - Project directory path
   * @returns {Promise<string|null>} Copilot session UUID or null if no match
   */
  async findCopilotSession(agentMetadata) {
    const copilotSessions = await this.getRecentSessions();

    for (const sessionFile of copilotSessions) {
      try {
        const events = await this._parseJsonl(sessionFile);
        const sessionStart = events.find(e => e.type === 'session.start');

        if (!sessionStart) continue;

        // Check if copilot session was ACTIVE when agent spawned
        // Session must start BEFORE or near agent spawn (0 to +5 minutes)
        const sessionStartTime = new Date(sessionStart.timestamp);
        const agentSpawnTime = new Date(agentMetadata.spawned_at);
        
        const timeDiff = agentSpawnTime - sessionStartTime;
        const maxWindow = 300000; // 5 minutes in milliseconds
        
        // Session started before agent (timeDiff >= 0) and within 5 minutes
        if (timeDiff < 0 || timeDiff > maxWindow) {
          continue;
        }

        // Verify project directory via file operations
        const fileOps = events.filter(e =>
          e.type === 'tool.execution_start' &&
          (e.data.toolName === 'view' || e.data.toolName === 'edit' || 
           e.data.toolName === 'create' || e.data.toolName === 'bash')
        );

        const hasProjectFiles = fileOps.some(op => {
          const argPath = op.data.arguments?.path;
          return argPath && (
            argPath.startsWith(agentMetadata.project_dir) ||
            argPath.includes(agentMetadata.project_dir)
          );
        });

        if (hasProjectFiles) {
          return sessionStart.data.sessionId; // MATCH FOUND
        }
      } catch (error) {
        console.warn(`Error processing session file ${sessionFile}:`, error.message);
        continue;
      }
    }

    return null; // No match
  }

  /**
   * Get recent copilot sessions (last 24 hours)
   * 
   * @returns {Promise<string[]>} Array of session file paths
   */
  async getRecentSessions() {
    try {
      const files = await fs.readdir(this.copilotStateDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      const recentFiles = [];
      
      for (const file of jsonlFiles) {
        const filePath = path.join(this.copilotStateDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtimeMs >= oneDayAgo) {
          recentFiles.push(filePath);
        }
      }
      
      return recentFiles.sort((a, b) => {
        // Sort by modification time, newest first
        const aStats = statSync(a);
        const bStats = statSync(b);
        return bStats.mtimeMs - aStats.mtimeMs;
      });
    } catch (error) {
      console.warn(`Error reading copilot state directory: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if session is still active (file being written)
   * 
   * @param {string} sessionUuid - Copilot session UUID
   * @returns {Promise<boolean>} True if session file was modified recently
   */
  async isSessionActive(sessionUuid) {
    const sessionFile = path.join(this.copilotStateDir, `${sessionUuid}.jsonl`);
    
    try {
      const stats = await fs.stat(sessionFile);
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      return stats.mtimeMs >= fiveMinutesAgo;
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse JSONL file into array of events
   * 
   * @private
   * @param {string} filePath - Path to JSONL file
   * @returns {Promise<Array>} Array of parsed JSON events
   */
  async _parseJsonl(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    return lines
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          console.warn(`Failed to parse line in ${filePath}:`, error.message);
          return null;
        }
      })
      .filter(Boolean);
  }
}

export default SessionCorrelator;
