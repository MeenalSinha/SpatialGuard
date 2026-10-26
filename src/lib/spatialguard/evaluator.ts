import type { Door, Floor, Project, Wall, Window } from '$lib/models/types';
import { wallPathProfile } from '$lib/utils/wallProfiles';
import { projectToPreparedRoomPlan } from '$lib/utils/interchange';
import { createProjectFromRoomPlan } from '$lib/utils/roomplanImport';
import { resolveRooms } from '$lib/utils/roomDetection';
import type { InvariantResult, SpatialAuditReport } from './types';

export const SPATIAL_TOLERANCES = {
  BOUNDARY_CM: 0.5,
  LENGTH_CM: 0.1,
  PARAM: 0.005,
  AREA_M2: 0.02,
} as const;

/**
 * Computes the real arc-length of a wall in centimetres.
 */
export function getWallArcLength(wall: Wall): number {
  if (wall.curvePoint) {
    return wallPathProfile(wall).length;
  }
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

/**
 * INV-OPENING-001: Opening Attachment and Interval Boundary Containment.
 * Checks that every door and window is anchored to an existing wall,
 * has valid positive dimensions not exceeding the host wall,
 * and that its physical jamb span fits inside [0, L_wall] within tolerance.
 */
export function evaluateOpeningIntegrity(
  floor: Floor,
  options: { boundaryTolerance?: number } = {}
): InvariantResult[] {
  const results: InvariantResult[] = [];
  const tolerance = options.boundaryTolerance ?? SPATIAL_TOLERANCES.BOUNDARY_CM;
  const wallMap = new Map<string, Wall>(floor.walls.map(w => [w.id, w]));
  const openings: Array<{ item: Door | Window; kind: 'door' | 'window' }> = [
    ...floor.doors.map(item => ({ item, kind: 'door' as const })),
    ...floor.windows.map(item => ({ item, kind: 'window' as const })),
  ];

  for (const { item, kind } of openings) {
    const target = { floorId: floor.id, elementId: item.id, kind };
    const now = new Date().toISOString();

    // 1. Host wall existence
    const hostWall = wallMap.get(item.wallId);
    if (!hostWall) {
      results.push({
        invariantId: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        category: 'opening',
        status: 'failed',
        target,
        metrics: {
          expected: 'Existing wall ID on current floor',
          actual: item.wallId,
        },
        message: `Opening '${item.id}' references non-existent host wall '${item.wallId}'.`,
        timestamp: now,
      });
      continue;
    }

    const wallLength = getWallArcLength(hostWall);

    // 2. Non-degenerate host wall
    if (wallLength <= 1e-4) {
      results.push({
        invariantId: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        category: 'opening',
        status: 'failed',
        target,
        metrics: {
          expected: '> 0 cm',
          actual: wallLength,
          unit: 'cm',
        },
        message: `Opening '${item.id}' is attached to degenerate host wall '${hostWall.id}' with length ${wallLength.toFixed(2)} cm.`,
        timestamp: now,
      });
      continue;
    }

    // 3. Opening width capacity
    if (item.width <= 0) {
      results.push({
        invariantId: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        category: 'opening',
        status: 'failed',
        target,
        metrics: {
          expected: '> 0 cm',
          actual: item.width,
          unit: 'cm',
        },
        message: `Opening '${item.id}' has non-positive width ${item.width} cm.`,
        timestamp: now,
      });
      continue;
    }

    if (item.width > wallLength + tolerance) {
      results.push({
        invariantId: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        category: 'opening',
        status: 'failed',
        target,
        metrics: {
          expected: `<= ${wallLength.toFixed(2)} cm`,
          actual: item.width,
          delta: item.width - wallLength,
          unit: 'cm',
          tolerance,
        },
        message: `Opening '${item.id}' width (${item.width} cm) exceeds host wall '${hostWall.id}' length (${wallLength.toFixed(2)} cm).`,
        timestamp: now,
      });
      continue;
    }

    // 4. Physical span containment
    let centerDist: number;
    if (hostWall.curvePoint) {
      centerDist = wallPathProfile(hostWall).distanceAt(item.position);
    } else {
      centerDist = item.position * wallLength;
    }

    const leftJamb = centerDist - item.width / 2;
    const rightJamb = centerDist + item.width / 2;

    const leftOverflow = -leftJamb;
    const rightOverflow = rightJamb - wallLength;

    if (leftOverflow > tolerance || rightOverflow > tolerance) {
      const maxOverflow = Math.max(leftOverflow, rightOverflow);
      results.push({
        invariantId: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        category: 'opening',
        status: 'failed',
        target,
        metrics: {
          expected: { min: 0, max: Number(wallLength.toFixed(2)) },
          actual: {
            leftJamb: Number(leftJamb.toFixed(2)),
            rightJamb: Number(rightJamb.toFixed(2)),
            center: Number(centerDist.toFixed(2)),
          },
          delta: Number(maxOverflow.toFixed(2)),
          unit: 'cm',
          tolerance,
        },
        message: `Opening '${item.id}' jamb span [${leftJamb.toFixed(1)} cm, ${rightJamb.toFixed(1)} cm] overflows host wall boundaries [0, ${wallLength.toFixed(1)} cm] by ${maxOverflow.toFixed(1)} cm.`,
        timestamp: now,
      });
      continue;
    }

    // Passes
    results.push({
      invariantId: 'INV-OPENING-001',
      name: 'Opening Attachment and Interval Boundary Containment',
      category: 'opening',
      status: 'passed',
      target,
      metrics: {
        expected: { min: 0, max: Number(wallLength.toFixed(2)) },
        actual: {
          leftJamb: Number(leftJamb.toFixed(2)),
          rightJamb: Number(rightJamb.toFixed(2)),
          width: item.width,
        },
        unit: 'cm',
        tolerance,
      },
      message: `Opening '${item.id}' safely contained on host wall '${hostWall.id}' ([${leftJamb.toFixed(1)} cm, ${rightJamb.toFixed(1)} cm] within [0, ${wallLength.toFixed(1)} cm]).`,
      timestamp: now,
    });
  }

  return results;
}

/**
 * INV-INTERCHANGE-001: Prepared RoomPlan Interchange Round-Trip Spatial Conservation.
 * Evaluates that projectToRoomPlan -> createProjectFromRoomPlan preserves wall lengths,
 * opening dimensions, and enclosed room areas against independently defined expectations.
 */
export function evaluateInterchangeRoundTrip(
  sourceProject: Project,
  expected: {
    wallLengths?: Record<string, number>;
    roomArea?: number;
    doorWidths?: Record<string, number>;
  } = {}
): InvariantResult[] {
  const results: InvariantResult[] = [];
  const now = new Date().toISOString();

  // Execute actual interchange transformations
  const exportedRoomPlan = projectToPreparedRoomPlan(sourceProject);
  const reimportedProject = createProjectFromRoomPlan(exportedRoomPlan, 'Interchange Re-import');

  const srcFloor = sourceProject.floors[0];
  const impFloor = reimportedProject.floors[0];

  // 1. Check wall length preservation
  if (expected.wallLengths) {
    for (const [wallId, expLength] of Object.entries(expected.wallLengths)) {
      // Walls in re-imported project match by index or ID (roomplanImport may assign new UUIDs)
      const srcIndex = srcFloor.walls.findIndex(w => w.id === wallId);
      const impWall = srcIndex >= 0 ? impFloor.walls[srcIndex] : impFloor.walls.find(w => w.id === wallId);

      if (!impWall) {
        results.push({
          invariantId: 'INV-INTERCHANGE-001',
          name: 'Prepared RoomPlan Interchange Round-Trip Spatial Conservation',
          category: 'interchange',
          status: 'failed',
          target: { floorId: srcFloor.id, elementId: wallId, kind: 'wall' },
          metrics: { expected: expLength, actual: null, unit: 'cm' },
          message: `Wall '${wallId}' missing from re-imported interchange project.`,
          timestamp: now,
        });
        continue;
      }

      const actLength = getWallArcLength(impWall);
      const delta = Math.abs(actLength - expLength);

      if (delta > SPATIAL_TOLERANCES.LENGTH_CM) {
        results.push({
          invariantId: 'INV-INTERCHANGE-001',
          name: 'Prepared RoomPlan Interchange Round-Trip Spatial Conservation',
          category: 'interchange',
          status: 'failed',
          target: { floorId: srcFloor.id, elementId: wallId, kind: 'wall' },
          metrics: {
            expected: expLength,
            actual: Number(actLength.toFixed(2)),
            delta: Number(delta.toFixed(2)),
            unit: 'cm',
            tolerance: SPATIAL_TOLERANCES.LENGTH_CM,
          },
          message: `Wall '${wallId}' length changed during interchange round-trip: expected ${expLength} cm, got ${actLength.toFixed(2)} cm (delta: ${delta.toFixed(2)} cm).`,
          timestamp: now,
        });
      } else {
        results.push({
          invariantId: 'INV-INTERCHANGE-001',
          name: 'Prepared RoomPlan Interchange Round-Trip Spatial Conservation',
          category: 'interchange',
          status: 'passed',
          target: { floorId: srcFloor.id, elementId: wallId, kind: 'wall' },
          metrics: {
            expected: expLength,
            actual: Number(actLength.toFixed(2)),
            delta: Number(delta.toFixed(4)),
            unit: 'cm',
            tolerance: SPATIAL_TOLERANCES.LENGTH_CM,
          },
          message: `Wall '${wallId}' length conserved in interchange round-trip (${actLength.toFixed(2)} cm vs expected ${expLength} cm).`,
          timestamp: now,
        });
      }
    }
  }

  // 2. Check room area conservation
  if (expected.roomArea !== undefined) {
    const resolvedRooms = resolveRooms(impFloor);
    const totalArea = resolvedRooms.reduce((sum, r) => sum + r.area, 0);
    const delta = Math.abs(totalArea - expected.roomArea);

    if (resolvedRooms.length === 0 || delta > SPATIAL_TOLERANCES.AREA_M2) {
      results.push({
        invariantId: 'INV-INTERCHANGE-001',
        name: 'Prepared RoomPlan Interchange Round-Trip Spatial Conservation',
        category: 'interchange',
        status: 'failed',
        target: { floorId: srcFloor.id, kind: 'room' },
        metrics: {
          expected: expected.roomArea,
          actual: Number(totalArea.toFixed(2)),
          delta: Number(delta.toFixed(2)),
          unit: 'm²',
          tolerance: SPATIAL_TOLERANCES.AREA_M2,
        },
        message: `Room area altered during interchange round-trip: expected ${expected.roomArea} m², resolved ${totalArea.toFixed(2)} m² across ${resolvedRooms.length} room(s).`,
        timestamp: now,
      });
    } else {
      results.push({
        invariantId: 'INV-INTERCHANGE-001',
        name: 'Prepared RoomPlan Interchange Round-Trip Spatial Conservation',
        category: 'interchange',
        status: 'passed',
        target: { floorId: srcFloor.id, kind: 'room' },
        metrics: {
          expected: expected.roomArea,
          actual: Number(totalArea.toFixed(2)),
          delta: Number(delta.toFixed(4)),
          unit: 'm²',
          tolerance: SPATIAL_TOLERANCES.AREA_M2,
        },
        message: `Room area conserved during interchange round-trip (${totalArea.toFixed(2)} m² vs expected ${expected.roomArea} m²).`,
        timestamp: now,
      });
    }
  }

  // 3. Check door width preservation
  if (expected.doorWidths) {
    for (const [doorId, expWidth] of Object.entries(expected.doorWidths)) {
      const srcIndex = srcFloor.doors.findIndex(d => d.id === doorId);
      const impDoor = srcIndex >= 0 ? impFloor.doors[srcIndex] : impFloor.doors.find(d => d.id === doorId);

      if (!impDoor) {
        results.push({
          invariantId: 'INV-INTERCHANGE-001',
          name: 'Prepared RoomPlan Interchange Round-Trip Spatial Conservation',
          category: 'interchange',
          status: 'failed',
          target: { floorId: srcFloor.id, elementId: doorId, kind: 'door' },
          metrics: { expected: expWidth, actual: null, unit: 'cm' },
          message: `Door '${doorId}' missing from re-imported interchange project.`,
          timestamp: now,
        });
        continue;
      }

      const delta = Math.abs(impDoor.width - expWidth);
      if (delta > SPATIAL_TOLERANCES.LENGTH_CM) {
        results.push({
          invariantId: 'INV-INTERCHANGE-001',
          name: 'Prepared RoomPlan Interchange Round-Trip Spatial Conservation',
          category: 'interchange',
          status: 'failed',
          target: { floorId: srcFloor.id, elementId: doorId, kind: 'door' },
          metrics: {
            expected: expWidth,
            actual: impDoor.width,
            delta,
            unit: 'cm',
            tolerance: SPATIAL_TOLERANCES.LENGTH_CM,
          },
          message: `Door '${doorId}' width altered in interchange: expected ${expWidth} cm, got ${impDoor.width} cm.`,
          timestamp: now,
        });
      } else {
        results.push({
          invariantId: 'INV-INTERCHANGE-001',
          name: 'Prepared RoomPlan Interchange Round-Trip Spatial Conservation',
          category: 'interchange',
          status: 'passed',
          target: { floorId: srcFloor.id, elementId: doorId, kind: 'door' },
          metrics: {
            expected: expWidth,
            actual: impDoor.width,
            delta,
            unit: 'cm',
            tolerance: SPATIAL_TOLERANCES.LENGTH_CM,
          },
          message: `Door '${doorId}' width conserved in interchange (${impDoor.width} cm vs expected ${expWidth} cm).`,
          timestamp: now,
        });
      }
    }
  }

  return results;
}

/**
 * INV-ROOM-001: Enclosed Planar Room Boundary & Area Non-Degeneracy.
 * Evaluates that a floor with closed perimeter walls detects the exact
 * expected area and room count.
 */
export function evaluateRoomEnclosure(
  floor: Floor,
  expected: { roomCount: number; area: number }
): InvariantResult[] {
  const results: InvariantResult[] = [];
  const now = new Date().toISOString();
  const rooms = resolveRooms(floor);

  // 1. Room count
  if (rooms.length !== expected.roomCount) {
    results.push({
      invariantId: 'INV-ROOM-001',
      name: 'Enclosed Planar Room Area Non-Degeneracy and Metric Conservation',
      category: 'room',
      status: 'failed',
      target: { floorId: floor.id, kind: 'room' },
      metrics: {
        expected: expected.roomCount,
        actual: rooms.length,
      },
      message: `Expected ${expected.roomCount} detected room(s), but found ${rooms.length}.`,
      timestamp: now,
    });
  } else {
    results.push({
      invariantId: 'INV-ROOM-001',
      name: 'Enclosed Planar Room Area Non-Degeneracy and Metric Conservation',
      category: 'room',
      status: 'passed',
      target: { floorId: floor.id, kind: 'room' },
      metrics: {
        expected: expected.roomCount,
        actual: rooms.length,
      },
      message: `Detected expected ${expected.roomCount} room(s).`,
      timestamp: now,
    });
  }

  // 2. Room area
  const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
  const delta = Math.abs(totalArea - expected.area);

  if (delta > SPATIAL_TOLERANCES.AREA_M2) {
    results.push({
      invariantId: 'INV-ROOM-001',
      name: 'Enclosed Planar Room Area Non-Degeneracy and Metric Conservation',
      category: 'room',
      status: 'failed',
      target: { floorId: floor.id, kind: 'room' },
      metrics: {
        expected: expected.area,
        actual: Number(totalArea.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        unit: 'm²',
        tolerance: SPATIAL_TOLERANCES.AREA_M2,
      },
      message: `Room area ${totalArea.toFixed(2)} m² departs from expected ${expected.area} m² by ${delta.toFixed(2)} m².`,
      timestamp: now,
    });
  } else {
    results.push({
      invariantId: 'INV-ROOM-001',
      name: 'Enclosed Planar Room Area Non-Degeneracy and Metric Conservation',
      category: 'room',
      status: 'passed',
      target: { floorId: floor.id, kind: 'room' },
      metrics: {
        expected: expected.area,
        actual: Number(totalArea.toFixed(2)),
        delta: Number(delta.toFixed(4)),
        unit: 'm²',
        tolerance: SPATIAL_TOLERANCES.AREA_M2,
      },
      message: `Room area ${totalArea.toFixed(2)} m² matches expected ${expected.area} m² within tolerance.`,
      timestamp: now,
    });
  }

  return results;
}

/**
 * Runs a complete spatial audit on a project and returns a structured report.
 */
export function runSpatialAudit(
  project: Project,
  expectedFloorPlan?: {
    wallLengths?: Record<string, number>;
    roomArea?: number;
    roomCount?: number;
    doorWidths?: Record<string, number>;
  }
): SpatialAuditReport {
  const start = Date.now();
  const allResults: InvariantResult[] = [];

  for (const floor of project.floors) {
    allResults.push(...evaluateOpeningIntegrity(floor));

    if (expectedFloorPlan && expectedFloorPlan.roomArea !== undefined) {
      allResults.push(
        ...evaluateRoomEnclosure(floor, {
          roomCount: expectedFloorPlan.roomCount ?? 1,
          area: expectedFloorPlan.roomArea,
        })
      );
    }
  }

  if (expectedFloorPlan) {
    allResults.push(...evaluateInterchangeRoundTrip(project, expectedFloorPlan));
  }

  const passed = allResults.filter(r => r.status === 'passed').length;
  const failed = allResults.filter(r => r.status === 'failed').length;
  const errors = allResults.filter(r => r.status === 'error').length;

  return {
    summary: {
      total: allResults.length,
      passed,
      failed,
      errors,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
    },
    results: allResults,
  };
}
