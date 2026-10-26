/**
 * SpatialGuard Phase 5 — Incident Correlator & Runtime Monitor
 *
 * Implements:
 * 1. Fingerprinting and grouping of repetitive outages to prevent alert spam
 * 2. Threshold evaluation (latency, consecutive failures)
 * 3. Assembly of structured, auditable OperationalReports
 */

import { createHash } from 'crypto';
import type {
  IncidentRecord,
  LiveVerificationResult,
  MonitoringThresholds,
  OperationalReport,
  RecoveryRecommendation
} from './types';

export class IncidentCorrelator {
  private activeIncidents: Map<string, IncidentRecord> = new Map();

  /**
   * Generates a deterministic fingerprint for an operational failure
   */
  public static computeFingerprint(targetUrl: string, errorCategory: string, commitSha: string): string {
    const raw = `${targetUrl}:${errorCategory}:${commitSha}`;
    return createHash('sha256').update(raw).digest('hex').substring(0, 16);
  }

  /**
   * Correlates a live verification outcome against existing active incidents
   */
  public recordVerificationResult(
    result: LiveVerificationResult,
    expectedCommitSha: string
  ): { incident?: IncidentRecord; isNewIncident: boolean } {
    if (result.overallStatus === 'HEALTHY') {
      // If a previous incident existed for this target, mark it as recovering/recovered
      for (const [fp, inc] of this.activeIncidents.entries()) {
        if (inc.targetUrl === result.targetUrl && inc.status === 'ACTIVE') {
          inc.status = 'RECOVERED';
          inc.lastObservedAt = result.checkedAt;
          inc.verifiedRecovery = true;
          this.activeIncidents.delete(fp);
          return { incident: inc, isNewIncident: false };
        }
      }
      return { isNewIncident: false };
    }

    // Failure occurred: determine error category
    const errorCategory = result.versionMatch === false ? 'VERSION_DRIFT' : 'ENDPOINT_FAILURE';
    const deployedCommit = result.versionInfo?.commitSha || expectedCommitSha;
    const fingerprint = IncidentCorrelator.computeFingerprint(result.targetUrl, errorCategory, deployedCommit);

    const existing = this.activeIncidents.get(fingerprint);
    if (existing) {
      existing.occurrenceCount += 1;
      existing.lastObservedAt = result.checkedAt;
      existing.diagnosticSummary = result.failures.join('; ');
      return { incident: existing, isNewIncident: false };
    }

    const newIncident: IncidentRecord = {
      incidentId: `INC-${Date.now().toString(36).toUpperCase()}`,
      fingerprint,
      targetUrl: result.targetUrl,
      releaseCommitSha: deployedCommit,
      firstObservedAt: result.checkedAt,
      lastObservedAt: result.checkedAt,
      occurrenceCount: 1,
      status: 'ACTIVE',
      diagnosticSummary: result.failures.join('; '),
      recoveryAttempted: false,
      verifiedRecovery: false
    };

    this.activeIncidents.set(fingerprint, newIncident);
    return { incident: newIncident, isNewIncident: true };
  }

  /**
   * Generates a comprehensive OperationalReport
   */
  public static generateOperationalReport(params: {
    environment: 'staging' | 'production' | 'preview';
    verificationResult: LiveVerificationResult;
    expectedCommitSha: string;
    incident?: IncidentRecord;
    recoveryRecommendation?: RecoveryRecommendation;
  }): OperationalReport {
    const { verificationResult, environment, expectedCommitSha, incident, recoveryRecommendation } = params;

    const failedCount = verificationResult.endpointChecks.filter(c => c.status !== 'PASS').length;
    const avgResponseTime = verificationResult.endpointChecks.length > 0
      ? verificationResult.endpointChecks.reduce((acc, c) => acc + c.responseTimeMs, 0) / verificationResult.endpointChecks.length
      : 0;

    let summary = `[${environment.toUpperCase()}] Deployment is ${verificationResult.overallStatus}.`;
    if (verificationResult.overallStatus !== 'HEALTHY') {
      summary += ` Observed ${verificationResult.failures.length} issues: ${verificationResult.failures.join(', ')}`;
    }

    return {
      specVersion: '1.0.0',
      reportId: `OPR-${Date.now().toString(36).toUpperCase()}`,
      projectName: 'SpatialGuard',
      environment,
      targetUrl: verificationResult.targetUrl,
      timestamp: verificationResult.checkedAt,
      healthStatus: verificationResult.overallStatus,
      deployedCommitSha: verificationResult.versionInfo?.commitSha || 'unknown',
      expectedCommitSha,
      versionMatchesExpected: verificationResult.versionMatch,
      metrics: {
        responseTimeMs: Math.round(avgResponseTime),
        endpointsCheckedCount: verificationResult.endpointChecks.length,
        endpointsFailedCount: failedCount
      },
      activeIncident: incident,
      recoveryRecommendation,
      humanInterventionRequired: verificationResult.overallStatus !== 'HEALTHY',
      summary
    };
  }
}
