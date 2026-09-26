import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateNavigationUrl } from "../dist/src/navigation.js";

const scenarios = JSON.parse(await readFile(new URL("./scenarios.json", import.meta.url), "utf8"));
let passed = 0;

for (const scenario of scenarios) {
  try {
    const parsed = validateNavigationUrl(scenario.url);
    assert.equal(scenario.accepted, true, `${scenario.id}: expected URL to be rejected`);
    assert.equal(parsed.hostname, scenario.host, `${scenario.id}: canonical host mismatch`);
  } catch (error) {
    assert.equal(scenario.accepted, false, `${scenario.id}: unexpected rejection: ${String(error)}`);
  }
  passed += 1;
}

console.log(JSON.stringify({ suite: "arc-navigation-input-safety", passed, total: scenarios.length, score: passed / scenarios.length }));
