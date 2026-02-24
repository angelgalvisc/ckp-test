/**
 * CKP v0.2.0 Built-in Test Vectors
 *
 * 31 vectors: 13 L1 + 10 L2 + 8 L3
 * Extracted from clawkernel-test-vectors.md
 *
 * Manifest-only vectors include inline `manifestData` for real validation.
 * TV-L1-12 uses `rawRequest` to send malformed JSON bytes.
 */

import type { TestVector } from "./runner.js";

export const TEST_VECTORS: TestVector[] = [
  // ── Level 1: Core ────────────────────────────────────────────────────────

  {
    id: "TV-L1-01",
    level: "L1",
    title: "Valid Minimal Manifest",
    description: "Smallest valid claw.yaml with inline Identity + Provider",
    request: null,
    manifestData: {
      claw: "0.2.0",
      kind: "Claw",
      metadata: { name: "test-minimal" },
      spec: {
        identity: {
          inline: {
            personality: "Minimal test agent for L1 conformance.",
            autonomy: "supervised",
          },
        },
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
    },
    expected: { type: "manifest-valid" },
    reference: "Section 6, Minimal Valid Manifest",
  },
  {
    id: "TV-L1-02",
    level: "L1",
    title: "Missing Identity",
    description: "Manifest without Identity — must reject",
    request: null,
    manifestData: {
      claw: "0.2.0",
      kind: "Claw",
      metadata: { name: "test-no-identity" },
      spec: {
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
    },
    expected: { type: "manifest-invalid" },
    reference: "Section 5.1, Validation Rules",
  },
  {
    id: "TV-L1-03",
    level: "L1",
    title: "Missing Providers",
    description: "Manifest without Providers — must reject",
    request: null,
    manifestData: {
      claw: "0.2.0",
      kind: "Claw",
      metadata: { name: "test-no-providers" },
      spec: {
        identity: {
          inline: {
            personality: "Agent without providers.",
          },
        },
      },
    },
    expected: { type: "manifest-invalid" },
    reference: "Section 5.2, Validation Rules",
  },
  {
    id: "TV-L1-04",
    level: "L1",
    title: "Initialize Happy Path",
    description: "Send claw.initialize with valid manifest, expect success",
    request: {
      jsonrpc: "2.0",
      id: 1,
      method: "claw.initialize",
      params: {
        protocolVersion: "0.2.0",
        clientInfo: { name: "ckp-test", version: "0.2.0" },
        manifest: {
          kind: "Claw",
          metadata: { name: "test-agent" },
          spec: {
            identity: { inline: { personality: "Test agent." } },
            providers: [
              {
                inline: {
                  protocol: "openai-compatible",
                  endpoint: "http://localhost:11434/v1",
                  model: "test",
                  auth: { type: "none" },
                },
              },
            ],
          },
        },
        capabilities: { tools: {}, swarm: {}, memory: {} },
      },
    },
    expected: {
      type: "success",
      requiredFields: ["protocolVersion", "agentInfo", "conformanceLevel", "capabilities"],
    },
    reference: "Section 9.3.1, claw.initialize",
  },
  {
    id: "TV-L1-05",
    level: "L1",
    title: "Initialize Version Mismatch",
    description: "Send claw.initialize with unsupported version, expect -32001",
    request: {
      jsonrpc: "2.0",
      id: 2,
      method: "claw.initialize",
      params: {
        protocolVersion: "99.0.0",
        clientInfo: { name: "ckp-test", version: "0.2.0" },
        manifest: { kind: "Claw", metadata: { name: "test" }, spec: {} },
        capabilities: {},
      },
    },
    expected: { type: "error", errorCode: -32001 },
    reference: "Section 9.3.1, claw.initialize",
  },
  {
    id: "TV-L1-06",
    level: "L1",
    title: "Status Query",
    description: "Query agent status, expect state + uptime_ms",
    request: {
      jsonrpc: "2.0",
      id: 3,
      method: "claw.status",
      params: {},
    },
    expected: {
      type: "success",
      requiredFields: ["state", "uptime_ms"],
    },
    reference: "Section 9.3.1, claw.status",
  },
  {
    id: "TV-L1-07",
    level: "L1",
    title: "Shutdown Happy Path",
    description: "Send claw.shutdown, expect drained response",
    request: {
      jsonrpc: "2.0",
      id: 4,
      method: "claw.shutdown",
      params: { reason: "test-complete" },
    },
    expected: {
      type: "success",
      requiredFields: ["drained"],
    },
    reference: "Section 9.3.1, claw.shutdown",
  },
  {
    id: "TV-L1-08",
    level: "L1",
    title: "Unknown Method",
    description: "Send unknown method, expect -32601",
    request: {
      jsonrpc: "2.0",
      id: 5,
      method: "claw.nonexistent",
      params: {},
    },
    expected: { type: "error", errorCode: -32601 },
    reference: "Section 9.4, Error Codes",
  },
  {
    id: "TV-L1-09",
    level: "L1",
    title: "Invalid Params",
    description: "Send claw.initialize with missing required params, expect -32602",
    request: {
      jsonrpc: "2.0",
      id: 6,
      method: "claw.initialize",
      params: {},
    },
    expected: { type: "error", errorCode: -32602 },
    reference: "Section 9.4, Error Codes",
  },
  {
    id: "TV-L1-10",
    level: "L1",
    title: "Empty Provider Personality",
    description: "Identity with empty personality string — must reject",
    request: null,
    manifestData: {
      claw: "0.2.0",
      kind: "Claw",
      metadata: { name: "test-empty-personality" },
      spec: {
        identity: {
          inline: {
            personality: "",
          },
        },
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
    },
    expected: { type: "manifest-invalid" },
    reference: "Section 5.1, Validation Rules",
  },
  {
    id: "TV-L1-11",
    level: "L1",
    title: "Invalid Request (Missing Method)",
    description: "JSON-RPC without method field, expect -32600",
    request: {
      jsonrpc: "2.0",
      id: 7,
      params: {},
    },
    expected: { type: "error", errorCode: -32600 },
    reference: "Section 9.4, Error Codes",
  },
  {
    id: "TV-L1-12",
    level: "L1",
    title: "Parse Error (Malformed JSON)",
    description: "Intentionally malformed JSON — expect -32700. This vector sends raw bytes, not structured JSON.",
    request: null,
    rawRequest: "{invalid json without closing brace",
    expected: { type: "error", errorCode: -32700 },
    reference: "Section 9.4, Error Codes",
  },
  {
    id: "TV-L1-13",
    level: "L1",
    title: "Heartbeat Notification",
    description: "Validate heartbeat notification structure (Agent → Operator)",
    request: {
      jsonrpc: "2.0",
      method: "claw.heartbeat",
      params: {
        state: "READY",
        uptime_ms: 120000,
        timestamp: "2026-02-22T10:32:00Z",
      },
    },
    expected: { type: "notification" },
    reference: "Section 9.3.1, claw.heartbeat",
  },

  // ── Level 2: Standard ────────────────────────────────────────────────────

  {
    id: "TV-L2-01",
    level: "L2",
    title: "Valid Level 2 Manifest",
    description: "Manifest with Identity + Provider + Channel + Tool + Sandbox + Policy",
    request: null,
    manifestData: {
      claw: "0.2.0",
      kind: "Claw",
      metadata: { name: "test-l2-manifest" },
      spec: {
        identity: {
          inline: {
            personality: "L2 test agent with tools and sandbox.",
            autonomy: "supervised",
          },
        },
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
              type: "cron",
              transport: "polling",
              auth: { secret_ref: "CRON_TOKEN" },
              trigger: {
                schedule: "0 */6 * * *",
                max_parallel: 2,
                overlap_policy: "queue",
              },
            },
          },
        ],
        tools: [
          {
            inline: {
              name: "echo",
              description: "Echo input back",
              input_schema: { type: "object", properties: { text: { type: "string" } } },
            },
          },
        ],
        sandbox: {
          inline: {
            level: "process",
          },
        },
        policies: [
          {
            inline: {
              rules: [{ id: "allow-all", action: "allow", scope: "all" }],
            },
          },
        ],
      },
    },
    expected: { type: "manifest-valid" },
    reference: "Section 11, Conformance Levels",
  },
  {
    id: "TV-L2-02",
    level: "L2",
    title: "Tool Call Happy Path",
    description: "Execute a tool and get content response",
    request: {
      jsonrpc: "2.0",
      id: "req-001",
      method: "claw.tool.call",
      params: {
        name: "echo",
        arguments: { text: "hello" },
        context: {
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          identity: "test-agent",
        },
      },
    },
    expected: {
      type: "success",
      requiredFields: ["content"],
    },
    reference: "Section 9.3.2, claw.tool.call",
  },
  {
    id: "TV-L2-03",
    level: "L2",
    title: "Tool Call — Invalid Params",
    description: "Call tool with invalid arguments, expect -32602",
    request: {
      jsonrpc: "2.0",
      id: "req-002",
      method: "claw.tool.call",
      params: {
        name: "web-fetch",
        arguments: { invalid_field: true },
        context: {
          request_id: "660e8400-e29b-41d4-a716-446655440001",
          identity: "test-agent",
        },
      },
    },
    expected: { type: "error", errorCode: -32602 },
    reference: "Section 5.4, Validation Rules",
  },
  {
    id: "TV-L2-04",
    level: "L2",
    title: "Policy Denied",
    description: "Attempt to execute a tool blocked by policy, expect -32011",
    request: {
      jsonrpc: "2.0",
      id: "req-003",
      method: "claw.tool.call",
      params: {
        name: "destructive-tool",
        arguments: {},
        context: {
          request_id: "770e8400-e29b-41d4-a716-446655440002",
          identity: "test-agent",
          policy: "deny-all",
        },
      },
    },
    expected: { type: "error", errorCode: -32011 },
    reference: "Section 5.8, Policy Validation Rules",
  },
  {
    id: "TV-L2-05",
    level: "L2",
    title: "Tool Execution Timeout",
    description: "Tool exceeds timeout_ms, expect -32014",
    request: {
      jsonrpc: "2.0",
      id: "req-004",
      method: "claw.tool.call",
      params: {
        name: "slow-tool",
        arguments: {},
        context: {
          request_id: "880e8400-e29b-41d4-a716-446655440003",
          identity: "test-agent",
        },
      },
    },
    expected: { type: "error", errorCode: -32014 },
    reference: "Section 5.4, Validation Rules",
  },
  {
    id: "TV-L2-06",
    level: "L2",
    title: "Approval Happy Path",
    description: "Tool requires approval → approve → execute",
    request: {
      jsonrpc: "2.0",
      id: "req-005",
      method: "claw.tool.approve",
      params: {
        request_id: "990e8400-e29b-41d4-a716-446655440004",
        reason: "Approved by test",
      },
    },
    expected: {
      type: "success",
      requiredFields: ["acknowledged"],
    },
    reference: "Section 9.3.2, claw.tool.approve",
  },
  {
    id: "TV-L2-07",
    level: "L2",
    title: "Approval Timeout",
    description: "Approval not received within timeout, expect -32012",
    request: null,
    scenario: true, // Official SKIP: requires multi-step orchestration (send tool.call, wait timeout, verify -32012)
    expected: { type: "error", errorCode: -32012 },
    reference: "Section 5.8, Policy Validation Rules",
  },
  {
    id: "TV-L2-08",
    level: "L2",
    title: "Approval Denied",
    description: "User explicitly denies tool execution",
    request: {
      jsonrpc: "2.0",
      id: "req-006",
      method: "claw.tool.deny",
      params: {
        request_id: "aa0e8400-e29b-41d4-a716-446655440005",
        reason: "Denied by test",
      },
    },
    expected: {
      type: "success",
      requiredFields: ["acknowledged"],
    },
    reference: "Section 9.3.2, claw.tool.deny",
  },
  {
    id: "TV-L2-09",
    level: "L2",
    title: "Sandbox Denied",
    description: "Tool blocked by sandbox constraints, expect -32010",
    request: {
      jsonrpc: "2.0",
      id: "req-007",
      method: "claw.tool.call",
      params: {
        name: "network-tool",
        arguments: { url: "http://169.254.169.254/metadata" },
        context: {
          request_id: "bb0e8400-e29b-41d4-a716-446655440006",
          identity: "test-agent",
          sandbox: "restricted-sandbox",
        },
      },
    },
    expected: { type: "error", errorCode: -32010 },
    reference: "Section 5.7, Sandbox",
  },
  {
    id: "TV-L2-10",
    level: "L2",
    title: "Provider Quota Exceeded",
    description: "Token limit exceeded, expect -32021",
    request: {
      jsonrpc: "2.0",
      id: "req-008",
      method: "claw.tool.call",
      params: {
        name: "expensive-tool",
        arguments: {},
        context: {
          request_id: "cc0e8400-e29b-41d4-a716-446655440007",
          identity: "test-agent",
        },
      },
    },
    expected: { type: "error", errorCode: -32021 },
    reference: "Section 5.2, Validation Rules",
  },

  // ── Level 3: Full ────────────────────────────────────────────────────────

  {
    id: "TV-L3-01",
    level: "L3",
    title: "Valid Level 3 Manifest",
    description: "Manifest with all 9 core primitives (Telemetry optional)",
    request: null,
    manifestData: {
      claw: "0.2.0",
      kind: "Claw",
      metadata: { name: "test-l3-manifest" },
      spec: {
        identity: {
          inline: {
            personality: "L3 full-featured test agent.",
            autonomy: "autonomous",
          },
        },
        providers: [
          {
            inline: {
              protocol: "anthropic-native",
              endpoint: "https://api.anthropic.com/v1",
              model: "claude-sonnet-4-20250514",
              auth: { type: "bearer", secret_ref: "API_KEY" },
            },
          },
        ],
        channels: [
          {
            inline: {
              type: "cli",
              transport: "stdio",
              auth: { secret_ref: "CLI_TOKEN" },
            },
          },
        ],
        tools: [
          {
            inline: {
              name: "echo",
              description: "Echo input back",
              input_schema: { type: "object", properties: { text: { type: "string" } } },
            },
          },
        ],
        skills: [
          {
            inline: {
              description: "Analyze data",
              tools_required: ["echo"],
              instruction: "Use echo tool to process data.",
            },
          },
        ],
        memory: {
          inline: {
            stores: [{ name: "default", type: "key-value", backend: "sqlite", scope: "global" }],
          },
        },
        sandbox: {
          inline: {
            level: "container",
          },
        },
        policies: [
          {
            inline: {
              rules: [{ id: "allow-all", action: "allow", scope: "all" }],
            },
          },
        ],
        swarm: {
          inline: {
            topology: "peer-to-peer",
            agents: [{ identity_ref: "peer-1", role: "peer" }],
            coordination: { message_passing: "direct", backend: "in-process", concurrency: { max_parallel: 2 } },
            aggregation: { strategy: "merge" },
          },
        },
      },
    },
    expected: { type: "manifest-valid" },
    reference: "Section 11, Conformance Levels",
  },
  {
    id: "TV-L3-02",
    level: "L3",
    title: "Swarm Delegate + Report",
    description: "Delegate task to peer, receive report",
    request: {
      jsonrpc: "2.0",
      id: 10,
      method: "claw.swarm.delegate",
      params: {
        task_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        task: {
          description: "Analyze test data",
          input: { dataset: "test" },
        },
        context: {
          request_id: "f0e1d2c3-b4a5-6789-0abc-def012345678",
          swarm: "test-team",
        },
      },
    },
    expected: {
      type: "success",
      requiredFields: ["acknowledged"],
    },
    reference: "Section 9.3.3, claw.swarm.delegate",
  },
  {
    id: "TV-L3-03",
    level: "L3",
    title: "Swarm Discover",
    description: "Discover available peers",
    request: {
      jsonrpc: "2.0",
      id: 11,
      method: "claw.swarm.discover",
      params: { swarm: "test-team" },
    },
    expected: {
      type: "success",
      requiredFields: ["peers"],
    },
    reference: "Section 9.3.3, claw.swarm.discover",
  },
  {
    id: "TV-L3-04",
    level: "L3",
    title: "Memory Store + Query",
    description: "Store an entry then query it",
    request: {
      jsonrpc: "2.0",
      id: 12,
      method: "claw.memory.store",
      params: {
        store: "test-store",
        entries: [{ content: "Test memory entry" }],
        context: { request_id: "dd0e8400-e29b-41d4-a716-446655440008" },
      },
    },
    expected: {
      type: "success",
      requiredFields: ["stored", "ids"],
    },
    reference: "Section 9.3.4, claw.memory.store",
  },
  {
    id: "TV-L3-05",
    level: "L3",
    title: "Memory Query",
    description: "Query memory store with semantic search",
    request: {
      jsonrpc: "2.0",
      id: 13,
      method: "claw.memory.query",
      params: {
        store: "test-store",
        query: { type: "semantic", text: "test", top_k: 5 },
      },
    },
    expected: {
      type: "success",
      requiredFields: ["entries"],
    },
    reference: "Section 9.3.4, claw.memory.query",
  },
  {
    id: "TV-L3-06",
    level: "L3",
    title: "Memory Compact",
    description: "Trigger compaction of a memory store",
    request: {
      jsonrpc: "2.0",
      id: 14,
      method: "claw.memory.compact",
      params: { store: "test-store" },
    },
    expected: {
      type: "success",
      requiredFields: ["entries_before", "entries_after"],
    },
    reference: "Section 9.3.4, claw.memory.compact",
  },
  {
    id: "TV-L3-07",
    level: "L3",
    title: "Swarm Broadcast",
    description: "Broadcast message to all peers (notification, no response)",
    request: {
      jsonrpc: "2.0",
      method: "claw.swarm.broadcast",
      params: {
        swarm: "test-team",
        message: { type: "test", data: "hello peers" },
      },
    },
    expected: { type: "notification" },
    reference: "Section 9.3.3, claw.swarm.broadcast",
  },
  {
    id: "TV-L3-08",
    level: "L3",
    title: "Swarm Report",
    description: "Peer reports task completion",
    request: {
      jsonrpc: "2.0",
      id: 15,
      method: "claw.swarm.report",
      params: {
        task_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        status: "completed",
        result: { summary: "Test analysis complete" },
        token_usage: 1000,
        duration_ms: 5000,
      },
    },
    expected: {
      type: "success",
      requiredFields: ["acknowledged"],
    },
    reference: "Section 9.3.3, claw.swarm.report",
  },
];
