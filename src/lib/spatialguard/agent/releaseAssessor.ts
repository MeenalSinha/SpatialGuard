import type {
  AssessmentStatus,
  PipelineContext,
  SpatialImpactAssessment,
  SpatialInvestigationReport,
  SpatialReleaseAssessment,
} from './types';

/**
 * Agent 3: Synthesizes impact analysis and test evidence into an authoritative, evidence-backed release assessment.
 */
export function assessSpatialRelease(
  impact: SpatialImpactAssessment,
  investigation: SpatialInvestigationReport,
  context: PipelineContext = {}
): SpatialReleaseAssessment {
  const now = new Date().toISOString();
  const blockingFindings: string[] = [];
  const unresolvedRisks: string[] = [];
  const recommendedActions: string[] = [];
  const limitations: string[] = [
    'Supervised Autonomy Level: Assessment is an engineering advisory and does not replace human merge review.',
    'Phase 2 Scope: Automated code patching and production deployment are excluded.',
  ];

  let status: AssessmentStatus = 'INCONCLUSIVE';
  let summary = '';

  // 1. Check for missing or corrupted evidence
  if (investigation.verificationStatus === 'MISSING_EVIDENCE') {
    status = 'INCONCLUSIVE';
    summary = 'Release assessment inconclusive: Spatial test results artifact was not found.';
    unresolvedRisks.push('No spatial test evidence available from CI pipeline.');
    recommendedActions.push('Ensure CI pipeline executes `npm run test:spatial` and publishes `test-results/spatial-results.json`.');
  } else if (investigation.verificationStatus === 'MALFORMED_EVIDENCE') {
    status = 'INCONCLUSIVE';
    summary = 'Release assessment inconclusive: Spatial test results artifact could not be parsed.';
    unresolvedRisks.push('Test results JSON is corrupted or in an unexpected schema.');
    recommendedActions.push('Check Vitest JSON reporter configuration and pipeline logs.');
  } else if (investigation.verificationStatus === 'STALE_EVIDENCE') {
    status = 'INCONCLUSIVE';
    summary = 'Release assessment inconclusive: Test evidence is stale and predates current commit.';
    unresolvedRisks.push('Report artifact timestamp does not correlate with current commit.');
    recommendedActions.push('Trigger a fresh CI pipeline for the active merge request commit.');
  } else if (investigation.verificationStatus === 'CONFIRMED_FAILURE') {
    // 2. Confirmed spatial regression / test failure
    status = 'BLOCKED';
    summary = `Release BLOCKED: Detected ${investigation.failedCount} spatial verification failure(s).`;

    for (const fail of investigation.failedChecks) {
      const metricInfo = fail.delta !== undefined ? ` (delta: ${fail.delta}${fail.unit ? ` ${fail.unit}` : ''})` : '';
      blockingFindings.push(`[${fail.invariantId}] ${fail.testName}${metricInfo}: ${fail.suspectedCause}`);
    }

    recommendedActions.push('Inspect failure diagnostics and revert or fix the geometry violation.');
    recommendedActions.push('Re-run `npm run test:spatial` locally to verify regression resolution before pushing.');
  } else if (investigation.verificationStatus === 'VERIFIED_PASS') {
    // 3. Tests passed - verify scope coverage
    const missingInvariants = impact.impactedInvariants
      .map(i => i.invariantId)
      .filter(id => !investigation.evaluatedInvariants.includes(id));

    if (impact.isSpatialChange && missingInvariants.length > 0) {
      status = 'INCONCLUSIVE';
      summary = `Release assessment inconclusive: Code modifications impacted ${missingInvariants.join(', ')}, but those invariants were not evaluated in the test report.`;
      unresolvedRisks.push(`Uncovered invariants in test run: ${missingInvariants.join(', ')}`);
      recommendedActions.push(`Extend spatial test suite to execute ${missingInvariants.join(', ')}.`);
    } else {
      status = 'READY_FOR_FURTHER_REVIEW';
      summary = `Release READY FOR FURTHER REVIEW: All ${investigation.totalTests} spatial check(s) passed across ${investigation.evaluatedInvariants.length} invariant(s).`;
      recommendedActions.push('Proceed to peer code review and integration validation.');
    }
  }

  // Non-spatial changes note
  if (!impact.isSpatialChange && status === 'READY_FOR_FURTHER_REVIEW') {
    summary += ' (No spatial modules modified in this change set).';
  }

  return {
    status,
    summary,
    projectContext: {
      ...investigation.pipelineContext,
      ...context,
    },
    impactScope: {
      isSpatialChange: impact.isSpatialChange,
      risk: impact.riskClassification,
      impactedInvariants: impact.impactedInvariants.map(i => i.invariantId),
    },
    verification: {
      status: investigation.verificationStatus,
      totalTests: investigation.totalTests,
      failedTests: investigation.failedCount,
      verifiedInvariants: investigation.evaluatedInvariants,
    },
    blockingFindings,
    unresolvedRisks,
    recommendedActions,
    limitations,
    generatedAt: now,
  };
}
