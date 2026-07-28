#!/usr/bin/env node
// Validation checks for the Cardview QOL add-on. Run from the repository root.
// Lives under .github/ so it is never swept into the XPI by build.yml.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const failures = [];

function check(name, fn) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message.replaceAll("\n", "\n        ")}`);
    failures.push(name);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

console.log("manifest.json / schema.json");

let manifest;
check("manifest.json is valid JSON", () => {
  manifest = readJson("manifest.json");
});

let schema;
check("schema.json is valid JSON", () => {
  schema = readJson("schema.json");
});

check("manifest.json declares the files it references", () => {
  if (!manifest) throw new Error("manifest.json did not parse");

  const referenced = [
    ...manifest.background.scripts,
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.experiment_apis).flatMap((api) => [
      api.schema,
      api.parent.script,
    ]),
  ];

  const missing = referenced.filter((file) => {
    try {
      readFileSync(file);
      return false;
    } catch {
      return true;
    }
  });

  if (missing.length > 0) {
    throw new Error(`referenced but not present: ${missing.join(", ")}`);
  }
});

// The `settings` parameter is duplicated verbatim between add() and reload().
// Updating one and forgetting the other is the easy mistake this catches.
check("cardModifier add/reload accept the same settings", () => {
  if (!schema) throw new Error("schema.json did not parse");

  const namespace = schema.find((entry) => entry.namespace === "cardModifier");
  if (!namespace) throw new Error("no cardModifier namespace in schema.json");

  const settingsOf = (name) => {
    const fn = namespace.functions.find((candidate) => candidate.name === name);
    if (!fn) throw new Error(`cardModifier.${name} is missing from schema.json`);
    const param = fn.parameters.find((candidate) => candidate.name === "settings");
    if (!param) throw new Error(`cardModifier.${name} has no settings parameter`);
    return param.properties;
  };

  const add = settingsOf("add");
  const reload = settingsOf("reload");

  if (JSON.stringify(add) !== JSON.stringify(reload)) {
    throw new Error(
      `add:    ${JSON.stringify(add)}\nreload: ${JSON.stringify(reload)}`
    );
  }
});

console.log("\njavascript syntax");

const sources = execFileSync(
  "git",
  ["ls-files", "*.js", "*.mjs"],
  { encoding: "utf8" }
)
  .split("\n")
  .filter(Boolean);

if (sources.length === 0) {
  failures.push("found no javascript sources to check");
  console.log("  FAIL  found no javascript sources to check");
}

for (const source of sources) {
  check(source, () => {
    execFileSync(process.execPath, ["--check", source], { stdio: "pipe" });
  });
}

// On a tag push the release job publishes whatever manifest.json says, so a
// stale version number would ship silently.
const tag = process.env.RELEASE_TAG;
if (tag) {
  console.log("\nrelease");
  check(`manifest.json version matches tag ${tag}`, () => {
    if (manifest.version !== tag) {
      throw new Error(`manifest.json is ${manifest.version}, tag is ${tag}`);
    }
  });
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}

console.log("\nall checks passed");
