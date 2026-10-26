import { describe, it, expect, beforeEach } from 'vitest';
import {
  LiveVerifier,
  IncidentCorrelator,
  RecoveryEngine,
  type LiveVerificationResult,
  type RecoveryRecommendation
} from '../../src/lib/spatialguard/operations';
import type { ReleaseEvidenceBundle } from '../../src/lib/spatialguard/release';

describe('SpatialGuard Phase 5 — Production Operations, Runtime Verification & Recovery', () => {
  const TARGET_URL = 'https://app.spatialguard.internal';
  const VERIFIED_COMMIT = '8fca9821626b287cff684e38aad811f9771adeb6';
  const PREVIOUS_COMMIT = '97af466a0123456789abcdef0123456789abcdef';

  // 1. Live Deployment & Version Verification Tests
  describe('LiveVerifier', () => {
    it('verifies a healthy deployment when all endpoints respond with valid version', async () => {
      const result = await LiveVerifier.verifyDeployment(
        { baseUrl: TARGET_URL, expectedCommitSha: VERIFIED_COMMIT },
        async (url) => {
          if (url.endsWith('/health')) {
            return { status: 200, body: JSON.stringify({ status: 'HEALTHY', version: '0.9.0' }) };
          }
          if (url.endsWith('/api/version')) {
            return {
              status: 200,
              body: JSON.stringify({ version: '0.9.0', commitSha: VERIFIED_COMMIT })
            };
          }
          return {
            status: 200,
            headers: { 'x-content-type-options': 'nosniff' },
            body: '<!DOCTYPE html><html><body>OpenPlan3D</body></html>'
          };
        }
      );

      expect(result.overallStatus).toBe('HEALTHY');
      expect(result.versionMatch).toBe(true);
      expect(result.endpointChecks.length).toBe(3);
      expect(result.failures.length).toBe(0);
    });

    it('detects runtime version drift when deployed commit does not match expected release', async () => {
      const result = await LiveVerifier.verifyDeployment(
        { baseUrl: TARGET_URL, expectedCommitSha: VERIFIED_COMMIT },
        async (url) => {
          if (url.endsWith('/api/version')) {
            return {
              status: 200,
              body: JSON.stringify({ version: '0.9.0', commitSha: 'unverified_old_commit_789' })
            };
          }
          return { status: 200, headers: { 'x-content-type-options': 'nosniff' }, body: 'OK' };
        }
      );

      expect(result.overallStatus).toBe('UNHEALTHY');
      expect(result.versionMatch).toBe(false);
      expect(result.failures.some(f => f.includes('Version drift'))).toBe(true);
    });

    it('fails closed when an endpoint returns HTTP 502 or 500 error', async () => {
      const result = await LiveVerifier.verifyDeployment(
        { baseUrl: TARGET_URL, expectedCommitSha: VERIFIED_COMMIT },
        async (url) => {
          if (url.endsWith('/health')) {
            return { status: 502, body: 'Bad Gateway' };
          }
          return { status: 200, headers: { 'x-content-type-options': 'nosniff' }, body: 'OK' };
        }
      );

      expect(result.overallStatus).toBe('UNHEALTHY');
      expect(result.failures.some(f => f.includes('HTTP 502'))).toBe(true);
    });

    it('detects missing security headers and classifies status as DEGRADED', async () => {
      const result = await LiveVerifier.verifyDeployment(
        { baseUrl: TARGET_URL, expectedCommitSha: VERIFIED_COMMIT },
        async (url) => {
          if (url.endsWith('/api/version')) {
            return { status: 200, body: JSON.stringify({ commitSha: VERIFIED_COMMIT }) };
          }
          // Missing X-Content-Type-Options
          return { status: 200, headers: {}, body: 'OK' };
        }
      );

      expect(result.overallStatus).toBe('DEGRADED');
      expect(result.securityHeadersValid).toBe(false);
    });

    it('truthfully handles network timeouts and connection errors without fake success', async () => {
      const result = await LiveVerifier.verifyDeployment(
        { baseUrl: TARGET_URL, expectedCommitSha: VERIFIED_COMMIT },
        async () => {
          throw new Error('Connection refused: ECONNREFUSED');
        }
      );

      expect(result.overallStatus).toBe('UNHEALTHY');
      expect(result.failures.some(f => f.includes('unreachable'))).toBe(true);
    });
  });

  // 2. Incident Correlation & Alert Spam Prevention Tests
  describe('IncidentCorrelator', () => {
    let correlator: IncidentCorrelator;

    beforeEach(() => {
      correlator = new IncidentCorrelator();
    });

    it('creates a new incident on initial failure and correlates repeated failures', () => {
      const failureResult: LiveVerificationResult = {
        targetUrl: TARGET_URL,
        checkedAt: '2026-10-26T18:00:00Z',
        overallStatus: 'UNHEALTHY',
        versionMatch: true,
        endpointChecks: [
          { endpoint: '/health', status: 'FAIL', httpStatus: 503, responseTimeMs: 120 }
        ],
        securityHeadersValid: true,
        spatialCapabilityFunctional: false,
        failures: ['Endpoint /health returned HTTP 503']
      };

      // 1st occurrence
      const first = correlator.recordVerificationResult(failureResult, VERIFIED_COMMIT);
      expect(first.isNewIncident).toBe(true);
      expect(first.incident?.occurrenceCount).toBe(1);

      // 2nd occurrence (repeated failure within same incident fingerprint)
      const secondResult = { ...failureResult, checkedAt: '2026-10-26T18:02:00Z' };
      const second = correlator.recordVerificationResult(secondResult, VERIFIED_COMMIT);
      expect(second.isNewIncident).toBe(false);
      expect(second.incident?.occurrenceCount).toBe(2);
      expect(second.incident?.incidentId).toBe(first.incident?.incidentId);
    });

    it('marks incident RECOVERED when a subsequent verification check passes', () => {
      const failureResult: LiveVerificationResult = {
        targetUrl: TARGET_URL,
        checkedAt: '2026-10-26T18:00:00Z',
        overallStatus: 'UNHEALTHY',
        versionMatch: true,
        endpointChecks: [{ endpoint: '/health', status: 'FAIL', httpStatus: 500, responseTimeMs: 50 }],
        securityHeadersValid: true,
        spatialCapabilityFunctional: false,
        failures: ['500 Server Error']
      };
      correlator.recordVerificationResult(failureResult, VERIFIED_COMMIT);

      const healthyResult: LiveVerificationResult = {
        targetUrl: TARGET_URL,
        checkedAt: '2026-10-26T18:05:00Z',
        overallStatus: 'HEALTHY',
        versionMatch: true,
        endpointChecks: [{ endpoint: '/health', status: 'PASS', httpStatus: 200, responseTimeMs: 25 }],
        securityHeadersValid: true,
        spatialCapabilityFunctional: true,
        failures: []
      };

      const recovery = correlator.recordVerificationResult(healthyResult, VERIFIED_COMMIT);
      expect(recovery.incident?.status).toBe('RECOVERED');
      expect(recovery.incident?.verifiedRecovery).toBe(true);
    });

    it('generates an auditable OperationalReport with accurate metrics and diagnostic summary', () => {
      const verification: LiveVerificationResult = {
        targetUrl: TARGET_URL,
        checkedAt: new Date().toISOString(),
        overallStatus: 'HEALTHY',
        versionInfo: {
          name: 'open3dfloorplan',
          version: '0.9.0',
          commitSha: VERIFIED_COMMIT,
          nodeVersion: 'v22.19.0',
          environment: 'production'
        },
        versionMatch: true,
        endpointChecks: [
          { endpoint: '/', status: 'PASS', httpStatus: 200, responseTimeMs: 30 },
          { endpoint: '/health', status: 'PASS', httpStatus: 200, responseTimeMs: 15 }
        ],
        securityHeadersValid: true,
        spatialCapabilityFunctional: true,
        failures: []
      };

      const report = IncidentCorrelator.generateOperationalReport({
        environment: 'production',
        verificationResult: verification,
        expectedCommitSha: VERIFIED_COMMIT
      });

      expect(report.healthStatus).toBe('HEALTHY');
      expect(report.metrics.endpointsCheckedCount).toBe(2);
      expect(report.metrics.endpointsFailedCount).toBe(0);
      expect(report.humanInterventionRequired).toBe(false);
    });
  });

  // 3. Safe Supervised Recovery & Rollback Engine Tests
  describe('RecoveryEngine', () => {
    const createMockBundle = (decision: 'PASS' | 'FAIL', sha = PREVIOUS_COMMIT): ReleaseEvidenceBundle => ({
      specVersion: '1.0.0',
      projectName: 'SpatialGuard',
      commitSha: sha,
      pipelineId: '2990415000',
      branch: 'main',
      timestamp: '2026-10-26T17:00:00Z',
      typeCheckPassed: true,
      unitTestsPassed: true,
      spatialVerificationPassed: true,
      spatialInvariantCount: 4,
      securitySummary: {
        scannersExecuted: ['SAST', 'SECRET_DETECTION', 'DEPENDENCY_SCA'],
        totalFindings: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        infoCount: 0,
        findings: [],
        decision: 'PASS',
        blockingReasons: []
      },
      sbomManifest: {
        format: 'SpatialGuard-SBOM',
        specVersion: '1.0.0',
        packageName: 'open3dfloorplan',
        packageVersion: '0.9.0',
        commitSha: sha,
        generatedAt: '2026-10-26T17:00:00Z',
        totalDependencies: 15,
        directDependenciesCount: 5,
        transitiveDependenciesCount: 10,
        dependencies: []
      },
      artifactManifest: {
        packageIdentity: 'open3dfloorplan@0.9.0',
        commitSha: sha,
        pipelineId: '2990415000',
        buildTimestamp: '2026-10-26T17:00:00Z',
        buildOutputDirectory: 'build',
        files: [{ path: 'index.js', sha256: 'abc123', sizeBytes: 1024 }],
        manifestHash: 'hash123'
      },
      stagingVerification: {
        stagingUrl: 'https://staging.spatialguard.internal',
        deploymentTimestamp: '2026-10-26T17:00:00Z',
        deploymentStatus: 'SUCCESS',
        smokeTests: [],
        dastFindings: [],
        decision: 'PASS',
        reasons: []
      },
      releaseDecision: decision,
      gateSummary: {
        applicationGate: 'PASS',
        spatialGate: 'PASS',
        securityGate: 'PASS',
        integrityGate: 'PASS',
        stagingGate: 'PASS'
      },
      blockingFindings: [],
      bundleSha256: 'bundle_hash_123'
    });

    it('formulates ROLLBACK recommendation targeting verified previous candidate', () => {
      const failedVerification: LiveVerificationResult = {
        targetUrl: TARGET_URL,
        checkedAt: new Date().toISOString(),
        overallStatus: 'UNHEALTHY',
        versionMatch: true,
        endpointChecks: [{ endpoint: '/health', status: 'FAIL', httpStatus: 500, responseTimeMs: 100 }],
        securityHeadersValid: true,
        spatialCapabilityFunctional: false,
        failures: ['HTTP 500']
      };

      const verifiedBundle = createMockBundle('PASS');
      const rec = RecoveryEngine.evaluateRecovery(failedVerification, verifiedBundle);

      expect(rec.action).toBe('ROLLBACK');
      expect(rec.targetReleaseSha).toBe(PREVIOUS_COMMIT);
      expect(rec.verifiedArtifactAvailable).toBe(true);
      expect(rec.requiresHumanApproval).toBe(true);
    });

    it('blocks rollback if candidate bundle did not pass release verification', () => {
      const failedVerification: LiveVerificationResult = {
        targetUrl: TARGET_URL,
        checkedAt: new Date().toISOString(),
        overallStatus: 'UNHEALTHY',
        versionMatch: true,
        endpointChecks: [{ endpoint: '/health', status: 'FAIL', httpStatus: 500, responseTimeMs: 100 }],
        securityHeadersValid: true,
        spatialCapabilityFunctional: false,
        failures: ['HTTP 500']
      };

      const unverifiedBundle = createMockBundle('FAIL');
      const rec = RecoveryEngine.evaluateRecovery(failedVerification, unverifiedBundle);

      expect(rec.action).toBe('INVESTIGATE_ONLY');
      expect(rec.blockers.some(b => b.includes('not PASS'))).toBe(true);
    });

    it('enforces human approval boundary and blocks autonomous rollback execution', async () => {
      const recommendation: RecoveryRecommendation = {
        action: 'ROLLBACK',
        targetReleaseSha: PREVIOUS_COMMIT,
        justification: 'Critical failure',
        requiresHumanApproval: true,
        verifiedArtifactAvailable: true,
        blockers: []
      };

      // Attempt execution without human approval
      const result = await RecoveryEngine.executeSupervisedRecovery(recommendation, false);
      expect(result.status).toBe('BLOCKED_PENDING_APPROVAL');
      expect(result.error).toContain('explicit human approval');
    });

    it('fails safely when human approval is confirmed but no recovery executor is provided', async () => {
      const recommendation: RecoveryRecommendation = {
        action: 'ROLLBACK',
        targetReleaseSha: PREVIOUS_COMMIT,
        justification: 'Critical failure',
        requiresHumanApproval: true,
        verifiedArtifactAvailable: true,
        blockers: []
      };

      // Confirmed human approval, but executor omitted
      const result = await RecoveryEngine.executeSupervisedRecovery(recommendation, true);
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('No active deployment recovery executor');
    });

    it('executes recovery when human approval is confirmed and executor is provided', async () => {
      const recommendation: RecoveryRecommendation = {
        action: 'ROLLBACK',
        targetReleaseSha: PREVIOUS_COMMIT,
        justification: 'Critical failure',
        requiresHumanApproval: true,
        verifiedArtifactAvailable: true,
        blockers: []
      };

      // Confirmed human approval with active executor
      const result = await RecoveryEngine.executeSupervisedRecovery(
        recommendation,
        true,
        async (sha) => ({ success: true })
      );
      expect(result.status).toBe('EXECUTED');
    });
  });
});
