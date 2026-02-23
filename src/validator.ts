/**
 * CKP Manifest Validator
 *
 * Validates a claw.yaml manifest against the CKP v0.2.0 specification.
 * Returns the detected conformance level and any validation errors.
 */

import { REQUIRED_FIELDS_BY_KIND, CONFORMANCE_REQUIREMENTS, type ConformanceLevel } from "./schemas.js";

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  conformanceLevel: ConformanceLevel | null;
  errors: ValidationError[];
  warnings: ValidationError[];
  primitivesSeen: string[];
}

/**
 * Validate a parsed claw.yaml manifest object.
 */
export function validateManifest(manifest: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const primitivesSeen: string[] = [];

  // Check top-level fields
  if (manifest.claw !== "0.2.0") {
    errors.push({
      path: "claw",
      message: `Expected protocol version "0.2.0", got "${manifest.claw}"`,
      severity: "error",
    });
  }

  if (manifest.kind !== "Claw") {
    errors.push({
      path: "kind",
      message: `Expected kind "Claw", got "${manifest.kind}"`,
      severity: "error",
    });
  }

  const metadata = manifest.metadata as Record<string, unknown> | undefined;
  if (!metadata || typeof metadata.name !== "string") {
    errors.push({
      path: "metadata.name",
      message: "metadata.name is REQUIRED and must be a string",
      severity: "error",
    });
  } else if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62})$/.test(metadata.name)) {
    errors.push({
      path: "metadata.name",
      message: `metadata.name "${metadata.name}" does not match kebab-case pattern`,
      severity: "error",
    });
  }

  const spec = manifest.spec as Record<string, unknown> | undefined;
  if (!spec) {
    errors.push({
      path: "spec",
      message: "spec is REQUIRED",
      severity: "error",
    });
    return { valid: false, conformanceLevel: null, errors, warnings, primitivesSeen };
  }

  // Validate Identity (REQUIRED)
  if (!spec.identity) {
    errors.push({
      path: "spec.identity",
      message: "spec.identity is REQUIRED",
      severity: "error",
    });
  } else {
    primitivesSeen.push("identity");
    validateInlinePrimitive(spec.identity, "Identity", "spec.identity", errors);
  }

  // Validate Providers (REQUIRED, at least one)
  if (!spec.providers || !Array.isArray(spec.providers) || spec.providers.length === 0) {
    errors.push({
      path: "spec.providers",
      message: "spec.providers is REQUIRED and must contain at least one entry",
      severity: "error",
    });
  } else {
    primitivesSeen.push("providers");
    for (let i = 0; i < spec.providers.length; i++) {
      validateInlinePrimitive(spec.providers[i], "Provider", `spec.providers[${i}]`, errors);
    }
  }

  // Validate optional primitives
  const optionalArrayPrimitives: [string, string][] = [
    ["channels", "Channel"],
    ["tools", "Tool"],
    ["skills", "Skill"],
    ["policies", "Policy"],
  ];

  for (const [key, kind] of optionalArrayPrimitives) {
    const val = spec[key];
    if (val !== undefined) {
      if (!Array.isArray(val)) {
        errors.push({
          path: `spec.${key}`,
          message: `spec.${key} must be an array`,
          severity: "error",
        });
      } else {
        primitivesSeen.push(key);
        for (let i = 0; i < val.length; i++) {
          validateInlinePrimitive(val[i], kind, `spec.${key}[${i}]`, errors);
        }
      }
    }
  }

  // Validate optional single primitives
  const optionalSinglePrimitives: [string, string][] = [
    ["memory", "Memory"],
    ["sandbox", "Sandbox"],
    ["swarm", "Swarm"],
  ];

  for (const [key, kind] of optionalSinglePrimitives) {
    if (spec[key] !== undefined) {
      primitivesSeen.push(key);
      validateInlinePrimitive(spec[key], kind, `spec.${key}`, errors);
    }
  }

  // Determine conformance level
  let conformanceLevel: ConformanceLevel | null = null;
  for (const level of ["level-3", "level-2", "level-1"] as ConformanceLevel[]) {
    const req = CONFORMANCE_REQUIREMENTS[level];
    const allPresent = req.requiredPrimitives.every(p => primitivesSeen.includes(p));
    if (allPresent) {
      conformanceLevel = level;
      break;
    }
  }

  if (!conformanceLevel && errors.length === 0) {
    // Has identity + providers but nothing else → level-1
    if (primitivesSeen.includes("identity") && primitivesSeen.includes("providers")) {
      conformanceLevel = "level-1";
    }
  }

  return {
    valid: errors.length === 0,
    conformanceLevel,
    errors,
    warnings,
    primitivesSeen,
  };
}

function validateInlinePrimitive(
  value: unknown,
  kind: string,
  path: string,
  errors: ValidationError[],
): void {
  // String references (file paths or claw:// URIs) are valid
  if (typeof value === "string") return;

  // Inline primitives
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    // Check for inline key
    const spec = obj.inline ?? obj.spec ?? obj;
    if (typeof spec !== "object" || spec === null) {
      errors.push({
        path,
        message: `Expected inline ${kind} spec to be an object`,
        severity: "error",
      });
      return;
    }

    // Validate required fields for this kind
    const required = REQUIRED_FIELDS_BY_KIND[kind] ?? [];
    for (const field of required) {
      if (!(field in (spec as Record<string, unknown>))) {
        errors.push({
          path: `${path}.${field}`,
          message: `${kind} requires field "${field}"`,
          severity: "error",
        });
      }
    }

    // Special validation for Tool (conditional requirements)
    if (kind === "Tool") {
      const toolSpec = spec as Record<string, unknown>;
      if (!toolSpec.mcp_source && (!toolSpec.description || !toolSpec.input_schema)) {
        errors.push({
          path,
          message: "Tool requires either mcp_source OR (description + input_schema)",
          severity: "error",
        });
      }
    }
  }
}
