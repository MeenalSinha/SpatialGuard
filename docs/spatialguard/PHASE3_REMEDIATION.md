# SpatialGuard — Phase 3 Remediation Architecture & Engineering Specification
**Autonomous Failure Investigation, Bounded Remediation, and Regression Verification**

**Project:** SpatialGuard — *Every change has a geometry. Every release needs proof.*  
**Hackathon:** GitLab Transcend Hackathon 2026 (Path B — Bring Your Own)  
**Autonomy Level:** Supervised Autonomy  
**Primary Platform:** GitLab Duo Agent Platform  

---

## 1. Phase 3 Executive Summary

Phase 3 transitions SpatialGuard from an observational spatial analysis harness into an **autonomous, bounded code remediation system**.

When a code change introduces a geometry violation, SpatialGuard does not simply produce terminal logs or generic advice. Instead, it:
1. **Classifies** the failure to ensure only genuine, reproducible spatial regressions are targeted.
2. **Investigates** the computational root cause across evaluator functions, geometry modules, and test fixtures.
3. **Synthesizes** a minimal corrective patch grounded in mathematical bounds (e.g. interval clamping, polygon closure, coordinate precision).
4. **Pairs** every candidate patch with a deterministic, independent regression test.
5. **Verifies** the patch through strict local/CI verification gates (`test:spatial`, `check`, `test`).
6. **Bounds** automated retries with finite attempt limits and anti-recursion idempotency keys.
7. **Presents** an evidence-backed remediation report for human peer review—strictly adhering to supervised autonomy without autonomous merges or direct pushes to `main`.

---

## 2. Phase 0–2 Readiness Audit

Before Phase 3 was implemented, the repository baseline and earlier phases were audited:

| Component | Status | Verified Evidence & Repairs |
| :--- | :--- | :--- |
| **Phase 0: Baseline & Tests** | **PASS** | `SPATIALGUARD_BASELINE.md` accurate. Repaired pre-existing Windows CRLF line-ending in `tests/skill-examples.test.ts` via portable newline normalization. Full Vitest suite: **167/167 files passed (1630/1630 tests passed)**. |
| **Phase 1: Geometry Core** | **PASS** | `src/lib/spatialguard/evaluator.ts` implements real geometry invariants: `INV-OPENING-001`, `INV-INTERCHANGE-001`, `INV-ROOM-001`. `npm run test:spatial` runs deterministically. |
| **Phase 2: Duo Platform** | **PASS** | 3-stage agent pipeline (`impactAnalyzer.ts`, `evidenceInvestigator.ts`, `releaseAssessor.ts`). `.gitlab-ci.yml` verified `valid: True`. Remotes synchronized at `5b9c059`. GitLab SaaS cloud runner credit-card gate documented as an external platform blocker. |

---

## 3. Remediation Architecture & Agent Responsibilities

```
                                  [Pipeline Failure Event]
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │        Failure Classification             │
                       │     (src/lib/spatialguard/remediation)    │
                       └─────────────────────┬─────────────────────┘
                                             │
                  ┌──────────────────────────┴──────────────────────────┐
                  ▼                                                     ▼
        [Ineligible Failures]                                [Eligible Spatial Failure]
    (Infrastructure / Non-Spatial)                             (INV-OPENING-001, etc.)
                  │                                                     │
                  ▼                                                     ▼
        Status: BLOCKED or                                 ┌───────────────────────────┐
           INCONCLUSIVE                                    │    Root Cause Analysis    │
                                                           └─────────────┬─────────────┘
                                                                         │
                                                                         ▼
                                                           ┌───────────────────────────┐
                                                           │  Bounded Patch Synthesis  │
                                                           │   & Regression Test Gen   │
                                                           └─────────────┬─────────────┘
                                                                         │
                                                                         ▼
                                                           ┌───────────────────────────┐
                                                           │ Isolated Verification Gate│
                                                           │  (test:spatial && check)  │
                                                           └─────────────┬─────────────┘
                                                                         │
                                           ┌─────────────────────────────┴─────────────────────────────┐
                                           ▼                                                           ▼
                                      [All Gates Pass]                                            [Gates Fail]
                                           │                                                           │
                                           ▼                                                           ▼
                              Status: FIXED_AND_VERIFIED                                      Attempt < Max (3)?
                              • Unified Diff Artifact                                                  │
                              • Paired Regression Test                                       ┌─────────┴─────────┐
                              • Reviewable Draft Note                                        ▼                   ▼
                                                                                           [Yes]               [No]
                                                                                          (Retry)        Status: UNRESOLVED
```

### 3.1 Component Breakdown

1. **Failure Classifier (`classifier.ts` - Task B):**
   Categorizes events into 7 discrete cases:
   - `CONFIRMED_SPATIAL_INVARIANT_FAILURE`: Eligible for automated remediation.
   - `NON_SPATIAL_APPLICATION_FAILURE`: Ineligible; geometry code is not modified.
   - `INFRASTRUCTURE_OR_ENVIRONMENT_FAILURE`: Runner/network error; marked `BLOCKED`.
   - `INVALID_OR_MISSING_REPORT`: Report empty or corrupt; marked `INCONCLUSIVE`.
   - `STALE_OR_MISMATCHED_EVIDENCE`: Mismatched commit SHA; marked `INCONCLUSIVE`.
   - `FAILURE_ALREADY_RESOLVED`: Current source passes; zero patches needed.
   - `NO_SAFE_CORRECTION_IDENTIFIED`: Unsupported invariant; human review requested.

2. **Root Cause Investigator (`investigator.ts` - Task D):**
   Pinpoints specific mathematical causes:
   - `INV-OPENING-001`: Opening interval overflow beyond host wall limits or overlapping adjacent openings.
   - `INV-INTERCHANGE-001`: Rounding truncation in export matrices or missing dimensions during format conversion.
   - `INV-ROOM-001`: Unclosed wall cycle graph or inverted polygon vertex winding.

3. **Remediation Policy Engine (`policy.ts` - Task H):**
   Enforces configurable limits:
   - `maxAttempts`: Fixed between 1 and 10 (default 3).
   - `allowedPathPatterns`: Whitelist (`src/lib/geometry/**`, `src/lib/utils/**`, `tests/**`).
   - `forbiddenPathPatterns`: Blacklist (`.gitlab-ci.yml`, `package.json`, `LICENSE`, `INVARIANTS.md`).
   - `allowAutoMerge: false` and `allowDirectPushToMain: false` (strictly enforced).

4. **Patch & Regression Generator (`generator.ts` - Tasks E & F):**
   Produces minimal unified diffs and pairs them with an independent Vitest regression test.

5. **Loop Prevention & Idempotency (`loopPrevention.ts` - Task L):**
   Computes a deterministic idempotency key (`sg-rem-${project}-${commit}-${inv}-${category}`) and maintains an attempt registry to prevent recursive pipeline loops.

6. **Remediation Orchestrator (`remediator.ts` - Tasks A, G, I, J, N):**
   Coordinates the end-to-end execution loop and produces the final `RemediationReport`.

---

## 4. Terminal Status Semantics

The workflow reports one of 5 explicit terminal statuses:

1. **`FIXED_AND_VERIFIED`**:
   The candidate patch was applied in isolation, the newly generated regression test passed, existing spatial invariants passed without regressions, and TypeScript checks passed. Prepared for human peer review.
2. **`PATCH_PROPOSED_UNVERIFIED`**:
   A candidate patch was synthesized, but one or more verification commands failed or could not be run.
3. **`UNRESOLVED`**:
   The maximum configured remediation attempts (3) were exhausted without achieving passing verification gates.
4. **`BLOCKED`**:
   Execution halted due to policy safety violations, missing runner infrastructure, or permission barriers.
5. **`INCONCLUSIVE`**:
   Input test evidence was missing, corrupt, stale, or contradicted source state.

---

## 5. GitLab Duo Agent Platform Integration

### 5.1 Custom Flow (`.gitlab/duo/flows/spatialguard-investigate.yml`)

The GitLab Duo flow defines 4 sequential stages:
- **Stage 1 (`spatial_impact_analysis`)**: Inspects MR diffs and maps changed files to invariants.
- **Stage 2 (`spatial_evidence_investigation`)**: Retrieves CI artifact `test-results/spatial-results.json` and extracts failure metrics.
- **Stage 3 (`spatial_release_assessment`)**: Assesses release readiness (`READY_FOR_FURTHER_REVIEW`, `BLOCKED`, `INCONCLUSIVE`).
- **Stage 4 (`spatial_bounded_remediation`)**: Triggered when Stage 3 status is `BLOCKED`. Synthesizes bounded candidate patches, executes verification gates, and posts reviewable diffs to the Merge Request.

### 5.2 Agent Runtime Configuration (`.gitlab/duo/agent-config.yml`)

Configures supervised autonomy boundaries:
```yaml
permissions:
  repository:
    read: true
    write: false
    create_remediation_branch: true
  merge_requests:
    read: true
    create_notes: true
    create_draft_mr: true
    merge: false
  production:
    deploy: false
```

---

## 6. Verification and Validation Results

All checks executed deterministically in the local repository:

```bash
# Type checking
npm run check
# Output: svelte-check found 0 errors and 0 warnings

# Full Vitest suite
npm test
# Output: 167 passed (167), 1630 passed (1630)

# Spatial verification suite (including Phase 3 remediation tests)
npm run test:spatial
# Output: 3 passed (3), 34 passed (34)

# Production build
npm run build
# Output: built in 31.76s (Adapter Node complete)
```

---

## 7. Safety, No-Hardcoding, and Anti-Recursion Guarantees

1. **No Fabricated Evidence**: Test failures and metric deltas are parsed from genuine Vitest JSON output. If the artifact is missing or corrupt, status is immediately marked `INCONCLUSIVE`.
2. **Strict Supervised Autonomy**: Automated merges to `main` and automated production deployments are forbidden at the type, policy, and configuration levels.
3. **Finite Retry Limits**: Hard-capped at `maxAttempts` (default 3). Resubmitting the same failed patch without new evidence is prohibited.
4. **Idempotency Fingerprinting**: SHA-derived idempotency keys ensure follow-up pipelines on candidate branches do not trigger recursive remediation loops.
5. **Protected Files Invariant**: Security, CI configuration (`.gitlab-ci.yml`), dependencies (`package.json`), and spatial invariant contracts (`INVARIANTS.md`) cannot be modified by automated patches.

---

## 8. Roadmap & Transition to Phase 4

Phase 3 establishes verified, evidence-driven autonomous remediation.

**Phase 4 will deliver**:
- Complete DevSecOps release gates (SAST/DAST verification and supply-chain attestations).
- Staging environment preview deployments.
- Supervised production promotion workflows with cryptographic release evidence bundles.
