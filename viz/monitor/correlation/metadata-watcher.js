/**
 * Metadata Watcher
 * 
 * Monitors agent metadata directory for new agent spawns.
 * Emits events when new metadata files are created.
 */

import chokidar from 'chokidar';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

class MetadataWatcher {
  /**
   * @param {string} metadataDir - Path to agent metadata directory
   */
  constructor(metadataDir = '~/projects/shelfwood-agents/agent/metadata') {
    this.metadataDir = metadataDir.replace('~', os.homedir());
    this.watcher = null;
  }

  /**
   * Watch for new metadata files (agent spawns)
   * 
   * @param {Function} onNewAgent - Callback receives metadata object when new file detected
   * @returns {void}
   */
  watch(onNewAgent) {
    this.watcher = chokidar.watch(this.metadataDir, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true, // Don't emit events for existing files
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    });

    this.watcher.on('add', async (filePath) => {
      // Filter for JSON files only
      if (!filePath.endsWith('.json')) {
        return;
      }

      // Ignore archive directory
      if (filePath.includes('/archive/')) {
        return;
      }

      try {
        const metadata = await this._readMetadata(filePath);
        onNewAgent(metadata);
      } catch (error) {
        console.warn(`Error reading metadata file ${filePath}:`, error.message);
      }
    });

    this.watcher.on('error', error => {
      console.error('Metadata watcher error:', error);
    });
  }

  /**
   * Read all existing metadata files (initial state)
   * 
   * @returns {Promise<Array>} Array of metadata objects
   */
  async getExistingAgents() {
    try {
      const files = await fs.readdir(this.metadataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const metadataPromises = jsonFiles.map(file => {
        const filePath = path.join(this.metadataDir, file);
        return this._readMetadata(filePath);
      });
      
      const results = await Promise.allSettled(metadataPromises);
      
      return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
    } catch (error) {
      console.warn(`Error reading metadata directory: ${error.message}`);
      return [];
    }
  }

  /**
   * Stop watching
   * 
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Read and parse metadata file
   * 
   * @private
   * @param {string} filePath - Path to metadata JSON file
   * @returns {Promise<Object>} Parsed metadata object
   */
  async _readMetadata(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }
}

export default MetadataWatcher;
