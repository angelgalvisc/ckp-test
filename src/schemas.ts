// Snapshot of clawkernel/schema/0.2.0/ — sync on CKP version bump

/**
 * Embedded JSON Schemas for CKP v0.2.0 validation.
 * These are copies of the schemas from clawkernel/schema/0.2.0/.
 * When validating, the harness uses these embedded schemas so it works standalone.
 *
 * Usage with AJV:
 *   1. ajv.addSchema(DEFINITIONS_SCHEMA)
 *   2. const validate = ajv.compile(CLAW_MANIFEST_SCHEMA)
 */

// ── Definitions Schema ─────────────────────────────────────────────────────

export const DEFINITIONS_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "definitions.schema.json",
  title: "CKP Common Definitions",
  description: "Shared definitions for Claw Kernel Protocol v0.2.0 schemas.",
  $defs: {
    semver: {
      type: "string",
      pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+(-.+)?$",
    },
    protocolVersion: {
      type: "string",
      const: "0.2.0",
    },
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
        "Identity",
        "Provider",
        "Channel",
        "Tool",
        "Skill",
        "Memory",
        "Sandbox",
        "Policy",
        "Swarm",
        "Claw",
      ],
    },
  },
} as const;

// ── Claw Manifest Schema (root) ────────────────────────────────────────────

export const CLAW_MANIFEST_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "claw.schema.json",
  title: "CKP Claw Manifest",
  description: "Root manifest schema for Claw Kernel Protocol v0.2.0.",
  type: "object",
  properties: {
    claw: { $ref: "definitions.schema.json#/$defs/protocolVersion" },
    kind: { const: "Claw" },
    metadata: {
      type: "object",
      properties: {
        name: { $ref: "definitions.schema.json#/$defs/kebabName" },
        version: { $ref: "definitions.schema.json#/$defs/semver" },
        description: { type: "string" },
        labels: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        annotations: { type: "object", additionalProperties: true },
      },
      required: ["name"],
    },
    spec: {
      type: "object",
      properties: {
        identity: {
          description:
            "REQUIRED. File path, claw:// URI, or inline Identity primitive.",
          oneOf: [
            { type: "string", minLength: 1 },
            {
              type: "object",
              properties: {
                inline: {
                  type: "object",
                  properties: {
                    personality: { type: "string", minLength: 1 },
                    context_files: {
                      type: "object",
                      additionalProperties: { type: "string" },
                    },
                    locale: { type: "string" },
                    capabilities: {
                      type: "array",
                      items: { type: "string" },
                    },
                    autonomy: {
                      type: "string",
                      enum: ["observer", "supervised", "autonomous"],
                    },
                  },
                  required: ["personality"],
                },
              },
              required: ["inline"],
            },
          ],
        },
        providers: {
          type: "array",
          minItems: 1,
          items: {
            oneOf: [
              { type: "string", minLength: 1 },
              {
                type: "object",
                properties: {
                  inline: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      protocol: {
                        type: "string",
                        enum: [
                          "openai-compatible",
                          "anthropic-native",
                          "custom",
                        ],
                      },
                      endpoint: { type: "string", format: "uri" },
                      model: { type: "string", minLength: 1 },
                      auth: {
                        type: "object",
                        properties: {
                          type: {
                            type: "string",
                            enum: [
                              "bearer",
                              "api-key-header",
                              "oauth2",
                              "none",
                            ],
                          },
                          secret_ref: { type: "string" },
                        },
                        required: ["type"],
                      },
                      streaming: { type: "boolean" },
                      hints: { type: "object" },
                      fallback: { type: "array" },
                      limits: { type: "object" },
                      retry: { type: "object" },
                    },
                    required: ["protocol", "endpoint", "model", "auth"],
                  },
                },
                required: ["inline"],
              },
            ],
          },
        },
        channels: {
          type: "array",
          items: {
            oneOf: [
              { type: "string", minLength: 1 },
              { type: "object" },
            ],
          },
        },
        tools: {
          type: "array",
          items: {
            oneOf: [
              { type: "string", minLength: 1 },
              { type: "object" },
            ],
          },
        },
        skills: {
          type: "array",
          items: {
            oneOf: [
              { type: "string", minLength: 1 },
              { type: "object" },
            ],
          },
        },
        memory: {
          oneOf: [
            { type: "string", minLength: 1 },
            { type: "object" },
          ],
        },
        sandbox: {
          oneOf: [
            { type: "string", minLength: 1 },
            { type: "object" },
          ],
        },
        policies: {
          type: "array",
          items: {
            oneOf: [
              { type: "string", minLength: 1 },
              { type: "object" },
            ],
          },
        },
        swarm: {
          oneOf: [
            { type: "string", minLength: 1 },
            { type: "object" },
          ],
        },
      },
      required: ["identity", "providers"],
      additionalProperties: false,
    },
  },
  required: ["claw", "kind", "metadata", "spec"],
  additionalProperties: false,
} as const;

// ── Per-kind Required Fields (for supplemental inline validation) ───────────

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

// ── Conformance Level Requirements ─────────────────────────────────────────

export const CONFORMANCE_REQUIREMENTS = {
  "level-1": {
    requiredPrimitives: ["identity", "providers"],
    methods: [
      "claw.initialize",
      "claw.status",
      "claw.shutdown",
      "claw.heartbeat",
    ],
  },
  "level-2": {
    requiredPrimitives: [
      "identity",
      "providers",
      "channels",
      "tools",
      "sandbox",
      "policies",
    ],
    methods: [
      "claw.initialize",
      "claw.status",
      "claw.shutdown",
      "claw.heartbeat",
      "claw.tool.call",
      "claw.tool.approve",
      "claw.tool.deny",
    ],
  },
  "level-3": {
    requiredPrimitives: [
      "identity",
      "providers",
      "channels",
      "tools",
      "skills",
      "memory",
      "sandbox",
      "policies",
      "swarm",
    ],
    methods: [
      "claw.initialize",
      "claw.status",
      "claw.shutdown",
      "claw.heartbeat",
      "claw.tool.call",
      "claw.tool.approve",
      "claw.tool.deny",
      "claw.swarm.delegate",
      "claw.swarm.report",
      "claw.swarm.broadcast",
      "claw.swarm.discover",
      "claw.memory.query",
      "claw.memory.store",
      "claw.memory.compact",
    ],
  },
} as const;

export type ConformanceLevel = keyof typeof CONFORMANCE_REQUIREMENTS;
