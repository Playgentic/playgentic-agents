# playgentic agents

An agent pipeline for writing and repairing Playwright tests, packaged as a plugin for **Claude Code**, **GitHub Copilot** and **OpenAI Codex**. It works with plain Playwright or playwright-bdd, in new repos or existing ones.

It doesn't impose a layout. It learns your suite's conventions first and writes tests that look like your team wrote them.


## What's in it

| Piece | Purpose |
| --- | --- |
| `author-tests` skill | The orchestrator. Sets up the branch, learns the suite, plans acceptance criteria, delegates, reviews and commits. |
| `explorer` agent | Explores the live app read-only and returns locators, flows and the observable proof ("oracle") for each acceptance criterion. |
| `builder` agent | Writes and runs the tests for its assigned criteria in your repo's style, iterating until they pass or it can say exactly why not. |
| `auditor` agent | Read-only adversarial review. Rates whether each test genuinely verifies its criterion and flags weakened or low-quality tests. |
| `playwright-test` MCP | Playwright's test MCP server (`npx playwright run-test-mcp-server`), used by the explorer and builder. |

## Install

**Claude Code**

```
/plugin install playgentic --marketplace playgentic/playgentic-agents
```

**GitHub Copilot CLI**

```bash
copilot plugin marketplace add playgentic/playgentic-agents
copilot plugin install playgentic@playgentic
```

**Codex**

```bash
codex plugin marketplace add playgentic/playgentic-agents
codex plugin add playgentic@playgentic
```

Codex plugins can't ship custom agents. On Codex, the skill spawns generic subagents using the briefs in `skills/author-tests/agents/`.

**Requirements in the target repo:**
- `@playwright/test` installed (the MCP server runs from the repo's own Playwright)
- a reachable app under test
- git

## Usage

Invoke the `author-tests` skill. In Claude Code that's `/playgentic:author-tests`; other harnesses invoke the skill by name or pick it up from the request.

```
author-tests --gen cover applying and removing coupons at checkout
author-tests --heal tests/checkout.spec.ts is failing after the cart redesign
```

- `--gen` (default): add coverage for new or untested behaviour.
- `--heal`: repair broken or flaky tests. Whatever the broken test verified must still be verified afterwards. Deleting or weakening assertions doesn't count as a fix.

## The agent workflow
1. **Branch.** Every run gets a fresh feature branch cut from your base branch. If you confirm the work is parallel, it runs in a git worktree next to the repo instead.
2. **Learn the suite.** Reads your Playwright config, nearby tests or steps, fixtures and page objects, and writes a conventions brief. It never assumes docstrings, a step wiki or a generated report.
3. **Plan.** Writes numbered acceptance criteria (`AC-n`), each with an oracle. You confirm them before anything is built.
4. **Explore.** One explorer per surface, run in parallel.
5. **Build.** Up to three builders in parallel, each owning its own files. Every test is tagged `@AC-n`.
6. **Review.** The orchestrator re-runs the tests itself, then the auditor reviews them. There are at most 2 rounds of fixes.
7. **Hand off.** Commits test files only and reports a table of criteria, tests, results and verdicts. It doesn't push or open a PR unless you ask.

## Configuration

Create `.playgentic/config.json` in the target repo. Anything in CLAUDE.md, AGENTS.md or your project rules takes precedence over it, but this will allow you to easily configure how you want branching , worktrees, test runs to be done by the agents. 

```json
{
  "preferredBaseBranch": "main",
  "branchPrefix": "test/",
  "worktrees": "ask",
  "runCommand": "npx playwright test"
}
```

| Key | Meaning |
| --- | --- |
| `preferredBaseBranch` | Branch that feature branches are cut from. |
| `branchPrefix` | Prefix for the run's feature branch. |
| `worktrees` | `ask` (confirm each run), `always`, or `never`. |
| `runCommand` | How the suite runs. Args like `--grep` are appended. For playwright-bdd use `npx bddgen && npx playwright test`. |


## Customising: conventions and extensions

Teach the agents your team's rules by adding files under `.playgentic/wiki/` in your repo. They live in your repo, not the plugin, so plugin updates never overwrite them.

| File | Effect |
| --- | --- |
| `.playgentic/wiki/CONVENTIONS.md` | Your coding style and testing expectations: locators, page objects, steps, test data, what good UI and API tests look like. Every agent gets it, and it takes precedence over their defaults. |
| `.playgentic/wiki/extensions/author-tests.md` | Extra rules for the orchestrator skill. |
| `.playgentic/wiki/extensions/{explorer,builder,auditor}.md` | Extra rules for each agent, appended to its prompt. |
| `.playgentic/wiki/index.md` | An index of your steps and page objects. The agents use it instead of grepping. |

All of these are optional. Without them, the agents infer conventions from your code.

Extension rules **override the built-in instructions where they conflict, including the guardrails.** For example, a builder extension can allow `waitForTimeout` for one legacy widget.

The [`playgentic`](https://github.com/playgentic/playgentic) scaffold creates these files for you and generates `index.md` with `npm run wiki`.
