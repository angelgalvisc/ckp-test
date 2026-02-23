# ckp-test

Conformance test harness for the [Claw Kernel Protocol (CKP)](https://github.com/angelgalvisc/clawkernel).

## Install

```bash
git clone https://github.com/angelgalvisc/ckp-test.git
cd ckp-test
npm install
npx tsc
```

## Usage

### Validate a manifest

```bash
node dist/cli.js validate claw.yaml
```

### Run conformance vectors

```bash
# Against a live agent (stdio transport)
node dist/cli.js run --target "./my-agent" --manifest claw.yaml --output report.md

# Manifest-only (no agent needed)
node dist/cli.js run --manifest claw.yaml --level 1

# With skip policy
node dist/cli.js run --target "./my-agent" --skip skips.json --output report.json
```

### List vectors

```bash
node dist/cli.js vectors
```

## Conformance Criteria

| Result | Meaning |
|--------|---------|
| **CONFORMANT** | All vectors pass, 0 skips |
| **PARTIAL** | All vectors pass or skip, 0 failures |
| **NON-CONFORMANT** | Any vector fails |

**Skip policy:** Vectors may only be skipped with explicit justification. Skips always result in PARTIAL, never CONFORMANT.

## Test Vectors

31 vectors across 3 levels:

- **L1 Core** (13): Identity + Provider + lifecycle methods
- **L2 Standard** (10): + Channel, Tool, Sandbox, Policy
- **L3 Full** (8): + Skill, Memory, Swarm

## License

Apache 2.0
