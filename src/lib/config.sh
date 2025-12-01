#!/bin/bash
# Configuration system for copilot-agent orchestration
# Follows XDG Base Directory specification
#
# This file can be sourced multiple times safely (idempotent)
# Usage: source src/lib/config.sh

# XDG Base Directories (with fallbacks)
# XDG_CONFIG_HOME: User-specific configuration files (~/.config)
# XDG_DATA_HOME: User-specific data files (~/.local/share)
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

# Agent installation directories
# AGENT_HOME: Root directory for all agent data
export AGENT_HOME="${AGENT_HOME:-$XDG_DATA_HOME/copilot-agent}"

# AGENT_METADATA_DIR: Storage for agent session metadata
export AGENT_METADATA_DIR="${AGENT_METADATA_DIR:-$AGENT_HOME/metadata}"

# AGENT_METADATA_ARCHIVE_DIR: Archive directory for completed sessions
export AGENT_METADATA_ARCHIVE_DIR="${AGENT_METADATA_ARCHIVE_DIR:-$AGENT_METADATA_DIR/archive}"

# Prevent multiple sourcing side effects (but allow idempotent operations)
if [[ -n "${AGENT_CONFIG_LOADED:-}" ]]; then
    # Already loaded - only ensure directories exist
    [[ -d "$AGENT_METADATA_DIR" ]] || mkdir -p "$AGENT_METADATA_DIR"
    [[ -d "$AGENT_METADATA_ARCHIVE_DIR" ]] || mkdir -p "$AGENT_METADATA_ARCHIVE_DIR"
    return 0
fi
export AGENT_CONFIG_LOADED=1

# AGENT_BIN_DIR: Directory for agent binaries (future use)
export AGENT_BIN_DIR="${AGENT_BIN_DIR:-$AGENT_HOME/bin}"

# AGENT_SYSTEM_INSTRUCTIONS_PATH: Optional path to system instructions file
# Can be used for Obsidian integration or custom instructions
# Leave empty if not needed
export AGENT_SYSTEM_INSTRUCTIONS_PATH="${AGENT_SYSTEM_INSTRUCTIONS_PATH:-}"

# Load user configuration if exists
# Users can override any of the above variables in this file
AGENT_CONFIG_FILE="$XDG_CONFIG_HOME/copilot-agent/config"
if [[ -f "$AGENT_CONFIG_FILE" ]]; then
    source "$AGENT_CONFIG_FILE"
fi

# Function to find copilot binary
# Searches in NVM directories and PATH
# Returns 0 if found, 1 if not found
find_copilot_binary() {
    local copilot_bin=""
    
    # Check if already in PATH
    if command -v github-copilot-cli &>/dev/null; then
        copilot_bin="github-copilot-cli"
    # Check NVM directories
    elif [[ -n "${NVM_DIR:-}" ]] && [[ -d "$NVM_DIR" ]]; then
        # Search through NVM node versions
        for node_version in "$NVM_DIR"/versions/node/*/bin/github-copilot-cli; do
            if [[ -x "$node_version" ]]; then
                copilot_bin="$node_version"
                break
            fi
        done
    fi
    
    if [[ -n "$copilot_bin" ]]; then
        export COPILOT_BIN="$copilot_bin"
        return 0
    else
        return 1
    fi
}

# Function to ensure directories exist
# Creates all required agent directories
# Safe to call multiple times (idempotent)
init_agent_directories() {
    mkdir -p "$AGENT_METADATA_DIR"
    mkdir -p "$AGENT_METADATA_ARCHIVE_DIR"
    mkdir -p "$AGENT_BIN_DIR"
    
    # Verify directories were created
    if [[ ! -d "$AGENT_METADATA_DIR" ]]; then
        echo "ERROR: Failed to create AGENT_METADATA_DIR: $AGENT_METADATA_DIR" >&2
        return 1
    fi
    
    if [[ ! -d "$AGENT_METADATA_ARCHIVE_DIR" ]]; then
        echo "ERROR: Failed to create AGENT_METADATA_ARCHIVE_DIR: $AGENT_METADATA_ARCHIVE_DIR" >&2
        return 1
    fi
    
    return 0
}

# Initialize directories on source (optional)
# Comment out if you want to call init_agent_directories manually
init_agent_directories
