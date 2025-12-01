# Task: Comprehensive Repository Review for Public Release Readiness

## Objective
Conduct objective analysis of repository consistency, coherence, and completeness for public GitHub distribution.

## Discovery Phase (Agent MUST execute these first)

Before making ANY assessments, agent must enumerate all repository components:

```bash
# Count all agent management scripts
ls -1 agent/agent-* | wc -l

# Verify all scripts source config.sh
grep -l "source.*config.sh" agent/agent-* | wc -l

# Check executable permissions consistency
ls -l agent/agent-* | awk '{print $1, $NF}'

# Enumerate documentation files
find . -name "*.md" -type f | grep -v node_modules | sort

# Check for hardcoded paths
rg -i "shelfwood|/Users/shelfwood" --type md --type json --type js -g '!node_modules' -g '!.agent/tasks'

# Verify GitHub repository URL consistency
git remote -v
grep -r "github.com" package.json README.md

# Check package.json files array matches actual structure
cat package.json | grep -A 20 '"files"'
```

**Agent must report enumeration results before proceeding to analysis.**

## Context

This repository was recently reorganized for public distribution:

- **Primary restructuring**: Hardcoded paths removed, XDG-compliant config system added
- **Installation system**: Created install.sh, package.json, bin/agent wrapper
- **Documentation**: README sanitized, orchestration patterns documented
- **GitHub publication**: Repository published to https://github.com/j-shelfwood/agents

**Known issues from discovery:**
1. Execute permissions inconsistent (only 4/14 scripts executable: agent-await, agent-launch, agent-metadata, agent-doctor)
2. GitHub URL mismatch: package.json says `github.com/shelfwood/agents` but actual repo is `github.com/j-shelfwood/agents`
3. Documentation typo: `docs/ORCHESTRATION_PATTERNS.md:7` says "await_agents() is deprecated. Use await_agents()"
4. README.md line 31 mentions `metadata/` directory under `agent/` but git status shows it's untracked

## Requirements

Agent must systematically review and report on:

### 1. Consistency Analysis
- [ ] Execute permissions: Are all agent scripts consistently executable or non-executable?
- [ ] Config sourcing: Do ALL 14 agent-* scripts source config.sh?
- [ ] GitHub URLs: Do package.json, README.md, and git remote all reference the same repository URL?
- [ ] Documentation cross-references: Do file paths in README match actual structure?
- [ ] Naming conventions: Are commands/tools named consistently across CLI, MCP server, and docs?

### 2. Coherence Analysis
- [ ] Installation workflow: Does install.sh install everything listed in package.json "files" array?
- [ ] Documentation completeness: Do README examples work with current implementation?
- [ ] XDG compliance: Are all paths using config.sh variables (no hardcoded paths remaining)?
- [ ] Metadata directory: Should `agent/metadata/` be tracked in git or .gitignored?
- [ ] MCP tool alignment: Do MCP tool names in index.js match documentation examples?

### 3. Completeness Analysis
- [ ] Missing files: LICENSE listed in package.json "files" - does it exist and is it committed?
- [ ] Testing: Does `npm test` work? Does tests/orchestration-patterns.sh execute successfully?
- [ ] GitHub repository metadata: Are topics/keywords configured for discoverability?
- [ ] Contributing guide: Should there be CONTRIBUTING.md for public repo?
- [ ] Examples: Are there working examples users can run to test installation?

### 4. Critical Issues
Identify issues that would prevent users from:
- Installing successfully via npm/install.sh
- Running basic commands (agent launch, agent list, agent await)
- Integrating MCP server with Claude Code
- Understanding how to use the system from README alone

## Verification Commands (Agent MUST run these)

After analysis, agent must verify claims:

```bash
# Test installation script syntax
bash -n install.sh

# Verify bin/agent wrapper works in dev mode
./bin/agent --help

# Check package.json is valid JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json')))"

# Verify all agent scripts have valid bash syntax
for script in agent/agent-*; do bash -n "$script" || echo "SYNTAX ERROR: $script"; done

# Test that tests are runnable
bash -n tests/orchestration-patterns.sh
```

## Success Criteria

Agent must produce a structured report with:

- [ ] **Consistency Section**: List all consistency issues with specific file:line references
- [ ] **Coherence Section**: List all coherence issues with impact assessment
- [ ] **Completeness Section**: List all missing/incomplete elements with priority (critical/nice-to-have)
- [ ] **Verification Results**: Confirm all verification commands executed successfully
- [ ] **Recommendations**: Prioritized list of fixes (P0: blocks users, P1: degrades experience, P2: polish)

## Completion Confirmation

Agent must report:
1. Total issues found: {N} consistency + {M} coherence + {K} completeness = {TOTAL}
2. Critical blockers: {count} (P0 issues that prevent basic usage)
3. Verification status: {PASS/FAIL with details}
4. Top 3 recommended fixes in priority order
