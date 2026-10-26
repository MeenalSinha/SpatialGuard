import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import {
  SecurityScanner,
  EvidenceCollector,
  StagingDeployer,
  IntegrityVerifier,
  PromotionGate,
  type ReleaseEvidenceBundle,
  type SecurityFinding,
  type SecurityScanSummary,
  type ArtifactIntegrityManifest,
  type SbomManifest,
  type StagingVerificationReport
} from '../../src/lib/spatialguard/release';

describe('SpatialGuard Phase 4 — DevSecOps Release & Governance Engine', () => {
  const MOCK_COMMIT = '97af466a0123456789abcdef0123456789abcdef';
  const MOCK_PIPELINE = '2990415001';
  const PROJECT_ROOT = path.resolve(__dirname, '../../');

  // Helper to build canonical passing test components
  const createPassingSecuritySummary = (): SecurityScanSummary => ({
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
  });

  const createPassingArtifactManifest = (): ArtifactIntegrityManifest => {
    const files = [
      { path: 'index.js', sha256: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890', sizeBytes: 1024 },
      { path: 'shims.js', sha256: 'b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1', sizeBytes: 512 }
    ];
    const manifestContent = files.map(f => `${f.sha256}  ${f.path}`).join('\n');
    return {
      packageIdentity: 'open3dfloorplan@0.9.0',
      commitSha: MOCK_COMMIT,
      pipelineId: MOCK_PIPELINE,
      buildTimestamp: new Date().toISOString(),
      buildOutputDirectory: 'build',
      files,
      manifestHash: EvidenceCollector.computeHash(manifestContent)
    };
  };

  const createPassingSbom = (): SbomManifest => ({
    format: 'SpatialGuard-SBOM',
    specVersion: '1.0.0',
    packageName: 'open3dfloorplan',
    packageVersion: '0.9.0',
    commitSha: MOCK_COMMIT,
    generatedAt: new Date().toISOString(),
    totalDependencies: 15,
    directDependenciesCount: 5,
    transitiveDependenciesCount: 10,
    dependencies: [{ name: 'three', version: '0.160.0', direct: true }]
  });

  const createPassingStagingReport = (): StagingVerificationReport => ({
    stagingUrl: 'https://staging.spatialguard.internal',
    deploymentTimestamp: new Date().toISOString(),
    deploymentStatus: 'SUCCESS',
    smokeTests: [
      { endpoint: 'https://staging.spatialguard.internal/', status: 'PASS', statusCode: 200, responseTimeMs: 32, description: 'Root' },
      { endpoint: 'https://staging.spatialguard.internal/health', status: 'PASS', statusCode: 200, responseTimeMs: 15, description: 'Health' }
    ],
    dastFindings: [],
    decision: 'PASS',
    reasons: []
  });

  // 1. Security Scanning Tests
  describe('SecurityScanner', () => {
    it('detects exposed private keys as CRITICAL severity', () => {
      const codeWithSecret = `
        const key = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA0...\\n-----END RSA PRIVATE KEY-----";
      `;
      const findings = SecurityScanner.scanContentForSecrets(codeWithSecret, 'auth.ts');
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].id).toBe('SEC-001');
    });

    it('detects GitLab personal access tokens as CRITICAL severity', () => {
      const codeWithToken = `const token = "glpat-abcdef1234567890_WXYZ";`;
      const findings = SecurityScanner.scanContentForSecrets(codeWithToken, 'config.ts');
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].severity).toBe('CRITICAL');
      expect(findings[0].id).toBe('SEC-002');
    });

    it('detects dangerous dynamic eval in SAST analysis', () => {
      const sourceFiles = [
        { path: 'src/calc.ts', content: 'const res = eval("2 + 2");' }
      ];
      const findings = SecurityScanner.performStaticAnalysis(sourceFiles);
      expect(findings.some(f => f.id === 'SAST-EVAL-001')).toBe(true);
    });

    it('blocks security gate when CRITICAL or HIGH findings exist', () => {
      const findings: SecurityFinding[] = [
        {
          id: 'SEC-001',
          scanner: 'SECRET_DETECTION',
          severity: 'CRITICAL',
          title: 'Exposed Private Key',
          description: '...'
        }
      ];
      const summary = SecurityScanner.evaluateSecurityGate(findings, ['SECRET_DETECTION']);
      expect(summary.decision).toBe('FAIL');
      expect(summary.blockingReasons.length).toBeGreaterThan(0);
    });

    it('marks security gate INCONCLUSIVE when no scanners were executed', () => {
      const summary = SecurityScanner.evaluateSecurityGate([], []);
      expect(summary.decision).toBe('INCONCLUSIVE');
    });
  });

  // 2. SBOM & Artifact Integrity Tests
  describe('EvidenceCollector', () => {
    it('generates real SBOM from repository package.json', () => {
      const sbom = EvidenceCollector.generateSbom(PROJECT_ROOT, MOCK_COMMIT);
      expect(sbom.packageName).toBe('open3dfloorplan');
      expect(sbom.totalDependencies).toBeGreaterThan(0);
      expect(sbom.dependencies.some(d => d.name === 'three')).toBe(true);
    });

    it('computes deterministic SHA-256 hashes and builds manifest', () => {
      const manifest = createPassingArtifactManifest();
      expect(manifest.files.length).toBe(2);
      expect(manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('assembles a cryptographically hashed ReleaseEvidenceBundle', () => {
      const bundle = EvidenceCollector.assembleEvidenceBundle({
        commitSha: MOCK_COMMIT,
        pipelineId: MOCK_PIPELINE,
        branch: 'main',
        typeCheckPassed: true,
        unitTestsPassed: true,
        spatialVerificationPassed: true,
        spatialInvariantCount: 3,
        securitySummary: createPassingSecuritySummary(),
        sbomManifest: createPassingSbom(),
        artifactManifest: createPassingArtifactManifest(),
        stagingVerification: createPassingStagingReport()
      });

      expect(bundle.releaseDecision).toBe('PASS');
      expect(bundle.bundleSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(bundle.blockingFindings.length).toBe(0);
    });

    it('blocks release decision if spatial verification failed', () => {
      const bundle = EvidenceCollector.assembleEvidenceBundle({
        commitSha: MOCK_COMMIT,
        pipelineId: MOCK_PIPELINE,
        branch: 'main',
        typeCheckPassed: true,
        unitTestsPassed: true,
        spatialVerificationPassed: false, // Invariant failure!
        spatialInvariantCount: 3,
        securitySummary: createPassingSecuritySummary(),
        sbomManifest: createPassingSbom(),
        artifactManifest: createPassingArtifactManifest(),
        stagingVerification: createPassingStagingReport()
      });

      expect(bundle.releaseDecision).toBe('FAIL');
      expect(bundle.gateSummary.spatialGate).toBe('FAIL');
      expect(bundle.blockingFindings.some(f => f.includes('Spatial verification failed'))).toBe(true);
    });
  });

  // 3. Staging Deployment & Smoke Tests
  describe('StagingDeployer', () => {
    it('verifies passing staging deployment and checks security headers', async () => {
      const report = await StagingDeployer.verifyStagingDeployment({
        stagingUrl: 'https://staging.spatialguard.internal',
        mockHttpResponder: (endpoint) => ({
          statusCode: 200,
          responseTimeMs: 25,
          headers: {
            'content-type': 'text/html',
            'x-content-type-options': 'nosniff',
            'x-frame-options': 'SAMEORIGIN'
          }
        })
      });

      expect(report.deploymentStatus).toBe('SUCCESS');
      expect(report.decision).toBe('PASS');
      expect(report.smokeTests.length).toBe(3);
    });

    it('blocks staging gate when a smoke test endpoint fails with HTTP 500', async () => {
      const report = await StagingDeployer.verifyStagingDeployment({
        stagingUrl: 'https://staging.spatialguard.internal',
        mockHttpResponder: (endpoint) => {
          if (endpoint === '/health') {
            return { statusCode: 500, responseTimeMs: 120 };
          }
          return { statusCode: 200, responseTimeMs: 25 };
        }
      });

      expect(report.deploymentStatus).toBe('FAILED');
      expect(report.decision).toBe('FAIL');
      expect(report.reasons.some(r => r.includes('HTTP 500'))).toBe(true);
    });
  });

  // 4. IntegrityVerifier & Supervised Promotion Gate
  describe('PromotionGate & IntegrityVerifier', () => {
    let validBundle: ReleaseEvidenceBundle;

    beforeEach(() => {
      validBundle = EvidenceCollector.assembleEvidenceBundle({
        commitSha: MOCK_COMMIT,
        pipelineId: MOCK_PIPELINE,
        branch: 'main',
        typeCheckPassed: true,
        unitTestsPassed: true,
        spatialVerificationPassed: true,
        spatialInvariantCount: 3,
        securitySummary: createPassingSecuritySummary(),
        sbomManifest: createPassingSbom(),
        artifactManifest: createPassingArtifactManifest(),
        stagingVerification: createPassingStagingReport()
      });
    });

    it('validates a pristine evidence bundle with 0 errors', () => {
      const check = IntegrityVerifier.verifyBundleIntegrity(validBundle);
      expect(check.valid).toBe(true);
      expect(check.errors.length).toBe(0);
    });

    it('detects tampering in bundle content and rejects hash match', () => {
      // Tamper with spatial test count after hash calculation
      (validBundle as any).spatialInvariantCount = 999;
      const check = IntegrityVerifier.verifyBundleIntegrity(validBundle);
      expect(check.valid).toBe(false);
      expect(check.errors.some(e => e.includes('Bundle SHA-256 mismatch'))).toBe(true);
    });

    it('blocks promotion when release drift occurs (commit SHA mismatch)', () => {
      const decision = PromotionGate.evaluatePromotion(
        validBundle,
        'different_untested_commit_123456789'
      );
      expect(decision.status).toBe('BLOCKED');
      expect(decision.blockers.some(b => b.includes('Release drift detected'))).toBe(true);
    });

    it('holds promotion in PENDING_APPROVAL when human approval is absent (supervised autonomy)', () => {
      const decision = PromotionGate.evaluatePromotion(
        validBundle,
        MOCK_COMMIT
      );
      expect(decision.status).toBe('PENDING_APPROVAL');
      expect(decision.blockers.some(b => b.includes('supervised human approval'))).toBe(true);
    });

    it('grants PROMOTED when all gates passed and valid human approval is provided', () => {
      const decision = PromotionGate.evaluatePromotion(
        validBundle,
        MOCK_COMMIT,
        {
          approverEmail: 'lead-architect@gitlab-hackathon.org',
          approvedAt: new Date().toISOString(),
          comment: 'Approved post-staging verification',
          promotionTarget: 'production'
        }
      );
      expect(decision.status).toBe('PROMOTED');
      expect(decision.blockers.length).toBe(0);
    });

    it('performs post-release health check and verifies healthy deployment', () => {
      const health = PromotionGate.evaluatePostReleaseHealth(
        'https://spatialguard.gitlab.io',
        '0.9.0',
        () => ({ httpStatus: 200, responseTimeMs: 40, inUseVersion: '0.9.0' })
      );
      expect(health.healthy).toBe(true);
      expect(health.metrics.httpStatus).toBe(200);
    });

    it('detects production version drift in post-release health check', () => {
      const health = PromotionGate.evaluatePostReleaseHealth(
        'https://spatialguard.gitlab.io',
        '0.9.0',
        () => ({ httpStatus: 200, responseTimeMs: 40, inUseVersion: '0.8.9' })
      );
      expect(health.healthy).toBe(false);
      expect(health.errors?.some(e => e.includes('Version drift'))).toBe(true);
    });
  });
});
