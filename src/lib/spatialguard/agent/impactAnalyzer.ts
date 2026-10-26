import type { ChangedFile, InvariantImpact, RiskClassification, SpatialImpactAssessment } from './types';

interface ModuleMapping {
  pattern: RegExp;
  invariants: Array<{
    id: string;
    name: string;
    severity: 'high' | 'medium' | 'low';
    reason: string;
    tests: string[];
  }>;
  criticalSymbols?: string[];
}

const MODULE_REGISTRY: ModuleMapping[] = [
  {
    pattern: /src\/lib\/models\/types\.ts$/,
    invariants: [
      {
        id: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        severity: 'high',
        reason: 'Core Wall/Door/Window model definitions determine physical dimension boundaries and coordinate units.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/plan-opening.test.ts'],
      },
      {
        id: 'INV-INTERCHANGE-001',
        name: 'Prepared RoomPlan Round-Trip Spatial Conservation',
        severity: 'high',
        reason: 'Model interface modifications impact serialization schema and 4x4 transform mappings.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/interchange.test.ts'],
      },
      {
        id: 'INV-ROOM-001',
        name: 'Enclosed Planar Room Boundary & Area Non-Degeneracy',
        severity: 'high',
        reason: 'Floor and Room model properties directly govern planar boundary representation.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/rooms.test.ts'],
      },
    ],
    criticalSymbols: ['Wall', 'Door', 'Window', 'Room', 'Floor', 'Project', 'Point'],
  },
  {
    pattern: /src\/lib\/utils\/(planOpening|openingDrop|openingAlignment|openingPlanBounds)\.ts$/,
    invariants: [
      {
        id: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        severity: 'high',
        reason: 'Direct modification of opening clipping, projection, drop-target calculation, or jamb bounds along wall centerline.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/plan-opening.test.ts', 'tests/opening-drop.test.ts'],
      },
    ],
    criticalSymbols: ['planOpening', 'planWallSpans', 'openingDropTarget', 'openingAlignmentPosition', 'openingPlanBounds'],
  },
  {
    pattern: /src\/lib\/utils\/(wallProfiles|wallEditing|wallPlanGeometry|wallProjection|wallTranslation|splitWallGeometry)\.ts$/,
    invariants: [
      {
        id: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        severity: 'high',
        reason: 'Wall arc-length and profile calculations govern physical opening capacity and endpoint clamping.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/wall-profiles.test.ts'],
      },
      {
        id: 'INV-ROOM-001',
        name: 'Enclosed Planar Room Boundary & Area Non-Degeneracy',
        severity: 'medium',
        reason: 'Wall endpoint manipulation and splitting affect planar face closure.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/wall-editing.test.ts'],
      },
    ],
    criticalSymbols: ['wallPathProfile', 'wallPathSpans', 'openingOnWall', 'projectOntoWall'],
  },
  {
    pattern: /src\/lib\/utils\/(roomDetection|roomNesting|interiorArea|roomSlabGeometry)\.ts$/,
    invariants: [
      {
        id: 'INV-ROOM-001',
        name: 'Enclosed Planar Room Boundary & Area Non-Degeneracy',
        severity: 'high',
        reason: 'Direct modification of planar cycle traversal, shoelace area computation, or hole subtraction.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/rooms.test.ts', 'tests/interior-area.test.ts'],
      },
      {
        id: 'INV-INTERCHANGE-001',
        name: 'Prepared RoomPlan Round-Trip Spatial Conservation',
        severity: 'medium',
        reason: 'Room detection is used during re-import to reconstruct spatial areas.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/interchange.test.ts'],
      },
    ],
    criticalSymbols: ['detectRooms', 'resolveRooms', 'splitWallsAtJunctions', 'shoelace', 'roomHoles'],
  },
  {
    pattern: /src\/lib\/utils\/(interchange|roomplanImport|roomplanMerge|roomplanValidation)\.ts$/,
    invariants: [
      {
        id: 'INV-INTERCHANGE-001',
        name: 'Prepared RoomPlan Round-Trip Spatial Conservation',
        severity: 'high',
        reason: 'Alters 2D cm to 3D metre matrix transformations, wall midpoint representations, or opening parameters during interchange.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/interchange.test.ts', 'tests/roomplan-import.test.ts'],
      },
    ],
    criticalSymbols: ['projectToPreparedRoomPlan', 'createProjectFromRoomPlan', 'transformAt', 'validateRoomPlan'],
  },
  {
    pattern: /src\/lib\/utils\/projectValidation\.ts$/,
    invariants: [
      {
        id: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        severity: 'medium',
        reason: 'Changes to project reading or opening validation schema constraints.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/project-validation.test.ts'],
      },
      {
        id: 'INV-ROOM-001',
        name: 'Enclosed Planar Room Boundary & Area Non-Degeneracy',
        severity: 'medium',
        reason: 'Floor and wall array validation directly impacts room detection inputs.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/project-validation.test.ts'],
      },
    ],
    criticalSymbols: ['readProject'],
  },
  {
    pattern: /src\/lib\/utils\/(cadExport|export)\.ts$/,
    invariants: [
      {
        id: 'INV-OPENING-001',
        name: 'Opening Attachment and Interval Boundary Containment',
        severity: 'low',
        reason: 'CAD export consumes opening intervals to cut wall outlines.',
        tests: ['tests/spatialguard/invariants.test.ts', 'tests/cadExport.test.ts'],
      },
    ],
    criticalSymbols: ['planWallSpans'],
  },
];

/**
 * Analyzes changed files and code modifications to determine impact on spatial invariants.
 */
export function analyzeSpatialImpact(
  files: Array<string | ChangedFile>
): SpatialImpactAssessment {
  const normalizedFiles: ChangedFile[] = files.map(f => (typeof f === 'string' ? { path: f } : f));
  const filePaths = normalizedFiles.map(f => f.path.replace(/\\/g, '/'));
  const now = new Date().toISOString();

  if (filePaths.length === 0) {
    return {
      changedFiles: [],
      spatialFiles: [],
      impactedInvariants: [],
      riskClassification: 'NEGLIGIBLE',
      isSpatialChange: false,
      suggestedAction: 'No files changed. No spatial verification required.',
      evidence: ['Change set is empty.'],
      confidence: 'inconclusive',
      timestamp: now,
    };
  }

  const spatialFiles: string[] = [];
  const impactedMap = new Map<string, InvariantImpact>();
  const evidence: string[] = [];

  for (const file of normalizedFiles) {
    const cleanPath = file.path.replace(/\\/g, '/');
    let matched = false;

    for (const mapping of MODULE_REGISTRY) {
      if (mapping.pattern.test(cleanPath)) {
        matched = true;
        if (!spatialFiles.includes(cleanPath)) spatialFiles.push(cleanPath);

        const detectedSymbols: string[] = [];
        if (file.diff && mapping.criticalSymbols) {
          for (const sym of mapping.criticalSymbols) {
            if (file.diff.includes(sym)) detectedSymbols.push(sym);
          }
        }
        if (file.modifiedSymbols) {
          detectedSymbols.push(...file.modifiedSymbols);
        }

        for (const inv of mapping.invariants) {
          const existing = impactedMap.get(inv.id);
          const tests = Array.from(new Set([...(existing?.suggestedTests ?? []), ...inv.tests]));
          const allSymbols = Array.from(new Set([...(existing?.affectedSymbols ?? []), ...detectedSymbols]));

          impactedMap.set(inv.id, {
            invariantId: inv.id,
            name: inv.name,
            severity: existing && existing.severity === 'high' ? 'high' : inv.severity,
            reason: `${cleanPath}: ${inv.reason}`,
            affectedSymbols: allSymbols,
            suggestedTests: tests,
          });
        }

        evidence.push(
          `Module '${cleanPath}' mapped to ${mapping.invariants.map(i => i.id).join(', ')}${
            detectedSymbols.length ? ` (modified symbols: ${detectedSymbols.join(', ')})` : ''
          }`
        );
      }
    }
  }

  const impactedInvariants = Array.from(impactedMap.values());
  const isSpatialChange = spatialFiles.length > 0;

  // Determine risk classification
  let riskClassification: RiskClassification = 'NEGLIGIBLE';
  if (isSpatialChange) {
    const hasHigh = impactedInvariants.some(i => i.severity === 'high');
    const coreCount = spatialFiles.filter(f =>
      f.includes('types.ts') ||
      f.includes('planOpening.ts') ||
      f.includes('interchange.ts') ||
      f.includes('roomDetection.ts')
    ).length;

    if (coreCount >= 2 || (hasHigh && spatialFiles.length >= 3)) {
      riskClassification = 'CRITICAL';
    } else if (hasHigh) {
      riskClassification = 'HIGH';
    } else if (impactedInvariants.some(i => i.severity === 'medium')) {
      riskClassification = 'MEDIUM';
    } else {
      riskClassification = 'LOW';
    }
  } else {
    // Check if test files themselves changed
    const testChanges = filePaths.filter(f => f.includes('tests/'));
    if (testChanges.length > 0) {
      riskClassification = 'LOW';
      evidence.push(`Test files modified: ${testChanges.join(', ')}`);
    } else {
      evidence.push('No spatial geometry or transformation modules were modified.');
    }
  }

  const suggestedAction = isSpatialChange
    ? `Execute spatial invariant suite (${impactedInvariants.map(i => i.invariantId).join(', ')}) via 'npm run test:spatial'.`
    : 'No spatial invariants impacted. Standard CI tests sufficient.';

  return {
    changedFiles: filePaths,
    spatialFiles,
    impactedInvariants,
    riskClassification,
    isSpatialChange,
    suggestedAction,
    evidence,
    confidence: isSpatialChange ? 'high' : 'medium',
    timestamp: now,
  };
}
