export type InvariantSeverity = 'high' | 'medium' | 'low';
export type RiskClassification = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NEGLIGIBLE';
export type VerificationOutcome =
  | 'VERIFIED_PASS'
  | 'CONFIRMED_FAILURE'
  | 'MISSING_EVIDENCE'
  | 'MALFORMED_EVIDENCE'
  | 'STALE_EVIDENCE';
export type AssessmentStatus = 'READY_FOR_FURTHER_REVIEW' | 'BLOCKED' | 'INCONCLUSIVE';
export type EvidenceSufficiency = 'sufficient' | 'partial' | 'insufficient';

export interface ChangedFile {
  path: string;
  status?: 'modified' | 'added' | 'deleted' | 'renamed';
  diff?: string;
  modifiedSymbols?: string[];
}

export interface InvariantImpact {
  invariantId: string;
  name: string;
  severity: InvariantSeverity;
  reason: string;
  affectedSymbols: string[];
  suggestedTests: string[];
}

export interface SpatialImpactAssessment {
  changedFiles: string[];
  spatialFiles: string[];
  impactedInvariants: InvariantImpact[];
  riskClassification: RiskClassification;
  isSpatialChange: boolean;
  suggestedAction: string;
  evidence: string[];
  confidence: 'high' | 'medium' | 'low' | 'inconclusive';
  timestamp: string;
}

export interface FailedCheckDetail {
  invariantId: string;
  testName: string;
  expected?: unknown;
  actual?: unknown;
  delta?: number;
  unit?: string;
  failureMessage: string;
  suspectedCause: string;
  sourceLocations: string[];
}

export interface PipelineContext {
  projectId?: string;
  pipelineId?: string;
  commitSha?: string;
  mrId?: string;
  branch?: string;
  timestamp?: string;
}

export interface SpatialInvestigationReport {
  verificationStatus: VerificationOutcome;
  pipelineContext: PipelineContext;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  evaluatedInvariants: string[];
  failedChecks: FailedCheckDetail[];
  evidenceSufficiency: EvidenceSufficiency;
  diagnostics: string[];
  artifactSource: string;
  timestamp: string;
}

export interface SpatialReleaseAssessment {
  status: AssessmentStatus;
  summary: string;
  projectContext: PipelineContext;
  impactScope: {
    isSpatialChange: boolean;
    risk: RiskClassification;
    impactedInvariants: string[];
  };
  verification: {
    status: VerificationOutcome;
    totalTests: number;
    failedTests: number;
    verifiedInvariants: string[];
  };
  blockingFindings: string[];
  unresolvedRisks: string[];
  recommendedActions: string[];
  limitations: string[];
  generatedAt: string;
}
