---
name: author-tests
description: pipeline skill to extend and repair existing tests or generate new regression coverage in Playwright suites (plain Playwright or playwright-bdd), in greenfield or brownfield repos. Use when asked to add, write, fix, or heal Playwright tests.
argument-hint: "[--gen | --heal] <what to cover, issue/PR ref, or failing test>"
---

# author-tests

You are the orchestrator. You set up the branch, learn the suite, agree acceptance criteria with the user, then delegate: `explorer` looks at the live app, `builder` writes and runs tests, `auditor` reviews. You never drive the browser yourself.

### Delegating to agents

How you launch each agent depends on your harness:

- **Claude Code:** use the plugin subagents `playgentic:explorer`, `playgentic:builder`, `playgentic:auditor`.
- **GitHub Copilot:** use the custom agents `explorer`, `builder`, `auditor`.
- **Any harness without those agents (e.g. Codex):** spawn a subagent whose instructions are the matching brief in `agents/` next to this file (`agents/explorer.md`, `agents/builder.md`, `agents/auditor.md`), followed by your task-specific prompt. Spawn explorer and auditor read-only where your harness supports it.

If your harness can't run subagents at all, play each role yourself in sequence, following its brief exactly. Never mix the auditor's review into the builder's work.

Modes:
- `--gen` (default): add coverage for new or untested behaviour.
- `--heal`: repair broken or flaky tests. The acceptance criteria are what the broken test used to verify, and those must still be verified afterwards. Deleting or weakening an assertion is not a fix.

### Project wiki and extensions

A repo can customise this pipeline in `.playgentic/wiki/`. All of it is optional; use whatever exists:

- `CONVENTIONS.md`: the team's coding style and testing expectations (locators, page objects, steps, test data, what good UI and API tests look like). It's **authoritative**: where it disagrees with this skill, the agent briefs, or what you infer from the code, it wins.
- `index.md`: a generated index of the suite's steps and page objects. Use it instead of grepping when it exists.
- `extensions/<name>.md`: extra rules for one skill or agent:
  - `author-tests.md` applies to **you**.
  - `explorer.md`, `builder.md` and `auditor.md` apply to those agents.

  Extension rules **override built-in instructions where they conflict, including the guardrails** (e.g. an extension may allow `waitForTimeout` in a specific case).

Read `extensions/author-tests.md` now, if it exists, and follow it for the rest of the run. When you delegate to an agent, append the contents of its extension file to the prompt under a final heading, `## Project extensions (override everything above)`. Skip the heading if the file is missing or has no rules. Treat HTML comments as empty.

## Step 1: Establish your working environment

### Read config

Read `.playgentic/config.json` at the repo root if it exists. Instructions in CLAUDE.md or project rules take precedence over it. Missing keys fall back to these defaults:

```json
{
  "preferredBaseBranch": "main",
  "branchPrefix": "test/",
  "worktrees": "ask",
  "runCommand": "npx playwright test"
}
```

- `preferredBaseBranch`: the branch that features are cut from.
- `branchPrefix`: prefix for the feature branch name.
- `worktrees`: `ask` (confirm with the user each run), `always`, or `never`.
- `runCommand`: how the suite runs. playwright-bdd repos usually need `npx bddgen && npx playwright test`. Extra Playwright args such as `--grep` are appended to it.

If no config file exists and CLAUDE.md doesn't settle it, confirm the base branch with the user before continuing.

### Check the tree

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --porcelain
```

If the tree is dirty, stop and ask the user to commit or stash. Do not stash on their behalf: uncommitted work would end up mixed into the agents' diff.

### Always create a feature branch

Every run gets its own feature branch, even if you are already on a non-base branch. Pick a short kebab-case slug from the task, e.g. `checkout-coupons`.

```bash
git fetch origin <base> 2>/dev/null || true
```

Branch from `origin/<base>` if it exists, otherwise from the local `<base>`.

### Worktree only for parallel work

If `worktrees` is `ask`, ask the user whether this work should run in parallel with other work, which means using a worktree. `always` and `never` skip the question.

**No worktree:**

```bash
git switch -c <branchPrefix><slug> <base-ref>
```

**Worktree:**

```bash
git worktree add ../<repo-name>-<slug> -b <branchPrefix><slug> <base-ref>
```

`node_modules` is gitignored, so symlink it from the main checkout. Otherwise `npx` resolves against the worktree and tries to download Playwright:

```bash
ln -s "$(git rev-parse --show-toplevel)/node_modules" ../<repo-name>-<slug>/node_modules
```

Copy or point at env files the same way if the suite needs them (e.g. `.env`). Prefer a symlink so secrets aren't duplicated. From here on, run every command and pass every path from inside the worktree, and tell each agent the worktree's absolute path.

## Step 2: Learn the suite

Do not assume a layout or conventions. If `.playgentic/wiki/` exists, start there: read `CONVENTIONS.md` and `index.md`, then confirm against the code. Otherwise read, in this order:

1. The Playwright config (`playwright.config.{ts,js,mjs}`). Note `testDir`, projects, `baseURL` and where it comes from (which env var), and whether it uses `defineBddConfig`/`defineBddProject`, which means playwright-bdd.
2. `package.json`: the test scripts and whether `playwright-bdd` is a dependency.
3. Three to five existing tests close to the area you'll work in. For bdd, read the feature files plus their step definitions.
4. Shared fixtures, page objects and helpers.

Write down a short **conventions brief** (keep it in context; you'll paste it into every agent prompt). If `CONVENTIONS.md` exists, include its relevant sections verbatim rather than paraphrasing them:

- Suite type: plain or bdd, plus the feature and step locations.
- File naming and where new tests or steps belong.
- Locator style: role/label/testid vs CSS, and any page-object layer.
- Fixtures, auth/setup patterns, and how test data is created.
- Tagging conventions already in use.
- Step documentation: do existing steps carry JSDoc/docstrings? If most do, new ones must too, in the same format. If they don't, don't introduce them. Never require a docs wiki or a generated report unless `CONVENTIONS.md` says so.
- How to run one test: `runCommand` plus `--grep "<tag or title>"`, plus `--project` if needed.

For bdd suites, list the existing step patterns (grep the step files for `Given(`/`When(`/`Then(`/`Step(`). The builder must reuse existing steps before writing new ones.

## Step 3: Plan acceptance criteria

Turn the request into numbered acceptance criteria. For each one, give:

- `AC-n`: one behaviour, stated so it can fail.
- **Oracle**: the observable thing that proves it. Name the specific text, state, URL or count. "The page works" is not an oracle.

In heal mode, derive the ACs from what the broken test asserted, and say which ones are now wrong because the app intentionally changed.

Show the ACs to the user and get confirmation before building. Do not change them afterwards without asking.

## Step 4: Explore

Group the ACs by surface (page or flow). Launch one `explorer` agent per surface, in parallel when there are several. Each prompt includes:

- the base URL and how to sign in, if needed
- the ACs for that surface, with their oracles
- the conventions brief

Each explorer returns a JSON surface map. Keep it so you can hand it to builders. If an explorer reports blockers (missing test data, unreachable flow), take them to the user before building that AC.

## Step 5: Build

Launch `builder` agents with up to three running in parallel. Each builder gets one AC, or a few ACs that share a file. Each prompt includes:

- the working directory (the worktree path if one is in use)
- the AC(s) and oracle(s)
- the relevant surface map
- the conventions brief, including how to run one test
- the existing steps to reuse (bdd)
- the files it owns

Parallel builders must not edit the same file. If two ACs need the same new shared step or helper, give both to one builder.

Every test must be tagged `@AC-n` the way the suite tags things: a Gherkin tag in bdd, otherwise `{ tag: '@AC-n' }` or a title suffix, matching what the repo already does. If the repo shouldn't carry AC tags long-term, ask the user, and strip them at hand-off.

Builders stop after 3 failed attempts on the same problem and report why. A builder that reports a real application bug has succeeded. Pass that finding on to the user rather than having the test bent to pass.

## Step 6: Review

Once builders finish, run the new and changed tests yourself with `runCommand` and `--grep`. Never accept a builder's word that they're green.

Launch one `auditor` agent with:

- the AC list with oracles
- the diff: `git diff <base-ref>...HEAD -- <test paths>` plus uncommitted changes
- the conventions brief

If the auditor returns `BLOCK`, or any AC comes back `weak` or `not-verified`, send the specific findings back to the relevant builder. Run at most 2 review loops. After that, stop and report the remaining gaps honestly.

Unless `CONVENTIONS.md` or an extension explicitly allows it, reject immediately, without waiting for the auditor, any diff that:

- adds `.skip`, `.only` or `@skip`
- deletes or loosens an existing assertion without the user agreeing to it
- adds `waitForTimeout`
- edits the Playwright config to make tests pass (retries, grep, `testIgnore`, timeouts)

## Step 7: Hand off

1. If the repo documents a command that regenerates its wiki or index (e.g. `npm run wiki` in `CONVENTIONS.md`), run it so the index reflects the new steps and page objects.
2. Make sure only test-related files changed: tests, steps, features, fixtures, page objects, and generated wiki or index files. Never edit `CONVENTIONS.md` or `extensions/`; they belong to the team. Revert anything else unless the user asked for it.
3. Commit with a clear message, e.g. `test(<area>): cover <behaviour> (AC-1..n)`.
4. Report to the user:
   - the branch, and the worktree path if there is one
   - an AC table with columns AC, test (file:line), result and auditor verdict
   - any app bugs found and any blockers
5. If a worktree was used, offer to remove it (`git worktree remove <path>`). Never remove it without asking. The branch stays either way.

Do not push or open a PR unless the user asks.
