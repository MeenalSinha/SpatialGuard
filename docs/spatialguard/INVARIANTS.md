# SpatialGuard — Spatial Invariant Contracts

## 1. What is a Spatial Invariant?

In SpatialGuard, a **Spatial Invariant** is a deterministic, mathematically verifiable rule that must hold across state transitions, transformations, editing operations, and serialization cycles in a spatial geometry application.

Unlike visual snapshot tests or subjective assertions ("it looks right"), a spatial invariant:
1. Operates on concrete domain entities (`Wall`, `Door`, `Window`, `Room`, `Floor`, `Project`).
2. Evaluates explicit geometric and topological properties (lengths, intervals, containment, areas, coordinate preservation).
3. Produces reproducible, boolean-verifiable conclusions with machine-readable diagnostics.
4. Identifies the specific offending element, coordinates, expected values, and observed deviations upon failure.

---

## 2. Implemented Invariants in Phase 1

### Invariant 1: `INV-OPENING-001` — Opening Attachment & Wall Interval Boundary Containment

- **Identifier:** `INV-OPENING-001`
- **Name:** Opening Attachment and Interval Boundary Containment
- **Category:** Opening Integrity
- **Description:**  
  Every opening (door or window) associated with a host wall must be geometrically valid, physically anchored to an existing wall on the same floor, and must not exceed the physical boundaries of that wall.
- **Formal Property:**
  For any opening $O \in (\text{Doors} \cup \text{Windows})$ and its host wall $W$:
  1. **Host Existence:** $W$ must exist in the same floor's wall collection: $W \in \text{Floor.walls}$ where $W.id = O.wallId$.
  2. **Non-Degenerate Host:** The host wall length $L_W = \text{arcLength}(W)$ must be strictly positive: $L_W > 0$.
  3. **Non-Degenerate Width:** The opening width $w_O$ must be strictly positive: $w_O > 0$.
  4. **Length Capacity:** The opening width cannot exceed the host wall arc length: $w_O \le L_W$.
  5. **Parameter Range:** The normalized parameter $t_O$ must lie within $[0, 1]$.
  6. **Physical Span Containment:** For straight walls without external trim overrides, the physical interval of the opening along the wall centerline, defined as $[\text{center} - w_O / 2, \text{center} + w_O / 2]$ where $\text{center} = t_O \cdot L_W$, must be contained within $[0, L_W]$ subject to the boundary tolerance $\tau_{boundary}$:
     $$-\tau_{boundary} \le \left(t_O \cdot L_W - \frac{w_O}{2}\right) \quad \text{and} \quad \left(t_O \cdot L_W + \frac{w_O}{2}\right) \le L_W + \tau_{boundary}$$
- **Relevant Application Modules:**
  - `src/lib/models/types.ts` (`Door`, `Window`, `Wall`)
  - `src/lib/utils/projectValidation.ts` (`readProject`)
  - `src/lib/utils/planOpening.ts` (`planOpening`, `planWallSpans`)
  - `src/lib/utils/openingDrop.ts` (`openingDropTarget`)
- **Accepted Coordinate System & Units:**
  - Floor plan coordinates: **centimetres (cm)**.
  - Position parameter $t$: dimensionless scalar in $[0, 1]$.
- **Assumptions:**
  - Wall centerline is modeled from `start` to `end`.
  - For curved walls, $L_W$ is computed via arc-length profile (`wallPathProfile`).
- **Tolerances:**
  - Boundary tolerance $\tau_{boundary} = 0.5\text{ cm}$ (permits minor floating-point discretization along rounded millimeter boundaries).
  - Arc length tolerance $\epsilon = 10^{-4}\text{ cm}$.
- **Expected Failure Conditions:**
  - Door or window references an unknown `wallId`.
  - Door width is larger than the entire host wall ($w_O > L_W$).
  - Door jamb extends past wall corner into uncontained space ($center + w_O/2 > L_W$).
  - Host wall has zero length ($L_W = 0$).
- **Test Fixtures:**
  - Valid: `CANONICAL_RECTANGULAR_PLAN` (90cm door on 400cm wall, 120cm window on 300cm wall).
  - Invalid: `DOOR_OVERSIZED_FIXTURE`, `DOOR_CORNER_OVERFLOW_FIXTURE`, `ORPHAN_OPENING_FIXTURE`.
- **Diagnostic Output:**
  ```json
  {
    "invariantId": "INV-OPENING-001",
    "status": "failed",
    "elementId": "door-overflow",
    "wallId": "wall-1",
    "reason": "Opening jamb interval [360cm, 460cm] exceeds host wall length 400cm by 60cm.",
    "expected": { "min": 0, "max": 400 },
    "actual": { "leftJamb": 360, "rightJamb": 460, "wallLength": 400 }
  }
  ```

---

### Invariant 2: `INV-INTERCHANGE-001` — Plan Interchange Round-Trip Spatial Conservation

- **Identifier:** `INV-INTERCHANGE-001`
- **Name:** Prepared RoomPlan Interchange Round-Trip Spatial Conservation
- **Category:** Import/Export Consistency
- **Description:**  
  When an OpenPlan3D project is serialized into the prepared RoomPlan interchange JSON format (`projectToRoomPlan`) and deserialized back into an OpenPlan3D project (`createProjectFromRoomPlan`), the geometric integrity of the floor plan must be preserved against independent reference specifications.
- **Formal Property:**
  Given a reference project $P_{ref}$ with known wall lengths $\{L_i\}$, opening widths $\{w_j\}$, and room area $A_{room}$, the re-imported project $P_{imported} = \text{createProjectFromRoomPlan}(\text{projectToRoomPlan}(P_{ref}))$ must satisfy:
  1. **Topological Conservation:** The number of walls, doors, and rooms must match:
     $$|\text{walls}(P_{imported})| = |\text{walls}(P_{ref})|, \quad |\text{doors}(P_{imported})| = |\text{doors}(P_{ref})|$$
  2. **Wall Length Conservation:** For each corresponding wall $W_i$, its Euclidean length $|W_i.end - W_i.start|$ must match the reference length $L_i^{ref}$ within tolerance $\tau_{length}$:
     $$|\text{length}(W_i) - L_i^{ref}| \le \tau_{length}$$
  3. **Opening Placement Conservation:** For each door $D_k$, its relative parameter along the reconstructed wall $t_k$ and its physical width $w_k$ must match reference expectations:
     $$|t_k - t_k^{ref}| \le \tau_{param}, \quad |w_k - w_k^{ref}| \le \tau_{length}$$
  4. **Enclosed Room Area Conservation:** Re-evaluating room detection via `resolveRooms(floor)` on the reconstructed floor must yield the independent expected room area $A_{expected}$ within area tolerance $\tau_{area}$:
     $$|A(P_{imported}) - A_{expected}| \le \tau_{area}$$
- **Relevant Application Modules:**
  - `src/lib/utils/interchange.ts` (`projectToRoomPlan`)
  - `src/lib/utils/roomplanImport.ts` (`createProjectFromRoomPlan`, `validateRoomPlan`)
  - `src/lib/utils/roomDetection.ts` (`resolveRooms`)
  - `src/lib/models/types.ts`
- **Accepted Coordinate System & Units:**
  - Internal Web Project: **centimetres (cm)** for lengths, **square metres ($\text{m}^2$)** for room areas.
  - Interchange JSON: **metres (m)** with 8-decimal precision ($r8 = \text{round}(v \times 10^8) / 10^8$), column-major 4x4 matrix transforms.
- **Assumptions:**
  - The plan contains valid, non-degenerate planar walls.
  - Coordinate origin translation between native and web is invariant with respect to Euclidean distance and enclosed polygon area.
- **Tolerances:**
  - Linear length tolerance: $\tau_{length} = 0.1\text{ cm}$ (accounting for $10^{-8}\text{ m}$ serialization rounding and single-precision transform projections).
  - Relative parameter tolerance: $\tau_{param} = 0.005$ (0.5% along wall).
  - Room area tolerance: $\tau_{area} = 0.02\text{ m}^2$.
- **Expected Failure Conditions:**
  - Re-imported wall lengths altered due to transform matrix distortion.
  - Re-imported openings disconnected from host walls.
  - Reconstructed wall endpoints fail to form a closed cycle within `EPSILON = 5cm`, causing `resolveRooms` to return zero rooms.
  - Re-imported room area departs from independent mathematical ground truth.
- **Test Fixtures:**
  - `CANONICAL_RECTANGULAR_PLAN` (400cm x 300cm rectangular room, 12.00 m² independent area, 90cm door).
- **Diagnostic Output:**
  ```json
  {
    "invariantId": "INV-INTERCHANGE-001",
    "status": "failed",
    "metric": "room_area",
    "expected": 12.0,
    "actual": 0.0,
    "delta": 12.0,
    "unit": "m²",
    "reason": "Re-imported floor failed to detect enclosed room boundary; area dropped from 12.00 m² to 0 m²."
  }
  ```

---

### Invariant 3: `INV-ROOM-001` — Enclosed Planar Room Boundary & Area Non-Degeneracy

- **Identifier:** `INV-ROOM-001`
- **Name:** Enclosed Planar Room Area Non-Degeneracy and Metric Conservation
- **Category:** Room Consistency
- **Description:**  
  Any planar closed loop of $N \ge 3$ non-overlapping wall segments must form a detected room whose calculated area strictly corresponds to the mathematical shoelace polygon area of its bounding vertices, scaled from $\text{cm}^2$ to $\text{m}^2$ ($A = \text{area}_{cm^2} / 10000$). Removing any wall or creating a gap greater than endpoint tolerance ($\text{gap} > 5\text{ cm}$) must deterministically dismantle the room enclosure.
- **Formal Property:**
  For any closed wall circuit with vertex coordinates $\{(x_i, y_i)\}_{i=0}^{N-1}$:
  1. If the cycle is closed ($\text{dist}((x_N, y_N), (x_0, y_0)) < \text{EPSILON}$), then `resolveRooms(floor)` must detect exactly one room per minimal cycle.
  2. The detected room area must satisfy:
     $$|A_{detected} - A_{mathematical}| \le \tau_{area}$$
     where $A_{mathematical} = \frac{1}{20000} \left| \sum_{i=0}^{N-1} (x_i y_{i+1} - x_{i+1} y_i) \right|$.
  3. If any boundary wall is removed or broken such that no closed cycle exists, `resolveRooms(floor)` must return 0 rooms for that boundary.
- **Relevant Application Modules:**
  - `src/lib/utils/roomDetection.ts` (`detectRooms`, `resolveRooms`, `splitWallsAtJunctions`)
  - `src/lib/utils/roomNesting.ts` (`roomHoles`)
- **Tolerances:**
  - $\tau_{area} = 0.01\text{ m}^2$ (standard rounding in `roomDetection.ts`: `Math.round(area / 10000 * 100) / 100`).
- **Test Fixtures:**
  - Valid: `CANONICAL_RECTANGULAR_PLAN` (400cm $\times$ 300cm = 12.00 m²).
  - Negative: `BROKEN_PERIMETER_PLAN` (one wall removed, gap = 400cm).

---

## 3. Machine-Readable Evidence Schema

All SpatialGuard invariant evaluations produce a structured diagnostic result conforming to the following TypeScript interface:

```typescript
export interface InvariantResult {
  invariantId: string;
  name: string;
  category: 'wall' | 'opening' | 'room' | 'interchange' | 'persistence';
  status: 'passed' | 'failed' | 'error';
  target: {
    floorId?: string;
    elementId?: string;
    kind?: string;
  };
  metrics: {
    expected: number | string | Record<string, unknown>;
    actual: number | string | Record<string, unknown>;
    delta?: number;
    unit?: string;
    tolerance?: number;
  };
  message: string;
  timestamp: string;
}
```

This format is serialized into `test-results/spatial-results.json` during execution of `npm run test:spatial`, enabling future GitLab Duo agents to parse precise geometric failure evidence without parsing unstructured console logs.
