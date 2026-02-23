/**
 * CKP Conformance Test Runner
 *
 * Runs test vectors against a target agent via JSON-RPC over stdio.
 * Supports skip policy and conformance exit criteria.
 */

import { spawn } from "node:child_process";
import { type ConformanceLevel } from "./schemas.js";
import { validateManifest } from "./validator.js";

// ── Test Vector Definitions ────────────────────────────────────────────────

export type VectorStatus = "pass" | "fail" | "skip" | "error";

export interface TestVector {
  id: string;
  level: "L1" | "L2" | "L3";
  title: string;
  description: string;
  /** JSON-RPC request to send (or null for manifest-only vectors). */
  request: Record<string, unknown> | null;
  /** Inline manifest data for manifest validation vectors. */
  manifestData?: Record<string, unknown>;
  /** Raw string to send as-is (for parse error testing). */
  rawRequest?: string;
  /** Expected behavior. */
  expected: {
    type: "success" | "error" | "notification" | "manifest-valid" | "manifest-invalid";
    /** For error responses: expected error code. */
    errorCode?: number;
    /** Fields that MUST be present in the response result. */
    requiredFields?: string[];
    /** Custom validation function description. */
    check?: string;
  };
  /** Normative spec section reference. */
  reference: string;
}

export interface VectorResult {
  vector: TestVector;
  status: VectorStatus;
  actual?: unknown;
  error?: string;
  skipReason?: string;
  durationMs: number;
}

// ── Skip Policy ────────────────────────────────────────────────────────────

export interface SkipPolicy {
  /**
   * Map of vector IDs to skip reasons.
   * A vector may be skipped ONLY if:
   *   1. The feature is documented as "Not supported" in the compatibility table
   *   2. The skip reason references a specific limitation
   *   3. Skipped vectors appear in the report as SKIP (not hidden)
   */
  skippedVectors: Record<string, string>;
}

// ── Exit Criteria ──────────────────────────────────────────────────────────

export interface ConformanceCriteria {
  level: ConformanceLevel;
  totalVectors: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  result: "CONFORMANT" | "PARTIAL" | "NON-CONFORMANT";
}

export function evaluateCriteria(results: VectorResult[], level: "L1" | "L2" | "L3"): ConformanceCriteria {
  const levelVectors = results.filter(r => r.vector.level === level);
  const passed = levelVectors.filter(r => r.status === "pass").length;
  const failed = levelVectors.filter(r => r.status === "fail").length;
  const skipped = levelVectors.filter(r => r.status === "skip").length;
  const errors = levelVectors.filter(r => r.status === "error").length;
  const total = levelVectors.length;

  let result: "CONFORMANT" | "PARTIAL" | "NON-CONFORMANT";
  if (total === 0) {
    result = "NON-CONFORMANT"; // No vectors = not tested
  } else if (failed === 0 && errors === 0 && skipped === 0) {
    result = "CONFORMANT";
  } else if (failed === 0 && errors === 0 && skipped > 0) {
    // Skips present → never "CONFORMANT", always "PARTIAL"
    result = "PARTIAL";
  } else {
    result = "NON-CONFORMANT";
  }

  const conformanceMap: Record<string, ConformanceLevel> = {
    L1: "level-1",
    L2: "level-2",
    L3: "level-3",
  };

  return {
    level: conformanceMap[level]!,
    totalVectors: total,
    passed,
    failed,
    skipped,
    errors,
    result,
  };
}

// ── JSON-RPC Client ────────────────────────────────────────────────────────

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Send a JSON-RPC request over a transport and return the response.
 * For stdio transport: write to stdin, read from stdout.
 */
export async function sendJsonRpc(
  transport: StdioTransport,
  request: Record<string, unknown>,
  timeoutMs: number = 10000,
): Promise<JsonRpcResponse> {
  return transport.send(request, timeoutMs);
}

export interface StdioTransport {
  send(request: Record<string, unknown>, timeoutMs: number): Promise<JsonRpcResponse>;
  sendRaw(raw: string, timeoutMs: number): Promise<JsonRpcResponse>;
  close(): void;
}

/**
 * Create a stdio transport that communicates with a child process.
 */
export function createStdioTransport(command: string, args: string[] = []): StdioTransport {
  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";

  function waitForResponse(timeoutMs: number, label: string): Promise<JsonRpcResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`JSON-RPC ${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const onData = (data: Buffer) => {
        buffer += data.toString();
        // Try to parse complete JSON-RPC response
        const lines = buffer.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!.trim();
          if (!line) continue;
          try {
            const response = JSON.parse(line) as JsonRpcResponse;
            clearTimeout(timer);
            child.stdout!.removeListener("data", onData);
            buffer = lines.slice(i + 1).join("\n");
            resolve(response);
            return;
          } catch {
            // Not complete JSON yet, continue
          }
        }
      };

      child.stdout!.on("data", onData);
    });
  }

  return {
    send(request: Record<string, unknown>, timeoutMs: number): Promise<JsonRpcResponse> {
      const promise = waitForResponse(timeoutMs, "request");
      child.stdin!.write(JSON.stringify(request) + "\n");
      return promise;
    },

    sendRaw(raw: string, timeoutMs: number): Promise<JsonRpcResponse> {
      const promise = waitForResponse(timeoutMs, "raw request");
      child.stdin!.write(raw + "\n");
      return promise;
    },

    close() {
      child.kill();
    },
  };
}

// ── Test Vector Runner ─────────────────────────────────────────────────────

export async function runVector(
  vector: TestVector,
  transport: StdioTransport | null,
  skipPolicy: SkipPolicy,
): Promise<VectorResult> {
  const start = Date.now();

  // Check skip policy
  if (skipPolicy.skippedVectors[vector.id]) {
    return {
      vector,
      status: "skip",
      skipReason: skipPolicy.skippedVectors[vector.id],
      durationMs: Date.now() - start,
    };
  }

  // Manifest validation vectors — validate inline manifestData
  if (!vector.request && !vector.rawRequest) {
    if (vector.manifestData) {
      const validation = validateManifest(vector.manifestData);
      if (vector.expected.type === "manifest-valid") {
        return {
          vector,
          status: validation.valid ? "pass" : "fail",
          actual: { valid: validation.valid, errors: validation.errors },
          error: validation.valid ? undefined : `Expected valid manifest but got ${validation.errors.length} errors`,
          durationMs: Date.now() - start,
        };
      }
      if (vector.expected.type === "manifest-invalid") {
        return {
          vector,
          status: !validation.valid ? "pass" : "fail",
          actual: { valid: validation.valid, errors: validation.errors },
          error: !validation.valid ? undefined : "Expected invalid manifest but validation passed",
          durationMs: Date.now() - start,
        };
      }
    }
    // No manifestData and no request — skip as scenario/manual vector
    return {
      vector,
      status: "skip",
      skipReason: "Scenario-based vector: requires orchestrated test (no inline validation possible)",
      durationMs: Date.now() - start,
    };
  }

  // Raw request vectors (e.g., parse error testing)
  if (vector.rawRequest) {
    if (!transport) {
      return {
        vector,
        status: "skip",
        skipReason: "No transport configured (manifest-only mode)",
        durationMs: Date.now() - start,
      };
    }
    try {
      const response = await transport.sendRaw(vector.rawRequest, 5000);
      if (vector.expected.type === "error" && response.error) {
        if (vector.expected.errorCode !== undefined && response.error.code !== vector.expected.errorCode) {
          return {
            vector,
            status: "fail",
            actual: response.error,
            error: `Expected error code ${vector.expected.errorCode} but got ${response.error.code}`,
            durationMs: Date.now() - start,
          };
        }
        return { vector, status: "pass", actual: response.error, durationMs: Date.now() - start };
      }
      return {
        vector,
        status: "fail",
        actual: response,
        error: `Expected error but got: ${JSON.stringify(response)}`,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        vector,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  // Transport-based vectors
  if (!transport) {
    return {
      vector,
      status: "skip",
      skipReason: "No transport configured (manifest-only mode)",
      durationMs: Date.now() - start,
    };
  }

  try {
    // Notifications have no id → no response expected
    if (!("id" in vector.request!)) {
      await transport.send(vector.request!, 5000).catch(() => {
        // Notifications don't expect responses
      });
      return {
        vector,
        status: "pass",
        durationMs: Date.now() - start,
      };
    }

    const response = await sendJsonRpc(transport, vector.request!);

    // Validate response
    if (vector.expected.type === "success") {
      if (response.error) {
        return {
          vector,
          status: "fail",
          actual: response.error,
          error: `Expected success but got error: ${response.error.message}`,
          durationMs: Date.now() - start,
        };
      }
      // Check required fields
      if (vector.expected.requiredFields && response.result) {
        const result = response.result as Record<string, unknown>;
        for (const field of vector.expected.requiredFields) {
          if (!(field in result)) {
            return {
              vector,
              status: "fail",
              actual: response.result,
              error: `Missing required field "${field}" in response result`,
              durationMs: Date.now() - start,
            };
          }
        }
      }
      return {
        vector,
        status: "pass",
        actual: response.result,
        durationMs: Date.now() - start,
      };
    }

    if (vector.expected.type === "error") {
      if (!response.error) {
        return {
          vector,
          status: "fail",
          actual: response.result,
          error: `Expected error code ${vector.expected.errorCode} but got success`,
          durationMs: Date.now() - start,
        };
      }
      if (vector.expected.errorCode !== undefined && response.error.code !== vector.expected.errorCode) {
        return {
          vector,
          status: "fail",
          actual: response.error,
          error: `Expected error code ${vector.expected.errorCode} but got ${response.error.code}`,
          durationMs: Date.now() - start,
        };
      }
      return {
        vector,
        status: "pass",
        actual: response.error,
        durationMs: Date.now() - start,
      };
    }

    return {
      vector,
      status: "pass",
      actual: response,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      vector,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

// ── Report Generator ───────────────────────────────────────────────────────

export interface ConformanceReport {
  harness: string;
  version: string;
  timestamp: string;
  target: string;
  manifestValid: boolean;
  detectedLevel: string | null;
  results: VectorResult[];
  criteria: {
    L1: ConformanceCriteria;
    L2: ConformanceCriteria;
    L3: ConformanceCriteria;
  };
  overallResult: string;
}

export function generateReport(
  target: string,
  manifestValid: boolean,
  detectedLevel: string | null,
  results: VectorResult[],
): ConformanceReport {
  const criteria = {
    L1: evaluateCriteria(results, "L1"),
    L2: evaluateCriteria(results, "L2"),
    L3: evaluateCriteria(results, "L3"),
  };

  // Overall result: highest conformant level
  let overallResult = "NON-CONFORMANT";
  if (criteria.L3.result === "CONFORMANT") overallResult = "L3 CONFORMANT";
  else if (criteria.L3.result === "PARTIAL") overallResult = "L3 PARTIAL";
  else if (criteria.L2.result === "CONFORMANT") overallResult = "L2 CONFORMANT";
  else if (criteria.L2.result === "PARTIAL") overallResult = "L2 PARTIAL";
  else if (criteria.L1.result === "CONFORMANT") overallResult = "L1 CONFORMANT";
  else if (criteria.L1.result === "PARTIAL") overallResult = "L1 PARTIAL";

  return {
    harness: "@clawkernel/ckp-test",
    version: "0.2.0",
    timestamp: new Date().toISOString(),
    target,
    manifestValid,
    detectedLevel,
    results,
    criteria,
    overallResult,
  };
}

export function formatReport(report: ConformanceReport): string {
  const lines: string[] = [];

  lines.push("# CKP Conformance Report");
  lines.push("");
  lines.push(`**Harness:** ${report.harness} v${report.version}`);
  lines.push(`**Date:** ${report.timestamp}`);
  lines.push(`**Target:** ${report.target}`);
  lines.push(`**Manifest:** ${report.manifestValid ? "VALID" : "INVALID"}`);
  lines.push(`**Detected Level:** ${report.detectedLevel ?? "N/A"}`);
  lines.push(`**Overall:** ${report.overallResult}`);
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push("| Level | Total | Pass | Fail | Skip | Error | Result |");
  lines.push("|-------|-------|------|------|------|-------|--------|");
  for (const [level, c] of Object.entries(report.criteria)) {
    lines.push(`| ${level} | ${c.totalVectors} | ${c.passed} | ${c.failed} | ${c.skipped} | ${c.errors} | **${c.result}** |`);
  }
  lines.push("");

  // Detailed results
  lines.push("## Detailed Results");
  lines.push("");
  for (const level of ["L1", "L2", "L3"] as const) {
    const levelResults = report.results.filter(r => r.vector.level === level);
    if (levelResults.length === 0) continue;

    lines.push(`### Level ${level.charAt(1)}`);
    lines.push("");
    for (const r of levelResults) {
      const icon = r.status === "pass" ? "\u2713" : r.status === "fail" ? "\u2717" : r.status === "skip" ? "\u2014" : "!";
      const extra = r.status === "skip" ? ` (${r.skipReason})` : r.status === "fail" ? ` \u2014 ${r.error}` : "";
      lines.push(`- ${icon} **${r.vector.id}** ${r.vector.title}${extra} (${r.durationMs}ms)`);
    }
    lines.push("");
  }

  // Skip policy
  const skipped = report.results.filter(r => r.status === "skip");
  if (skipped.length > 0) {
    lines.push("## Skip Justifications");
    lines.push("");
    lines.push("| Vector | Reason |");
    lines.push("|--------|--------|");
    for (const r of skipped) {
      lines.push(`| ${r.vector.id} | ${r.skipReason ?? "No reason provided"} |`);
    }
    lines.push("");
    lines.push("> **Policy:** Skipped vectors result in PARTIAL, never CONFORMANT.");
    lines.push("");
  }

  lines.push("---");
  lines.push("*Generated by @clawkernel/ckp-test*");

  return lines.join("\n");
}
