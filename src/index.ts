/**
 * @clawkernel/ckp-test — CKP Conformance Test Harness
 *
 * Public API exports.
 */

export { validateManifest, type ValidationResult, type ValidationError } from "./validator.js";
export {
  runVector,
  evaluateCriteria,
  generateReport,
  formatReport,
  createStdioTransport,
  type TestVector,
  type VectorResult,
  type VectorStatus,
  type SkipPolicy,
  type ConformanceCriteria,
  type ConformanceReport,
  type StdioTransport,
} from "./runner.js";
export { TEST_VECTORS } from "./vectors.js";
export { CONFORMANCE_REQUIREMENTS, type ConformanceLevel } from "./schemas.js";
