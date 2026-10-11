#!/usr/bin/env node
// Release steps for the playgentic agents plugin. Zero dependencies.
// `bump` is run locally by the /release skill before tagging; `current`, `notes`
// and `package` are run by .github/workflows/release.yml when the tag is pushed.
//
//   node scripts/release.mjs current            print the version (fails if manifests disagree)
//   node scripts/release.mjs bump <x.y.z>       set the version in every manifest and
//                                               move CHANGELOG [Unreleased] under [x.y.z] - today
//   node scripts/release.mjs notes <x.y.z>      print that version's CHANGELOG section
//   node scripts/release.mjs package <x.y.z>    build dist/playgentic-<harness>-v<x.y.z>.zip
//                                               for claude, copilot and codex

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const REPO_URL = "https://github.com/BlaiseMoses01/playgentic-agents";

// Every place the version lives. Keep in sync with the CI "Versions agree" check.
const VERSION_FILES = [
  { file: ".claude-plugin/plugin.json", get: (j) => j.version, set: (j, v) => (j.version = v) },
  { file: "plugin.json", get: (j) => j.version, set: (j, v) => (j.version = v) },
  { file: ".codex-plugin/plugin.json", get: (j) => j.version, set: (j, v) => (j.version = v) },
  {
    file: ".github/plugin/marketplace.json",
    get: (j) => j.plugins[0].version,
    set: (j, v) => {
      j.plugins[0].version = v;
      if (j.metadata) j.metadata.version = v;
    },
  },
];

// What each harness needs to load the plugin. The marketplaces are not included:
// a zip is a single plugin, installed from a local path, not a marketplace.
const COMMON = ["skills", "LICENSE", "README.md", "CHANGELOG.md"];
const BUNDLES = {
  claude: [...COMMON, ".claude-plugin/plugin.json", ".mcp.json", "agents"],
  copilot: [...COMMON, "plugin.json", "mcp.json", "com.github.copilot"],
  codex: [...COMMON, "plugin.json", "mcp.json", ".codex-plugin/plugin.json"],
};

const die = (msg) => {
  console.error(`release: ${msg}`);
  process.exit(1);
};
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const writeJson = (rel, data) => writeFileSync(join(ROOT, rel), JSON.stringify(data, null, 2) + "\n");

function assertSemver(v) {
  if (!/^\d+\.\d+\.\d+$/.test(v ?? "")) die(`expected a version like 1.2.3, got "${v ?? ""}"`);
}

function current() {
  const versions = Object.fromEntries(VERSION_FILES.map(({ file, get }) => [file, get(readJson(file))]));
  const unique = new Set(Object.values(versions));
  if (unique.size !== 1) die(`manifest versions disagree:\n${JSON.stringify(versions, null, 2)}`);
  return [...unique][0];
}

function bump(v) {
  assertSemver(v);
  const from = current();
  const text = readFileSync(CHANGELOG, "utf8");
  if (new RegExp(`^## \\[${v.replaceAll(".", "\\.")}\\]`, "m").test(text)) die(`CHANGELOG already has a [${v}] section`);

  const m = text.match(/^## \[Unreleased\]\n([\s\S]*?)(?=^## \[)/m);
  if (!m) die("CHANGELOG has no [Unreleased] section followed by a release");
  if (!m[1].trim()) die("CHANGELOG [Unreleased] is empty — record the changes before releasing");

  for (const { file, set } of VERSION_FILES) {
    const json = readJson(file);
    set(json, v);
    writeJson(file, json);
  }

  const today = new Date().toISOString().slice(0, 10);
  let next = text.replace(m[0], `## [Unreleased]\n\n## [${v}] - ${today}\n${m[1].replace(/^\n*/, "\n")}`);
  // Keep the compare links at the bottom current.
  next = next.replace(/^\[Unreleased\]: .*$/m, `[Unreleased]: ${REPO_URL}/compare/v${v}...HEAD`);
  if (!new RegExp(`^\\[${v.replaceAll(".", "\\.")}\\]: `, "m").test(next)) {
    next = next.replace(
      /^(\[Unreleased\]: .*)$/m,
      `$1\n[${v}]: ${REPO_URL}/compare/v${from}...v${v}`,
    );
  }
  writeFileSync(CHANGELOG, next);
  console.log(`bumped ${from} → ${v} in ${VERSION_FILES.length} manifests and CHANGELOG`);
}

function notes(v) {
  assertSemver(v);
  const text = readFileSync(CHANGELOG, "utf8");
  const m = text.match(new RegExp(`^## \\[${v.replaceAll(".", "\\.")}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|^\\[[^\\]]+\\]: |(?![\\s\\S]))`, "m"));
  if (!m || !m[1].trim()) die(`no CHANGELOG section for [${v}]`);
  process.stdout.write(m[1].trim() + "\n");
}

function pkg(v) {
  assertSemver(v);
  if (current() !== v) die(`manifests are at ${current()}, not ${v} — run bump first`);
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  for (const [harness, files] of Object.entries(BUNDLES)) {
    const stage = join(DIST, ".stage", harness);
    for (const rel of files) {
      const src = join(ROOT, rel);
      if (!existsSync(src)) die(`${harness} bundle is missing ${rel}`);
      cpSync(src, join(stage, rel), { recursive: true });
    }
    const zip = join(DIST, `playgentic-${harness}-v${v}.zip`);
    // -X drops extra file attributes so the archive only reflects content.
    execFileSync("zip", ["-qrX", zip, "."], { cwd: stage });
    console.log(`built dist/playgentic-${harness}-v${v}.zip`);
  }
  rmSync(join(DIST, ".stage"), { recursive: true, force: true });
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "current") console.log(current());
else if (cmd === "bump") bump(arg);
else if (cmd === "notes") notes(arg);
else if (cmd === "package") pkg(arg);
else die("usage: release.mjs current | bump <x.y.z> | notes <x.y.z> | package <x.y.z>");
