# Task: Create Installation System

## Objective
Create install.sh script, root package.json, and bin/agent wrapper for public distribution and npm installation support.

## Discovery Phase (Agent MUST execute these first)
Before making ANY changes, agent must verify structure:

```bash
# Verify project root structure
ls -la
pwd

# Check if files already exist
test -f install.sh && echo "install.sh exists" || echo "install.sh MISSING"
test -f package.json && echo "package.json exists" || echo "package.json MISSING"
test -d bin && echo "bin/ exists" || echo "bin/ MISSING"

# Review existing MCP server package.json as reference
cat mcp-servers/agent/package.json

# Verify config system exists
test -f src/lib/config.sh && echo "✓ config.sh exists" || echo "❌ config.sh missing"
```

**Agent must report current installation state before proceeding.**

## Context
- Project root: /Users/shelfwood/Projects/shelfwood-agents
- Target files: install.sh (NEW), package.json (NEW), bin/agent (NEW)
- Integration: Supports both manual and npm installation
- Pattern: Standard npm package with bin entry points

## Requirements
Agent must implement the following systematically:

### 1. Create install.sh Script

Create executable install.sh at project root with:

```bash
#!/bin/bash
# Installation script for copilot-agent orchestration system

set -e

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Copilot Agent Orchestration - Installation${NC}     ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Detect installation directory (use XDG standard)
INSTALL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/copilot-agent"
BIN_DIR="${HOME}/.local/bin"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/copilot-agent"

echo -e "${GREEN}Installation directories:${NC}"
echo -e "  Install: $INSTALL_DIR"
echo -e "  Bin:     $BIN_DIR"
echo -e "  Config:  $CONFIG_DIR"
echo ""

# Check dependencies
check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"

    # Check tmux
    if ! command -v tmux &>/dev/null; then
        echo -e "${RED}✗ tmux not found${NC}"
        echo "  Install: brew install tmux (macOS) or apt install tmux (Linux)"
        exit 1
    else
        echo -e "${GREEN}✓ tmux found${NC}"
    fi

    # Check node
    if ! command -v node &>/dev/null; then
        echo -e "${RED}✗ Node.js not found${NC}"
        echo "  Install: https://nodejs.org/"
        exit 1
    else
        echo -e "${GREEN}✓ Node.js found ($(node --version))${NC}"
    fi

    # Check copilot (optional warning)
    if ! command -v copilot &>/dev/null; then
        echo -e "${YELLOW}⚠ GitHub Copilot CLI not found${NC}"
        echo "  Install: npm install -g @github/copilot@latest"
        echo "  (Required for agent operation, but can install later)"
    else
        echo -e "${GREEN}✓ GitHub Copilot CLI found${NC}"
    fi

    echo ""
}

# Create directories
create_directories() {
    echo -e "${YELLOW}Creating directories...${NC}"
    mkdir -p "$INSTALL_DIR/src/commands"
    mkdir -p "$INSTALL_DIR/src/lib"
    mkdir -p "$INSTALL_DIR/src/mcp-server"
    mkdir -p "$BIN_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$INSTALL_DIR/metadata"
    mkdir -p "$INSTALL_DIR/metadata/archive"
    echo -e "${GREEN}✓ Directories created${NC}"
    echo ""
}

# Copy files
install_files() {
    echo -e "${YELLOW}Installing files...${NC}"

    # Copy bash scripts
    cp -r agent/* "$INSTALL_DIR/src/commands/"
    chmod +x "$INSTALL_DIR/src/commands/agent"*

    # Copy config system
    cp src/lib/config.sh "$INSTALL_DIR/src/lib/"

    # Copy MCP server
    cp -r mcp-servers/agent/* "$INSTALL_DIR/src/mcp-server/"

    # Create bin wrapper
    cat > "$BIN_DIR/agent" << 'WRAPPER'
#!/bin/bash
# Wrapper script for copilot-agent
AGENT_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/copilot-agent"
exec "$AGENT_HOME/src/commands/agent" "$@"
WRAPPER
    chmod +x "$BIN_DIR/agent"

    echo -e "${GREEN}✓ Files installed${NC}"
    echo ""
}

# Generate config
generate_config() {
    echo -e "${YELLOW}Generating configuration...${NC}"

    if [[ ! -f "$CONFIG_DIR/config" ]]; then
        cat > "$CONFIG_DIR/config" << 'CONFIG'
# Copilot Agent Configuration
# Override any of these variables to customize installation

# Installation directory
# export AGENT_HOME="$HOME/.local/share/copilot-agent"

# Metadata storage
# export AGENT_METADATA_DIR="$AGENT_HOME/metadata"

# Optional: System instructions (e.g., Obsidian vault)
# export AGENT_SYSTEM_INSTRUCTIONS_PATH="$HOME/path/to/instructions.md"

# Optional: Explicit copilot binary path
# export COPILOT_BIN="/path/to/copilot"
CONFIG
        echo -e "${GREEN}✓ Config file created: $CONFIG_DIR/config${NC}"
    else
        echo -e "${YELLOW}⚠ Config file already exists, skipping${NC}"
    fi
    echo ""
}

# Setup PATH
setup_path() {
    echo -e "${YELLOW}Setting up PATH...${NC}"

    # Check if BIN_DIR is in PATH
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        echo -e "${YELLOW}⚠ $BIN_DIR not in PATH${NC}"
        echo ""
        echo "Add to your shell profile (~/.bashrc or ~/.zshrc):"
        echo -e "${BLUE}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
        echo ""
    else
        echo -e "${GREEN}✓ $BIN_DIR already in PATH${NC}"
    fi
}

# Main installation
check_dependencies
create_directories
install_files
generate_config
setup_path

echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BLUE}Installation Complete!${NC}                         ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "  1. Ensure ${BLUE}~/.local/bin${NC} is in your PATH"
echo -e "  2. Run: ${BLUE}agent doctor${NC} to verify installation"
echo -e "  3. Configure MCP server in Claude Code (see docs/INSTALL.md)"
echo ""
```

### 2. Create root package.json

Create package.json at project root:

```json
{
  "name": "copilot-agent-orchestrator",
  "version": "1.0.0",
  "description": "Autonomous agent orchestration system for GitHub Copilot CLI with MCP server for Claude Code integration",
  "keywords": [
    "copilot",
    "github-copilot",
    "mcp",
    "agent",
    "orchestration",
    "autonomous",
    "claude-code",
    "tmux"
  ],
  "bin": {
    "agent": "./bin/agent"
  },
  "scripts": {
    "postinstall": "./install.sh",
    "test": "bash tests/orchestration-patterns.sh"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yourusername/copilot-agent-orchestrator.git"
  },
  "author": "Shelfwood",
  "license": "MIT",
  "engines": {
    "node": ">=16.0.0"
  },
  "os": [
    "darwin",
    "linux"
  ],
  "dependencies": {},
  "devDependencies": {},
  "files": [
    "agent/",
    "src/",
    "mcp-servers/",
    "docs/",
    "bin/",
    "install.sh",
    "LICENSE",
    "README.md"
  ]
}
```

### 3. Create bin/agent wrapper

Create bin/agent:

```bash
#!/bin/bash
# Wrapper script for copilot-agent command
# Detects installation location and executes main agent script

# Try to find agent installation
if [[ -n "${AGENT_HOME}" ]]; then
    # Use explicit AGENT_HOME if set
    AGENT_DIR="$AGENT_HOME/src/commands"
elif [[ -f "$HOME/.local/share/copilot-agent/src/commands/agent" ]]; then
    # XDG standard location
    AGENT_DIR="$HOME/.local/share/copilot-agent/src/commands"
else
    # Development mode: check if we're in repo
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$SCRIPT_DIR/../agent/agent" ]]; then
        AGENT_DIR="$SCRIPT_DIR/../agent"
    else
        echo "Error: Cannot find agent installation" >&2
        echo "Set AGENT_HOME or run install.sh" >&2
        exit 1
    fi
fi

# Execute main agent script
exec "$AGENT_DIR/agent" "$@"
```

## Verification Commands (Agent MUST run these before completion)
After implementation, agent must verify:

```bash
# Verify files created
test -f install.sh && echo "✓ install.sh exists" || echo "❌ Missing"
test -f package.json && echo "✓ package.json exists" || echo "❌ Missing"
test -f bin/agent && echo "✓ bin/agent exists" || echo "❌ Missing"

# Verify executable permissions
test -x install.sh && echo "✓ install.sh executable" || echo "❌ Not executable"
test -x bin/agent && echo "✓ bin/agent executable" || echo "❌ Not executable"

# Verify JSON syntax
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" && echo "✓ package.json valid"

# Verify shell script syntax
bash -n install.sh && echo "✓ install.sh syntax valid"
bash -n bin/agent && echo "✓ bin/agent syntax valid"

# Check package.json has required fields
grep -q '"name".*copilot-agent' package.json && echo "✓ Package name set"
grep -q '"bin"' package.json && echo "✓ Bin entry configured"
```

## Success Criteria
- [x] install.sh created with full installation logic
- [x] install.sh is executable
- [x] package.json created at project root
- [x] package.json has bin entry for 'agent' command
- [x] bin/agent wrapper created
- [x] bin/agent is executable
- [x] All scripts pass syntax validation
- [x] package.json is valid JSON
- [x] All verification commands pass

## Completion Confirmation
Agent must report:
1. Files created: 3 (install.sh, package.json, bin/agent)
2. Executable permissions: Set on install.sh and bin/agent
3. Syntax validation: All scripts valid
4. Verification: All test commands passed
