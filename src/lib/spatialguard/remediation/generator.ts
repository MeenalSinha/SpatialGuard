/**
 * SpatialGuard Phase 3 — Patch & Regression Test Generator (Tasks E & F)
 * 
 * Synthesizes minimal corrective patches addressing diagnosed root causes
 * and pairs every proposed patch with an independent regression test.
 */

import type { CandidatePatch, FailureContext, RegressionTestSpec, RemediationPolicy, RootCauseDiagnosis } from './types';
import { isPathPermittedForRemediation } from './policy';

export interface PatchGenerationResult {
  success: boolean;
  patch?: CandidatePatch;
  error?: string;
}

/**
 * Generates a minimal, inspectable patch proposal and paired regression test.
 */
export function generateCandidatePatch(
  context: FailureContext,
  diagnosis: RootCauseDiagnosis,
  attemptNumber: number,
  policy: RemediationPolicy
): PatchGenerationResult {
  const targetFile = diagnosis.primarySourceFile;

  // 1. Safety Audit: Validate that target file is permitted under policy
  const permission = isPathPermittedForRemediation(targetFile, policy);
  if (!permission.permitted) {
    return {
      success: false,
      error: `Safety Audit Failed: ${permission.reason}`
    };
  }

  // 2. Synthesize fix strategy based on invariant and diagnosis
  let originalSnippet = '';
  let replacementSnippet = '';
  let rationale = '';
  let regressionTest: RegressionTestSpec;

  switch (diagnosis.invariantId) {
    case 'INV-OPENING-001': {
      // Clamping opening boundary containment within host wall
      originalSnippet = `export function clampOpeningPosition(pos: number, width: number, wallLength: number): number {\n  return pos;\n}`;
      replacementSnippet = `export function clampOpeningPosition(pos: number, width: number, wallLength: number): number {\n  const half = width / 2;\n  return Math.max(half, Math.min(pos, wallLength - half));\n}`;
      rationale = 'Clamps opening center position so intervals remain strictly within host wall endpoints [width/2, wallLength - width/2], satisfying INV-OPENING-001.';
      regressionTest = {
        testFilePath: 'tests/spatialguard/regression-opening-boundary.test.ts',
        testSuiteName: 'INV-OPENING-001 Regression: Opening Boundary Clamping',
        testCaseName: 'prevents opening interval from exceeding host wall bounds',
        reproducingInputDescription: 'Wall of length 5.0m with door width 0.9m placed at illegal offset 4.9m (overflowing wall by 0.35m).',
        testCode: `import { describe, expect, it } from 'vitest';\nimport { clampOpeningPosition } from '$lib/geometry/planOpening';\n\ndescribe('INV-OPENING-001 Regression', () => {\n  it('prevents opening interval from exceeding host wall bounds', () => {\n    const wallLength = 5.0;\n    const doorWidth = 0.9;\n    const illegalPos = 4.9;\n    const clamped = clampOpeningPosition(illegalPos, doorWidth, wallLength);\n    expect(clamped).toBeLessThanOrEqual(wallLength - (doorWidth / 2));\n    expect(clamped).toBe(4.55);\n  });\n});`
      };
      break;
    }

    case 'INV-INTERCHANGE-001': {
      // Spatial conservation and dimension preservation in RoomPlan roundtrip
      originalSnippet = `export function sanitizeScale(scale: number): number {\n  return Math.round(scale);\n}`;
      replacementSnippet = `export function sanitizeScale(scale: number): number {\n  // Preserve floating-point precision for RoomPlan spatial conservation\n  return Number(scale.toFixed(6));\n}`;
      rationale = 'Preserves millimeter-grade floating-point precision during format serialization rather than truncating scale factors, satisfying INV-INTERCHANGE-001.';
      regressionTest = {
        testFilePath: 'tests/spatialguard/regression-interchange-scale.test.ts',
        testSuiteName: 'INV-INTERCHANGE-001 Regression: Scale Conservation',
        testCaseName: 'conserves sub-meter dimensions during format transformation',
        reproducingInputDescription: 'RoomPlan dimension 2.455m evaluated through sanitizeScale.',
        testCode: `import { describe, expect, it } from 'vitest';\nimport { sanitizeScale } from '$lib/utils/interchange';\n\ndescribe('INV-INTERCHANGE-001 Regression', () => {\n  it('conserves sub-meter dimensions during format transformation', () => {\n    const original = 2.455;\n    const preserved = sanitizeScale(original);\n    expect(preserved).toBeCloseTo(original, 4);\n  });\n});`
      };
      break;
    }

    case 'INV-ROOM-001': {
      // Enclosed planar room boundary closure
      originalSnippet = `export function isPolygonClosed(vertices: { x: number; y: number }[]): boolean {\n  return vertices.length > 2;\n}`;
      replacementSnippet = `export function isPolygonClosed(vertices: { x: number; y: number }[]): boolean {\n  if (vertices.length < 3) return false;\n  const first = vertices[0];\n  const last = vertices[vertices.length - 1];\n  const dist = Math.hypot(first.x - last.x, first.y - last.y);\n  return dist < 0.01; // Coincident within 1cm closure tolerance\n}`;
      rationale = 'Validates polygon closure by checking that first and last vertices are coincident within tolerance, preventing unclosed planar rooms from violating INV-ROOM-001.';
      regressionTest = {
        testFilePath: 'tests/spatialguard/regression-room-closure.test.ts',
        testSuiteName: 'INV-ROOM-001 Regression: Planar Room Boundary Closure',
        testCaseName: 'rejects unclosed wall vertex sequences as valid room boundaries',
        reproducingInputDescription: '3-vertex sequence with end-to-start gap of 0.5m.',
        testCode: `import { describe, expect, it } from 'vitest';\nimport { isPolygonClosed } from '$lib/utils/roomDetection';\n\ndescribe('INV-ROOM-001 Regression', () => {\n  it('rejects unclosed wall vertex sequences as valid room boundaries', () => {\n    const unclosed = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }];\n    expect(isPolygonClosed(unclosed)).toBe(false);\n  });\n});`
      };
      break;
    }

    default: {
      return {
        success: false,
        error: `Cannot automatically synthesize patch for invariant '${diagnosis.invariantId}'. Requires manual architectural review.`
      };
    }
  }

  // Generate unified diff
  const diffUnified = [
    `--- a/${targetFile}`,
    `+++ b/${targetFile}`,
    `@@ -1,3 +1,4 @@`,
    ...originalSnippet.split('\n').map(l => `-${l}`),
    ...replacementSnippet.split('\n').map(l => `+${l}`)
  ].join('\n');

  const patch: CandidatePatch = {
    patchId: `patch-${diagnosis.invariantId.toLowerCase()}-att${attemptNumber}`,
    attemptNumber,
    targetFile,
    originalSnippet,
    replacementSnippet,
    diffUnified,
    rationale,
    regressionTest,
    safetyAuditPassed: true,
    safetyAuditViolations: []
  };

  return {
    success: true,
    patch
  };
}
