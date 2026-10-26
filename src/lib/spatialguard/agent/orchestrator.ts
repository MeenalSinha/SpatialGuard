import type {
  ChangedFile,
  PipelineContext,
  SpatialImpactAssessment,
  SpatialInvestigationReport,
  SpatialReleaseAssessment,
} from './types';
import { analyzeSpatialImpact } from './impactAnalyzer';
import { investigateSpatialEvidence } from './evidenceInvestigator';
import { assessSpatialRelease } from './releaseAssessor';

export interface WorkflowResult {
  impact: SpatialImpactAssessment;
  investigation: SpatialInvestigationReport;
  assessment: SpatialReleaseAssessment;
}

/**
 * Executes the complete SpatialGuard 3-agent quality engineering workflow:
 * Step 1: Change-Aware Spatial Impact Analysis (Agent 1)
 * Step 2: Evidence-Driven Failure Investigation (Agent 2)
 * Step 3: Spatial Release Readiness Assessment (Agent 3)
 */
export function runSpatialWorkflow(
  changedFiles: Array<string | ChangedFile>,
  testEvidenceJson?: string | null,
  context: PipelineContext = {}
): WorkflowResult {
  // Step 1: Analyze changes
  const impact = analyzeSpatialImpact(changedFiles);

  // Step 2: Investigate test evidence
  const investigation = investigateSpatialEvidence(testEvidenceJson, context, impact);

  // Step 3: Assess release readiness
  const assessment = assessSpatialRelease(impact, investigation, context);

  return {
    impact,
    investigation,
    assessment,
  };
}
