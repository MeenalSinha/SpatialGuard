import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  analyzeSpatialImpact,
  investigateSpatialEvidence,
  assessSpatialRelease,
  runSpatialWorkflow,
} from '$lib/spatialguard';

const CANONICAL_PASSING_REPORT = JSON.stringify({
  numTotalTestSuites: 1,
  numPassedTestSuites: 1,
  numFailedTestSuites: 0,
  numTotalTests: 8,
  numPassedTests: 8,
  numFailedTests: 0,
  testResults: [
    {
      name: 'tests/spatialguard/invariants.test.ts',
      status: 'passed',
      assertionResults: [
        { title: 'Spatial Invariant INV-OPENING-001: Opening Boundary Containment', fullName: 'Spatial Invariant INV-OPENING-001: Opening Boundary Containment', ancestorTitles: ['tests/spatialguard/invariants.test.ts'], status: 'passed', failureMessages: [] },
        { title: 'Spatial Invariant INV-INTERCHANGE-001: Prepared RoomPlan Conservation', fullName: 'Spatial Invariant INV-INTERCHANGE-001: Prepared RoomPlan Conservation', ancestorTitles: ['tests/spatialguard/invariants.test.ts'], status: 'passed', failureMessages: [] },
        { title: 'Spatial Invariant INV-ROOM-001: Enclosed Planar Room Boundary', fullName: 'Spatial Invariant INV-ROOM-001: Enclosed Planar Room Boundary', ancestorTitles: ['tests/spatialguard/invariants.test.ts'], status: 'passed', failureMessages: [] }
      ]
    }
  ]
});

describe('SpatialGuard Phase 2 — AI Agent Workflow Suite', () => {
  beforeEach(() => {
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/spatial-results.json', CANONICAL_PASSING_REPORT, 'utf8');
  });

  describe('Agent 1: Spatial Impact Analyzer', () => {
    it('handles empty change set safely', () => {
      const assessment = analyzeSpatialImpact([]);
      expect(assessment.isSpatialChange).toBe(false);
      expect(assessment.riskClassification).toBe('NEGLIGIBLE');
      expect(assessment.confidence).toBe('inconclusive');
      expect(assessment.impactedInvariants).toHaveLength(0);
    });

    it('classifies non-spatial files as negligible risk without impacting invariants', () => {
      const assessment = analyzeSpatialImpact([
        'docs/user-guide.md',
        'src/app.css',
        'static/favicon.png',
        'README.md',
      ]);
      expect(assessment.isSpatialChange).toBe(false);
      expect(assessment.riskClassification).toBe('NEGLIGIBLE');
      expect(assessment.impactedInvariants).toHaveLength(0);
      expect(assessment.evidence).toContain('No spatial geometry or transformation modules were modified.');
    });

    it('identifies INV-OPENING-001 impact when opening utilities are modified', () => {
      const assessment = analyzeSpatialImpact([
        {
          path: 'src/lib/utils/planOpening.ts',
          diff: '+ export function planOpening(wall: Wall, position: number, width: number)',
          modifiedSymbols: ['planOpening'],
        },
      ]);
      expect(assessment.isSpatialChange).toBe(true);
      expect(assessment.riskClassification).toBe('HIGH');
      expect(assessment.impactedInvariants.map(i => i.invariantId)).toContain('INV-OPENING-001');
      expect(assessment.spatialFiles).toContain('src/lib/utils/planOpening.ts');

      const inv = assessment.impactedInvariants.find(i => i.invariantId === 'INV-OPENING-001')!;
      expect(inv.severity).toBe('high');
      expect(inv.affectedSymbols).toContain('planOpening');
      expect(inv.suggestedTests).toContain('tests/spatialguard/invariants.test.ts');
    });

    it('identifies CRITICAL risk when core types and multiple geometry modules are modified', () => {
      const assessment = analyzeSpatialImpact([
        'src/lib/models/types.ts',
        'src/lib/utils/roomDetection.ts',
        'src/lib/utils/interchange.ts',
      ]);
      expect(assessment.isSpatialChange).toBe(true);
      expect(assessment.riskClassification).toBe('CRITICAL');
      const invIds = assessment.impactedInvariants.map(i => i.invariantId);
      expect(invIds).toContain('INV-OPENING-001');
      expect(invIds).toContain('INV-INTERCHANGE-001');
      expect(invIds).toContain('INV-ROOM-001');
    });
  });

  describe('Agent 2: Spatial Evidence Investigator', () => {
    it('investigates real on-disk spatial test report from Phase 1 execution', () => {
      const reportPath = 'test-results/spatial-results.json';
      expect(existsSync(reportPath), 'spatial-results.json should exist from test:spatial').toBe(true);
      const rawContent = readFileSync(reportPath, 'utf8');

      const investigation = investigateSpatialEvidence(rawContent, {
        commitSha: 'cb1fbf2',
        pipelineId: 'pipeline-1234',
      });

      expect(investigation.verificationStatus).toBe('VERIFIED_PASS');
      expect(investigation.totalTests).toBeGreaterThanOrEqual(8);
      expect(investigation.failedCount).toBe(0);
      expect(investigation.evidenceSufficiency).toBe('sufficient');
      expect(investigation.evaluatedInvariants).toContain('INV-OPENING-001');
      expect(investigation.evaluatedInvariants).toContain('INV-INTERCHANGE-001');
      expect(investigation.evaluatedInvariants).toContain('INV-ROOM-001');
      expect(investigation.failedChecks).toHaveLength(0);
    });

    it('correctly investigates and diagnoses a simulated spatial failure report', () => {
      const simulatedFailureReport = JSON.stringify({
        numTotalTests: 8,
        numPassedTests: 7,
        numFailedTests: 1,
        startTime: Date.now(),
        success: false,
        testResults: [
          {
            name: 'tests/spatialguard/invariants.test.ts',
            status: 'failed',
            assertionResults: [
              {
                ancestorTitles: [
                  'SpatialGuard Core — Invariant Verification Suite',
                  'INV-OPENING-001: Opening Attachment and Interval Boundary Containment',
                ],
                fullName: 'SpatialGuard Core INV-OPENING-001 corner overflow door check',
                status: 'failed',
                title: 'detects and rejects door jamb overflowing wall corner',
                failureMessages: [
                  'AssertionError: Opening door-corner-overflow jamb span [330.0 cm, 430.0 cm] overflows host wall boundaries [0, 400.0 cm] by 30.0 cm.\n    at evaluateOpeningIntegrity (src/lib/spatialguard/evaluator.ts:130:15)',
                ],
              },
            ],
          },
        ],
      });

      const investigation = investigateSpatialEvidence(simulatedFailureReport, {
        commitSha: 'test-sha',
      });

      expect(investigation.verificationStatus).toBe('CONFIRMED_FAILURE');
      expect(investigation.failedCount).toBe(1);
      expect(investigation.failedChecks).toHaveLength(1);

      const check = investigation.failedChecks[0];
      expect(check.invariantId).toBe('INV-OPENING-001');
      expect(check.delta).toBe(30);
      expect(check.unit).toBe('cm');
      expect(check.suspectedCause).toContain('Opening position parameter places jamb coordinates past host wall endpoint corners.');
      expect(check.sourceLocations.some(l => l.includes('src/lib/spatialguard/evaluator.ts'))).toBe(true);
    });

    it('handles missing evidence gracefully without throwing', () => {
      const investigation = investigateSpatialEvidence(null);
      expect(investigation.verificationStatus).toBe('MISSING_EVIDENCE');
      expect(investigation.evidenceSufficiency).toBe('insufficient');
      expect(investigation.diagnostics[0]).toContain('missing or empty');
    });

    it('handles malformed evidence safely without crashing', () => {
      const investigation = investigateSpatialEvidence('{ bad json ...');
      expect(investigation.verificationStatus).toBe('MALFORMED_EVIDENCE');
      expect(investigation.evidenceSufficiency).toBe('insufficient');
      expect(investigation.diagnostics[0]).toContain('Failed to parse JSON');
    });

    it('flags stale evidence when report timestamp predates commit by more than 1 hour', () => {
      const oldReport = JSON.stringify({
        numTotalTests: 8,
        numPassedTests: 8,
        numFailedTests: 0,
        startTime: new Date('2026-01-01T00:00:00Z').getTime(),
        testResults: [],
      });

      const investigation = investigateSpatialEvidence(oldReport, {
        commitSha: 'new-commit',
        timestamp: '2026-01-01T05:00:00Z', // 5 hours after report
      });

      expect(investigation.verificationStatus).toBe('STALE_EVIDENCE');
      expect(investigation.evidenceSufficiency).toBe('insufficient');
    });
  });

  describe('Agent 3: Spatial Release Assessor', () => {
    it('assesses READY_FOR_FURTHER_REVIEW when all required spatial evidence passes', () => {
      const impact = analyzeSpatialImpact(['src/lib/utils/planOpening.ts']);
      const investigation = investigateSpatialEvidence(
        readFileSync('test-results/spatial-results.json', 'utf8')
      );

      const assessment = assessSpatialRelease(impact, investigation, { mrId: '101' });

      expect(assessment.status).toBe('READY_FOR_FURTHER_REVIEW');
      expect(assessment.blockingFindings).toHaveLength(0);
      expect(assessment.summary).toContain('READY FOR FURTHER REVIEW');
      expect(assessment.limitations).toContain('Supervised Autonomy Level: Assessment is an engineering advisory and does not replace human merge review.');
    });

    it('assesses BLOCKED when confirmed failure is reported', () => {
      const impact = analyzeSpatialImpact(['src/lib/utils/planOpening.ts']);
      const failedReport = {
        verificationStatus: 'CONFIRMED_FAILURE' as const,
        pipelineContext: { commitSha: 'abc1234' },
        totalTests: 8,
        passedCount: 7,
        failedCount: 1,
        evaluatedInvariants: ['INV-OPENING-001'],
        failedChecks: [
          {
            invariantId: 'INV-OPENING-001',
            testName: 'corner overflow',
            delta: 30,
            unit: 'cm',
            failureMessage: 'overflows by 30cm',
            suspectedCause: 'Opening exceeds wall boundary.',
            sourceLocations: ['src/lib/spatialguard/evaluator.ts:100'],
          },
        ],
        evidenceSufficiency: 'sufficient' as const,
        diagnostics: ['failure detected'],
        artifactSource: 'test-results/spatial-results.json',
        timestamp: new Date().toISOString(),
      };

      const assessment = assessSpatialRelease(impact, failedReport);

      expect(assessment.status).toBe('BLOCKED');
      expect(assessment.blockingFindings).toHaveLength(1);
      expect(assessment.blockingFindings[0]).toContain('[INV-OPENING-001]');
      expect(assessment.blockingFindings[0]).toContain('30 cm');
      expect(assessment.recommendedActions.some(a => a.includes('revert or fix'))).toBe(true);
    });

    it('assesses INCONCLUSIVE when test evidence is missing', () => {
      const impact = analyzeSpatialImpact(['src/lib/utils/planOpening.ts']);
      const missingReport = investigateSpatialEvidence(null);

      const assessment = assessSpatialRelease(impact, missingReport);

      expect(assessment.status).toBe('INCONCLUSIVE');
      expect(assessment.unresolvedRisks.some(r => r.includes('No spatial test evidence'))).toBe(true);
    });

    it('assesses INCONCLUSIVE when impacted invariant was not evaluated in test results', () => {
      const impact = analyzeSpatialImpact(['src/lib/utils/interchange.ts']); // Impacts INV-INTERCHANGE-001
      const partialInvestigation = {
        verificationStatus: 'VERIFIED_PASS' as const,
        pipelineContext: {},
        totalTests: 4,
        passedCount: 4,
        failedCount: 0,
        evaluatedInvariants: ['INV-OPENING-001'], // Missing INV-INTERCHANGE-001
        failedChecks: [],
        evidenceSufficiency: 'sufficient' as const,
        diagnostics: [],
        artifactSource: 'test-results/spatial-results.json',
        timestamp: new Date().toISOString(),
      };

      const assessment = assessSpatialRelease(impact, partialInvestigation);

      expect(assessment.status).toBe('INCONCLUSIVE');
      expect(assessment.summary).toContain('INV-INTERCHANGE-001');
      expect(assessment.unresolvedRisks.some(r => r.includes('Uncovered invariants'))).toBe(true);
    });
  });

  describe('End-to-End Orchestrator', () => {
    it('runs full 3-agent quality engineering pipeline end-to-end', () => {
      const rawEvidence = readFileSync('test-results/spatial-results.json', 'utf8');
      const workflow = runSpatialWorkflow(
        ['src/lib/utils/planOpening.ts', 'docs/user-guide.md'],
        rawEvidence,
        { commitSha: 'cb1fbf2', mrId: '42' }
      );

      // Verify Stage 1
      expect(workflow.impact.isSpatialChange).toBe(true);
      expect(workflow.impact.spatialFiles).toEqual(['src/lib/utils/planOpening.ts']);
      expect(workflow.impact.impactedInvariants.map(i => i.invariantId)).toContain('INV-OPENING-001');

      // Verify Stage 2
      expect(workflow.investigation.verificationStatus).toBe('VERIFIED_PASS');
      expect(workflow.investigation.totalTests).toBeGreaterThanOrEqual(8);

      // Verify Stage 3
      expect(workflow.assessment.status).toBe('READY_FOR_FURTHER_REVIEW');
      expect(workflow.assessment.projectContext.commitSha).toBe('cb1fbf2');
      expect(workflow.assessment.projectContext.mrId).toBe('42');
    });
  });
});
