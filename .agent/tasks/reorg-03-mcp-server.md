# Task: Update MCP Server Configuration

## Objective
Update mcp-servers/agent/index.js to use configurable paths and remove hardcoded /Users/shelfwood references.

## Discovery Phase (Agent MUST execute these first)
Before making ANY changes, agent must verify current state:

```bash
# Review current MCP server code
cat mcp-servers/agent/index.js | head -30

# Search for hardcoded paths
grep -n "HOME.*shelfwood\|/Users/shelfwood" mcp-servers/agent/index.js

# Check current AGENT_CMD definition
grep -n "AGENT_CMD" mcp-servers/agent/index.js

# Verify package.json
cat mcp-servers/agent/package.json
```

**Agent must report current configuration before proceeding.**

## Context
- Primary file: mcp-servers/agent/index.js
- Current hardcode (line 13): `const AGENT_CMD = process.env.HOME + '/projects/shelfwood-agents/agent/agent';`
- Integration: MCP server is called by Claude Code via stdio
- Pattern: Use environment variables with sensible fallbacks

## Requirements
Agent must implement the following:

1. Replace hardcoded AGENT_CMD with configuration chain:
   ```javascript
   // Configurable agent command path
   // Priority: AGENT_BIN_PATH env var → PATH lookup → relative path fallback
   const AGENT_CMD = process.env.AGENT_BIN_PATH
     || process.env.HOME + '/.local/share/copilot-agent/bin/agent'
     || 'agent'; // Assumes in PATH
   ```

2. Add configuration documentation in comment:
   ```javascript
   /**
    * Agent command resolution:
    * 1. AGENT_BIN_PATH environment variable (explicit override)
    * 2. XDG data directory: ~/.local/share/copilot-agent/bin/agent
    * 3. PATH lookup (assumes global install)
    *
    * Configure via:
    *   export AGENT_BIN_PATH="/path/to/copilot-agent/bin/agent"
    *
    * Or in Claude Code MCP settings:
    *   "env": {
    *     "AGENT_BIN_PATH": "/path/to/installation/bin/agent"
    *   }
    */
   ```

3. Update metadata directory paths in health check (lines 616-617):
   - Change from: `$HOME/projects/shelfwood-agents/agent/metadata`
   - To: `$HOME/.local/share/copilot-agent/metadata`

4. Ensure no other /Users/shelfwood references exist

## Verification Commands (Agent MUST run these before completion)
After implementation, agent must verify:

```bash
# Verify no hardcoded user paths
grep "/Users/shelfwood\|projects/shelfwood" mcp-servers/agent/index.js && echo "❌ Hardcoded paths found" || echo "✓ No user paths"

# Verify AGENT_CMD uses environment variables
grep "AGENT_BIN_PATH\|process.env" mcp-servers/agent/index.js | head -5

# Check syntax (Node.js)
node --check mcp-servers/agent/index.js && echo "✓ No syntax errors"

# Verify configuration comment added
grep -A 5 "Agent command resolution" mcp-servers/agent/index.js | head -10
```

## Success Criteria
- [x] AGENT_CMD uses environment variable with fallback chain
- [x] Configuration documentation added as comments
- [x] Metadata directory paths updated to XDG standard
- [x] No /Users/shelfwood references remain
- [x] No projects/shelfwood-agents references remain
- [x] Node.js syntax check passes
- [x] All verification commands pass

## Completion Confirmation
Agent must report:
1. File modified: mcp-servers/agent/index.js
2. Hardcoded paths removed: Verified with grep
3. Configuration: Environment variable support added
4. Verification: Syntax check passed
