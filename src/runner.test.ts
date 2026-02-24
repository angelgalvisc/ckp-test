import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCriteria,
  generateReport,
  runVector,
  type SkipPolicy,
  type TestVector,
  type VectorResult,
} from "./runner.js";

function makeVector(id: string, level: "L1" | "L2" | "L3"): TestVector {
  return {
    id,
    level,
    title: id,
    description: "test",
    request: null,
    expected: { type: "manifest-valid" },
    reference: "test",
  };
}

test("evaluateCriteria marks full pass as CONFORMANT", () => {
  const results: VectorResult[] = [
    { vector: makeVector("v1", "L1"), status: "pass", durationMs: 1 },
    { vector: makeVector("v2", "L1"), status: "pass", durationMs: 1 },
  ];

  const criteria = evaluateCriteria(results, "L1");
  assert.equal(criteria.result, "CONFORMANT");
  assert.equal(criteria.passed, 2);
  assert.equal(criteria.skipped, 0);
});

test("runVector skips scenario vectors before transport execution", async () => {
  const vector: TestVector = {
    ...makeVector("TV-SCENARIO", "L2"),
    request: { jsonrpc: "2.0", id: 1, method: "claw.tool.call", params: {} },
    scenario: true,
    expected: { type: "success" },
  };

  const skipPolicy: SkipPolicy = { skippedVectors: {} };
  const result = await runVector(vector, null, skipPolicy);

  assert.equal(result.status, "skip");
  assert.match(result.skipReason ?? "", /Scenario-based/);
});

test("generateReport applies hierarchical overall result", () => {
  const results: VectorResult[] = [
    { vector: makeVector("L1-PASS", "L1"), status: "pass", durationMs: 1 },
    { vector: makeVector("L2-SKIP", "L2"), status: "skip", skipReason: "scenario", durationMs: 1 },
    { vector: makeVector("L3-PASS", "L3"), status: "pass", durationMs: 1 },
  ];

  const report = generateReport("test-target", true, "level-3", results);

  assert.equal(report.criteria.L1.result, "CONFORMANT");
  assert.equal(report.criteria.L2.result, "PARTIAL");
  assert.equal(report.criteria.L3.result, "CONFORMANT");
  assert.equal(report.overallResult, "L3 PARTIAL");
});
