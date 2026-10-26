/**
 * SpatialGuard Phase 5 — Live Verifier
 *
 * Performs live remote verification against real deployed OpenPlan3D instances.
 * Checks HTTP availability, /health, /api/version, security headers,
 * and detects version drift without default-success fallback.
 */

import type {
  EndpointCheckResult,
  LiveVerificationResult,
  LiveVerificationTarget,
  RuntimeHealthStatus,
  RuntimeVersionInfo
} from './types';

export class LiveVerifier {
  /**
   * Executes remote verification against a target URL
   */
  public static async verifyDeployment(
    target: LiveVerificationTarget,
    mockFetch?: (url: string) => Promise<{ status: number; headers?: Record<string, string>; body?: string }>
  ): Promise<LiveVerificationResult> {
    const baseUrl = target.baseUrl.replace(/\/$/, '');
    const endpoints = ['/', '/health', '/api/version'];
    const endpointChecks: EndpointCheckResult[] = [];
    const failures: string[] = [];

    let versionInfo: RuntimeVersionInfo | undefined;
    let securityHeadersValid = true;

    for (const ep of endpoints) {
      const fullUrl = `${baseUrl}${ep}`;
      const startTime = Date.now();

      try {
        let status = 0;
        let headers: Record<string, string> = {};
        let body = '';

        if (mockFetch) {
          const res = await mockFetch(fullUrl);
          status = res.status;
          headers = res.headers || {};
          body = res.body || '';
        } else {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), target.timeoutMs || 8000);
          const response = await fetch(fullUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'Accept': 'text/html,application/json' }
          });
          clearTimeout(timeoutId);
          status = response.status;
          response.headers.forEach((val, key) => {
            headers[key.toLowerCase()] = val;
          });
          body = await response.text();
        }

        const responseTimeMs = Date.now() - startTime;
        const passed = status >= 200 && status < 400;

        endpointChecks.push({
          endpoint: ep,
          status: passed ? 'PASS' : 'FAIL',
          httpStatus: status,
          responseTimeMs,
          headers,
          bodyPreview: body.substring(0, 150)
        });

        if (!passed) {
          failures.push(`Endpoint ${ep} returned HTTP ${status}`);
        }

        // Parse version info from /api/version
        if (ep === '/api/version' && passed) {
          try {
            versionInfo = JSON.parse(body);
          } catch {
            failures.push('Failed to parse JSON response from /api/version');
          }
        }

        // Validate security headers on root
        if (ep === '/' && passed) {
          if (!headers['x-content-type-options'] || headers['x-content-type-options'] !== 'nosniff') {
            securityHeadersValid = false;
            failures.push('Missing or invalid X-Content-Type-Options: nosniff header');
          }
        }
      } catch (err: any) {
        endpointChecks.push({
          endpoint: ep,
          status: 'ERROR',
          httpStatus: 0,
          responseTimeMs: Date.now() - startTime,
          error: err.message || 'Request failed'
        });
        failures.push(`Endpoint ${ep} unreachable: ${err.message || 'Network error'}`);
      }
    }

    // Determine version match
    let versionMatch = true;
    if (target.expectedCommitSha && versionInfo) {
      if (versionInfo.commitSha !== target.expectedCommitSha) {
        versionMatch = false;
        failures.push(`Version drift: deployed commit (${versionInfo.commitSha}) does not match expected (${target.expectedCommitSha})`);
      }
    } else if (target.expectedCommitSha && !versionInfo) {
      versionMatch = false;
      failures.push('Could not verify commit SHA: /api/version returned no version metadata');
    }

    // Determine overall health status
    let overallStatus: RuntimeHealthStatus = 'HEALTHY';
    const hasErrors = endpointChecks.some(c => c.status === 'ERROR' || c.status === 'FAIL');
    if (hasErrors || !versionMatch) {
      overallStatus = 'UNHEALTHY';
    } else if (!securityHeadersValid) {
      overallStatus = 'DEGRADED';
    }

    // Verify genuine spatial capability if a checker function is supplied
    let spatialCapabilityFunctional = false;
    if (overallStatus === 'HEALTHY' && target.spatialCapabilityChecker) {
      try {
        spatialCapabilityFunctional = await target.spatialCapabilityChecker(baseUrl);
        if (!spatialCapabilityFunctional) {
          failures.push('Spatial capability verification failed: CAD geometry or editor operations non-functional');
          overallStatus = 'UNHEALTHY';
        }
      } catch (spatialErr: any) {
        spatialCapabilityFunctional = false;
        failures.push(`Spatial verification error: ${spatialErr.message || 'Check failed'}`);
        overallStatus = 'UNHEALTHY';
      }
    } else if (overallStatus === 'HEALTHY' && !target.spatialCapabilityChecker) {
      // Basic HTTP health verified, but spatial functionality is unverified
      spatialCapabilityFunctional = false;
    }

    return {
      targetUrl: baseUrl,
      checkedAt: new Date().toISOString(),
      overallStatus,
      versionInfo,
      versionMatch,
      endpointChecks,
      securityHeadersValid,
      spatialCapabilityFunctional,
      failures
    };
  }
}
