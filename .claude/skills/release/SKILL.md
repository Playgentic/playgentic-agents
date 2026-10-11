---
name: release
description: Kick off a release of the playgentic agents plugin. Picks the semver bump from the changelog, bumps every manifest, commits, tags and pushes the tag. CI (.github/workflows/release.yml) then builds the per-harness zips and publishes the GitHub release. Use when asked to release, tag, or cut a version of this repo.
argument-hint: "[x.y.z | major | minor | patch]"
disable-model-invocation: true
---

# Release

This skill is for maintaining this repo. It isn't part of the plugin.

Your job ends at pushing a version tag. Pushing a `v*.*.*` tag triggers `.github/workflows/release.yml`, which then:
1. re-runs the CI checks
2. verifies the tag matches the manifest version
3. builds `playgentic-{claude,copilot,codex}-vx.y.z.zip`
4. publishes the GitHub release with that version's changelog section as notes

**Never build zips or create the GitHub release yourself.**

Stop at the first failure and report it. Never paper over a failed check to keep going.

## 1. Preflight

```bash
git status --porcelain                 # must be empty
git branch --show-current              # must be main
git fetch origin --tags && git status -sb   # must not be behind origin/main
node scripts/release.mjs current       # all manifests agree
```

Run the same checks CI runs, so the release doesn't fail after the tag is already pushed:

```bash
node scripts/build.mjs && git diff --exit-code
claude plugin validate . && claude plugin validate .claude-plugin/marketplace.json
```

## 2. Pick the version

Read `## [Unreleased]` in `CHANGELOG.md`. If it's empty, stop: there's nothing to release. Ask the user to record the changes first, or offer to draft entries from `git log v<current>..HEAD` for them to approve.

If the user gave an exact version, use it. Otherwise propose a bump from the Unreleased entries:
- **major:** anything under "Removed", or marked BREAKING, such as a renamed skill or agent, a changed config key, or a changed plugin name. While the version is `0.x`, a breaking change bumps minor instead.
- **minor:** "Added", or a behaviour change that's backwards compatible.
- **patch:** only "Fixed" or wording changes.

Make sure the tag `v<x.y.z>` doesn't already exist (`git tag -l v<x.y.z>`).

Show the user the current version, the proposed version, and the Unreleased entries. **Get confirmation before continuing.**

## 3. Bump, commit, tag

```bash
node scripts/release.mjs bump <x.y.z>   # all manifests + CHANGELOG [Unreleased] → [x.y.z] - today
git diff --stat
git add -A
git commit -m "release: v<x.y.z>"
git tag -a v<x.y.z> -m "v<x.y.z>"
```

## 4. Push and hand off to CI

Pushing the tag publishes a release, so **confirm with the user before pushing**:

```bash
git push origin main
git push origin v<x.y.z>
```

Then follow the release run until it finishes:

```bash
gh run list --workflow release.yml --limit 1
gh run watch <run-id> --exit-status
```

Report:
- the run result and the release URL (`gh release view v<x.y.z> --json url -q .url`)
- the attached zips
- a reminder that marketplace installs pick up the new version on their next update

## If the release run fails

Read the failing step with `gh run view <run-id> --log-failed`.

- **Checks failed, or the tag doesn't match the manifest:** the tag points at a bad commit. Ask the user before deleting it. Only do it if no release was created: `git push origin :refs/tags/v<x.y.z>` and `git tag -d v<x.y.z>`. Then fix forward with a new commit and re-tag.
- **Failed after packaging** (e.g. publishing failed): fix the cause, then re-run the workflow with `gh run rerun <run-id> --failed`. Never move a tag that already has a published release.
