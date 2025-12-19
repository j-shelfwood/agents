.PHONY: test test-unit test-security test-integration test-all clean help

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[1;33m
CYAN   := \033[0;36m
NC     := \033[0m

# Default target
help:
	@echo "$(CYAN)Agent Test Suite$(NC)"
	@echo ""
	@echo "Available targets:"
	@echo "  $(GREEN)make test$(NC)             - Run unit, MCP, and security tests (quick)"
	@echo "  $(GREEN)make test-unit$(NC)        - Run Bash unit tests only"
	@echo "  $(GREEN)make test-mcp$(NC)         - Run MCP server (Node.js) tests only"
	@echo "  $(GREEN)make test-security$(NC)    - Run security tests only"
	@echo "  $(GREEN)make test-integration$(NC) - Run integration tests (slower)"
	@echo "  $(GREEN)make test-all$(NC)         - Run all tests"
	@echo "  $(GREEN)make clean$(NC)            - Clean test artifacts"
	@echo ""

# Quick test suite (unit + security + mcp)
test: test-unit test-mcp test-security
	@echo "$(GREEN)✅ Quick test suite passed!$(NC)"

# Unit tests (fast, no external dependencies)
test-unit:
	@echo "$(CYAN)Running Bash unit tests...$(NC)"
	@bats tests/unit/*.bats
	@echo "$(GREEN)✓ Bash unit tests passed$(NC)"
	@echo ""

# MCP server tests (Node.js/Jest)
test-mcp:
	@echo "$(CYAN)Running MCP server tests...$(NC)"
	@cd mcp-servers/agent && npm test
	@echo "$(GREEN)✓ MCP server tests passed$(NC)"
	@echo ""

# Security tests
test-security:
	@echo "$(CYAN)Running security tests...$(NC)"
	@bats tests/security/*.bats || (echo "$(YELLOW)⚠️  Security vulnerabilities detected!$(NC)" && exit 1)
	@echo "$(GREEN)✓ Security tests passed$(NC)"
	@echo ""

# Integration tests (requires tmux, copilot)
test-integration:
	@echo "$(CYAN)Running integration tests...$(NC)"
	@if [ -f tests/orchestration-patterns.sh ]; then \
		bash tests/orchestration-patterns.sh; \
	fi
	@if [ -d tests/integration ] && [ -n "$$(ls tests/integration/*.bats 2>/dev/null)" ]; then \
		bats tests/integration/*.bats; \
	fi
	@echo "$(GREEN)✓ Integration tests passed$(NC)"
	@echo ""

# Run all tests
test-all: test-unit test-mcp test-security test-integration
	@echo ""
	@echo "$(GREEN)╔════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║$(NC)  $(YELLOW)All tests passed!$(NC)                                         $(GREEN)║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""

# Clean test artifacts
clean:
	@echo "$(CYAN)Cleaning test artifacts...$(NC)"
	@rm -f /tmp/test-task-*.md /tmp/agent-test-*.md /tmp/sec-test-*.md 2>/dev/null || true
	@tmux list-sessions 2>/dev/null | grep "^test-agent-" | cut -d: -f1 | xargs -I {} tmux kill-session -t {} 2>/dev/null || true
	@if [ -d ~/.local/share/copilot-agent/metadata ]; then \
		find ~/.local/share/copilot-agent/metadata -name "test-agent-*.json" -delete 2>/dev/null || true; \
	fi
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

# Check test dependencies
check-deps:
	@echo "$(CYAN)Checking test dependencies...$(NC)"
	@command -v bats >/dev/null 2>&1 || (echo "$(YELLOW)⚠️  bats not found. Install: npm install -g bats$(NC)" && exit 1)
	@command -v tmux >/dev/null 2>&1 || (echo "$(YELLOW)⚠️  tmux not found. Install: brew install tmux$(NC)" && exit 1)
	@command -v copilot >/dev/null 2>&1 || echo "$(YELLOW)⚠️  copilot not found. Some integration tests may fail.$(NC)"
	@echo "$(GREEN)✓ Dependencies OK$(NC)"
	@echo ""
