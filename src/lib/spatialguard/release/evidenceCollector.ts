/**
 * SpatialGuard Phase 4 — Artifact Integrity & Evidence Collector
 *
 * Implements:
 * 1. SHA-256 calculation for build outputs and release packages
 * 2. SBOM manifest generation from package.json and lockfile
 * 3. Assembly of the cryptographic ReleaseEvidenceBundle
 */

import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import type {
  ArtifactFileEntry,
  ArtifactIntegrityManifest,
  ReleaseEvidenceBundle,
  ReleaseGateDecision,
  SbomDependency,
  SbomManifest,
  SecurityScanSummary,
  StagingVerificationReport
} from './types';

export class EvidenceCollector {
  /**
   * Computes SHA-256 hash of a string or buffer
   */
  public static computeHash(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Computes SHA-256 hash of a file on disk
   */
  public static hashFile(filePath: string): string {
    if (!existsSync(filePath)) {
      throw new Error(`File does not exist for hashing: ${filePath}`);
    }
    const buffer = readFileSync(filePath);
    return this.computeHash(buffer);
  }

  /**
   * Recursively scans directory and builds an ArtifactIntegrityManifest
   */
  public static buildArtifactManifest(
    buildOutputDir: string,
    commitSha: string,
    pipelineId: string,
    packageIdentity = 'open3dfloorplan@0.9.0'
  ): ArtifactIntegrityManifest {
    const files: ArtifactFileEntry[] = [];

    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const stats = statSync(fullPath);
          const sha256 = this.hashFile(fullPath);
          const relPath = path.relative(buildOutputDir, fullPath).replace(/\\/g, '/');
          files.push({
            path: relPath,
            sha256,
            sizeBytes: stats.size
          });
        }
      }
    };

    walk(buildOutputDir);

    // Sort files deterministically by relative path
    files.sort((a, b) => a.path.localeCompare(b.path));

    // Manifest hash is the hash of all file paths and their individual hashes
    const manifestContent = files.map(f => `${f.sha256}  ${f.path}`).join('\n');
    const manifestHash = this.computeHash(manifestContent);

    return {
      packageIdentity,
      commitSha,
      pipelineId,
      buildTimestamp: new Date().toISOString(),
      buildOutputDirectory: path.basename(buildOutputDir),
      files,
      manifestHash
    };
  }

  /**
   * Generates an SBOM manifest from package.json and package-lock.json
   */
  public static generateSbom(projectRoot: string, commitSha: string): SbomManifest {
    const pkgPath = path.join(projectRoot, 'package.json');
    const lockPath = path.join(projectRoot, 'package-lock.json');

    let pkgName = 'open3dfloorplan';
    let pkgVersion = '0.9.0';
    const dependencies: SbomDependency[] = [];

    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        pkgName = pkg.name || pkgName;
        pkgVersion = pkg.version || pkgVersion;

        const directProd = Object.keys(pkg.dependencies || {});
        const directDev = Object.keys(pkg.devDependencies || {});
        const allDirect = new Set([...directProd, ...directDev]);

        if (existsSync(lockPath)) {
          const lock = JSON.parse(readFileSync(lockPath, 'utf-8'));
          const packages = lock.packages || {};
          for (const [pkgKey, info] of Object.entries<any>(packages)) {
            if (!pkgKey) continue; // root entry
            const depName = pkgKey.replace(/^node_modules\//, '');
            // Only include top-level node_modules or direct
            if (!pkgKey.includes('node_modules/') || pkgKey.split('node_modules/').length <= 2) {
              dependencies.push({
                name: depName,
                version: info.version || 'unknown',
                direct: allDirect.has(depName),
                license: info.license,
                integrity: info.integrity
              });
            }
          }
        } else {
          for (const [d, v] of Object.entries<string>(pkg.dependencies || {})) {
            dependencies.push({ name: d, version: v, direct: true });
          }
        }
      } catch {
        // Fallback if parsing fails
      }
    }

    const directCount = dependencies.filter(d => d.direct).length;
    const transitiveCount = dependencies.length - directCount;

    return {
      format: 'SpatialGuard-SBOM',
      specVersion: '1.0.0',
      packageName: pkgName,
      packageVersion: pkgVersion,
      commitSha,
      generatedAt: new Date().toISOString(),
      totalDependencies: dependencies.length,
      directDependenciesCount: directCount,
      transitiveDependenciesCount: transitiveCount,
      dependencies
    };
  }

  /**
   * Assembles the complete ReleaseEvidenceBundle and calculates its canonical SHA-256
   */
  public static assembleEvidenceBundle(params: {
    commitSha: string;
    pipelineId: string;
    branch: string;
    typeCheckPassed: boolean;
    unitTestsPassed: boolean;
    spatialVerificationPassed: boolean;
    spatialInvariantCount: number;
    securitySummary: SecurityScanSummary;
    sbomManifest: SbomManifest;
    artifactManifest: ArtifactIntegrityManifest;
    stagingVerification: StagingVerificationReport;
    remediationAttempted?: boolean;
    remediationStatus?: string;
  }): ReleaseEvidenceBundle {
    const blockingFindings: string[] = [];

    // Evaluate application correctness gate
    let applicationGate: ReleaseGateDecision = 'PASS';
    if (!params.typeCheckPassed || !params.unitTestsPassed) {
      applicationGate = 'FAIL';
      blockingFindings.push('Application correctness checks failed (typecheck or unit tests failed)');
    }

    // Evaluate spatial gate
    let spatialGate: ReleaseGateDecision = 'PASS';
    if (!params.spatialVerificationPassed) {
      spatialGate = 'FAIL';
      blockingFindings.push('Spatial verification failed: one or more required spatial invariants were violated.');
    } else if (params.spatialInvariantCount === 0) {
      spatialGate = 'INCONCLUSIVE';
      blockingFindings.push('Spatial verification inconclusive: no invariants evaluated.');
    }

    // Evaluate security gate
    const securityGate = params.securitySummary.decision;
    if (securityGate !== 'PASS') {
      blockingFindings.push(...params.securitySummary.blockingReasons);
    }

    // Evaluate artifact integrity gate
    let integrityGate: ReleaseGateDecision = 'PASS';
    if (params.artifactManifest.files.length === 0) {
      integrityGate = 'FAIL';
      blockingFindings.push('Artifact manifest is empty: build outputs missing.');
    }

    // Evaluate staging gate
    const stagingGate = params.stagingVerification.decision;
    if (stagingGate !== 'PASS') {
      blockingFindings.push(...params.stagingVerification.reasons);
    }

    // Collect all gates to avoid compiler narrowing false-positives
    const gates: ReleaseGateDecision[] = [
      applicationGate,
      spatialGate,
      securityGate,
      integrityGate,
      stagingGate
    ];

    // Overall Release Decision
    let releaseDecision: ReleaseGateDecision = 'PASS';
    if (gates.includes('FAIL')) {
      releaseDecision = 'FAIL';
    } else if (gates.includes('INCONCLUSIVE')) {
      releaseDecision = 'INCONCLUSIVE';
    }

    const partialBundle = {
      specVersion: '1.0.0' as const,
      projectName: 'SpatialGuard' as const,
      commitSha: params.commitSha,
      pipelineId: params.pipelineId,
      branch: params.branch,
      timestamp: new Date().toISOString(),
      typeCheckPassed: params.typeCheckPassed,
      unitTestsPassed: params.unitTestsPassed,
      spatialVerificationPassed: params.spatialVerificationPassed,
      spatialInvariantCount: params.spatialInvariantCount,
      remediationAttempted: params.remediationAttempted,
      remediationStatus: params.remediationStatus,
      securitySummary: params.securitySummary,
      sbomManifest: params.sbomManifest,
      artifactManifest: params.artifactManifest,
      stagingVerification: params.stagingVerification,
      releaseDecision,
      gateSummary: {
        applicationGate,
        spatialGate,
        securityGate,
        integrityGate,
        stagingGate
      },
      blockingFindings
    };

    const bundleSha256 = this.computeHash(JSON.stringify(partialBundle));

    return {
      ...partialBundle,
      bundleSha256,
      digitalSignature: {
        algorithm: 'ECDSA-P256-SHA256 (GitLab Keyless Attestation Planned)',
        signatureHex: '',
        verified: false,
        note: 'Cryptographic SHA-256 hash manifest verified; full cloud keyless attestation requires active cosign/OIDC runner token.'
      }
    };
  }
}
