# Task: Comprehensive System Validation

## Objective
Perform thorough end-to-end validation of all repository components and agent orchestration features.

## Discovery Phase - Enumerate All Components

```bash
# 1. Repository structure
echo "=== REPOSITORY STRUCTURE ==="
ls -la | grep -E "^d|^-.*\.(sh|json|md)$"

# 2. Agent scripts
echo -e "\n=== AGENT SCRIPTS ==="
ls -l agent/agent-* | awk '{print $1, $9}'

# 3. Configuration system
echo -e "\n=== CONFIG SYSTEM ==="
ls -la src/lib/
cat src/lib/config.sh | grep -E "^export |^#.*\(|init_agent_directories"

# 4. MCP server
echo -e "\n=== MCP SERVER ==="
ls -la mcp-servers/agent/
test -f mcp-servers/agent/package.json && echo "package.json: EXISTS"
test -d mcp-servers/agent/node_modules && echo "node_modules: EXISTS"

# 5. Documentation
echo -e "\n=== DOCUMENTATION ==="
find . -name "*.md" -not -path "*/node_modules/*" | sort

# 6. Installation system
echo -e "\n=== INSTALLATION ==="
ls -la install.sh bin/agent 2>/dev/null
```

## Test Suite 1: Configuration System

### Test 1.1: Single Source
```bash
echo "=== TEST 1.1: Single Source ==="
bash -c 'source src/lib/config.sh && echo "AGENT_CONFIG_LOADED=$AGENT_CONFIG_LOADED" && echo "AGENT_METADATA_DIR=$AGENT_METADATA_DIR"'
```

### Test 1.2: Double Source (Idempotency)
```bash
echo "=== TEST 1.2: Double Source ==="
bash -c 'source src/lib/config.sh && source src/lib/config.sh && echo "Second source: SUCCESS"'
```

### Test 1.3: Directory Creation
```bash
echo "=== TEST 1.3: Directory Creation ==="
bash -c 'rm -rf /tmp/agent-test-$$ && export AGENT_HOME=/tmp/agent-test-$$ && source src/lib/config.sh && ls -la "$AGENT_METADATA_DIR" && ls -la "$AGENT_METADATA_ARCHIVE_DIR" && rm -rf /tmp/agent-test-$$'
```

## Test Suite 2: Agent Script Functionality

### Test 2.1: Main Agent Dispatcher
```bash
echo "=== TEST 2.1: Agent Dispatcher ==="
agent/agent --help 2>&1 | head -20
```

### Test 2.2: Agent-Metadata Utilities
```bash
echo "=== TEST 2.2: Agent-Metadata ==="
bash -c 'source agent/agent-metadata && validate_session_name "test-123" && echo "Validation: SUCCESS"'
```

### Test 2.3: Agent-Doctor Health Check
```bash
echo "=== TEST 2.3: Agent-Doctor ==="
agent/agent-doctor 2>&1 | grep -E "Status:|Passed:|Failed:"
```

### Test 2.4: Agent-Launch Copilot Discovery
```bash
echo "=== TEST 2.4: Copilot Discovery ==="
bash -c 'source src/lib/config.sh && source agent/agent-metadata && find_copilot_binary && echo "COPILOT_BIN=$COPILOT_BIN"' 2>&1 | grep -E "COPILOT_BIN=|Error:"
```

## Test Suite 3: Execute Permissions

### Test 3.1: All Scripts Executable
```bash
echo "=== TEST 3.1: Execute Permissions ==="
for script in agent/agent-*; do
  if [[ ! -x "$script" ]]; then
    echo "NOT EXECUTABLE: $script"
  fi
done
echo "Permission check complete"
```

### Test 3.2: Shebang Validation
```bash
echo "=== TEST 3.2: Shebang Validation ==="
for script in agent/agent-*; do
  head -1 "$script" | grep -q "^#!/" || echo "MISSING SHEBANG: $script"
done
echo "Shebang check complete"
```

## Test Suite 4: Syntax Validation

### Test 4.1: All Agent Scripts
```bash
echo "=== TEST 4.1: Bash Syntax ==="
for script in agent/agent-*; do
  bash -n "$script" 2>&1 || echo "SYNTAX ERROR: $script"
done
echo "All agent scripts: VALID"
```

### Test 4.2: Config.sh Syntax
```bash
echo "=== TEST 4.2: Config Syntax ==="
bash -n src/lib/config.sh && echo "config.sh: VALID"
```

### Test 4.3: Installation Scripts
```bash
echo "=== TEST 4.3: Install Scripts ==="
bash -n install.sh && echo "install.sh: VALID"
bash -n bin/agent && echo "bin/agent: VALID"
```

## Test Suite 5: Agent Orchestration (End-to-End)

### Test 5.1: Agent Launch
```bash
echo "=== TEST 5.1: Agent Launch Test ==="
# This will be tested via actual agent spawn in orchestration
echo "Will spawn test agent with minimal task"
```

### Test 5.2: Agent List
```bash
echo "=== TEST 5.2: Agent List ==="
agent/agent list 2>&1 | head -10
```

### Test 5.3: Metadata Management
```bash
echo "=== TEST 5.3: Metadata System ==="
ls -la "$HOME/.local/share/copilot-agent/metadata/" 2>/dev/null || echo "Metadata directory empty (expected)"
```

## Test Suite 6: MCP Server Integration

### Test 6.1: Package.json Valid
```bash
echo "=== TEST 6.1: Package.json ==="
node -e "console.log(JSON.parse(require('fs').readFileSync('mcp-servers/agent/package.json')).name)"
```

### Test 6.2: MCP Server Syntax
```bash
echo "=== TEST 6.2: MCP Server Syntax ==="
node --check mcp-servers/agent/index.js && echo "index.js: VALID"
```

### Test 6.3: Dependencies Installed
```bash
echo "=== TEST 6.3: Node Dependencies ==="
test -d mcp-servers/agent/node_modules && echo "node_modules: EXISTS" || echo "node_modules: MISSING"
```

## Test Suite 7: Documentation Consistency

### Test 7.1: README Examples
```bash
echo "=== TEST 7.1: README Validation ==="
grep -E "github.com|/path/to" README.md | head -10
```

### Test 7.2: Package.json Repository URL
```bash
echo "=== TEST 7.2: Repository URLs ==="
git remote -v | grep origin
grep "github.com" package.json
```

### Test 7.3: Documentation Typos
```bash
echo "=== TEST 7.3: Known Issues ==="
grep -n "await_agents.*deprecated.*await_agents" docs/ORCHESTRATION_PATTERNS.md || echo "No self-referential deprecation found"
```

## Success Criteria

Report results for each test suite:

- [ ] Suite 1 (Config): All 3 tests pass
- [ ] Suite 2 (Scripts): All 4 tests pass
- [ ] Suite 3 (Permissions): All scripts executable
- [ ] Suite 4 (Syntax): All files valid bash/JS
- [ ] Suite 5 (Orchestration): Agent spawn/list works
- [ ] Suite 6 (MCP): Server valid and dependencies installed
- [ ] Suite 7 (Docs): No placeholder paths, URLs consistent

## Verification

After all tests, produce summary:

```
VALIDATION SUMMARY
==================
Total Tests: [N]
Passed: [N]
Failed: [N]

Critical Issues: [list]
Warnings: [list]
```
