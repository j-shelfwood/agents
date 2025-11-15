import { categorizeCommand } from './command-categorizer.js';
import { normalizePath } from './path-normalizer.js';

/**
 * Transform raw JSONL events into database-ready format
 */
export class EventTransformer {
  constructor(projectDir = null) {
    this.projectDir = projectDir;
  }

  /**
   * Transform tool.execution_start event
   * @param {Object} jsonlEvent - Raw JSONL event
   * @param {string} sessionId - Session identifier
   * @returns {Object} Database-ready event
   */
  transformToolStart(jsonlEvent, sessionId) {
    const { data, id, parentId, timestamp } = jsonlEvent;
    const { toolName, toolCallId, arguments: args } = data;

    const event = {
      session_id: sessionId,
      copilot_event_id: id,
      parent_event_id: parentId,
      timestamp: timestamp,
      event_type: 'tool_start',
      tool_name: toolName,
      tool_call_id: toolCallId,
      tool_arguments: args,
      file_path: null,
      operation: null,
      command: null,
      command_category: null,
      status: 'running',
      duration_ms: null,
      source: 'jsonl',
      raw_data: jsonlEvent
    };

    // Extract file operation
    const fileOp = this.extractFileOperation({ toolName, arguments: args });
    if (fileOp) {
      event.file_path = fileOp.file_path;
      event.operation = fileOp.operation;
    }

    // Extract command execution
    const commandInfo = this.extractCommand({ toolName, arguments: args });
    if (commandInfo) {
      event.command = commandInfo.command;
      event.command_category = commandInfo.category;
    }

    return event;
  }

  /**
   * Transform tool.execution_complete event
   * @param {Object} jsonlEvent - Raw JSONL event
   * @param {string} sessionId - Session identifier
   * @returns {Object} Database-ready event
   */
  transformToolComplete(jsonlEvent, sessionId) {
    const { data, id, parentId, timestamp } = jsonlEvent;
    const { toolCallId, success } = data;

    return {
      session_id: sessionId,
      copilot_event_id: id,
      parent_event_id: parentId,
      timestamp: timestamp,
      event_type: 'tool_complete',
      tool_name: null, // Will be matched from start event
      tool_call_id: toolCallId,
      tool_arguments: null,
      file_path: null,
      operation: null,
      command: null,
      command_category: null,
      status: success ? 'success' : 'error',
      duration_ms: null, // Will be calculated from matching start event
      source: 'jsonl',
      raw_data: jsonlEvent
    };
  }

  /**
   * Extract file operations from tool events
   * @param {Object} toolEvent - Tool event with name and arguments
   * @returns {Object|null} File operation details or null
   */
  extractFileOperation(toolEvent) {
    const { toolName, arguments: args } = toolEvent;

    if (!args || !args.path) {
      return null;
    }

    let operation = null;

    // Map tool names to operations
    if (toolName === 'view' || toolName === 'read_file') {
      operation = 'read';
    } else if (toolName === 'edit_file' || toolName === 'edit') {
      operation = 'edit';
    } else if (toolName === 'write_file' || toolName === 'create') {
      operation = 'write';
    }

    if (!operation) {
      return null;
    }

    const filePath = this.projectDir 
      ? normalizePath(args.path, this.projectDir)
      : args.path;

    return {
      file_path: filePath,
      operation: operation
    };
  }

  /**
   * Extract command execution from shell tool events
   * @param {Object} toolEvent - Tool event with name and arguments
   * @returns {Object|null} Command details or null
   */
  extractCommand(toolEvent) {
    const { toolName, arguments: args } = toolEvent;

    // Check for shell/bash tools
    if (toolName !== 'shell' && toolName !== 'bash') {
      return null;
    }

    const command = args?.command || args?.cmd;
    if (!command) {
      return null;
    }

    return {
      command: command,
      category: categorizeCommand(command)
    };
  }

  /**
   * Calculate event duration from start and complete events
   * @param {Object} startEvent - Tool start event
   * @param {Object} completeEvent - Tool complete event
   * @returns {number} Duration in milliseconds
   */
  calculateDuration(startEvent, completeEvent) {
    const startTime = new Date(startEvent.timestamp).getTime();
    const completeTime = new Date(completeEvent.timestamp).getTime();
    return completeTime - startTime;
  }

  /**
   * Merge start and complete events
   * @param {Object} startEvent - Transformed start event
   * @param {Object} completeEvent - Transformed complete event
   * @returns {Object} Merged event with duration
   */
  mergeEvents(startEvent, completeEvent) {
    const duration = this.calculateDuration(startEvent, completeEvent);
    
    return {
      ...startEvent,
      status: completeEvent.status,
      duration_ms: duration,
      event_type: 'tool_execution' // Merged event type
    };
  }
}

export default EventTransformer;
