# CLAUDE.md

@CONTRIBUTING.md

## Rules for agents working in this repo

- **Never edit generated agent files.** Edit `src/agents/<name>.md`, run `node scripts/build.mjs`, and commit both. The generated files are `agents/`, `com.github.copilot/agents/` and `skills/author-tests/agents/`.
- **Keep the skill provider-neutral.** Name Claude, Copilot or Codex only in its "Delegating to agents" section.
- **Stay minimal.** Don't add CLIs, hooks, gates, ledgers or report generators. Snapshot, triage and evidence work is planned as separate builds.
- **Release versions must match.** Bump all four manifest versions together.
- **Expected warning:** `claude plugin validate .` warns that root `CLAUDE.md` isn't loaded as plugin context. That's intended; this file is for developing the plugin.
