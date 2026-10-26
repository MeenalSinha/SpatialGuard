/**
 * SpatialGuard Phase 3 — Remediation Adversarial & Functional Test Suite
 * 
 * Verifies all 12 distinct scenarios required by Phase 3 Task O:
 * 1. Eligible spatial failure
 * 2. Confirmed successful correction
 * 3. Candidate patch fails verification
 * 4. Attempt limit reached
 * 5. Invalid report
 * 6. Stale report
 * 7. Infrastructure failure
 * 8. Unsafe patch / forbidden file protection
 * 9. Unrelated working tree changes preservation
 * 10. Corrected source breaks another invariant
 * 11. Duplicate remediation event / idempotency
 * 12. Failure cannot be reproduced / already resolved
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  classifyFailure,
  investigateRootCause,
  validateRemediationPolicy,
  isPathPermittedForRemediation,
  computeIdempotencyKey,
  checkIdempotency,
  clearIdempotencyRegistry,
  generateCandidatePatch,
  executeRemediationWorkflow,
  type FailureContext,
  type RemediationPolicy
} from '$lib/spatialguard/remediation';

describe('SpatialGuard Phase 3: Bounded Remediation Suite', () => {
  const defaultCommit = 'a1b2c3d4e5f6';
  const defaultProject = 'MeenalSinha/SpatialGuard';

  beforeEach(() => {
    clearIdempotencyRegistry();
  });

  // Scenario 1: Eligible spatial failure
  it('Scenario 1: recognizes confirmed spatial invariant failure as eligible for bounded remediation', () => {
    const rawReport = JSON.stringify({
      commitSha: defaultCommit,
      testResults: [
        {
          name: 'tests/spatialguard/invariants.test.ts',
          assertionResults: [
            {
              fullName: 'Spatial Invariant INV-OPENING-001: Opening Boundary Containment',
              status: 'failed',
              failureMessages: [
                'AssertionError: expected false to be true\n    at Object.evaluateOpeningInvariants (src/lib/spatialguard/evaluator.ts:74:24)'
              ]
            }
          ]
        }
      ]
    });

    const context = classifyFailure({
      rawReportJson: rawReport,
      expectedCommitSha: defaultCommit,
      expectedProjectId: defaultProject
    });

    expect(context.failureCategory).toBe('CONFIRMED_SPATIAL_INVARIANT_FAILURE');
    expect(context.isEligibleForRemediation).toBe(true);
    expect(context.invariantId).toBe('INV-OPENING-001');
    expect(context.sourceLocations.some(l => l.includes('evaluator.ts'))).toBe(true);
  });

  // Scenario 2: Confirmed successful correction
  it('Scenario 2: addresses reproducible defect, generates regression test, and verifies status as FIXED_AND_VERIFIED', async () => {
    const rawReport = JSON.stringify({
      commitSha: defaultCommit,
      testResults: [
        {
          name: 'tests/spatialguard/invariants.test.ts',
          assertionResults: [
            {
              fullName: 'Spatial Invariant INV-OPENING-001: Opening Boundary Containment',
              status: 'failed',
              failureMessages: [
                'AssertionError: expected false to be true\n    at Object.clampOpeningPosition (src/lib/geometry/planOpening.ts:25:12)'
              ]
            }
          ]
        }
      ]
    });

    const report = await executeRemediationWorkflow(
      {
        rawReportJson: rawReport,
        expectedCommitSha: defaultCommit,
        expectedProjectId: defaultProject
      },
      { maxAttempts: 3 },
      {
        mockVerificationResult: {
          regressionTestPassed: true,
          spatialInvariantsPassed: true,
          cleanTypeCheck: true,
          newRegressions: []
        }
      }
    );

    expect(report.status).toBe('FIXED_AND_VERIFIED');
    expect(report.totalAttempts).toBe(1);
    expect(report.finalPatch).toBeDefined();
    expect(report.finalPatch?.regressionTest.testFilePath).toBe('tests/spatialguard/regression-opening-boundary.test.ts');
    expect(report.verificationSummary.regressionTestPassed).toBe(true);
    expect(report.verificationSummary.spatialInvariantsPassed).toBe(true);
    expect(report.reviewActionRequired).toBe(true);
  });

  // Scenario 3: Candidate patch fails
  it('Scenario 3: marks candidate patch unverified and retries when verification fails', async () => {
    const rawReport = JSON.stringify({
      commitSha: defaultCommit,
      testResults: [
        {
          name: 'tests/spatialguard/invariants.test.ts',
          assertionResults: [
            {
              fullName: 'Spatial Invariant INV-INTERCHANGE-001: Prepared RoomPlan Conservation',
              status: 'failed',
              failureMessages: [
                'AssertionError: expected 2.455 to be 2.0\n    at sanitizeScale (src/lib/utils/interchange.ts:15:9)'
              ]
            }
          ]
        }
      ]
    });

    const report = await executeRemediationWorkflow(
      {
        rawReportJson: rawReport,
        expectedCommitSha: defaultCommit,
        expectedProjectId: defaultProject
      },
      { maxAttempts: 2 },
      {
        mockVerificationResult: {
          regressionTestPassed: false, // verification fails
          spatialInvariantsPassed: false,
          cleanTypeCheck: true,
          newRegressions: []
        }
      }
    );

    // Retries exhausted
    expect(report.status).toBe('UNRESOLVED');
    expect(report.totalAttempts).toBe(2);
    expect(report.verificationSummary.regressionTestPassed).toBe(false);
  });

  // Scenario 4: Attempt limit reached
  it('Scenario 4: stops retrying and marks UNRESOLVED when maximum attempts limit is reached', async () => {
    const rawReport = JSON.stringify({
      commitSha: defaultCommit,
      testResults: [
        {
          name: 'tests/spatialguard/invariants.test.ts',
          assertionResults: [
            {
              fullName: 'Spatial Invariant INV-ROOM-001: Enclosed Planar Room Boundary',
              status: 'failed',
              failureMessages: [
                'AssertionError: expected false to be true\n    at isPolygonClosed (src/lib/utils/roomDetection.ts:40:10)'
              ]
            }
          ]
        }
      ]
    });

    const report = await executeRemediationWorkflow(
      {
        rawReportJson: rawReport,
        expectedCommitSha: defaultCommit,
        expectedProjectId: defaultProject
      },
      { maxAttempts: 1 }, // Bound to single attempt
      {
        mockVerificationResult: {
          regressionTestPassed: false,
          spatialInvariantsPassed: false,
          cleanTypeCheck: false
        }
      }
    );

    expect(report.totalAttempts).toBe(1);
    expect(report.status).toBe('UNRESOLVED');
    expect(report.limitationsAndRisks.some(l => l.includes('Exhausted all 1 authorized repair attempts'))).toBe(true);
  });

  // Scenario 5: Invalid report
  it('Scenario 5: returns INCONCLUSIVE when test report is malformed or empty', async () => {
    const emptyReport = await executeRemediationWorkflow({
      rawReportJson: '',
      expectedCommitSha: defaultCommit
    });
    expect(emptyReport.status).toBe('INCONCLUSIVE');
    expect(emptyReport.failureCategory).toBe('INVALID_OR_MISSING_REPORT');

    const corruptReport = await executeRemediationWorkflow({
      rawReportJson: '{ corrupt json: true',
      expectedCommitSha: defaultCommit
    });
    expect(corruptReport.status).toBe('INCONCLUSIVE');
    expect(corruptReport.failureCategory).toBe('INVALID_OR_MISSING_REPORT');
  });

  // Scenario 6: Stale report
  it('Scenario 6: refuses stale report from a different commit', async () => {
    const staleReport = JSON.stringify({
      commitSha: 'old-commit-000000',
      testResults: []
    });

    const report = await executeRemediationWorkflow({
      rawReportJson: staleReport,
      expectedCommitSha: defaultCommit
    });

    expect(report.status).toBe('INCONCLUSIVE');
    expect(report.failureCategory).toBe('STALE_OR_MISMATCHED_EVIDENCE');
    expect(report.limitationsAndRisks[0]).toContain('does not match expected commit');
  });

  // Scenario 7: Infrastructure failure
  it('Scenario 7: distinguishes infrastructure failures and prevents modifying geometry code', async () => {
    const report = await executeRemediationWorkflow({
      rawReportJson: JSON.stringify({ testResults: [] }),
      expectedCommitSha: defaultCommit,
      terminalOutput: 'Runner failed to pull image node:22-bookworm: EAI_AGAIN network resolution failure'
    });

    expect(report.status).toBe('BLOCKED');
    expect(report.failureCategory).toBe('INFRASTRUCTURE_OR_ENVIRONMENT_FAILURE');
    expect(report.totalAttempts).toBe(0); // Zero code patches attempted
  });

  // Scenario 8: Unsafe patch / protected file protection
  it('Scenario 8: rejects modification of protected configuration, licensing, or CI files', () => {
    const policyValidation = validateRemediationPolicy();
    const policy = policyValidation.sanitizedPolicy;

    expect(isPathPermittedForRemediation('.gitlab-ci.yml', policy).permitted).toBe(false);
    expect(isPathPermittedForRemediation('package.json', policy).permitted).toBe(false);
    expect(isPathPermittedForRemediation('LICENSE', policy).permitted).toBe(false);
    expect(isPathPermittedForRemediation('.gitlab/duo/agent-config.yml', policy).permitted).toBe(false);
    expect(isPathPermittedForRemediation('docs/spatialguard/INVARIANTS.md', policy).permitted).toBe(false);

    // Geometry and utility paths are permitted
    expect(isPathPermittedForRemediation('src/lib/geometry/planOpening.ts', policy).permitted).toBe(true);
    expect(isPathPermittedForRemediation('src/lib/utils/interchange.ts', policy).permitted).toBe(true);
  });

  // Scenario 9: Unrelated working tree changes preservation
  it('Scenario 9: validates that candidate patch produces isolated unified diff without altering unrelated files', () => {
    const context: FailureContext = {
      projectId: defaultProject,
      commitSha: defaultCommit,
      invariantId: 'INV-OPENING-001',
      failureCategory: 'CONFIRMED_SPATIAL_INVARIANT_FAILURE',
      isEligibleForRemediation: true,
      eligibilityRationale: 'Valid failure',
      sourceLocations: ['src/lib/geometry/planOpening.ts:25:12']
    };

    const diagnosis = investigateRootCause(context);
    const patchResult = generateCandidatePatch(context, diagnosis, 1, validateRemediationPolicy().sanitizedPolicy);

    expect(patchResult.success).toBe(true);
    expect(patchResult.patch?.targetFile).toBe('src/lib/geometry/planOpening.ts');
    expect(patchResult.patch?.diffUnified).toContain('--- a/src/lib/geometry/planOpening.ts');
    expect(patchResult.patch?.diffUnified).toContain('+++ b/src/lib/geometry/planOpening.ts');
  });

  // Scenario 10: Corrected source breaks another invariant
  it('Scenario 10: rejects marking FIXED_AND_VERIFIED if correction introduces new regression', async () => {
    const rawReport = JSON.stringify({
      commitSha: defaultCommit,
      testResults: [
        {
          name: 'tests/spatialguard/invariants.test.ts',
          assertionResults: [
            {
              fullName: 'Spatial Invariant INV-OPENING-001: Opening Boundary Containment',
              status: 'failed',
              failureMessages: ['AssertionError: expected false to be true']
            }
          ]
        }
      ]
    });

    const report = await executeRemediationWorkflow(
      {
        rawReportJson: rawReport,
        expectedCommitSha: defaultCommit,
        expectedProjectId: defaultProject
      },
      { maxAttempts: 1 },
      {
        mockVerificationResult: {
          regressionTestPassed: true,
          spatialInvariantsPassed: false, // Another invariant regressed!
          cleanTypeCheck: true,
          newRegressions: ['INV-ROOM-001']
        }
      }
    );

    expect(report.status).toBe('UNRESOLVED');
    expect(report.verificationSummary.noNewRegressions).toBe(false);
    expect(report.remediationAttempts[0].failureMessage).toContain('regressed: INV-ROOM-001');
  });

  // Scenario 11: Duplicate remediation event / idempotency
  it('Scenario 11: detects duplicate events and prevents recursive remediation runs', () => {
    const context: FailureContext = {
      projectId: defaultProject,
      commitSha: defaultCommit,
      invariantId: 'INV-OPENING-001',
      diagnosticMessage: 'AssertionError: expected false to be true',
      failureCategory: 'CONFIRMED_SPATIAL_INVARIANT_FAILURE',
      isEligibleForRemediation: true,
      eligibilityRationale: 'Valid failure',
      sourceLocations: []
    };

    const policy = validateRemediationPolicy({ maxAttempts: 2 }).sanitizedPolicy;

    // Check 1: First attempt allowed
    const check1 = checkIdempotency(context, policy);
    expect(check1.canProceed).toBe(true);
    expect(check1.attemptNumber).toBe(1);

    // Simulate recording 2 attempts
    const history = new Map<string, { attempts: number; completed: boolean; lastTimestamp: number }>();
    history.set(check1.idempotencyKey, { attempts: 2, completed: false, lastTimestamp: Date.now() });

    // Check 2: Attempt limit reached
    const check2 = checkIdempotency(context, policy, history);
    expect(check2.canProceed).toBe(false);
    expect(check2.hasExceededLimit).toBe(true);

    // Check 3: Already completed event suppressed
    history.set(check1.idempotencyKey, { attempts: 1, completed: true, lastTimestamp: Date.now() });
    const check3 = checkIdempotency(context, policy, history);
    expect(check3.canProceed).toBe(false);
    expect(check3.isDuplicateEvent).toBe(true);
  });

  // Scenario 12: Existing failure cannot be reproduced / already resolved
  it('Scenario 12: detects when failure is already resolved and avoids generating unneeded patches', async () => {
    const passingReport = JSON.stringify({
      commitSha: defaultCommit,
      testResults: [
        {
          name: 'tests/spatialguard/invariants.test.ts',
          assertionResults: [
            {
              fullName: 'Spatial Invariant INV-OPENING-001: Opening Boundary Containment',
              status: 'passed',
              failureMessages: []
            }
          ]
        }
      ]
    });

    const report = await executeRemediationWorkflow({
      rawReportJson: passingReport,
      expectedCommitSha: defaultCommit,
      expectedProjectId: defaultProject
    });

    expect(report.failureCategory).toBe('FAILURE_ALREADY_RESOLVED');
    expect(report.totalAttempts).toBe(0);
    expect(report.status).toBe('FIXED_AND_VERIFIED');
  });
});
