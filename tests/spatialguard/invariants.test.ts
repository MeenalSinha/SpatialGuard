import { describe, expect, it } from 'vitest';
import {
  evaluateOpeningIntegrity,
  evaluateInterchangeRoundTrip,
  evaluateRoomEnclosure,
  runSpatialAudit,
  getWallArcLength,
  SPATIAL_TOLERANCES,
} from '$lib/spatialguard';
import {
  CANONICAL_SPEC,
  createCanonicalRectangularProject,
  createOversizedDoorProject,
  createCornerOverflowDoorProject,
  createOrphanOpeningProject,
  createBrokenPerimeterProject,
} from './fixtures/canonical-fixtures';

describe('SpatialGuard Core — Invariant Verification Suite', () => {
  describe('INV-OPENING-001: Opening Attachment and Interval Boundary Containment', () => {
    it('passes for canonical valid floor plan with well-contained openings', () => {
      const project = createCanonicalRectangularProject();
      const floor = project.floors[0];
      const results = evaluateOpeningIntegrity(floor);

      expect(results).toHaveLength(2); // 1 door + 1 window
      expect(results.every(r => r.status === 'passed')).toBe(true);

      const doorResult = results.find(r => r.target.elementId === CANONICAL_SPEC.door.id)!;
      expect(doorResult.status).toBe('passed');
      expect(doorResult.invariantId).toBe('INV-OPENING-001');
      expect(doorResult.message).toContain('safely contained');

      const windowResult = results.find(r => r.target.elementId === CANONICAL_SPEC.window.id)!;
      expect(windowResult.status).toBe('passed');
      expect(windowResult.metrics.actual).toMatchObject({
        leftJamb: CANONICAL_SPEC.window.expectedLeftJambCm,
        rightJamb: CANONICAL_SPEC.window.expectedRightJambCm,
        width: CANONICAL_SPEC.window.widthCm,
      });
    });

    it('detects and rejects oversized door exceeding host wall length (negative case)', () => {
      const project = createOversizedDoorProject();
      const floor = project.floors[0];
      const results = evaluateOpeningIntegrity(floor);

      const failedResult = results.find(r => r.target.elementId === 'door-oversized')!;
      expect(failedResult).toBeDefined();
      expect(failedResult.status).toBe('failed');
      expect(failedResult.invariantId).toBe('INV-OPENING-001');
      expect(failedResult.metrics.actual).toBe(500);
      expect(failedResult.metrics.delta).toBe(100); // 500 - 400 = 100cm overflow
      expect(failedResult.message).toContain("width (500 cm) exceeds host wall 'wall-s' length (400.00 cm)");
    });

    it('detects and rejects door jamb overflowing wall corner (negative case)', () => {
      const project = createCornerOverflowDoorProject();
      const floor = project.floors[0];
      const results = evaluateOpeningIntegrity(floor);

      const failedResult = results.find(r => r.target.elementId === 'door-corner-overflow')!;
      expect(failedResult).toBeDefined();
      expect(failedResult.status).toBe('failed');
      expect(failedResult.metrics.delta).toBe(30); // 430 - 400 = 30cm overflow past corner
      expect(failedResult.message).toContain('overflows host wall boundaries [0, 400.0 cm] by 30.0 cm');
    });

    it('detects and rejects orphan opening referencing non-existent wall (negative case)', () => {
      const project = createOrphanOpeningProject();
      const floor = project.floors[0];
      const results = evaluateOpeningIntegrity(floor);

      const failedResult = results.find(r => r.target.elementId === 'door-orphan')!;
      expect(failedResult).toBeDefined();
      expect(failedResult.status).toBe('failed');
      expect(failedResult.message).toContain("references non-existent host wall 'wall-does-not-exist'");
    });
  });

  describe('INV-INTERCHANGE-001: Prepared RoomPlan Round-Trip Spatial Conservation', () => {
    it('conserves wall lengths, door width, and enclosed room area through export/re-import', () => {
      const project = createCanonicalRectangularProject();
      const expectedWallLengths = {
        'wall-n': CANONICAL_SPEC.walls['wall-n'].lengthCm,
        'wall-e': CANONICAL_SPEC.walls['wall-e'].lengthCm,
        'wall-s': CANONICAL_SPEC.walls['wall-s'].lengthCm,
        'wall-w': CANONICAL_SPEC.walls['wall-w'].lengthCm,
      };

      const results = evaluateInterchangeRoundTrip(project, {
        wallLengths: expectedWallLengths,
        roomArea: CANONICAL_SPEC.expectedAreaM2,
        doorWidths: { [CANONICAL_SPEC.door.id]: CANONICAL_SPEC.door.widthCm },
      });

      expect(results.length).toBeGreaterThanOrEqual(6); // 4 walls + 1 room area + 1 door
      const failures = results.filter(r => r.status === 'failed');
      expect(failures).toHaveLength(0);

      // Verify individual wall length conservation metrics
      for (const [wallId, length] of Object.entries(expectedWallLengths)) {
        const wallCheck = results.find(r => r.target.elementId === wallId)!;
        expect(wallCheck).toBeDefined();
        expect(wallCheck.status).toBe('passed');
        expect(wallCheck.metrics.actual).toBeCloseTo(length, 1);
      }

      // Verify room area conservation metric
      const areaCheck = results.find(r => r.target.kind === 'room')!;
      expect(areaCheck).toBeDefined();
      expect(areaCheck.status).toBe('passed');
      expect(areaCheck.metrics.actual).toBe(CANONICAL_SPEC.expectedAreaM2);
    });
  });

  describe('INV-ROOM-001: Enclosed Planar Room Boundary & Area Non-Degeneracy', () => {
    it('detects exactly 1 room with analytical area 12.00 m² for canonical rectangle', () => {
      const project = createCanonicalRectangularProject();
      const floor = project.floors[0];
      const results = evaluateRoomEnclosure(floor, {
        roomCount: 1,
        area: CANONICAL_SPEC.expectedAreaM2,
      });

      expect(results).toHaveLength(2); // count + area
      expect(results.every(r => r.status === 'passed')).toBe(true);

      const areaCheck = results.find(r => r.metrics.unit === 'm²')!;
      expect(areaCheck.metrics.actual).toBe(12.0);
      expect(areaCheck.metrics.delta).toBe(0);
    });

    it('fails when wall perimeter is broken and room enclosure is dismantled (negative case)', () => {
      const project = createBrokenPerimeterProject();
      const floor = project.floors[0];
      const results = evaluateRoomEnclosure(floor, {
        roomCount: 1,
        area: CANONICAL_SPEC.expectedAreaM2,
      });

      const countCheck = results.find(r => r.metrics.unit === undefined)!;
      expect(countCheck.status).toBe('failed');
      expect(countCheck.metrics.actual).toBe(0);
      expect(countCheck.message).toContain('Expected 1 detected room(s), but found 0');
    });
  });

  describe('SpatialGuard Full Audit Runner', () => {
    it('produces machine-readable diagnostic report across all active invariants', () => {
      const project = createCanonicalRectangularProject();
      const report = runSpatialAudit(project, {
        wallLengths: {
          'wall-n': 400,
          'wall-e': 300,
          'wall-s': 400,
          'wall-w': 300,
        },
        roomArea: 12.0,
        roomCount: 1,
        doorWidths: { [CANONICAL_SPEC.door.id]: 90 },
      });

      expect(report.summary.total).toBeGreaterThanOrEqual(8);
      expect(report.summary.failed).toBe(0);
      expect(report.summary.passed).toBe(report.summary.total);
      expect(report.summary.durationMs).toBeGreaterThanOrEqual(0);
      expect(report.results).toBeInstanceOf(Array);
    });
  });
});
