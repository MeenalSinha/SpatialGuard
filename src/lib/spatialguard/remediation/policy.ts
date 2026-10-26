/**
 * SpatialGuard Phase 3 — Remediation Policy Engine (Task H & Section 3)
 * 
 * Enforces bounded retries, file pattern whitelists/blacklists,
 * verification command requirements, and strict non-autonomous boundaries.
 */

import type { RemediationPolicy } from './types';
import { DEFAULT_REMEDIATION_POLICY } from './types';

export interface PolicyValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedPolicy: RemediationPolicy;
}

/**
 * Validates a user or project remediation policy against safety constraints.
 */
export function validateRemediationPolicy(userPolicy?: Partial<RemediationPolicy>): PolicyValidationResult {
  const errors: string[] = [];

  const policy: RemediationPolicy = {
    ...DEFAULT_REMEDIATION_POLICY,
    ...userPolicy,
    // Supervised autonomy restrictions are non-negotiable and cannot be overridden
    allowAutoMerge: false,
    allowDirectPushToMain: false
  };

  // 1. Validate maxAttempts (must be bounded integer between 1 and 10)
  if (typeof policy.maxAttempts !== 'number' || isNaN(policy.maxAttempts)) {
    errors.push('RemediationPolicy: maxAttempts must be a number.');
  } else if (!Number.isInteger(policy.maxAttempts)) {
    errors.push('RemediationPolicy: maxAttempts must be an integer.');
  } else if (policy.maxAttempts < 1) {
    errors.push('RemediationPolicy: maxAttempts must be at least 1.');
  } else if (policy.maxAttempts > 10) {
    errors.push('RemediationPolicy: maxAttempts exceeds maximum allowed safety bound (10).');
  }

  // 2. Validate allowedPathPatterns
  if (!Array.isArray(policy.allowedPathPatterns) || policy.allowedPathPatterns.length === 0) {
    errors.push('RemediationPolicy: allowedPathPatterns must be a non-empty array.');
  }

  // 3. Validate forbiddenPathPatterns
  if (!Array.isArray(policy.forbiddenPathPatterns) || policy.forbiddenPathPatterns.length === 0) {
    errors.push('RemediationPolicy: forbiddenPathPatterns must be a non-empty array.');
  }

  // 4. Validate requiredVerificationCommands
  if (!Array.isArray(policy.requiredVerificationCommands) || policy.requiredVerificationCommands.length === 0) {
    errors.push('RemediationPolicy: requiredVerificationCommands must be a non-empty array.');
  }

  // 5. Validate command timeout
  if (typeof policy.commandTimeoutMs !== 'number' || policy.commandTimeoutMs < 5000) {
    errors.push('RemediationPolicy: commandTimeoutMs must be at least 5000ms.');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedPolicy: policy
  };
}

/**
 * Checks if a target file path is permitted for remediation modification under the policy.
 */
export function isPathPermittedForRemediation(
  filePath: string,
  policy: RemediationPolicy = DEFAULT_REMEDIATION_POLICY
): { permitted: boolean; reason: string } {
  const normalized = filePath.replace(/\\/g, '/');

  // Check forbidden patterns first (denylist takes precedence)
  for (const pattern of policy.forbiddenPathPatterns) {
    if (matchesGlob(normalized, pattern)) {
      return {
        permitted: false,
        reason: `Target file '${normalized}' matches forbidden protected pattern '${pattern}'. Automated modification is forbidden.`
      };
    }
  }

  // Check allowed patterns (must be explicitly whitelisted)
  let allowed = false;
  for (const pattern of policy.allowedPathPatterns) {
    if (matchesGlob(normalized, pattern)) {
      allowed = true;
      break;
    }
  }

  if (!allowed) {
    return {
      permitted: false,
      reason: `Target file '${normalized}' is not in allowed remediation path patterns (${policy.allowedPathPatterns.join(', ')}).`
    };
  }

  return {
    permitted: true,
    reason: `Target file '${normalized}' is authorized for bounded remediation.`
  };
}

/**
 * Basic glob matcher supporting * and **
 */
function matchesGlob(path: string, pattern: string): boolean {
  if (pattern === path) return true;
  // Convert glob pattern to regular expression
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/(?<!\.)\*/g, '[^/]*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(path);
}
