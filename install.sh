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

    # Install MCP server dependencies
    if [[ -d "$INSTALL_DIR/src/mcp-server" ]]; then
        echo -e "${YELLOW}Installing MCP server dependencies...${NC}"
        (cd "$INSTALL_DIR/src/mcp-server" && npm install --silent)
    fi

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
echo -e "  3. Configure MCP server in Claude Code"
echo -e "     Add to Claude Code MCP settings:"
echo -e "     ${BLUE}\"agent\": {${NC}"
echo -e "     ${BLUE}  \"command\": \"node\",${NC}"
echo -e "     ${BLUE}  \"args\": [\"$INSTALL_DIR/src/mcp-server/index.js\"]${NC}"
echo -e "     ${BLUE}}${NC}"
echo ""
