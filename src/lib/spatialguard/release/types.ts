/**
 * SpatialGuard Phase 4 — DevSecOps Release, Verification and Governance Types
 *
 * Types for:
 * - Security scanning (SAST, Secret Detection, Dependency / SCA)
 * - SBOM and artifact integrity hashing
 * - Staging deployment, smoke tests, and DAST
 * - Cryptographic release evidence bundle
 * - Supervised production promotion and post-release health
 */

export type ReleaseGateDecision = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'BLOCKED';

export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface SecurityFinding {
  id: string;
  scanner: 'SAST' | 'SECRET_DETECTION' | 'DEPENDENCY_SCA' | 'DAST';
  severity: SecuritySeverity;
  title: string;
  description: string;
  location?: string;
  remediationAdvice?: string;
}

export interface SecurityScanSummary {
  scannersExecuted: Array<'SAST' | 'SECRET_DETECTION' | 'DEPENDENCY_SCA' | 'DAST'>;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  findings: SecurityFinding[];
  decision: ReleaseGateDecision;
  blockingReasons: string[];
}

export interface ArtifactFileEntry {
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface ArtifactIntegrityManifest {
  packageIdentity: string; // e.g. open3dfloorplan@0.9.0
  commitSha: string;
  pipelineId: string;
  buildTimestamp: string;
  buildOutputDirectory: string;
  files: ArtifactFileEntry[];
  manifestHash: string; // SHA-256 of canonical sorted file entries
}

export interface SbomDependency {
  name: string;
  version: string;
  direct: boolean;
  license?: string;
  integrity?: string;
}

export interface SbomManifest {
  format: 'CycloneDX' | 'SPDX' | 'SpatialGuard-SBOM';
  specVersion: string;
  packageName: string;
  packageVersion: string;
  commitSha: string;
  generatedAt: string;
  totalDependencies: number;
  directDependenciesCount: number;
  transitiveDependenciesCount: number;
  dependencies: SbomDependency[];
}

export interface StagingSmokeTestResult {
  endpoint: string;
  status: 'PASS' | 'FAIL';
  statusCode: number;
  responseTimeMs: number;
  description: string;
  details?: Record<string, unknown>;
}

export interface StagingVerificationReport {
  stagingUrl: string;
  deploymentTimestamp: string;
  deploymentStatus: 'SUCCESS' | 'FAILED';
  smokeTests: StagingSmokeTestResult[];
  dastFindings: SecurityFinding[];
  decision: ReleaseGateDecision;
  reasons: string[];
}

export interface HumanApprovalRecord {
  approverEmail: string;
  approvedAt: string;
  comment?: string;
  promotionTarget: 'production';
  signatureToken?: string;
}

export interface ProductionPromotionDecision {
  status: 'PROMOTED' | 'BLOCKED' | 'PENDING_APPROVAL';
  candidateCommitSha: string;
  evidenceBundleHash: string;
  approval?: HumanApprovalRecord;
  blockers: string[];
}

export interface PostReleaseHealthCheck {
  targetUrl: string;
  healthy: boolean;
  checkedAt: string;
  metrics: {
    httpStatus: number;
    responseTimeMs: number;
    activeVersion: string;
    invariantsFunctional: boolean;
  };
  errors?: string[];
}

export interface ReleaseEvidenceBundle {
  specVersion: '1.0.0';
  projectName: 'SpatialGuard';
  commitSha: string;
  pipelineId: string;
  branch: string;
  timestamp: string;
  
  // Verification Gates
  typeCheckPassed: boolean;
  unitTestsPassed: boolean;
  spatialVerificationPassed: boolean;
  spatialInvariantCount: number;
  remediationAttempted?: boolean;
  remediationStatus?: string;

  // Security & Supply Chain
  securitySummary: SecurityScanSummary;
  sbomManifest: SbomManifest;
  artifactManifest: ArtifactIntegrityManifest;

  // Staging & DAST
  stagingVerification: StagingVerificationReport;

  // Overall Release Decision
  releaseDecision: ReleaseGateDecision;
  gateSummary: {
    applicationGate: ReleaseGateDecision;
    spatialGate: ReleaseGateDecision;
    securityGate: ReleaseGateDecision;
    integrityGate: ReleaseGateDecision;
    stagingGate: ReleaseGateDecision;
  };
  blockingFindings: string[];

  // Cryptographic Proof
  bundleSha256: string;
  digitalSignature?: {
    algorithm: string;
    signatureHex: string;
    verified: boolean;
    note: string;
  };
}
