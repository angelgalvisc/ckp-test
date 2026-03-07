import test from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "./validator.js";

test("validateManifest accepts a minimal L1 manifest", () => {
  const manifest = {
    claw: "0.2.0",
    kind: "Claw",
    metadata: { name: "test-l1" },
    spec: {
      identity: { inline: { personality: "L1 test agent" } },
      providers: [
        {
          inline: {
            protocol: "openai-compatible",
            endpoint: "http://localhost:11434/v1",
            model: "test-model",
            auth: { type: "none" },
          },
        },
      ],
    },
  };

  const result = validateManifest(manifest);
  assert.equal(result.valid, true);
  assert.equal(result.conformanceLevel, "level-1");
  assert.equal(result.errors.length, 0);
});

test("validateManifest rejects manifest without providers", () => {
  const manifest = {
    claw: "0.2.0",
    kind: "Claw",
    metadata: { name: "test-invalid" },
    spec: {
      identity: { inline: { personality: "Missing providers" } },
    },
  };

  const result = validateManifest(manifest);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length > 0, true);
});

test("validateManifest detects level-3 primitives", () => {
  const manifest = {
    claw: "0.2.0",
    kind: "Claw",
    metadata: { name: "test-l3" },
    spec: {
      identity: { inline: { personality: "L3 test agent", autonomy: "autonomous" } },
      providers: [
        {
          inline: {
            protocol: "openai-compatible",
            endpoint: "http://localhost:11434/v1",
            model: "test-model",
            auth: { type: "none" },
          },
        },
      ],
      channels: [{ inline: { type: "cli", transport: "stdio", auth: { secret_ref: "CLI_TOKEN" } } }],
      tools: [{ inline: { name: "echo", description: "Echo", input_schema: { type: "object" } } }],
      skills: [{ inline: { description: "Echo skill", tools_required: ["echo"], instruction: "Use echo." } }],
      memory: { inline: { stores: [{ name: "default", type: "key-value", backend: "sqlite", scope: "global" }] } },
      sandbox: { inline: { level: "process" } },
      policies: [{ inline: { rules: [{ id: "allow-all", action: "allow", scope: "all" }] } }],
      swarm: {
        inline: {
          topology: "peer-to-peer",
          agents: [{ identity_ref: "peer-1", role: "peer" }],
          coordination: { message_passing: "direct", backend: "in-process", concurrency: { max_parallel: 2 } },
          aggregation: { strategy: "merge" },
        },
      },
    },
  };

  const result = validateManifest(manifest);
  assert.equal(result.valid, true);
  assert.equal(result.conformanceLevel, "level-3");
});

test("validateManifest rejects allowlist channels that also define roles", () => {
  const manifest = {
    claw: "0.2.0",
    kind: "Claw",
    metadata: { name: "bad-allowlist-channel" },
    spec: {
      identity: { inline: { personality: "Invalid channel test" } },
      providers: [
        {
          inline: {
            protocol: "openai-compatible",
            endpoint: "http://localhost:11434/v1",
            model: "test-model",
            auth: { type: "none" },
          },
        },
      ],
      channels: [
        {
          inline: {
            type: "slack",
            transport: "webhook",
            auth: { secret_ref: "SLACK_TOKEN" },
            access_control: {
              mode: "allowlist",
              allowed_ids: ["U01ABC"],
              roles: [{ id: "U01ABC", role: "admin" }],
            },
          },
        },
      ],
    },
  };

  const result = validateManifest(manifest);
  assert.equal(result.valid, false);
  assert.match(result.errors[0]?.message ?? "", /MUST NOT be present/);
});

test("validateManifest rejects role-based channels that also define allowed_ids", () => {
  const manifest = {
    claw: "0.2.0",
    kind: "Claw",
    metadata: { name: "bad-role-channel" },
    spec: {
      identity: { inline: { personality: "Invalid channel test" } },
      providers: [
        {
          inline: {
            protocol: "openai-compatible",
            endpoint: "http://localhost:11434/v1",
            model: "test-model",
            auth: { type: "none" },
          },
        },
      ],
      channels: [
        {
          inline: {
            type: "telegram",
            transport: "polling",
            auth: { secret_ref: "TG_TOKEN" },
            access_control: {
              mode: "role-based",
              roles: [{ id: "12345", role: "user" }],
              allowed_ids: ["12345"],
            },
          },
        },
      ],
    },
  };

  const result = validateManifest(manifest);
  assert.equal(result.valid, false);
  assert.match(result.errors[0]?.message ?? "", /MUST NOT be present/);
});
