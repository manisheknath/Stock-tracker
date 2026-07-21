// Minimal zero-dependency test runner. node:test requires Node 18+; this repo's
// dev environment is on Node 16, so a ~20-line harness over node:assert avoids
// the dependency entirely and runs identically here and in CI.
import assert from 'node:assert/strict';

const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
export { assert };

export function closeTo(actual, expected, epsilon = 1e-6, message) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    message || `expected ${actual} to be close to ${expected}`
  );
}

export async function run() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`  ok - ${name}`);
    } catch (err) {
      failed++;
      console.log(`  FAIL - ${name}`);
      console.log(`    ${err.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
  if (failed > 0) process.exit(1);
}
