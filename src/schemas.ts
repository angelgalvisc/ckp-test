/**
 * Embedded JSON Schemas for CKP v0.2.0 validation.
 * These are copies of the schemas from clawkernel/schema/0.2.0/.
 * When validating, the harness uses these embedded schemas so it works standalone.
 */

export const DEFINITIONS_SCHEMA = {
  $defs: {
    semver: {
      type: "string",
      pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(-.+)?$",
    },
    protocolVersion: { type: "string", const: "0.2.0" },
    kebabName: {
      type: "string",
      pattern: "^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62})$",
    },
    metadata: {
      type: "object",
      properties: {
        name: { $ref: "#/$defs/kebabName" },
        version: { $ref: "#/$defs/semver" },
        labels: { type: "object", additionalProperties: { type: "string" } },
        annotations: { type: "object", additionalProperties: true },
      },
      required: ["name"],
    },
    secretRef: { type: "string", minLength: 1 },
    durationString: { type: "string", pattern: "^[0-9]+(s|m|h|d)$" },
    kind: {
      type: "string",
      enum: [
        "Identity", "Provider", "Channel", "Tool", "Skill",
        "Memory", "Sandbox", "Policy", "Swarm", "Claw",
      ],
    },
  },
} as const;

// Minimal schemas per kind for manifest validation (inline specs)
export const REQUIRED_FIELDS_BY_KIND: Record<string, string[]> = {
  Identity: ["personality"],
  Provider: ["protocol", "endpoint", "model", "auth"],
  Channel: ["type", "transport", "auth"],
  Tool: [], // conditional: description+input_schema OR mcp_source
  Skill: ["description", "tools_required", "instruction"],
  Memory: ["stores"],
  Sandbox: ["level"],
  Policy: ["rules"],
  Swarm: ["topology", "agents", "coordination", "aggregation"],
};

// Conformance level requirements
export const CONFORMANCE_REQUIREMENTS = {
  "level-1": {
    requiredPrimitives: ["identity", "providers"],
    methods: [
      "claw.initialize", "claw.status", "claw.shutdown", "claw.heartbeat",
    ],
  },
  "level-2": {
    requiredPrimitives: ["identity", "providers", "channels", "tools", "sandbox", "policies"],
    methods: [
      "claw.initialize", "claw.status", "claw.shutdown", "claw.heartbeat",
      "claw.tool.call", "claw.tool.approve", "claw.tool.deny",
    ],
  },
  "level-3": {
    requiredPrimitives: [
      "identity", "providers", "channels", "tools", "skills",
      "memory", "sandbox", "policies", "swarm",
    ],
    methods: [
      "claw.initialize", "claw.status", "claw.shutdown", "claw.heartbeat",
      "claw.tool.call", "claw.tool.approve", "claw.tool.deny",
      "claw.swarm.delegate", "claw.swarm.report", "claw.swarm.broadcast", "claw.swarm.discover",
      "claw.memory.query", "claw.memory.store", "claw.memory.compact",
    ],
  },
} as const;

export type ConformanceLevel = keyof typeof CONFORMANCE_REQUIREMENTS;
