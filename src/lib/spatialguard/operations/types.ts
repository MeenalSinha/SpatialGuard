/**
 * SpatialGuard Phase 5 — Production Operations, Runtime Observability, and Safe Recovery Types
 *
 * Implements:
 * 1. Runtime health and version verification states
 * 2. Operational monitoring thresholds and metrics
 * 3. Structured operational reporting
 * 4. Incident correlation and duplicate alert prevention
 * 5. Safe supervised recovery and rollback models
 */

export type RuntimeHealthStatus = 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED' | 'UNKNOWN';

export interface RuntimeVersionInfo {
  name: string;
  version: string;
  commitSha: string;
  pipelineId?: string;
  nodeVersion: string;
  environment: string;
}

export interface LiveVerificationTarget {
  baseUrl: string;
  expectedVersion?: string;
  expectedCommitSha?: string;
  timeoutMs?: number;
}

export interface EndpointCheckResult {
  endpoint: string;
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'ERROR';
  httpStatus: number;
  responseTimeMs: number;
  headers?: Record<string, string>;
  error?: string;
  bodyPreview?: string;
}

export interface LiveVerificationResult {
  targetUrl: string;
  checkedAt: string;
  overallStatus: RuntimeHealthStatus;
  versionInfo?: RuntimeVersionInfo;
  versionMatch: boolean;
  endpointChecks: EndpointCheckResult[];
  securityHeadersValid: boolean;
  spatialCapabilityFunctional: boolean;
  failures: string[];
}

export interface MonitoringThresholds {
  maxResponseTimeMs: number;
  consecutiveFailureLimit: number;
  requiredPassingChecks: number;
}

export interface IncidentRecord {
  incidentId: string;
  fingerprint: string; // SHA-256 hash of (targetUrl + errorType + releaseCommit)
  targetUrl: string;
  releaseCommitSha: string;
  firstObservedAt: string;
  lastObservedAt: string;
  occurrenceCount: number;
  status: 'ACTIVE' | 'RESOLVING' | 'RECOVERED';
  diagnosticSummary: string;
  recoveryAttempted?: boolean;
  verifiedRecovery?: boolean;
}

export interface RecoveryRecommendation {
  action: 'ROLLBACK' | 'REDEPLOY_PREVIOUS' | 'INVESTIGATE_ONLY' | 'NO_ACTION';
  targetReleaseSha?: string;
  targetReleaseVersion?: string;
  justification: string;
  requiresHumanApproval: true; // Strictly enforced: Supervised Autonomy
  verifiedArtifactAvailable: boolean;
  blockers: string[];
}

export interface OperationalReport {
  specVersion: '1.0.0';
  reportId: string;
  projectName: 'SpatialGuard';
  environment: 'staging' | 'production' | 'preview';
  targetUrl: string;
  timestamp: string;
  healthStatus: RuntimeHealthStatus;
  deployedCommitSha: string;
  expectedCommitSha: string;
  versionMatchesExpected: boolean;
  metrics: {
    responseTimeMs: number;
    endpointsCheckedCount: number;
    endpointsFailedCount: number;
  };
  activeIncident?: IncidentRecord;
  recoveryRecommendation?: RecoveryRecommendation;
  humanInterventionRequired: boolean;
  summary: string;
}
