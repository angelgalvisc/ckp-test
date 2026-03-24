// Embedded snapshots of clawkernel/schema/0.2.0 and 0.3.0 — sync on CKP version bump

/**
 * Embedded JSON Schemas for CKP v0.2.0 and v0.3.0 validation.
 * These are copies of the root validation concepts from clawkernel/schema/.
 * When validating, the harness uses these embedded schemas so it works standalone.
 *
 * Usage with AJV:
 *   1. const { definitions, manifest } = getEmbeddedSchemas(version)
 *   2. ajv.addSchema(definitions)
 *   3. const validate = ajv.compile(manifest)
 */

// ── Definitions Schema ─────────────────────────────────────────────────────

export const DEFINITIONS_SCHEMA_V020 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "definitions-0.2.0.schema.json",
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
        "Telemetry",
        "Claw",
      ],
    },
  },
} as const;

// ── Claw Manifest Schema (root) ────────────────────────────────────────────

export const CLAW_MANIFEST_SCHEMA_V020 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "claw-0.2.0.schema.json",
  title: "CKP Claw Manifest",
  description: "Root manifest schema for Claw Kernel Protocol v0.2.0.",
  type: "object",
  properties: {
    claw: { $ref: "definitions-0.2.0.schema.json#/$defs/protocolVersion" },
    kind: { const: "Claw" },
    metadata: {
      type: "object",
      properties: {
        name: { $ref: "definitions-0.2.0.schema.json#/$defs/kebabName" },
        version: { $ref: "definitions-0.2.0.schema.json#/$defs/semver" },
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
        telemetry: {
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

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function replaceStringLeaves(value: unknown, from: string, to: string): unknown {
  if (typeof value === "string") return value.replaceAll(from, to);
  if (Array.isArray(value)) return value.map((item) => replaceStringLeaves(item, from, to));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        replaceStringLeaves(v, from, to),
      ]),
    );
  }
  return value;
}

export const DEFINITIONS_SCHEMA_V030 = (() => {
  const schema = replaceStringLeaves(
    deepClone(DEFINITIONS_SCHEMA_V020),
    "0.2.0",
    "0.3.0",
  ) as {
    $id: string;
    description: string;
    $defs: { kind: { enum: string[] } };
  };
  schema.$id = "definitions-0.3.0.schema.json";
  if (!schema.$defs.kind.enum.includes("WorldModel")) {
    const sandboxIndex = schema.$defs.kind.enum.indexOf("Sandbox");
    schema.$defs.kind.enum.splice(sandboxIndex, 0, "WorldModel");
  }
  return schema;
})();

export const CLAW_MANIFEST_SCHEMA_V030 = (() => {
  const schema = replaceStringLeaves(
    deepClone(CLAW_MANIFEST_SCHEMA_V020),
    "0.2.0",
    "0.3.0",
  ) as {
    $id: string;
    description: string;
    properties: { spec: { properties: Record<string, unknown> } };
  };
  schema.$id = "claw-0.3.0.schema.json";
  schema.description = "Root manifest schema for Claw Kernel Protocol v0.3.0.";
  schema.properties.spec.properties.world_models = {
    type: "array",
    items: {
      oneOf: [
        { type: "string", minLength: 1 },
        { type: "object" },
      ],
    },
  };
  return schema;
})();

export const SUPPORTED_PROTOCOL_VERSIONS = ["0.2.0", "0.3.0"] as const;

export function getEmbeddedSchemas(version: string): {
  definitions: Record<string, unknown>;
  manifest: Record<string, unknown>;
} {
  if (version === "0.3.0") {
    return {
      definitions: DEFINITIONS_SCHEMA_V030,
      manifest: CLAW_MANIFEST_SCHEMA_V030,
    };
  }
  return {
    definitions: DEFINITIONS_SCHEMA_V020,
    manifest: CLAW_MANIFEST_SCHEMA_V020,
  };
}

// ── Per-kind Required Fields (for supplemental inline validation) ───────────

export const REQUIRED_FIELDS_BY_KIND: Record<string, string[]> = {
  Identity: ["personality"],
  Provider: ["protocol", "endpoint", "model", "auth"],
  Channel: ["type", "transport", "auth"],
  Tool: [], // conditional: description+input_schema OR mcp_source
  Skill: ["description", "tools_required", "instruction"],
  Memory: ["stores"],
  WorldModel: ["backend"],
  Sandbox: ["level"],
  Policy: ["rules"],
  Swarm: ["topology", "agents", "coordination", "aggregation"],
  Telemetry: ["exporters"],
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
