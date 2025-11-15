/**
 * Categorize shell commands based on VISUALIZATION_SPEC.md:569-607
 * @param {string} command - Command string to categorize
 * @returns {string} Category name
 */
export function categorizeCommand(command) {
  if (!command || typeof command !== 'string') {
    return 'shell';
  }

  // Git operations
  if (/^git\s/.test(command)) return 'git';

  // Package managers
  if (/^(npm|yarn|pnpm|bun)\s/.test(command)) return 'npm';
  if (/^(pip|poetry|pipenv)\s/.test(command)) return 'python';
  if (/^composer\s/.test(command)) return 'php';
  if (/^brew\s/.test(command)) return 'brew';

  // Language runtimes
  if (/^(node|deno|bun)\s/.test(command)) return 'nodejs';
  if (/^python\s/.test(command)) return 'python';
  if (/^(php|artisan)\s/.test(command)) return 'php';
  if (/^ruby\s/.test(command)) return 'ruby';

  // Build tools
  if (/^(make|cmake|ninja)\s/.test(command)) return 'build';
  if (/^(webpack|vite|rollup|esbuild)\s/.test(command)) return 'bundler';

  // Testing
  if (/^(jest|vitest|pytest|phpunit|cargo test)\s/.test(command)) return 'test';

  // Filesystem
  if (/^(find|ls|tree|du|df)\s/.test(command)) return 'filesystem';
  if (/^(grep|rg|ag|ack)\s/.test(command)) return 'search';
  if (/^(cat|head|tail|less|more)\s/.test(command)) return 'fileview';

  // System
  if (/^(ps|top|htop|kill)\s/.test(command)) return 'process';
  if (/^(curl|wget|http)\s/.test(command)) return 'network';

  // Default
  return 'shell';
}
