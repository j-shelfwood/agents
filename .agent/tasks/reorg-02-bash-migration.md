# Task: Migrate Bash Scripts to Use Configuration System

## Objective
Update all 15 agent-* bash scripts to source config.sh and use configuration variables instead of hardcoded paths.

## Discovery Phase (Agent MUST execute these first)
Before making ANY changes, agent must enumerate all targets:

```bash
# Find all agent scripts
ls -1 agent/agent* | head -20

# Count total scripts
ls -1 agent/agent* | wc -l

# Search for hardcoded paths
grep -l "HOME/.shelfwood\|/Users/shelfwood" agent/agent* | wc -l

# Search for hardcoded variables
grep -l "METADATA_DIR=\|AGENT_CMD=" agent/agent*

# Review config.sh that should exist now
cat src/lib/config.sh | head -20
```

**Agent must report enumeration results before proceeding.**

## Context
- Primary files: agent/agent-* (15 scripts)
- Configuration source: src/lib/config.sh (created by previous task)
- Current hardcoded paths:
  - METADATA_DIR="$HOME/.shelfwood/agent/metadata"
  - AGENT_CMD="$HOME/.shelfwood/agent/agent"
  - Obsidian path in agent-launch
- Pattern: Source config.sh at top of each script

## Requirements
Agent must implement the following systematically for EACH script:

1. Add config sourcing at the top (after shebang and before any usage):
   ```bash
   # Source configuration
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/../src/lib/config.sh"
   ```

2. For agent-metadata (defines METADATA_DIR):
   - Remove hardcoded: `METADATA_DIR="$HOME/.shelfwood/agent/metadata"`
   - Keep the variable but rely on config.sh to set it
   - Ensure init_agent_directories() is called

3. For agent-await (references AGENT_CMD):
   - Remove hardcoded: `AGENT_CMD="$HOME/.shelfwood/agent/agent"`
   - Use: `AGENT_CMD="${AGENT_CMD:-$(command -v agent)}"`

4. For agent-launch (Obsidian integration):
   - Replace: `SYSTEM_INSTRUCTIONS="$HOME/Obsidian/..."`
   - With: `SYSTEM_INSTRUCTIONS="$AGENT_SYSTEM_INSTRUCTIONS_PATH"`
   - Add conditional: only prepend if file exists and is non-empty

5. For agent-doctor:
   - Update to use AGENT_METADATA_DIR variable
   - Update diagnostic output to show config paths

6. For all other scripts:
   - Source config.sh
   - Verify they can access AGENT_METADATA_DIR if needed

## Verification Commands (Agent MUST run these before completion)
After implementation, agent must verify:

```bash
# Verify all scripts source config
grep -l "source.*config.sh" agent/agent* | wc -l
# Should equal 15

# Verify no hardcoded .shelfwood paths remain
grep -r "\.shelfwood" agent/agent* && echo "❌ Hardcoded paths found" || echo "✓ No hardcoded paths"

# Verify no hardcoded /Users/shelfwood paths
grep -r "/Users/shelfwood" agent/agent* && echo "❌ User paths found" || echo "✓ No user paths"

# Test a script can source config
bash -c "cd agent && source ../src/lib/config.sh && source agent-metadata && echo \"✓ Scripts source correctly\""

# Verify agent-metadata no longer hardcodes path
grep "METADATA_DIR=\"\$HOME" agent/agent-metadata && echo "❌ Still hardcoded" || echo "✓ Using config"
```

## Success Criteria
- [x] All 15 agent-* scripts source config.sh
- [x] No hardcoded ~/.shelfwood paths remain
- [x] No hardcoded /Users/shelfwood paths remain
- [x] agent-metadata uses config variables
- [x] agent-await uses dynamic AGENT_CMD
- [x] agent-launch uses AGENT_SYSTEM_INSTRUCTIONS_PATH (optional)
- [x] agent-doctor displays new config paths
- [x] All verification commands pass
- [x] Scripts can still execute (no broken sourcing)

## Completion Confirmation
Agent must report:
1. Enumeration count: 15 files processed
2. Hardcoded paths removed: Verified with grep
3. Config sourcing: All scripts updated
4. Verification: All test commands passed
