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

console.log("\noptions.html accessibility");

// These are string-level assertions against the raw markup, not DOM
// assertions. The add-on ships as a zip with no node_modules and cannot take
// on an HTML parser / jsdom dependency, so we regex the source text instead.
const optionsHtml = readFileSync("options.html", "utf8");

function findTagById(html, id) {
  const match = html.match(
    new RegExp(`<[a-zA-Z][^>]*\\bid=["']${id}["'][^>]*>`, "s")
  );
  return match ? match[0] : null;
}

check("setting controls have aria-describedby pointing at a real id", () => {
  const controlIds = [
    "toggle-delete",
    "toggle-star",
    "toggle-indicator",
    "color-indicator",
  ];

  const missing = [];
  for (const id of controlIds) {
    const tag = findTagById(optionsHtml, id);
    if (!tag) {
      missing.push(`${id} (element not found)`);
      continue;
    }
    const describedBy = tag.match(/\baria-describedby=["']([^"']+)["']/);
    if (!describedBy) {
      missing.push(id);
      continue;
    }
    const targetId = describedBy[1];
    const targetExists = new RegExp(`\\bid=["']${targetId}["']`).test(
      optionsHtml
    );
    if (!targetExists) {
      missing.push(`${id} (aria-describedby="${targetId}" does not exist)`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `controls missing a valid aria-describedby: ${missing.join(", ")}`
    );
  }
});

check('status bar has role="status"', () => {
  const tag = findTagById(optionsHtml, "status-bar");
  if (!tag) throw new Error("#status-bar element not found");
  if (!/\brole=["']status["']/.test(tag)) {
    throw new Error(`#status-bar is missing role="status": ${tag}`);
  }
});

check('toggle inputs have role="switch"', () => {
  const toggleIds = ["toggle-delete", "toggle-star", "toggle-indicator"];
  const missing = toggleIds.filter((id) => {
    const tag = findTagById(optionsHtml, id);
    if (!tag) return true;
    return !/\brole=["']switch["']/.test(tag);
  });

  if (missing.length > 0) {
    throw new Error(
      `toggle inputs missing role="switch": ${missing.join(", ")}`
    );
  }
});

check(".toggle-label / .toggle-wrapper elements have no redundant aria-label", () => {
  const tags =
    optionsHtml.match(
      /<[a-zA-Z][^>]*\bclass=["'](?:toggle-label|toggle-wrapper)["'][^>]*>/gs
    ) ?? [];

  const offenders = tags.filter((tag) => /\baria-label=["'][^"']*["']/.test(tag));

  if (offenders.length > 0) {
    throw new Error(
      `.toggle-label / .toggle-wrapper elements with a redundant aria-label: ${offenders.join(", ")}`
    );
  }
});

check("each toggle input is referenced by exactly one for=", () => {
  const toggleIds = ["toggle-delete", "toggle-star", "toggle-indicator"];
  const wrongCounts = [];

  for (const id of toggleIds) {
    const matches = optionsHtml.match(new RegExp(`\\bfor=["']${id}["']`, "g")) ?? [];
    if (matches.length !== 1) {
      wrongCounts.push(`${id} (${matches.length})`);
    }
  }

  if (wrongCounts.length > 0) {
    throw new Error(
      `expected exactly one for= per toggle input, got: ${wrongCounts.join(", ")}`
    );
  }
});

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
