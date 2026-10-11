# Changelog

All notable changes to the **playgentic** agents plugin (Claude Code, GitHub Copilot, Codex) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Bump `version` in every manifest (see CLAUDE.md) with every release entry.

## [Unreleased]

## [0.2.0] - 2026-10-11

### Added

- **Project conventions and extensions.** The pipeline reads optional, repo-owned files under `.playgentic/wiki/`, so team rules survive plugin updates:
  - `CONVENTIONS.md`: the team's coding style and testing expectations. It's authoritative over the skill and agent defaults, and is passed to every agent.
  - `index.md`: a step and page-object index, used instead of grepping when present.
  - `extensions/<name>.md`: per-skill and per-agent rules (`author-tests`, `explorer`, `builder`, `auditor`). The orchestrator follows its own file and appends each agent's file to that agent's prompt. Extension rules override built-in instructions where they conflict, including the guardrails.

### Changed

- **Step 6 auto-reject list** now defers to `CONVENTIONS.md` and extensions when they explicitly allow something.
- **Hand-off** runs the repo's documented wiki or index command, and never edits `CONVENTIONS.md` or `extensions/`.

## [0.1.0] - 2026-10-11

First release. The core agent pipeline from [playgentic](https://github.com/BlaiseMoses01/playgentic) is ported as a plugin for Claude Code, GitHub Copilot and Codex. It is minimal, and it makes no assumptions about the repo it runs in.

### Added

- **`author-tests` skill.** A 7-step orchestrator that branches, learns the suite, plans acceptance criteria, explores, builds, reviews and hands off. It has `--gen` and `--heal` modes.
- **`explorer` agent.** Explores the live app read-only and returns locators with reasons, flows, and an oracle for each acceptance criterion.
- **`builder` agent.** Writes and runs tests in the repo's own conventions and tags each one `@AC-n`. It stops after 3 failed attempts, and treats finding an app bug as a success.
- **`auditor` agent.** Reviews read-only, giving each AC a verdict (verified / weak / not-verified) and a quality rating (BLOCK / MEETS / SHIP).
- **Bundled `playwright-test` MCP server** (`npx playwright run-test-mcp-server`).
- **Multi-provider packaging.** One plugin directory carries:
  - Claude manifest and marketplace (`.claude-plugin/`)
  - Agent Plugins 1.0 `plugin.json` + `mcp.json` for Copilot and Codex
  - Codex compatibility manifest (`.codex-plugin/`)
  - Copilot marketplace (`.github/plugin/`) and Codex marketplace (`.agents/plugins/`)
- **Single-source agents.** `src/agents/` holds one definition per agent, and `scripts/build.mjs` generates Claude subagents, Copilot custom agents, and plain briefs. Codex uses the briefs, because Codex plugins can't ship agents.
- **CI.** Checks that JSON parses, plugin validation passes, generated agents are up to date, versions agree across manifests, MCP tool names are prefixed, and the version has a changelog entry.
- **`.playgentic/config.json` support**, with these keys:
  - `preferredBaseBranch`
  - `branchPrefix`
  - `worktrees` (`ask` / `always` / `never`)
  - `runCommand`

[Unreleased]: https://github.com/BlaiseMoses01/playgentic-agents/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/BlaiseMoses01/playgentic-agents/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/BlaiseMoses01/playgentic-agents/releases/tag/v0.1.0
