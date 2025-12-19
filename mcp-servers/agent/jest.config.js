/**
 * Jest configuration for MCP server tests
 */

export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['index.js'],
  coverageDirectory: 'coverage',
  verbose: true,
};
