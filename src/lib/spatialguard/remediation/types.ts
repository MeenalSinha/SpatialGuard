/**
 * SpatialGuard Phase 3 — Bounded Remediation Types
 * 
 * Defines the domain models, policy schemas, failure classifications,
 * patch proposals, attempt records, and report structures for autonomous
 * failure investigation and bounded code remediation.
 */

import type { PipelineContext } from '../agent/types';

/**
 * Explicit terminal remediation status semantics (Task 21)
 */
export type RemediationStatus =
  | 'FIXED_AND_VERIFIED'        // Defect addressed, regression test demonstrates fix, all gates passed
  | 'PATCH_PROPOSED_UNVERIFIED' // Patch created, but required tests failed or could not be executed
  | 'UNRESOLVED'                // Defect remains after maximum permitted attempts exhausted
  | 'BLOCKED'                   // External dependency, runner, permission, or environment blocked execution
  | 'INCONCLUSIVE';             // Evidence insufficient or contradictory to determine cause or fix safely

/**
 * Failure category classification (Task B)
 */
export type FailureCategory =
  | 'CONFIRMED_SPATIAL_INVARIANT_FAILURE' // Valid report shows geometry invariant failed on current commit
  | 'NON_SPATIAL_APPLICATION_FAILURE'     // Failure in unrelated test without spatial invariant violation
  | 'INFRASTRUCTURE_OR_ENVIRONMENT_FAILURE' // Dependency, runner, network, or environment failed before tests ran
  | 'INVALID_OR_MISSING_REPORT'           // Test report absent, corrupt, or unparseable
  | 'STALE_OR_MISMATCHED_EVIDENCE'        // Report belongs to different commit, pipeline, or project
  | 'FAILURE_ALREADY_RESOLVED'            // Defect cannot be reproduced on current working tree state
  | 'NO_SAFE_CORRECTION_IDENTIFIED';      // Defect diagnosed but no safe/defensible patch within policy bounds

/**
 * Configurable, validated remediation policy (Task H & Section 3)
 */
export interface RemediationPolicy {
  /** Maximum number of automated repair attempts before aborting (finite bounded retry limit) */
  maxAttempts: number;
  /** Glob patterns of paths permitted for remediation modification */
  allowedPathPatterns: string[];
  /** Glob patterns of protected paths strictly forbidden from automated modification */
  forbiddenPathPatterns: string[];
  /** Required validation commands that must all succeed */
  requiredVerificationCommands: string[];
  /** Whether automatic branch creation is permitted (supervised context) */
  allowBranchCreation: boolean;
  /** Whether automatic merge is permitted (strictly false under supervised autonomy) */
  allowAutoMerge: false;
  /** Whether direct push to main is permitted (strictly false under supervised autonomy) */
  allowDirectPushToMain: false;
  /** Timeout per verification command in milliseconds */
  commandTimeoutMs: number;
}

/**
 * Default safe remediation policy
 */
export const DEFAULT_REMEDIATION_POLICY: RemediationPolicy = {
  maxAttempts: 3,
  allowedPathPatterns: [
    'src/lib/geometry/**',
    'src/lib/utils/**',
    'tests/spatialguard/**',
    'tests/regression/**'
  ],
  forbiddenPathPatterns: [
    '.gitlab/**',
    '.gitlab-ci.yml',
    'package.json',
    'package-lock.json',
    'LICENSE',
    'tsconfig.json',
    'vite.config.ts',
    'svelte.config.js',
    'docs/spatialguard/INVARIANTS.md'
  ],
  requiredVerificationCommands: [
    'npm run test:spatial',
    'npm run check'
  ],
  allowBranchCreation: true,
  allowAutoMerge: false,
  allowDirectPushToMain: false,
  commandTimeoutMs: 60000
};

/**
 * Reliable failure context gathered before remediation (Task C)
 */
export interface FailureContext {
  projectId: string;
  commitSha: string;
  pipelineId?: string;
  mergeRequestId?: string;
  invariantId?: string;
  testFile?: string;
  failedCheck?: string;
  diagnosticMessage?: string;
  metricDelta?: {
    metric: string;
    expected: number | string;
    actual: number | string;
    delta?: number;
    unit?: string;
  };
  sourceLocations: string[];
  failureCategory: FailureCategory;
  isEligibleForRemediation: boolean;
  eligibilityRationale: string;
}

/**
 * Root cause diagnosis (Task D)
 */
export interface RootCauseDiagnosis {
  invariantId: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  confirmedObservations: string[];
  supportedHypotheses: string[];
  unverifiedHypotheses: string[];
  primarySourceFile: string;
  targetFunction?: string;
  recommendedFixStrategy: 'boundary_clamp' | 'coordinate_snap' | 'scale_conservation' | 'polygon_closure' | 'manual_review';
}

/**
 * Regression test definition (Task F)
 */
export interface RegressionTestSpec {
  testFilePath: string;
  testSuiteName: string;
  testCaseName: string;
  reproducingInputDescription: string;
  testCode: string;
}

/**
 * Candidate corrective patch proposal (Task E)
 */
export interface CandidatePatch {
  patchId: string;
  attemptNumber: number;
  targetFile: string;
  originalSnippet: string;
  replacementSnippet: string;
  diffUnified: string;
  rationale: string;
  regressionTest: RegressionTestSpec;
  safetyAuditPassed: boolean;
  safetyAuditViolations: string[];
}

/**
 * Single remediation attempt record (Task H)
 */
export interface RemediationAttemptRecord {
  attemptNumber: number;
  timestamp: string;
  patch: CandidatePatch;
  verificationResults: {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    passed: boolean;
    durationMs: number;
  }[];
  allCommandsPassed: boolean;
  failureMessage?: string;
  newRegressionsDetected: string[];
}

/**
 * Evidence-backed remediation report (Task N & 20)
 */
export interface RemediationReport {
  reportId: string;
  status: RemediationStatus;
  timestamp: string;
  repositoryContext: {
    projectId: string;
    branch: string;
    commitSha: string;
    pipelineId?: string;
  };
  failureCategory: FailureCategory;
  failedInvariants: string[];
  rootCause: RootCauseDiagnosis;
  remediationAttempts: RemediationAttemptRecord[];
  totalAttempts: number;
  maxAttemptsAllowed: number;
  finalPatch?: CandidatePatch;
  regressionTestAdded?: string;
  verificationSummary: {
    regressionTestPassed: boolean;
    spatialInvariantsPassed: boolean;
    cleanTypeCheck: boolean;
    noNewRegressions: boolean;
  };
  idempotencyKey: string;
  reviewActionRequired: boolean;
  reviewInstructions: string;
  limitationsAndRisks: string[];
}
