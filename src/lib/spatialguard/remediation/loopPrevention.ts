/**
 * SpatialGuard Phase 3 — Idempotency and Loop Prevention (Task L & Section 6)
 * 
 * Prevents recursive pipeline triggering and unbounded remediation retries
 * by computing deterministic execution fingerprints and enforcing attempt counts.
 */

import type { FailureContext, RemediationPolicy } from './types';

export interface IdempotencyCheckResult {
  canProceed: boolean;
  idempotencyKey: string;
  attemptNumber: number;
  reason: string;
  isDuplicateEvent: boolean;
  hasExceededLimit: boolean;
}

/**
 * Computes a deterministic, collision-resistant idempotency key for a failure event.
 * Combines project, triggering commit, invariant ID, and failure signature.
 */
export function computeIdempotencyKey(context: FailureContext): string {
  const parts = [
    context.projectId,
    context.commitSha.slice(0, 12),
    context.invariantId ?? 'NO_INV',
    context.failureCategory,
    (context.diagnosticMessage ?? 'no_diag').replace(/\s+/g, '_').slice(0, 40)
  ];
  return `sg-rem-${parts.join('-')}`;
}

/**
 * In-memory registry of ongoing/completed remediation attempts by idempotency key.
 */
const executionRegistry = new Map<string, { attempts: number; completed: boolean; lastTimestamp: number }>();

/**
 * Evaluates whether a failure event is safe to remediate or should be suppressed to prevent loops.
 */
export function checkIdempotency(
  context: FailureContext,
  policy: RemediationPolicy,
  historyMap: Map<string, { attempts: number; completed: boolean; lastTimestamp: number }> = executionRegistry
): IdempotencyCheckResult {
  const key = computeIdempotencyKey(context);
  const existing = historyMap.get(key);

  const currentAttempts = existing ? existing.attempts : 0;
  const nextAttempt = currentAttempts + 1;

  // Check 1: Exceeded maximum allowed attempts
  if (currentAttempts >= policy.maxAttempts) {
    return {
      canProceed: false,
      idempotencyKey: key,
      attemptNumber: currentAttempts,
      reason: `Maximum remediation attempts (${policy.maxAttempts}) already exhausted for key ${key}. Suppressing retry to prevent infinite loops.`,
      isDuplicateEvent: false,
      hasExceededLimit: true
    };
  }

  // Check 2: Already marked completed and verified
  if (existing?.completed) {
    return {
      canProceed: false,
      idempotencyKey: key,
      attemptNumber: currentAttempts,
      reason: `Remediation for key ${key} has already been completed and verified. Suppressing redundant re-execution.`,
      isDuplicateEvent: true,
      hasExceededLimit: false
    };
  }

  return {
    canProceed: true,
    idempotencyKey: key,
    attemptNumber: nextAttempt,
    reason: `Remediation attempt ${nextAttempt} of ${policy.maxAttempts} authorized for key ${key}.`,
    isDuplicateEvent: false,
    hasExceededLimit: false
  };
}

/**
 * Records an attempt or completion in the registry
 */
export function recordRemediationAttempt(
  key: string,
  completed: boolean = false,
  historyMap: Map<string, { attempts: number; completed: boolean; lastTimestamp: number }> = executionRegistry
): void {
  const existing = historyMap.get(key);
  const count = (existing ? existing.attempts : 0) + 1;
  historyMap.set(key, {
    attempts: count,
    completed,
    lastTimestamp: Date.now()
  });
}

/**
 * Clears registry (useful for testing)
 */
export function clearIdempotencyRegistry(): void {
  executionRegistry.clear();
}
