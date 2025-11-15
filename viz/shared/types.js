/**
 * Event type definitions for visualization system
 */

export const EventTypes = {
  TOOL_START: 'tool_start',
  TOOL_COMPLETE: 'tool_complete',
  FILE_OP: 'file_op',
  COMMAND: 'command',
};

export const FileOperations = {
  READ: 'read',
  WRITE: 'write',
  EDIT: 'edit',
  DELETE: 'delete',
};

export const CommandCategories = {
  GIT: 'git',
  NPM: 'npm',
  PYTHON: 'python',
  PHP: 'php',
  BREW: 'brew',
  NODEJS: 'nodejs',
  BUNDLER: 'bundler',
  TEST: 'test',
  FILESYSTEM: 'filesystem',
  SEARCH: 'search',
  SHELL: 'shell',
};
