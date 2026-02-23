#!/usr/bin/env node

/**
 * ckp-test CLI — CKP Conformance Test Harness
 *
 * Usage:
 *   ckp-test validate <claw.yaml>            Validate manifest, detect conformance level
 *   ckp-test run --target <command>           Run all test vectors against a target
 *   ckp-test run --manifest-only <claw.yaml>  Run manifest-only vectors (no target needed)
 *   ckp-test vectors                          List all test vectors
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { validateManifest } from "./validator.js";
import {
  runVector,
  generateReport,
  formatReport,
  createStdioTransport,
  type SkipPolicy,
} from "./runner.js";
import { TEST_VECTORS } from "./vectors.js";

async function bootstrapSession(transport: ReturnType<typeof createStdioTransport>): Promise<boolean> {
  const bootstrapInitialize = {
    jsonrpc: "2.0",
    id: "ckp-bootstrap",
    method: "claw.initialize",
    params: {
      protocolVersion: "0.2.0",
      clientInfo: { name: "ckp-test", version: "0.2.0" },
      manifest: {
        kind: "Claw",
        metadata: { name: "ckp-bootstrap" },
        spec: {
          identity: { inline: { personality: "Bootstrap session for conformance testing." } },
          providers: [
            {
              inline: {
                protocol: "openai-compatible",
                endpoint: "http://localhost:11434/v1",
                model: "bootstrap-model",
                auth: { type: "none" },
              },
            },
          ],
        },
      },
      capabilities: { tools: {}, swarm: {}, memory: {} },
    },
  };

  try {
    const response = await transport.send(bootstrapInitialize, 5000);
    return !response.error;
  } catch {
    return false;
  }
}

// ── YAML parser (simple, no dependency for manifest parsing) ───────────────

function parseYaml(content: string): Record<string, unknown> {
  // Use the yaml package if available, otherwise try JSON
  try {
    // Dynamic import for yaml
    const yaml = require("yaml");
    return yaml.parse(content) as Record<string, unknown>;
  } catch {
    // Fallback: try JSON
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error("Failed to parse manifest. Ensure 'yaml' package is installed for YAML support.");
    }
  }
}

// ── Commands ───────────────────────────────────────────────────────────────

async function cmdValidate(manifestPath: string): Promise<void> {
  const content = fs.readFileSync(manifestPath, "utf-8");
  const manifest = parseYaml(content);
  const result = validateManifest(manifest);

  console.log("");
  console.log("CKP Manifest Validation");
  console.log("=======================");
  console.log(`File: ${manifestPath}`);
  console.log(`Valid: ${result.valid ? "\u2713 YES" : "\u2717 NO"}`);
  console.log(`Conformance Level: ${result.conformanceLevel ?? "N/A"}`);
  console.log(`Primitives: ${result.primitivesSeen.join(", ")}`);

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const err of result.errors) {
      console.log(`  \u2717 [${err.path}] ${err.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const w of result.warnings) {
      console.log(`  ! [${w.path}] ${w.message}`);
    }
  }

  console.log("");
  process.exit(result.valid ? 0 : 1);
}

async function cmdRun(options: {
  target?: string;
  manifestPath?: string;
  skipFile?: string;
  output?: string;
  level?: string;
}): Promise<void> {
  // Load skip policy
  const skipPolicy: SkipPolicy = { skippedVectors: {} };
  if (options.skipFile) {
    const skipContent = fs.readFileSync(options.skipFile, "utf-8");
    const parsed = JSON.parse(skipContent) as Record<string, string>;
    skipPolicy.skippedVectors = parsed;
  }

  // Filter vectors by level if specified
  let vectors = TEST_VECTORS;
  if (options.level) {
    const levelMap: Record<string, string> = { "1": "L1", "2": "L2", "3": "L3" };
    const lvl = levelMap[options.level] ?? options.level.toUpperCase();
    vectors = vectors.filter(v => v.level === lvl);
  }

  // Create transport if target specified
  let transport = null;
  if (options.target) {
    const parts = options.target.split(" ");
    transport = createStdioTransport(parts[0]!, parts.slice(1));
  }

  // Validate manifest if provided
  let manifestValid = true;
  let detectedLevel: string | null = null;
  if (options.manifestPath) {
    const content = fs.readFileSync(options.manifestPath, "utf-8");
    const manifest = parseYaml(content);
    const validation = validateManifest(manifest);
    manifestValid = validation.valid;
    detectedLevel = validation.conformanceLevel;
  }

  // Run vectors
  console.log("");
  console.log("CKP Conformance Test Runner v0.2.0");
  console.log("===================================");
  if (options.target) console.log(`Target: ${options.target}`);
  if (options.manifestPath) console.log(`Manifest: ${options.manifestPath}`);
  console.log(`Vectors: ${vectors.length}`);
  console.log("");

  const results = [];
  let sessionInitialized = false;
  for (const vector of vectors) {
    const method = (vector.request && typeof vector.request.method === "string")
      ? vector.request.method
      : null;

    // Ensure session bootstrap for vectors that require an initialized runtime.
    if (transport && method && method !== "claw.initialize" && !sessionInitialized) {
      sessionInitialized = await bootstrapSession(transport);
    }

    const result = await runVector(vector, transport, skipPolicy);
    const icon = result.status === "pass" ? "✓" :
                 result.status === "fail" ? "✗" :
                 result.status === "skip" ? "—" : "!";
    console.log(`  ${icon} ${vector.id}  ${vector.title}  (${result.durationMs}ms)`);
    if (result.status === "fail" && result.error) {
      console.log(`    └─ ${result.error}`);
    }
    if (result.status === "skip" && result.skipReason) {
      console.log(`    └─ Skip: ${result.skipReason}`);
    }

    if (method === "claw.initialize" && result.status === "pass") {
      sessionInitialized = true;
    }
    if (method === "claw.shutdown" && result.status === "pass") {
      sessionInitialized = false;
    }

    results.push(result);
  }

  // Generate report
  const report = generateReport(
    options.target ?? options.manifestPath ?? "unknown",
    manifestValid,
    detectedLevel,
    results,
  );

  console.log("");
  console.log("Results:");
  console.log(`  L1: ${report.criteria.L1.passed}/${report.criteria.L1.totalVectors} pass \u2014 ${report.criteria.L1.result}`);
  console.log(`  L2: ${report.criteria.L2.passed}/${report.criteria.L2.totalVectors} pass \u2014 ${report.criteria.L2.result}`);
  console.log(`  L3: ${report.criteria.L3.passed}/${report.criteria.L3.totalVectors} pass \u2014 ${report.criteria.L3.result}`);
  console.log("");
  console.log(`Overall: ${report.overallResult}`);
  console.log("");

  // Write report file
  if (options.output) {
    const ext = path.extname(options.output);
    if (ext === ".json") {
      fs.writeFileSync(options.output, JSON.stringify(report, null, 2));
    } else {
      fs.writeFileSync(options.output, formatReport(report));
    }
    console.log(`Report written to: ${options.output}`);
  }

  // Clean up
  if (transport) transport.close();

  // Exit code: 0 if result is CONFORMANT or PARTIAL for the requested scope.
  // --level N  → check that specific level's result
  // no --level → check overallResult
  let exitCode = 1;
  if (options.level) {
    const levelKey = `L${options.level}` as keyof typeof report.criteria;
    const levelResult = report.criteria[levelKey]?.result;
    if (levelResult === "CONFORMANT" || levelResult === "PARTIAL") {
      exitCode = 0;
    }
  } else {
    // Full suite: exit 0 if overall is anything other than NON-CONFORMANT
    if (report.overallResult !== "NON-CONFORMANT") {
      exitCode = 0;
    }
  }
  process.exit(exitCode);
}

function cmdVectors(): void {
  console.log("");
  console.log("CKP v0.2.0 Test Vectors (31 total)");
  console.log("====================================");
  console.log("");

  for (const level of ["L1", "L2", "L3"] as const) {
    const levelVectors = TEST_VECTORS.filter(v => v.level === level);
    console.log(`Level ${level.charAt(1)} (${levelVectors.length} vectors):`);
    for (const v of levelVectors) {
      const type = v.request ? (v.expected.type === "error" ? "must-fail" : "must-pass") : "manifest";
      console.log(`  ${v.id}  ${v.title}  [${type}]`);
    }
    console.log("");
  }
}

// ── CLI Entry Point ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  console.log(`
ckp-test — CKP Conformance Test Harness v0.2.0

Usage:
  ckp-test validate <claw.yaml>
    Validate a manifest and detect conformance level.

  ckp-test run [options]
    Run conformance test vectors.

    Options:
      --target <command>      Target agent command (stdio transport)
      --manifest <claw.yaml>  Manifest file to validate
      --skip <skips.json>     Skip policy file (vector_id → reason)
      --output <file>         Write report (.md or .json)
      --level <1|2|3>         Run only vectors for specific level

  ckp-test vectors
    List all test vectors.

Conformance Criteria:
  CONFORMANT:     All vectors pass, 0 skips
  PARTIAL:        All vectors pass or skip, 0 failures (skips present)
  NON-CONFORMANT: Any vector fails

Skip Policy:
  Provide a JSON file mapping vector IDs to skip reasons:
  { "TV-L3-01": "Swarm not implemented" }
  Skipped vectors → PARTIAL, never CONFORMANT.
`);
  process.exit(0);
}

if (command === "validate") {
  const manifestPath = args[1];
  if (!manifestPath) {
    console.error("Error: manifest path required. Usage: ckp-test validate <claw.yaml>");
    process.exit(1);
  }
  cmdValidate(manifestPath);
} else if (command === "run") {
  const options: {
    target?: string;
    manifestPath?: string;
    skipFile?: string;
    output?: string;
    level?: string;
  } = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--target" && args[i + 1]) {
      options.target = args[++i];
    } else if (args[i] === "--manifest" && args[i + 1]) {
      options.manifestPath = args[++i];
    } else if ((args[i] === "--skip") && args[i + 1]) {
      options.skipFile = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      options.output = args[++i];
    } else if (args[i] === "--level" && args[i + 1]) {
      options.level = args[++i];
    } else if (args[i] === "--manifest-only" && args[i + 1]) {
      options.manifestPath = args[++i];
    }
  }

  cmdRun(options);
} else if (command === "vectors") {
  cmdVectors();
} else {
  console.error(`Unknown command: ${command}. Use --help for usage.`);
  process.exit(1);
}
