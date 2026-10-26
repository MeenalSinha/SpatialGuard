/**
 * SpatialGuard Phase 4 — Security Scanner Engine
 *
 * Implements deterministic auditing for:
 * 1. Secret Detection (regex checks for private keys, tokens, hardcoded credentials)
 * 2. Static Application Security Testing (SAST)
 * 3. Dependency / Supply-chain Software Composition Analysis (SCA)
 * 4. DAST HTTP security header checks
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { SecurityFinding, SecurityScanSummary, ReleaseGateDecision, SecuritySeverity } from './types';

// High-confidence regex patterns for secret detection
const SECRET_PATTERNS: Array<{ id: string; name: string; pattern: RegExp; severity: SecuritySeverity }> = [
  {
    id: 'SEC-001',
    name: 'Private Key Detected',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: 'CRITICAL'
  },
  {
    id: 'SEC-002',
    name: 'GitLab Personal Access Token',
    pattern: /glpat-[0-9a-zA-Z_\-]{20,}/,
    severity: 'CRITICAL'
  },
  {
    id: 'SEC-003',
    name: 'AWS Access Key ID',
    pattern: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    severity: 'CRITICAL'
  },
  {
    id: 'SEC-004',
    name: 'Generic API Key / Secret Token',
    pattern: /(?:api_key|apiKey|secret_key|secretKey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{32,}['"]/,
    severity: 'HIGH'
  }
];

export class SecurityScanner {
  /**
   * Scans text content or file for exposed secrets
   */
  public static scanContentForSecrets(content: string, filePath = 'in-memory'): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const rule of SECRET_PATTERNS) {
      if (rule.pattern.test(content)) {
        findings.push({
          id: rule.id,
          scanner: 'SECRET_DETECTION',
          severity: rule.severity,
          title: rule.name,
          description: `Potential sensitive secret pattern matching ${rule.name} found in ${filePath}`,
          location: filePath,
          remediationAdvice: 'Revoke token immediately, store in GitLab CI/CD masked protected variables.'
        });
      }
    }

    return findings;
  }

  /**
   * Scans a set of files for exposed secrets
   */
  public static scanFilesForSecrets(filePaths: string[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    for (const file of filePaths) {
      if (existsSync(file)) {
        try {
          const content = readFileSync(file, 'utf-8');
          findings.push(...this.scanContentForSecrets(content, file));
        } catch {
          // ignore unreadable/binary files
        }
      }
    }
    return findings;
  }

  /**
   * Analyzes dependency audit report (e.g. from npm audit --json)
   */
  public static analyzeDependencyAudit(auditJsonText?: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    if (!auditJsonText) return findings;

    try {
      const data = JSON.parse(auditJsonText);
      // npm audit v7+ format
      if (data.vulnerabilities) {
        for (const [pkgName, details] of Object.entries<any>(data.vulnerabilities)) {
          const severity = (details.severity || 'low').toUpperCase();
          if (severity === 'CRITICAL' || severity === 'HIGH') {
            findings.push({
              id: `VULN-${pkgName}`,
              scanner: 'DEPENDENCY_SCA',
              severity: severity as SecuritySeverity,
              title: `Vulnerability in dependency ${pkgName}`,
              description: `Dependency ${pkgName} has ${severity} severity vulnerability: ${details.via?.[0]?.title || 'Known CVE'}`,
              location: `package.json -> ${pkgName}`,
              remediationAdvice: details.fixAvailable ? 'Run npm audit fix to update to patched version' : 'Review upstream mitigation'
            });
          }
        }
      }
    } catch {
      // invalid audit json
    }

    return findings;
  }

  /**
   * Static Application Security Testing (SAST) rule check on source code
   */
  public static performStaticAnalysis(sourceFiles: Array<{ path: string; content: string }>): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const file of sourceFiles) {
      // Check for dangerous eval or Function constructor
      if (/\beval\s*\(/.test(file.content) || /new\s+Function\s*\(/.test(file.content)) {
        findings.push({
          id: 'SAST-EVAL-001',
          scanner: 'SAST',
          severity: 'HIGH',
          title: 'Dangerous Code Execution (eval)',
          description: `File ${file.path} contains dynamic code evaluation (eval / new Function)`,
          location: file.path,
          remediationAdvice: 'Refactor code to eliminate dynamic code evaluation.'
        });
      }

      // Check for insecure innerHTML assignments without sanitization
      if (/\.innerHTML\s*=/.test(file.content) && !file.content.includes('DOMPurify')) {
        findings.push({
          id: 'SAST-XSS-001',
          scanner: 'SAST',
          severity: 'MEDIUM',
          title: 'Potential Cross-Site Scripting (innerHTML assignment)',
          description: `Direct innerHTML assignment in ${file.path} without DOMPurify sanitization.`,
          location: file.path,
          remediationAdvice: 'Use textContent or DOMPurify.sanitize().'
        });
      }
    }

    return findings;
  }

  /**
   * Evaluates HTTP response security headers (DAST)
   */
  public static evaluateDastSecurityHeaders(headers: Record<string, string>, targetUrl: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      normalized[k.toLowerCase()] = v;
    }

    if (!normalized['x-content-type-options']) {
      findings.push({
        id: 'DAST-HEADER-001',
        scanner: 'DAST',
        severity: 'LOW',
        title: 'Missing X-Content-Type-Options Header',
        description: `Target ${targetUrl} does not set 'X-Content-Type-Options: nosniff'`,
        location: targetUrl,
        remediationAdvice: 'Configure server to return X-Content-Type-Options: nosniff'
      });
    }

    if (!normalized['x-frame-options'] && !normalized['content-security-policy']) {
      findings.push({
        id: 'DAST-HEADER-002',
        scanner: 'DAST',
        severity: 'MEDIUM',
        title: 'Missing Clickjacking Protection',
        description: `Target ${targetUrl} lacks X-Frame-Options or frame-ancestors in CSP.`,
        location: targetUrl,
        remediationAdvice: 'Add X-Frame-Options: SAMEORIGIN or CSP frame-ancestors directive.'
      });
    }

    return findings;
  }

  /**
   * Consolidates findings and produces a SecurityScanSummary with ReleaseGateDecision
   */
  public static evaluateSecurityGate(findings: SecurityFinding[], executedScanners: Array<'SAST' | 'SECRET_DETECTION' | 'DEPENDENCY_SCA' | 'DAST'>): SecurityScanSummary {
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let infoCount = 0;
    const blockingReasons: string[] = [];

    for (const f of findings) {
      if (f.severity === 'CRITICAL') {
        criticalCount++;
        blockingReasons.push(`[CRITICAL] ${f.scanner}: ${f.title}`);
      } else if (f.severity === 'HIGH') {
        highCount++;
        blockingReasons.push(`[HIGH] ${f.scanner}: ${f.title}`);
      } else if (f.severity === 'MEDIUM') {
        mediumCount++;
      } else if (f.severity === 'LOW') {
        lowCount++;
      } else {
        infoCount++;
      }
    }

    // Policy: Any CRITICAL or HIGH findings strictly BLOCK the release gate
    let decision: ReleaseGateDecision = 'PASS';
    if (criticalCount > 0 || highCount > 0) {
      decision = 'FAIL';
    } else if (executedScanners.length === 0) {
      decision = 'INCONCLUSIVE';
      blockingReasons.push('No security scanners were executed for the release candidate.');
    }

    return {
      scannersExecuted: executedScanners,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      infoCount,
      findings,
      decision,
      blockingReasons
    };
  }
}
