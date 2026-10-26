/**
 * SpatialGuard Phase 3 — Failure Classification Engine (Task B)
 * 
 * Classifies pipeline and test failures before attempting remediation.
 * Ensures that only genuine, current, reproducible spatial invariant
 * regressions are routed to automated patch generation.
 */

import type { FailureCategory, FailureContext } from './types';
import type { SpatialInvestigationReport } from '../agent/types';

export interface RawFailureInput {
  rawReportJson?: string | null;
  pipelineStatus?: 'success' | 'failed' | 'running' | 'canceled';
  expectedCommitSha?: string;
  expectedProjectId?: string;
  pipelineId?: string;
  exitCode?: number;
  terminalOutput?: string;
  investigationReport?: SpatialInvestigationReport | null;
}

/**
 * Classifies a failure event into one of the 7 discrete cases defined in Phase 3 Task B.
 */
export function classifyFailure(input: RawFailureInput): FailureContext {
  const projectId = input.expectedProjectId ?? 'unknown-project';
  const commitSha = input.expectedCommitSha ?? 'unknown-commit';
  const pipelineId = input.pipelineId;

  // Case 3: Infrastructure or environment failure
  if (
    input.terminalOutput &&
    (input.terminalOutput.includes('EAI_AGAIN') ||
      input.terminalOutput.includes('npm ERR! code ENOTFOUND') ||
      input.terminalOutput.includes('Runner failed to pull image') ||
      input.terminalOutput.includes('Credit card required') ||
      input.terminalOutput.includes('shared runners have been disabled'))
  ) {
    return {
      projectId,
      commitSha,
      pipelineId,
      failureCategory: 'INFRASTRUCTURE_OR_ENVIRONMENT_FAILURE',
      isEligibleForRemediation: false,
      eligibilityRationale: 'Infrastructure/runner failure detected before tests could execute. Automated code patching is not applicable.',
      sourceLocations: []
    };
  }

  // Case 4: Invalid or missing test report
  if (!input.rawReportJson || input.rawReportJson.trim() === '') {
    return {
      projectId,
      commitSha,
      pipelineId,
      failureCategory: 'INVALID_OR_MISSING_REPORT',
      isEligibleForRemediation: false,
      eligibilityRationale: 'Test results artifact is absent or empty. Cannot verify failure without evidence.',
      sourceLocations: []
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(input.rawReportJson);
  } catch (err) {
    return {
      projectId,
      commitSha,
      pipelineId,
      failureCategory: 'INVALID_OR_MISSING_REPORT',
      isEligibleForRemediation: false,
      eligibilityRationale: `Malformed test report JSON: ${err instanceof Error ? err.message : String(err)}.`,
      sourceLocations: []
    };
  }

  // Case 5: Stale or mismatched evidence
  if (parsed.commitSha && input.expectedCommitSha && parsed.commitSha !== input.expectedCommitSha) {
    return {
      projectId,
      commitSha,
      pipelineId,
      failureCategory: 'STALE_OR_MISMATCHED_EVIDENCE',
      isEligibleForRemediation: false,
      eligibilityRationale: `Report commit ${parsed.commitSha} does not match expected commit ${input.expectedCommitSha}. Refusing stale evidence.`,
      sourceLocations: []
    };
  }

  // Extract assertion failure details from Vitest report format
  const failedAssertions: any[] = [];
  if (Array.isArray(parsed.testResults)) {
    for (const suite of parsed.testResults) {
      if (Array.isArray(suite.assertionResults)) {
        for (const test of suite.assertionResults) {
          if (test.status === 'failed') {
            failedAssertions.push({
              name: test.title ?? test.fullName,
              fullName: test.fullName,
              messages: test.failureMessages ?? [],
              file: suite.name
            });
          }
        }
      }
    }
  }

  // If no tests failed in report
  if (failedAssertions.length === 0) {
    // If pipeline failed but no tests failed, check if exit code was 0
    if (input.pipelineStatus === 'failed') {
      return {
        projectId,
        commitSha,
        pipelineId,
        failureCategory: 'INFRASTRUCTURE_OR_ENVIRONMENT_FAILURE',
        isEligibleForRemediation: false,
        eligibilityRationale: 'Pipeline marked failed, but spatial test report contains 0 test failures. Likely build or linter crash.',
        sourceLocations: []
      };
    }

    return {
      projectId,
      commitSha,
      pipelineId,
      failureCategory: 'FAILURE_ALREADY_RESOLVED',
      isEligibleForRemediation: false,
      eligibilityRationale: 'No failures found in test report. All checks currently pass.',
      sourceLocations: []
    };
  }

  // Detect whether failures contain a recognized spatial invariant ID (INV-*)
  const spatialInvariantRegex = /INV-[A-Z]+-\d+/;
  const spatialFailure = failedAssertions.find(fa =>
    spatialInvariantRegex.test(fa.fullName) ||
    fa.messages.some((m: string) => spatialInvariantRegex.test(m))
  );

  // Case 2: Non-spatial application test failure
  if (!spatialFailure) {
    const nonSpatialNames = failedAssertions.map(f => f.name).slice(0, 3).join(', ');
    return {
      projectId,
      commitSha,
      pipelineId,
      failedCheck: nonSpatialNames,
      failureCategory: 'NON_SPATIAL_APPLICATION_FAILURE',
      isEligibleForRemediation: false,
      eligibilityRationale: `Failed checks (${nonSpatialNames}) do not involve recognized spatial invariants. SpatialGuard will not modify geometry code for non-spatial defects.`,
      sourceLocations: failedAssertions.map(f => f.file).filter(Boolean)
    };
  }

  // Extract invariant ID
  const match = spatialFailure.fullName.match(spatialInvariantRegex) ||
    (spatialFailure.messages[0] ? spatialFailure.messages[0].match(spatialInvariantRegex) : null);
  const invariantId = match ? match[0] : 'INV-UNKNOWN';

  // Extract metric delta if present in failure messages
  const messageStr = spatialFailure.messages.join('\n');
  const metricDelta = extractMetricDelta(messageStr);

  // Extract source locations from stack frames
  const sourceLocations = extractSourceLocations(messageStr);
  if (spatialFailure.file && !sourceLocations.includes(spatialFailure.file)) {
    sourceLocations.push(spatialFailure.file);
  }

  // Case 1: Confirmed spatial invariant failure
  return {
    projectId,
    commitSha,
    pipelineId,
    invariantId,
    testFile: spatialFailure.file,
    failedCheck: spatialFailure.fullName,
    diagnosticMessage: spatialFailure.messages[0] ? spatialFailure.messages[0].split('\n')[0] : 'Assertion failed',
    metricDelta,
    sourceLocations,
    failureCategory: 'CONFIRMED_SPATIAL_INVARIANT_FAILURE',
    isEligibleForRemediation: true,
    eligibilityRationale: `Confirmed violation of invariant ${invariantId}. Diagnostic metrics and source stack frames available for bounded remediation.`
  };
}

/**
 * Parses numerical assertion deltas from Vitest failure messages
 */
function extractMetricDelta(message: string): { metric: string; expected: string | number; actual: string | number; delta?: number; unit?: string } | undefined {
  // Pattern: Expected [metric] to be <= [X], but got [Y]
  const pattern1 = /(?:expected|tolerance) (?:<=|<)?\s*([0-9.]+)\s*([a-zA-Z]*),?\s*(?:received|got|actual)\s*([0-9.]+)/i;
  const m1 = message.match(pattern1);
  if (m1) {
    const expected = parseFloat(m1[1]);
    const actual = parseFloat(m1[3]);
    return {
      metric: 'geometric_tolerance',
      expected,
      actual,
      delta: Math.abs(actual - expected),
      unit: m1[2] || 'm'
    };
  }

  // Pattern: expected false to be true (boolean assertion)
  if (message.includes('expected false to be true')) {
    return {
      metric: 'boundary_containment',
      expected: 'true',
      actual: 'false'
    };
  }

  return undefined;
}

/**
 * Extracts source code file paths and line numbers from stack traces
 */
function extractSourceLocations(stackTrace: string): string[] {
  const locations: string[] = [];
  const regex = /(?:src|tests)\/[a-zA-Z0-9_\-\/]+\.(?:ts|js|svelte):(\d+):(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(stackTrace)) !== null) {
    if (!locations.includes(m[0])) {
      locations.push(m[0]);
    }
  }
  return locations;
}
