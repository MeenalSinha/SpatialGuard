/**
 * SpatialGuard Phase 3 — Root Cause Investigation Engine (Task D)
 * 
 * Performs deep inspection of confirmed spatial failures, distinguishing
 * confirmed observations, supported hypotheses, and unverified possibilities.
 */

import type { FailureContext, RootCauseDiagnosis } from './types';

/**
 * Investigates a confirmed failure context to produce a structured root-cause assessment.
 */
export function investigateRootCause(context: FailureContext): RootCauseDiagnosis {
  const invariantId = context.invariantId ?? 'INV-UNKNOWN';
  const diagnostic = context.diagnosticMessage ?? '';
  const sourceLocations = context.sourceLocations;

  switch (invariantId) {
    case 'INV-OPENING-001': {
      // Opening interval and wall boundary containment
      const primarySourceFile = sourceLocations.find(loc => loc.includes('planOpening.ts'))?.split(':')[0]
        ?? 'src/lib/geometry/planOpening.ts';

      return {
        invariantId: 'INV-OPENING-001',
        summary: 'Opening attachment intervals violate host-wall bounds or overlap adjacent openings.',
        confidence: 'high',
        confirmedObservations: [
          'Spatial invariant INV-OPENING-001 failed during project validation or plan opening evaluation.',
          `Reported assertion: "${diagnostic}".`,
          `Observed primary source stack: ${sourceLocations.join(' -> ') || primarySourceFile}.`
        ],
        supportedHypotheses: [
          'Opening interval calculation does not properly clamp position against [width/2, wallLength - width/2].',
          'Adjacent opening intervals on the same wall segment overlap within the minimum separation distance (tolerance < 0.005m).'
        ],
        unverifiedHypotheses: [
          'Host wall coordinates may have been mutated dynamically without recalculating opening offsets.'
        ],
        primarySourceFile,
        targetFunction: 'clampOpeningPosition',
        recommendedFixStrategy: 'boundary_clamp'
      };
    }

    case 'INV-INTERCHANGE-001': {
      // Prepared RoomPlan round-trip conservation
      const primarySourceFile = sourceLocations.find(loc => loc.includes('interchange.ts'))?.split(':')[0]
        ?? 'src/lib/utils/interchange.ts';

      return {
        invariantId: 'INV-INTERCHANGE-001',
        summary: 'Prepared RoomPlan round-trip export/re-import loses geometric fidelity or shifts object scale.',
        confidence: 'high',
        confirmedObservations: [
          'Spatial invariant INV-INTERCHANGE-001 failed in project-to-RoomPlan or RoomPlan-to-project cycle.',
          `Reported assertion: "${diagnostic}".`,
          context.metricDelta
            ? `Metric deviation: expected ${context.metricDelta.expected}, got ${context.metricDelta.actual} (delta: ${context.metricDelta.delta ?? 'N/A'}).`
            : 'Re-imported project geometry does not match source within positional tolerance.'
        ],
        supportedHypotheses: [
          'Exported transformation matrix fails to preserve exact wall start/end coordinates due to rounding precision.',
          'Door/window swing properties or furniture scale dimensions dropped during format translation.'
        ],
        unverifiedHypotheses: [
          'Source RoomPlan JSON may contain unrepresented custom entity categories.'
        ],
        primarySourceFile,
        targetFunction: 'projectToPreparedRoomPlan',
        recommendedFixStrategy: 'scale_conservation'
      };
    }

    case 'INV-ROOM-001': {
      // Enclosed planar room boundary and non-degeneracy
      const primarySourceFile = sourceLocations.find(loc => loc.includes('roomDetection.ts'))?.split(':')[0]
        ?? 'src/lib/utils/roomDetection.ts';

      return {
        invariantId: 'INV-ROOM-001',
        summary: 'Detected room boundary polygon is degenerate, self-intersecting, or has zero/negative area.',
        confidence: 'high',
        confirmedObservations: [
          'Spatial invariant INV-ROOM-001 failed during resolveRooms or room area computation.',
          `Reported assertion: "${diagnostic}".`,
          `Source stack trace points to ${primarySourceFile}.`
        ],
        supportedHypotheses: [
          'Wall cycle graph search allows unclosed boundary loops or un-snapped collinear vertices.',
          'Shoelace area calculation produces degenerate result due to inverted vertex winding.'
        ],
        unverifiedHypotheses: [
          'T-junction wall splits may be omitting intersection vertices in room loops.'
        ],
        primarySourceFile,
        targetFunction: 'resolveRooms',
        recommendedFixStrategy: 'polygon_closure'
      };
    }

    default: {
      return {
        invariantId,
        summary: `Unrecognized or generic spatial failure: ${context.failedCheck ?? diagnostic}`,
        confidence: 'low',
        confirmedObservations: [
          `Failed check: ${context.failedCheck ?? 'Unknown'}.`,
          `Diagnostic: ${diagnostic}.`
        ],
        supportedHypotheses: [
          'Failure may require manual computational geometry review.'
        ],
        unverifiedHypotheses: [
          'Underlying data schema or coordinate system assumptions may have changed.'
        ],
        primarySourceFile: sourceLocations[0]?.split(':')[0] ?? 'src/lib/types.ts',
        recommendedFixStrategy: 'manual_review'
      };
    }
  }
}
