import type { Project, Floor, Wall, Door, Window } from '$lib/models/types';

/**
 * Independent ground-truth geometric specifications for the canonical rectangular plan.
 * These values are derived from analytical Euclidean geometry, NOT from calling the
 * production functions under test.
 */
export const CANONICAL_SPEC = {
  roomWidthCm: 400,
  roomHeightCm: 300,
  wallThicknessCm: 15,
  wallHeightCm: 250,
  expectedAreaM2: 12.0, // (400 * 300) / 10000 = 12.00 m²
  walls: {
    'wall-n': { start: { x: 0, y: 0 }, end: { x: 400, y: 0 }, lengthCm: 400 },
    'wall-e': { start: { x: 400, y: 0 }, end: { x: 400, y: 300 }, lengthCm: 300 },
    'wall-s': { start: { x: 400, y: 300 }, end: { x: 0, y: 300 }, lengthCm: 400 },
    'wall-w': { start: { x: 0, y: 300 }, end: { x: 0, y: 0 }, lengthCm: 300 },
  },
  door: {
    id: 'door-canonical-1',
    wallId: 'wall-s',
    position: 0.5,
    widthCm: 90,
    heightCm: 210,
    expectedCenterCm: 200,
    expectedLeftJambCm: 155, // 200 - 45
    expectedRightJambCm: 245, // 200 + 45
  },
  window: {
    id: 'window-canonical-1',
    wallId: 'wall-e',
    position: 0.5,
    widthCm: 120,
    heightCm: 120,
    expectedCenterCm: 150,
    expectedLeftJambCm: 90, // 150 - 60
    expectedRightJambCm: 210, // 150 + 60
  },
} as const;

export function createCanonicalRectangularProject(): Project {
  const walls: Wall[] = [
    {
      id: 'wall-n',
      start: { x: 0, y: 0 },
      end: { x: 400, y: 0 },
      thickness: CANONICAL_SPEC.wallThicknessCm,
      height: CANONICAL_SPEC.wallHeightCm,
      color: '#444444',
    },
    {
      id: 'wall-e',
      start: { x: 400, y: 0 },
      end: { x: 400, y: 300 },
      thickness: CANONICAL_SPEC.wallThicknessCm,
      height: CANONICAL_SPEC.wallHeightCm,
      color: '#444444',
    },
    {
      id: 'wall-s',
      start: { x: 400, y: 300 },
      end: { x: 0, y: 300 },
      thickness: CANONICAL_SPEC.wallThicknessCm,
      height: CANONICAL_SPEC.wallHeightCm,
      color: '#444444',
    },
    {
      id: 'wall-w',
      start: { x: 0, y: 300 },
      end: { x: 0, y: 0 },
      thickness: CANONICAL_SPEC.wallThicknessCm,
      height: CANONICAL_SPEC.wallHeightCm,
      color: '#444444',
    },
  ];

  const doors: Door[] = [
    {
      id: CANONICAL_SPEC.door.id,
      wallId: CANONICAL_SPEC.door.wallId,
      position: CANONICAL_SPEC.door.position,
      width: CANONICAL_SPEC.door.widthCm,
      height: CANONICAL_SPEC.door.heightCm,
      type: 'single',
      swingDirection: 'left',
      flipSide: false,
    },
  ];

  const windows: Window[] = [
    {
      id: CANONICAL_SPEC.window.id,
      wallId: CANONICAL_SPEC.window.wallId,
      position: CANONICAL_SPEC.window.position,
      width: CANONICAL_SPEC.window.widthCm,
      height: CANONICAL_SPEC.window.heightCm,
      sillHeight: 90,
      type: 'standard',
    },
  ];

  const floor: Floor = {
    id: 'floor-ground',
    name: 'Ground Floor',
    level: 0,
    walls,
    doors,
    windows,
    rooms: [],
    furniture: [],
    stairs: [],
    columns: [],
    guides: [],
    measurements: [],
    annotations: [],
    textAnnotations: [],
    groups: [],
  };

  return {
    id: 'canonical-demo-project',
    name: 'Canonical Rectangle Demo',
    floors: [floor],
    activeFloorId: 'floor-ground',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

/**
 * Defect Fixture 1: Oversized door exceeding host wall length.
 * Host wall length = 400cm, Door width = 500cm.
 */
export function createOversizedDoorProject(): Project {
  const project = createCanonicalRectangularProject();
  project.floors[0].doors = [
    {
      id: 'door-oversized',
      wallId: 'wall-s',
      position: 0.5,
      width: 500, // Exceeds 400cm wall
      height: 210,
      type: 'single',
      swingDirection: 'left',
      flipSide: false,
    },
  ];
  return project;
}

/**
 * Defect Fixture 2: Corner overflow door.
 * Wall length = 400cm, Door width = 100cm, position = 0.95 (center = 380cm).
 * Jamb span = [330cm, 430cm], overflowing the 400cm wall corner by 30cm.
 */
export function createCornerOverflowDoorProject(): Project {
  const project = createCanonicalRectangularProject();
  project.floors[0].doors = [
    {
      id: 'door-corner-overflow',
      wallId: 'wall-s',
      position: 0.95,
      width: 100,
      height: 210,
      type: 'single',
      swingDirection: 'left',
      flipSide: false,
    },
  ];
  return project;
}

/**
 * Defect Fixture 3: Orphan opening referencing nonexistent wall.
 */
export function createOrphanOpeningProject(): Project {
  const project = createCanonicalRectangularProject();
  project.floors[0].doors = [
    {
      id: 'door-orphan',
      wallId: 'wall-does-not-exist',
      position: 0.5,
      width: 90,
      height: 210,
      type: 'single',
      swingDirection: 'left',
      flipSide: false,
    },
  ];
  return project;
}

/**
 * Defect Fixture 4: Broken perimeter floor plan.
 * North wall is deleted, breaking the closed room cycle.
 */
export function createBrokenPerimeterProject(): Project {
  const project = createCanonicalRectangularProject();
  project.floors[0].walls = project.floors[0].walls.filter(w => w.id !== 'wall-n');
  return project;
}
