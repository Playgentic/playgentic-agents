# Contributing

This repo is one agent plugin that ships to three harnesses: Claude Code, GitHub Copilot and OpenAI Codex. It's markdown skills and agents plus manifests. The only code is a zero-dependency generator.

## Why the agents live in four places

Each harness looks for plugin agents in a different place and format, and Codex can't load agents from a plugin at all. So each agent (explorer, builder, auditor) exists in four places:

| Location | Edit it? | Why it exists |
| --- | --- | --- |
| `src/agents/*.md` | **yes, the only copy you edit** | Neutral frontmatter plus the prompt body. It doesn't belong to any harness. |
| `agents/*.md` | no, generated | Claude Code only reads plugin agents from here. Carries Claude's `tools:` list, including the namespaced `mcp__plugin_playgentic_playwright-test__*` names. That list is what enforces read-only and limits browser access. |
| `com.github.copilot/agents/*.agent.md` | no, generated | Copilot's required folder and extension for plugin agents. It has no `tools:` list, because Copilot's tool aliases aren't stable across surfaces yet, so read-only is stated in the prompt instead. |
| `skills/author-tests/agents/*.md` | no, generated | Codex plugins can't include agents. On Codex (or any harness without the named agents), the skill starts a generic subagent and gives it this file as its instructions. |

`scripts/build.mjs` generates the last three from `src/agents/`, and CI fails if they're out of date.


## Editing agents

1. Edit `src/agents/<name>.md`.
2. Run `node scripts/build.mjs`.
3. Commit the source and generated files together.

Source frontmatter:

```yaml
name: explorer
description: one line, used by harnesses to pick the agent
access: read            # read | write. The generator refuses `edit` for read agents
tools: [read, search, browser]   # read, search, edit, shell, browser, test
model: sonnet           # Claude only
color: green            # Claude only
```

The generator maps tool tags to each harness:
- **Claude:** tool names. Renaming the plugin or the MCP server changes the `mcp__plugin_<plugin>_<server>__*` prefix.
- **Copilot:** no tool list.
- **Codex:** a plain instructions file.

## Editing the skill

`skills/author-tests/SKILL.md` is shared by all three harnesses, so keep it provider-neutral. Harness-specific instructions belong only in its "Delegating to agents" section.

Don't assume anything about the target repo. It may be plain Playwright or playwright-bdd, greenfield or brownfield. In particular, don't hardcode:
- test paths
- docstring requirements
- a step wiki
- `npm run` script names

Keep three lists consistent:
- the builder's "Never" list
- the auditor's red flags
- the skill's Step 6 auto-reject list

## Manifests and marketplaces

| File | Harness |
| --- | --- |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Claude |
| `plugin.json` (Agent Plugins 1.0), `mcp.json` | Copilot, Codex |
| `.codex-plugin/plugin.json` | Codex (compatibility) |
| `.mcp.json` | Claude |
| `.github/plugin/marketplace.json` | Copilot |
| `.agents/plugins/marketplace.json` | Codex |

## Scope

This plugin is deliberately minimal and kept as generic as possilbe to preserve utility for users outside of our playgentic repo shape.

For more opinionated features and functionality , we tend to throw those in our scaffold package in the [`playgentic`](https://github.com/BlaiseMoses01/playgentic) npm package.

## Verifying changes

```bash
node scripts/build.mjs && git diff --exit-code
claude plugin validate . && claude plugin validate .claude-plugin/marketplace.json
claude --plugin-dir . -p "List tools containing 'playwright-test' and agents/skills containing playgentic"

# Codex, isolated from your real config
CODEX_HOME=$(mktemp -d) sh -c 'codex plugin marketplace add "$PWD" && codex plugin add playgentic@playgentic'

# Copilot
copilot plugin marketplace add "$PWD" && copilot plugin install playgentic@playgentic
```

To check behaviour, run `author-tests` on each harness against a scratch repo with a running app. Use both a plain `npm init playwright@latest` repo and a playwright-bdd repo without step docstrings.

## Releasing

Record changes under `## [Unreleased]` in `CHANGELOG.md` as you go (Keep a Changelog).

Releases are split between a skill and CI:

- **`/release` skill** (repo-local, `.claude/skills/release/`, not part of the plugin) runs the checks, proposes a semver bump from the Unreleased entries, runs `node scripts/release.mjs bump x.y.z` (all four manifests + changelog), commits, tags `vx.y.z`, and pushes after you confirm.
- **`.github/workflows/release.yml`** runs on the pushed `v*.*.*` tag. It:
  1. re-runs the CI checks
  2. verifies the tag matches the manifest version
  3. builds `playgentic-{claude,copilot,codex}-vx.y.z.zip`
  4. publishes the GitHub release with the zips attached and that version's changelog section as notes

To release without Claude, run `node scripts/release.mjs bump x.y.z`, then commit, tag and push the tag yourself. To preview the zips locally, run `node scripts/release.mjs package x.y.z`, which writes to `dist/` (gitignored).
