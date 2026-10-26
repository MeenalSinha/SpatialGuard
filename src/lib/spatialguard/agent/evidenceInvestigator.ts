import type {
  EvidenceSufficiency,
  FailedCheckDetail,
  PipelineContext,
  SpatialImpactAssessment,
  SpatialInvestigationReport,
  VerificationOutcome,
} from './types';
import type { SpatialAuditReport } from '../types';

interface VitestAssertionResult {
  ancestorTitles: string[];
  fullName: string;
  status: 'passed' | 'failed' | 'pending';
  title: string;
  duration?: number;
  failureMessages: string[];
}

interface VitestJsonReport {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  startTime: number;
  success: boolean;
  testResults: Array<{
    name: string;
    status: string;
    assertionResults: VitestAssertionResult[];
  }>;
}

function extractInvariantId(title: string, ancestors: string[]): string {
  const combined = [...ancestors, title].join(' ');
  const match = combined.match(/INV-[A-Z]+-\d+/);
  return match ? match[0] : 'INV-UNKNOWN';
}

function parseDeltaAndUnit(failureMessage: string): { delta?: number; unit?: string; expected?: unknown; actual?: unknown } {
  const result: { delta?: number; unit?: string; expected?: unknown; actual?: unknown } = {};

  // E.g. "overflows host wall boundaries [0, 400.0 cm] by 30.0 cm"
  const overflowMatch = failureMessage.match(/by\s+([0-9.]+)\s*([a-zA-Z²]+)/);
  if (overflowMatch) {
    result.delta = parseFloat(overflowMatch[1]);
    result.unit = overflowMatch[2];
  }

  // E.g. "expected 12.0 m², got 0 m²" or "expected 12 m², resolved 0.00 m²"
  const expActMatch = failureMessage.match(/expected\s+([0-9.]+)\s*([a-zA-Z²]*)[^0-9]+([0-9.]+)\s*([a-zA-Z²]*)/i);
  if (expActMatch) {
    result.expected = parseFloat(expActMatch[1]);
    result.actual = parseFloat(expActMatch[3]);
    if (expActMatch[2]) result.unit = expActMatch[2];
  }

  return result;
}

function extractSourceLocations(failureMessage: string): string[] {
  const locations: string[] = [];
  const lines = failureMessage.split('\n');
  for (const line of lines) {
    const match = line.match(/(?:at\s+|❯\s+)(.*:\d+:\d+)/);
    if (match) locations.push(match[1].trim());
  }
  return locations;
}

function deduceSuspectedCause(
  invariantId: string,
  failureMessage: string,
  impact?: SpatialImpactAssessment
): string {
  if (invariantId === 'INV-OPENING-001') {
    if (failureMessage.includes('exceeds host wall')) {
      return 'Opening width is specified larger than the host wall physical arc-length capacity.';
    }
    if (failureMessage.includes('overflows host wall boundaries')) {
      return 'Opening position parameter places jamb coordinates past host wall endpoint corners.';
    }
    if (failureMessage.includes('non-existent host wall')) {
      return 'Opening references an invalid or unresolvable wallId not found in the current floor.';
    }
  }

  if (invariantId === 'INV-INTERCHANGE-001') {
    if (failureMessage.includes('length changed')) {
      return 'Interchange matrix transformation or unit conversion (cm to m) altered wall Euclidean distance.';
    }
    if (failureMessage.includes('Room area altered') || failureMessage.includes('failed to detect enclosed room')) {
      return 'Re-imported wall endpoints failed to snap within 5cm tolerance, breaking the planar room cycle.';
    }
  }

  if (invariantId === 'INV-ROOM-001') {
    if (failureMessage.includes('found 0') || failureMessage.includes('no longer form a closed boundary')) {
      return 'Planar face traversal failed to close; one or more perimeter walls are missing or disconnected.';
    }
    if (failureMessage.includes('area')) {
      return 'Detected polygon area departs from independent shoelace ground truth.';
    }
  }

  if (impact && impact.spatialFiles.length > 0) {
    return `Potential regression originating from recent changes to: ${impact.spatialFiles.join(', ')}`;
  }

  return 'Deterministic assertion failure detected during spatial invariant execution.';
}

/**
 * Investigates a spatial test report, validates its integrity, and extracts evidence.
 */
export function investigateSpatialEvidence(
  rawContent: string | null | undefined,
  context: PipelineContext = {},
  impact?: SpatialImpactAssessment
): SpatialInvestigationReport {
  const now = new Date().toISOString();
  const artifactSource = 'test-results/spatial-results.json';

  // 1. Check missing evidence
  if (rawContent === null || rawContent === undefined || rawContent.trim() === '') {
    return {
      verificationStatus: 'MISSING_EVIDENCE',
      pipelineContext: context,
      totalTests: 0,
      passedCount: 0,
      failedCount: 0,
      evaluatedInvariants: [],
      failedChecks: [],
      evidenceSufficiency: 'insufficient',
      diagnostics: ['Spatial test results artifact is missing or empty. CI job may have failed prior to test completion.'],
      artifactSource,
      timestamp: now,
    };
  }

  // 2. Parse JSON evidence
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    return {
      verificationStatus: 'MALFORMED_EVIDENCE',
      pipelineContext: context,
      totalTests: 0,
      passedCount: 0,
      failedCount: 0,
      evaluatedInvariants: [],
      failedChecks: [],
      evidenceSufficiency: 'insufficient',
      diagnostics: [`Failed to parse JSON test report: ${err instanceof Error ? err.message : String(err)}`],
      artifactSource,
      timestamp: now,
    };
  }

  // 3. Stale check (if context specifies a commit timestamp older than report)
  if (context.timestamp && (parsed as VitestJsonReport).startTime) {
    const reportTime = (parsed as VitestJsonReport).startTime;
    const commitTime = new Date(context.timestamp).getTime();
    // If report was generated more than 1 hour before commit, flag as stale
    if (reportTime < commitTime - 3600_000) {
      return {
        verificationStatus: 'STALE_EVIDENCE',
        pipelineContext: context,
        totalTests: (parsed as VitestJsonReport).numTotalTests ?? 0,
        passedCount: (parsed as VitestJsonReport).numPassedTests ?? 0,
        failedCount: (parsed as VitestJsonReport).numFailedTests ?? 0,
        evaluatedInvariants: [],
        failedChecks: [],
        evidenceSufficiency: 'insufficient',
        diagnostics: [`Report generation timestamp (${new Date(reportTime).toISOString()}) predates commit timestamp (${context.timestamp}).`],
        artifactSource,
        timestamp: now,
      };
    }
  }

  // 4. Handle Vitest Native JSON format
  if (typeof parsed === 'object' && parsed !== null && 'testResults' in parsed) {
    const vitestReport = parsed as VitestJsonReport;
    const totalTests = vitestReport.numTotalTests ?? 0;
    const passedCount = vitestReport.numPassedTests ?? 0;
    const failedCount = vitestReport.numFailedTests ?? 0;
    const evaluatedInvariants = new Set<string>();
    const failedChecks: FailedCheckDetail[] = [];
    const diagnostics: string[] = [];

    for (const suite of vitestReport.testResults) {
      for (const assertion of suite.assertionResults) {
        const invId = extractInvariantId(assertion.title, assertion.ancestorTitles);
        if (invId !== 'INV-UNKNOWN') evaluatedInvariants.add(invId);

        if (assertion.status === 'failed') {
          const failureMsg = assertion.failureMessages.join('\n');
          const metrics = parseDeltaAndUnit(failureMsg);
          const sourceLocations = extractSourceLocations(failureMsg);
          const suspectedCause = deduceSuspectedCause(invId, failureMsg, impact);

          failedChecks.push({
            invariantId: invId,
            testName: assertion.fullName || assertion.title,
            expected: metrics.expected,
            actual: metrics.actual,
            delta: metrics.delta,
            unit: metrics.unit,
            failureMessage: failureMsg,
            suspectedCause,
            sourceLocations,
          });

          diagnostics.push(`[${invId}] Failure in '${assertion.title}': ${suspectedCause}`);
        }
      }
    }

    const verificationStatus: VerificationOutcome = failedCount === 0 && totalTests > 0
      ? 'VERIFIED_PASS'
      : 'CONFIRMED_FAILURE';

    return {
      verificationStatus,
      pipelineContext: context,
      totalTests,
      passedCount,
      failedCount,
      evaluatedInvariants: Array.from(evaluatedInvariants),
      failedChecks,
      evidenceSufficiency: totalTests > 0 ? 'sufficient' : 'insufficient',
      diagnostics,
      artifactSource,
      timestamp: now,
    };
  }

  // 5. Handle SpatialAuditReport format
  if (typeof parsed === 'object' && parsed !== null && 'summary' in parsed && 'results' in parsed) {
    const auditReport = parsed as SpatialAuditReport;
    const totalTests = auditReport.summary.total;
    const passedCount = auditReport.summary.passed;
    const failedCount = auditReport.summary.failed + auditReport.summary.errors;
    const evaluatedInvariants = new Set<string>();
    const failedChecks: FailedCheckDetail[] = [];
    const diagnostics: string[] = [];

    for (const res of auditReport.results) {
      evaluatedInvariants.add(res.invariantId);
      if (res.status !== 'passed') {
        const suspectedCause = deduceSuspectedCause(res.invariantId, res.message, impact);
        failedChecks.push({
          invariantId: res.invariantId,
          testName: `${res.invariantId} [${res.target.kind ?? 'element'}:${res.target.elementId ?? 'all'}]`,
          expected: res.metrics.expected,
          actual: res.metrics.actual,
          delta: res.metrics.delta,
          unit: res.metrics.unit,
          failureMessage: res.message,
          suspectedCause,
          sourceLocations: [],
        });
        diagnostics.push(`[${res.invariantId}] ${res.message}`);
      }
    }

    const verificationStatus: VerificationOutcome = failedCount === 0 && totalTests > 0
      ? 'VERIFIED_PASS'
      : 'CONFIRMED_FAILURE';

    return {
      verificationStatus,
      pipelineContext: context,
      totalTests,
      passedCount,
      failedCount,
      evaluatedInvariants: Array.from(evaluatedInvariants),
      failedChecks,
      evidenceSufficiency: totalTests > 0 ? 'sufficient' : 'insufficient',
      diagnostics,
      artifactSource,
      timestamp: now,
    };
  }

  return {
    verificationStatus: 'MALFORMED_EVIDENCE',
    pipelineContext: context,
    totalTests: 0,
    passedCount: 0,
    failedCount: 0,
    evaluatedInvariants: [],
    failedChecks: [],
    evidenceSufficiency: 'insufficient',
    diagnostics: ['Report does not match Vitest JSON or SpatialAuditReport schema.'],
    artifactSource,
    timestamp: now,
  };
}
