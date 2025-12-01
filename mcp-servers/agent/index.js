#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Agent command resolution:
 * 1. AGENT_BIN_PATH environment variable (explicit override)
 * 2. Development mode: Check if running from repository (mcp-servers/agent/index.js)
 * 3. XDG data directory: ~/.local/share/copilot-agent/bin/agent
 * 4. PATH lookup (assumes global install)
 *
 * Configure via:
 *   export AGENT_BIN_PATH="/path/to/copilot-agent/bin/agent"
 *
 * Or in Claude Code MCP settings:
 *   "env": {
 *     "AGENT_BIN_PATH": "/path/to/installation/bin/agent"
 *   }
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if running from repository (dev mode)
const devAgentPath = join(__dirname, '../../agent/agent');
const devMode = existsSync(devAgentPath);

const AGENT_CMD = process.env.AGENT_BIN_PATH
  || (devMode ? devAgentPath : null)
  || process.env.HOME + '/.local/share/copilot-agent/bin/agent'
  || 'agent'; // Assumes in PATH

/**
 * Validate session name format
 * Session names must be alphanumeric, dash, or underscore only
 * This prevents shell injection via session name parameters
 */
const validateSessionName = (name) => {
  if (!name || typeof name !== 'string') {
    throw new Error('Session name is required and must be a string');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(
      `Invalid session name '${name}'. ` +
      'Only alphanumeric characters, dashes, and underscores are allowed.'
    );
  }

  if (name.length > 100) {
    throw new Error('Session name too long (max 100 characters)');
  }

  return name;
};

/**
 * Execute spawn with promise wrapper and timeout
 */
const launchWithTimeout = (cmd, args, timeoutMs = 30000) => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000); // Force kill after 5s
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) return; // Already rejected

      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      if (!timedOut) reject(err);
    });
  });
};

/**
 * Enhance error messages with helpful context
 */
const enhanceError = (error, operation) => {
  let helpText = '';

  if (error.message.includes('not found') && error.message.includes('Session')) {
    helpText = '\n\nTip: Use list_agents() to see active sessions or launch_agent() to create a new one.';
  } else if (error.message.includes('timeout')) {
    helpText = '\n\nTip: The agent may still be working. Use read_agent_output() to check progress.';
  } else if (error.code === 2 && operation === 'await_agents') {
    // Exit code 2 from await = timeout, not error
    return {
      isTimeout: true,
      message: 'Await timeout reached. All monitored agents are still active.\n' + (error.stdout || ''),
    };
  } else if (error.message.includes('Invalid session name')) {
    helpText = '\n\nSession names must contain only letters, numbers, dashes, and underscores.';
  }

  return {
    isTimeout: false,
    message: error.message + helpText,
  };
};

/**
 * MCP Server for Autonomous Agent Orchestration
 * Wraps the agent command system for GitHub Copilot CLI management
 */
class AgentMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'agent-orchestration',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'launch_agent',
          description: 'Launch a new autonomous Copilot agent in a detached tmux session with task file. Returns session name for monitoring.',
          inputSchema: {
            type: 'object',
            properties: {
              project_dir: {
                type: 'string',
                description: 'Absolute path to project directory (working directory for agent)',
              },
              task_file: {
                type: 'string',
                description: 'Absolute path to task specification file (markdown format)',
              },
              session_name: {
                type: 'string',
                description: 'Optional custom session name (auto-generated if not provided)',
              },
            },
            required: ['project_dir', 'task_file'],
          },
        },
        {
          name: 'await_agents',
          description: 'BLOCKING operation: Waits until any agent requires attention (completes, waits for input, or errors). Returns immediately on state change. Use this INSTEAD of manual polling loops. Pattern: launch → await → handle → await → repeat.',
          inputSchema: {
            type: 'object',
            properties: {
              timeout: {
                type: 'number',
                description: 'Maximum wait time in seconds (default: 300, 0=infinite)',
              },
              interval: {
                type: 'number',
                description: 'Polling interval in seconds (default: 3)',
              },
              sessions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific session names to await (awaits all if not provided)',
              },
            },
          },
        },
        {
          name: 'list_agents',
          description: 'List all active Copilot agent sessions with their status and task information',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'read_agent_output',
          description: 'Read latest output from a running agent session (last 50 lines)',
          inputSchema: {
            type: 'object',
            properties: {
              session_name: {
                type: 'string',
                description: 'Agent session name to read from',
              },
              lines: {
                type: 'number',
                description: 'Number of lines to read (default: 50, max: 200)',
              },
            },
            required: ['session_name'],
          },
        },
        {
          name: 'check_agent_status',
          description: 'Check detailed status of a specific agent including activity state and resource usage',
          inputSchema: {
            type: 'object',
            properties: {
              session_name: {
                type: 'string',
                description: 'Agent session name to check',
              },
            },
            required: ['session_name'],
          },
        },
        {
          name: 'send_to_agent',
          description: 'Send text message or response to a running agent (for interactive prompts)',
          inputSchema: {
            type: 'object',
            properties: {
              session_name: {
                type: 'string',
                description: 'Agent session name',
              },
              message: {
                type: 'string',
                description: 'Message text to send (automatically submits with Enter)',
              },
            },
            required: ['session_name', 'message'],
          },
        },
        {
          name: 'approve_agent_prompt',
          description: 'Quick yes/no response to agent permission prompts',
          inputSchema: {
            type: 'object',
            properties: {
              session_name: {
                type: 'string',
                description: 'Agent session name',
              },
              approve: {
                type: 'boolean',
                description: 'true to approve (y), false to deny (n)',
              },
            },
            required: ['session_name', 'approve'],
          },
        },
        {
          name: 'kill_agent',
          description: 'Terminate a running agent session and clean up resources',
          inputSchema: {
            type: 'object',
            properties: {
              session_name: {
                type: 'string',
                description: 'Agent session name to terminate',
              },
            },
            required: ['session_name'],
          },
        },
        {
          name: 'health_check',
          description: 'Verify agent orchestration system is operational and check component status',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'launch_agent':
            return await this.launchAgent(args);
          case 'await_agents':
            return await this.watchAgents(args);
          case 'list_agents':
            return await this.listAgents();
          case 'read_agent_output':
            return await this.readAgentOutput(args);
          case 'check_agent_status':
            return await this.checkAgentStatus(args);
          case 'send_to_agent':
            return await this.sendToAgent(args);
          case 'approve_agent_prompt':
            return await this.approveAgentPrompt(args);
          case 'kill_agent':
            return await this.killAgent(args);
          case 'health_check':
            return await this.healthCheck();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async launchAgent(args) {
    const { project_dir, task_file, session_name } = args;

    // Validate session name if provided
    if (session_name) {
      validateSessionName(session_name);
    }

    // Build argument array (no shell interpretation)
    const launchArgs = ['launch'];
    if (session_name) {
      launchArgs.push('--session', session_name);
    }
    launchArgs.push(project_dir, task_file);

    try {
      // 60s timeout for launch (needs to setup tmux + send initial prompt)
      const { stdout } = await launchWithTimeout(AGENT_CMD, launchArgs, 60000);

      // Extract session name from output
      const sessionMatch = stdout.match(/Session:\s+(\S+)/);
      const extractedSession = sessionMatch ? sessionMatch[1] : session_name || 'unknown';

      return {
        content: [
          {
            type: 'text',
            text: `Agent launched successfully\n\nSession: ${extractedSession}\nProject: ${project_dir}\nTask: ${task_file}\n\n${stdout}`,
          },
        ],
      };
    } catch (error) {
      const enhanced = enhanceError(error, 'launch_agent');
      throw new Error(enhanced.message);
    }
  }

  async watchAgents(args) {
    const { timeout = 300, interval = 3, sessions } = args;

    // Validate all session names if provided
    if (sessions && sessions.length > 0) {
      sessions.forEach(validateSessionName);
    }

    // Build argument array
    const watchArgs = ['await', '--timeout', String(timeout), '--interval', String(interval)];

    if (sessions && sessions.length > 0) {
      watchArgs.push('--sessions', sessions.join(','));
    }

    try {
      // Add 30s buffer to MCP timeout vs bash script timeout
      const mcpTimeout = (timeout + 30) * 1000;
      const { stdout } = await launchWithTimeout(AGENT_CMD, watchArgs, mcpTimeout);

      return {
        content: [
          {
            type: 'text',
            text: stdout,
          },
        ],
      };
    } catch (error) {
      const enhanced = enhanceError(error, 'await_agents');

      // Exit code 2 = timeout (normal), not error
      if (enhanced.isTimeout) {
        return {
          content: [
            {
              type: 'text',
              text: enhanced.message,
            },
          ],
        };
      }

      throw new Error(enhanced.message);
    }
  }

  async listAgents() {
    const { stdout } = await execAsync(`${AGENT_CMD} list`);
    return {
      content: [
        {
          type: 'text',
          text: stdout,
        },
      ],
    };
  }

  async readAgentOutput(args) {
    const { session_name, lines = 50 } = args;

    validateSessionName(session_name);

    const maxLines = Math.min(lines, 200);

    try {
      const { stdout } = await launchWithTimeout(
        AGENT_CMD,
        ['read', session_name, String(maxLines)],
        10000 // 10s timeout
      );

      return {
        content: [
          {
            type: 'text',
            text: stdout,
          },
        ],
      };
    } catch (error) {
      const enhanced = enhanceError(error, 'read_agent_output');
      throw new Error(enhanced.message);
    }
  }

  async checkAgentStatus(args) {
    const { session_name } = args;

    validateSessionName(session_name);

    try {
      const { stdout } = await launchWithTimeout(
        AGENT_CMD,
        ['status', session_name],
        10000 // 10s timeout
      );

      return {
        content: [
          {
            type: 'text',
            text: stdout,
          },
        ],
      };
    } catch (error) {
      const enhanced = enhanceError(error, 'check_agent_status');
      throw new Error(enhanced.message);
    }
  }

  async sendToAgent(args) {
    const { session_name, message } = args;

    // Use spawn with argument array to avoid shell interpretation
    // This eliminates all escaping issues with backticks, quotes, etc.
    return new Promise((resolve, reject) => {
      const child = spawn(AGENT_CMD, ['send', session_name, message]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            content: [
              {
                type: 'text',
                text: stdout,
              },
            ],
          });
        } else {
          reject(new Error(`agent send failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn agent send: ${err.message}`));
      });
    });
  }

  async approveAgentPrompt(args) {
    const { session_name, approve } = args;
    const response = approve ? 'y' : 'n';

    // Use spawn to avoid shell interpretation
    return new Promise((resolve, reject) => {
      const child = spawn(AGENT_CMD, ['approve', session_name, response]);

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            content: [
              {
                type: 'text',
                text: stdout,
              },
            ],
          });
        } else {
          reject(new Error(`agent approve failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn agent approve: ${err.message}`));
      });
    });
  }

  async killAgent(args) {
    const { session_name } = args;

    validateSessionName(session_name);

    try {
      const { stdout } = await launchWithTimeout(
        AGENT_CMD,
        ['kill', session_name],
        10000 // 10s timeout
      );

      return {
        content: [
          {
            type: 'text',
            text: stdout,
          },
        ],
      };
    } catch (error) {
      const enhanced = enhanceError(error, 'kill_agent');
      throw new Error(enhanced.message);
    }
  }

  async healthCheck() {
    const checks = {
      agent_cmd_exists: false,
      agent_cmd_executable: false,
      tmux_available: false,
      metadata_dir_exists: false,
      metadata_dir_writable: false,
      active_sessions: 0,
      stale_metadata_files: 0,
    };

    try {
      // Check agent command exists
      const fs = await import('fs/promises');
      try {
        await fs.access(AGENT_CMD, fs.constants.X_OK);
        checks.agent_cmd_exists = true;
        checks.agent_cmd_executable = true;
      } catch {
        try {
          await fs.access(AGENT_CMD);
          checks.agent_cmd_exists = true;
        } catch {}
      }

      // Check tmux
      try {
        await launchWithTimeout('tmux', ['-V'], 5000);
        checks.tmux_available = true;
      } catch {}

      // Check metadata directory
      const metadataDir = process.env.HOME + '/.local/share/copilot-agent/metadata';
      try {
        await fs.access(metadataDir);
        checks.metadata_dir_exists = true;

        // Test writability
        const testFile = metadataDir + '/.health-check-test';
        try {
          await fs.writeFile(testFile, '');
          await fs.unlink(testFile);
          checks.metadata_dir_writable = true;
        } catch {}
      } catch {}

      // Count active sessions
      if (checks.tmux_available) {
        try {
          const { stdout } = await launchWithTimeout(AGENT_CMD, ['list'], 10000);
          const sessionLines = stdout.split('\n').filter(line =>
            line.includes('agent-') && !line.includes('Session Name')
          );
          checks.active_sessions = sessionLines.length;
        } catch {}
      }

      // Count metadata files
      if (checks.metadata_dir_exists) {
        try {
          const files = await fs.readdir(metadataDir);
          checks.stale_metadata_files = files.filter(f => f.endsWith('.json')).length;
        } catch {}
      }

      const allHealthy =
        checks.agent_cmd_executable &&
        checks.tmux_available &&
        checks.metadata_dir_writable;

      const status = allHealthy ? '✓ HEALTHY' : '⚠ DEGRADED';
      const output = `Agent Orchestration System Health Check\n\n` +
        `Status: ${status}\n\n` +
        `Component Status:\n` +
        `  Agent Command:      ${checks.agent_cmd_executable ? '✓' : '✗'} ${AGENT_CMD}\n` +
        `  Tmux Available:     ${checks.tmux_available ? '✓' : '✗'}\n` +
        `  Metadata Directory: ${checks.metadata_dir_writable ? '✓' : '✗'} Writable\n\n` +
        `Current State:\n` +
        `  Active Sessions:    ${checks.active_sessions}\n` +
        `  Metadata Files:     ${checks.stale_metadata_files}\n\n` +
        `Raw Checks:\n` +
        JSON.stringify(checks, null, 2);

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Health check failed: ${error.message}\n\n` +
              `Partial results:\n${JSON.stringify(checks, null, 2)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Agent Orchestration MCP server running on stdio');
  }
}

const server = new AgentMCPServer();
server.run().catch(console.error);
