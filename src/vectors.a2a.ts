/**
 * CKP-A2A Compatibility Vectors
 *
 * Focused interoperability vectors for the CKP-A2A profile.
 * These are not part of the core 31 CKP conformance vectors.
 */

import type { TestVector } from "./runner.js";

export const TEST_VECTORS_A2A: TestVector[] = [
  {
    id: "TV-A2A-01",
    level: "A2A",
    title: "Task Create",
    description: "Create a task via claw.task.create",
    request: {
      jsonrpc: "2.0",
      id: 9001,
      method: "claw.task.create",
      params: {
        task_id: "task-0001",
        message: {
          role: "user",
          content: [{ type: "text", text: "Analyze this sales report" }],
        },
      },
    },
    expected: {
      type: "success",
      requiredFields: ["task_id", "state"],
    },
    reference: "CKP-A2A Profile §6.2, SendMessage → claw.task.create",
  },
  {
    id: "TV-A2A-02",
    level: "A2A",
    title: "Task Get",
    description: "Fetch task state via claw.task.get",
    request: {
      jsonrpc: "2.0",
      id: 9002,
      method: "claw.task.get",
      params: { task_id: "task-0001" },
    },
    expected: {
      type: "success",
      requiredFields: ["task_id", "state"],
    },
    reference: "CKP-A2A Profile §6.2, GetTask → claw.task.get",
  },
  {
    id: "TV-A2A-03",
    level: "A2A",
    title: "Task List",
    description: "List tasks via claw.task.list",
    request: {
      jsonrpc: "2.0",
      id: 9003,
      method: "claw.task.list",
      params: {},
    },
    expected: {
      type: "success",
      requiredFields: ["tasks"],
    },
    reference: "CKP-A2A Profile §6.2, ListTasks → claw.task.list",
  },
  {
    id: "TV-A2A-04",
    level: "A2A",
    title: "Task Subscribe",
    description: "Subscribe to task updates via claw.task.subscribe",
    request: {
      jsonrpc: "2.0",
      id: 9004,
      method: "claw.task.subscribe",
      params: { task_id: "task-0001" },
    },
    expected: {
      type: "success",
      requiredFields: ["task_id", "subscribed"],
    },
    reference: "CKP-A2A Profile §6.2, SubscribeToTask → claw.task.subscribe",
  },
  {
    id: "TV-A2A-05",
    level: "A2A",
    title: "Task Cancel",
    description: "Cancel a task via claw.task.cancel",
    request: {
      jsonrpc: "2.0",
      id: 9005,
      method: "claw.task.cancel",
      params: {
        task_id: "task-0001",
        reason: "compatibility-test",
      },
    },
    expected: {
      type: "success",
      requiredFields: ["task_id", "state"],
    },
    reference: "CKP-A2A Profile §6.2, CancelTask → claw.task.cancel",
  },
  {
    id: "TV-A2A-06",
    level: "A2A",
    title: "Task Create Missing Payload",
    description: "Create without message/messages should fail",
    request: {
      jsonrpc: "2.0",
      id: 9006,
      method: "claw.task.create",
      params: {
        task_id: "task-0002",
      },
    },
    expected: {
      type: "error",
      errorCode: -32602,
    },
    reference: "CKP-A2A Profile §6.2 + CKP §9.4 Invalid params",
  },
  {
    id: "TV-A2A-07",
    level: "A2A",
    title: "Task Get Missing task_id",
    description: "Get without task_id should fail",
    request: {
      jsonrpc: "2.0",
      id: 9007,
      method: "claw.task.get",
      params: {},
    },
    expected: {
      type: "error",
      errorCode: -32602,
    },
    reference: "CKP §9.4 Invalid params",
  },
  {
    id: "TV-A2A-08",
    level: "A2A",
    title: "Task Unknown ID",
    description: "Unknown task_id should fail",
    request: {
      jsonrpc: "2.0",
      id: 9008,
      method: "claw.task.get",
      params: { task_id: "task-404" },
    },
    expected: {
      type: "error",
      errorCode: -32602,
    },
    reference: "CKP-A2A runtime mapping: unknown task is invalid params",
  },
];
