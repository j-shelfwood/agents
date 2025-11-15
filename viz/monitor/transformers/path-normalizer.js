/**
 * Convert absolute paths to project-relative paths
 * @param {string} absolutePath - Full file path
 * @param {string} projectDir - Project root directory
 * @returns {string} Normalized relative path or original if outside project
 */
export function normalizePath(absolutePath, projectDir) {
  if (!absolutePath || !projectDir) {
    return absolutePath;
  }

  // Ensure projectDir doesn't have trailing slash
  const normalizedProjectDir = projectDir.replace(/\/$/, '');
  
  // Check if path is within project
  if (absolutePath.startsWith(normalizedProjectDir + '/') || 
      absolutePath.startsWith(normalizedProjectDir + '\\')) {
    return absolutePath.slice(normalizedProjectDir.length + 1);
  }
  
  // Exact match (edge case: path is project root)
  if (absolutePath === normalizedProjectDir) {
    return '.';
  }
  
  // Path is outside project, return as-is
  return absolutePath;
}
