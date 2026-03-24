/**
 * CKP Manifest Validator
 *
 * Validates a claw.yaml manifest against the CKP v0.2.0 / v0.3.0 specification.
 * Uses embedded JSON Schemas as the primary validation layer.
 * Returns the detected conformance level and any validation errors.
 */

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  DEFINITIONS_SCHEMA_V020,
  DEFINITIONS_SCHEMA_V030,
  CLAW_MANIFEST_SCHEMA_V020,
  CLAW_MANIFEST_SCHEMA_V030,
  SUPPORTED_PROTOCOL_VERSIONS,
  REQUIRED_FIELDS_BY_KIND,
  CONFORMANCE_REQUIREMENTS,
  type ConformanceLevel,
} from "./schemas.js";

// ── AJV Setup (Draft 2020-12) ───────────────────────────────────────────────

function createValidator(definitions: object, manifest: object) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(definitions);
  return ajv.compile(manifest);
}

const validateSchemaV020 = createValidator(DEFINITIONS_SCHEMA_V020, CLAW_MANIFEST_SCHEMA_V020);
const validateSchemaV030 = createValidator(DEFINITIONS_SCHEMA_V030, CLAW_MANIFEST_SCHEMA_V030);

// ── Types ───────────────────────────────────────────────────────────────────

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

// ── Main Validator ──────────────────────────────────────────────────────────

/**
 * Validate a parsed claw.yaml manifest object.
 */
export function validateManifest(manifest: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const primitivesSeen: string[] = [];
  const manifestVersion = typeof manifest.claw === "string" ? manifest.claw : "0.3.0";

  if (typeof manifest.claw === "string" && !(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(manifest.claw)) {
    errors.push({
      path: "claw",
      message: `Unsupported CKP version: ${manifest.claw}`,
      severity: "error",
    });
  }

  // ── Phase 1: AJV schema validation ──────────────────────────────────────

  const validateSchema = manifestVersion === "0.3.0" ? validateSchemaV030 : validateSchemaV020;
  const schemaValid = validateSchema(manifest);

  if (!schemaValid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      const path = err.instancePath ? err.instancePath.replace(/\//g, ".").slice(1) : "(root)";
      errors.push({
        path,
        message: err.message ?? "Schema validation failed",
        severity: "error",
      });
    }
  }

  // ── Phase 2: Supplemental checks (things JSON Schema can't express) ─────

  const spec = manifest.spec as Record<string, unknown> | undefined;
  if (!spec) {
    // AJV already caught this, but we need to bail early for primitives detection
    return { valid: false, conformanceLevel: null, errors, warnings, primitivesSeen };
  }

  // Track which primitives are present
  if (spec.identity !== undefined) primitivesSeen.push("identity");
  if (spec.providers !== undefined && Array.isArray(spec.providers) && spec.providers.length > 0) {
    primitivesSeen.push("providers");
  }

  const optionalArrayPrimitives = ["channels", "tools", "skills", "policies"];
  for (const key of optionalArrayPrimitives) {
    if (spec[key] !== undefined && Array.isArray(spec[key])) {
      primitivesSeen.push(key);
    }
  }

  if (spec.world_models !== undefined && Array.isArray(spec.world_models)) {
    primitivesSeen.push("world_models");
  }

  const optionalSinglePrimitives = ["memory", "sandbox", "swarm", "telemetry"];
  for (const key of optionalSinglePrimitives) {
    if (spec[key] !== undefined) {
      primitivesSeen.push(key);
    }
  }

  // Supplemental inline validation for inline primitives
  // (AJV handles structure; we check per-kind required fields for deeply nested inlines)
  validateInlinePrimitives(spec, errors);
  validateWorldModelReferences(spec, errors);

  // ── Phase 3: Determine conformance level ────────────────────────────────

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

// ── Supplemental Inline Validation ──────────────────────────────────────────

function validateInlinePrimitives(
  spec: Record<string, unknown>,
  errors: ValidationError[],
): void {
  // Validate tools with conditional requirement (mcp_source OR description+input_schema)
  if (spec.tools && Array.isArray(spec.tools)) {
    for (let i = 0; i < spec.tools.length; i++) {
      const tool = spec.tools[i];
      if (typeof tool === "object" && tool !== null) {
        const obj = tool as Record<string, unknown>;
        const toolSpec = (obj.inline ?? obj.spec ?? obj) as Record<string, unknown>;
        if (typeof toolSpec === "object" && toolSpec !== null) {
          if (!toolSpec.mcp_source && (!toolSpec.description || !toolSpec.input_schema)) {
            errors.push({
              path: `spec.tools[${i}]`,
              message: "Tool requires either mcp_source OR (description + input_schema)",
              severity: "error",
            });
          }
        }
      }
    }
  }

  // Validate inline providers have required fields
  if (spec.providers && Array.isArray(spec.providers)) {
    for (let i = 0; i < spec.providers.length; i++) {
      validateSingleInline(spec.providers[i], "Provider", `spec.providers[${i}]`, errors);
    }
  }

  // Validate inline identity
  if (spec.identity && typeof spec.identity === "object") {
    validateSingleInline(spec.identity, "Identity", "spec.identity", errors);
  }

  // Validate inline array primitives (Channel, Skill, Policy, WorldModel)
  // These supplement AJV — the manifest schema uses { "type": "object" } for inlines,
  // so AJV doesn't check required fields. We use REQUIRED_FIELDS_BY_KIND to fill the gap.
  const arrayPrimitives: Record<string, string> = {
    channels: "Channel",
    skills: "Skill",
    policies: "Policy",
    world_models: "WorldModel",
  };
  for (const [key, kind] of Object.entries(arrayPrimitives)) {
    const arr = spec[key];
    if (arr && Array.isArray(arr)) {
      for (let i = 0; i < arr.length; i++) {
        validateSingleInline(arr[i], kind, `spec.${key}[${i}]`, errors);

        // Channel-specific trigger checks for event-driven channel types.
        if (kind === "Channel") {
          validateEventDrivenChannelTrigger(arr[i], `spec.${key}[${i}]`, errors);
          validateChannelAccessControl(arr[i], `spec.${key}[${i}]`, errors);
        }
      }
    }
  }

  // Validate inline single primitives (Memory, Sandbox, Swarm, Telemetry)
  const singlePrimitives: Record<string, string> = { memory: "Memory", sandbox: "Sandbox", swarm: "Swarm", telemetry: "Telemetry" };
  for (const [key, kind] of Object.entries(singlePrimitives)) {
    if (spec[key] && typeof spec[key] === "object") {
      validateSingleInline(spec[key], kind, `spec.${key}`, errors);
    }
  }
}

function validateWorldModelReferences(
  spec: Record<string, unknown>,
  errors: ValidationError[],
): void {
  const declaredWorldModels = new Set<string>();

  if (Array.isArray(spec.world_models)) {
    for (let i = 0; i < spec.world_models.length; i++) {
      const item = spec.world_models[i];
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, unknown>;
      const worldModel = (obj.inline ?? obj.spec ?? obj) as Record<string, unknown>;
      if (typeof worldModel !== "object" || worldModel === null) continue;
      if (typeof worldModel.name === "string" && worldModel.name.length > 0) {
        declaredWorldModels.add(worldModel.name);
      }
    }
  }

  const hasMemory = spec.memory !== undefined;
  const hasPolicies = Array.isArray(spec.policies) && spec.policies.length > 0;

  if (Array.isArray(spec.skills)) {
    for (let i = 0; i < spec.skills.length; i++) {
      const item = spec.skills[i];
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, unknown>;
      const skill = (obj.inline ?? obj.spec ?? obj) as Record<string, unknown>;
      if (typeof skill !== "object" || skill === null) continue;
      if (
        typeof skill.world_model_ref === "string" &&
        skill.world_model_ref.length > 0 &&
        !declaredWorldModels.has(skill.world_model_ref)
      ) {
        errors.push({
          path: `spec.skills[${i}].world_model_ref`,
          message: `world_model_ref "${skill.world_model_ref}" does not match any declared world model`,
          severity: "error",
        });
      }
    }
  }

  if (Array.isArray(spec.world_models)) {
    for (let i = 0; i < spec.world_models.length; i++) {
      const item = spec.world_models[i];
      if (typeof item !== "object" || item === null) continue;
      const obj = item as Record<string, unknown>;
      const worldModel = (obj.inline ?? obj.spec ?? obj) as Record<string, unknown>;
      if (typeof worldModel !== "object" || worldModel === null) continue;

      if (typeof worldModel.memory_ref === "string" && worldModel.memory_ref.length > 0 && !hasMemory) {
        errors.push({
          path: `spec.world_models[${i}].memory_ref`,
          message: "memory_ref requires a declared Memory primitive",
          severity: "error",
        });
      }

      const constraints = worldModel.constraints;
      if (
        typeof constraints === "object" &&
        constraints !== null &&
        typeof (constraints as Record<string, unknown>).policy_ref === "string" &&
        !hasPolicies
      ) {
        errors.push({
          path: `spec.world_models[${i}].constraints.policy_ref`,
          message: "constraints.policy_ref requires at least one declared Policy primitive",
          severity: "error",
        });
      }
    }
  }
}

function validateChannelAccessControl(
  value: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (typeof value !== "object" || value === null) return;

  const obj = value as Record<string, unknown>;
  const channel = (obj.inline ?? obj.spec ?? obj) as Record<string, unknown>;
  if (typeof channel !== "object" || channel === null) return;

  const access = channel.access_control;
  if (typeof access !== "object" || access === null) return;

  const cfg = access as Record<string, unknown>;
  const mode = cfg.mode;
  if (mode === "allowlist" && "roles" in cfg) {
    errors.push({
      path: path + ".access_control.roles",
      message: 'access_control.roles MUST NOT be present when mode is "allowlist"',
      severity: "error",
    });
  }
  if (mode === "role-based" && "allowed_ids" in cfg) {
    errors.push({
      path: path + ".access_control.allowed_ids",
      message: 'access_control.allowed_ids MUST NOT be present when mode is "role-based"',
      severity: "error",
    });
  }
}

function validateEventDrivenChannelTrigger(
  value: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (typeof value !== "object" || value === null) return;

  const obj = value as Record<string, unknown>;
  const channel = (obj.inline ?? obj.spec ?? obj) as Record<string, unknown>;
  if (typeof channel !== "object" || channel === null) return;

  const type = channel.type;
  if (typeof type !== "string") return;

  const eventDrivenType = type === "cron" || type === "queue" || type === "imap" || type === "db-trigger";
  if (!eventDrivenType) return;

  const trigger = channel.trigger;
  if (typeof trigger !== "object" || trigger === null) {
    errors.push({
      path: path + ".trigger",
      message: "Channel type \"" + type + "\" should define a trigger block",
      severity: "error",
    });
    return;
  }

  const t = trigger as Record<string, unknown>;
  const requiredByType: Record<string, string> = {
    cron: "schedule",
    queue: "queue_name",
    imap: "mailbox",
    "db-trigger": "table",
  };

  const requiredField = requiredByType[type];
  if (requiredField && !(requiredField in t)) {
    errors.push({
      path: path + ".trigger." + requiredField,
      message: "Channel type \"" + type + "\" requires trigger." + requiredField,
      severity: "error",
    });
  }

  if ("max_parallel" in t) {
    const mp = t.max_parallel;
    if (typeof mp !== "number" || !Number.isInteger(mp) || mp < 1) {
      errors.push({
        path: path + ".trigger.max_parallel",
        message: "trigger.max_parallel must be an integer >= 1",
        severity: "error",
      });
    }
  }

  if ("overlap_policy" in t) {
    const op = t.overlap_policy;
    if (op !== "skip" && op !== "queue" && op !== "allow") {
      errors.push({
        path: path + ".trigger.overlap_policy",
        message: 'trigger.overlap_policy must be one of: "skip", "queue", "allow"',
        severity: "error",
      });
    }
  }
}

function validateSingleInline(
  value: unknown,
  kind: string,
  path: string,
  errors: ValidationError[],
): void {
  // String references are valid
  if (typeof value === "string") return;

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const spec = (obj.inline ?? obj.spec ?? obj) as Record<string, unknown>;
    if (typeof spec !== "object" || spec === null) return;

    // Check required fields for this kind
    const required = REQUIRED_FIELDS_BY_KIND[kind] ?? [];
    for (const field of required) {
      if (!(field in spec)) {
        errors.push({
          path: `${path}.${field}`,
          message: `${kind} requires field "${field}"`,
          severity: "error",
        });
      }
    }
  }
}
