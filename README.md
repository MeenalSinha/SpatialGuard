# openplan3d

**Free Open Source 2D/3D Floor Plan Editor**

Design floor plans in an intuitive 2D editor, then instantly preview them in a fully navigable 3D view — all in your browser. No account required, no server dependency; your projects stay on your device.

**🌐 Try it live: [app.openplan3d.com](https://app.openplan3d.com/)**

Maintainers: see [NEXT.md](NEXT.md) for the current backlog, verified baseline,
iPhone release gates and Firebase cost constraints. The [capability reference](FEATURES.md)
links implementation scope to regression coverage and records known limits.

**User guide:** [docs/user-guide.md](docs/user-guide.md) walks through every menu,
tool, export and import as the hosted editor shows them. **For AI agents:** the
[plan-authoring skill](docs/skills/openplan3d-plan-authoring/SKILL.md) describes both
accepted file formats so an assistant can write or edit a plan you open with Import JSON.

<p align="center">
  <img src="plan1_2d.jpg" alt="2D Floor Plan View" width="48%">
  <img src="plan1_3d.jpg" alt="3D Floor Plan View" width="48%">
</p>
<p align="center">
  <img src="plan4_2d.jpg" alt="Detailed 2D Plan" width="48%">
  <img src="plan4_3d.jpg" alt="Detailed 3D View" width="48%">
</p>

---

## ✨ Features

### 🏗️ Drawing Tools
- **Walls** — Click-to-place with automatic snapping and angle constraints
- **Doors & Windows** — Multiple styles (single, double, sliding, pocket, bi-fold, french doors; casement, bay, picture windows)
- **Stairs** — Straight, L-shaped, and U-shaped with configurable dimensions
- **Rooms** — Auto-detected from walls with customizable labels and colors

### 🛋️ Furniture Library
- **Categorized catalog** for living room, bedroom, kitchen, bathroom, dining, office, outdoor, and more — see the [catalog source](src/lib/utils/furnitureCatalog.ts) for the current inventory
- Drag-and-drop placement with rotation, resizing, and snapping
- Full **3D models** rendered in the 3D view

### 🏠 3D View
- **Real-time 3D preview** — Toggle with `Tab`
- **Walkthrough mode** — First-person navigation through your floor plan
- **Material editor** — Apply textures to walls, floors, and ceilings (wood, tile, marble, carpet, concrete, brick, and more)
- **Lighting** — Ambient and directional lighting with adjustable intensity

### 📐 Pro Tools
- **Snap to grid** with configurable grid size
- **Smart guides** and alignment helpers
- **Multi-select** with box selection and alignment tools (align left, center, right, top, middle, bottom; distribute evenly)
- **Layers** — Organize elements across multiple layers with visibility toggles
- **Annotations** — Text labels with customizable font size and color
- **Room presets** — Quickly apply standard room dimensions
- **Undo/Redo** — Full history with grouped operations
- **Version history** — Auto-saved snapshots you can restore

### 📤 Export
- **SVG** — Scalable vector graphics
- **DXF** — AutoCAD-compatible format
- **PDF** — Print-ready output with title block
- **PNG** — High-resolution raster image
- **JSON** — Project data for backup and transfer
- **Project package ZIP** — Edited plans and supported attachments for exchange with the native companion; see the [format and limits](docs/project-package-v1.md)
- **Interchange JSON** — For OpenKitchen3D, OpenLandscape3D, OpenCatio3D and the iPhone app: the family's prepared RoomPlan JSON, saved as `<Project-Name>-openplan3d.json` by **Download interchange JSON**; see the [handoff format](docs/handoff-format-v1.md)
- **Open in OpenLandscape3D / OpenKitchen3D / OpenCatio3D** — Opens the other planner in a new tab with the whole plan in the link; nothing is uploaded. A plan too large for a link downloads the interchange JSON instead

### 📥 Import
- **JSON** — Restore saved projects
- **Apple RoomPlan** — Import room scans from iOS devices as a new project, or **Add to this plan** to stitch several scans into one floor plan
- **Sibling planner files and handoffs** — OpenKitchen3D, OpenLandscape3D and OpenCatio3D exports open with **Import JSON**, and the **Open in OpenPlan3D** buttons of OpenLandscape3D, OpenCatio3D and the OpenKitchen3D iPhone app open here directly; their cabinets, plants and structures are kept for the trip back
- **Project package ZIP** — Import edited native plans and supported attachments, with retained data governed by the [package contract](docs/project-package-v1.md)
- **Clipboard images** — Paste reference images directly onto the canvas

### 🔗 Works with
- **[OpenLandscape3D](https://openlandscape3d.com)** — gardens planned around the house footprint
- **[OpenKitchen3D](https://openkitchen3d.com)** — kitchen and cabinet planning inside a room
- **[OpenCatio3D](https://opencatio3d.com)** — catios designed against the house walls

Three free web planners from the same makers. They read and write the prepared RoomPlan JSON described in [docs/handoff-format-v1.md](docs/handoff-format-v1.md) (their own docs call it "OpenPlan3D JSON"), so a plan moves between the editors through the Export menu, a file, or the **Open in OpenPlan3D** action in OpenLandscape3D, OpenCatio3D and the OpenKitchen3D iPhone app.

---

## 📱 Companion iOS App

Scan a room with your iPhone and get an editable floor plan in seconds. The OpenPlan3D iOS app uses LiDAR (with an AR fallback for non-LiDAR devices) to build walls, doors, and windows as you walk, calculates room areas automatically, and shows the result in 2D and 3D — then hands the plan off to the web editor with one tap (see [iOS capture handoff](#-ios-capture-handoff)).

<p align="center">
  <img src="ios_home.png" alt="iOS app — scan a room, get a floor plan" width="24%">
  <img src="ios_editor.png" alt="iOS app — edit walls, doors, and windows" width="24%">
  <img src="ios_plan.png" alt="iOS app — room areas calculated" width="24%">
  <img src="ios_3d.png" alt="iOS app — 3D view of the scanned space" width="24%">
</p>

---

## 🚀 Getting Started

The easiest way to try openplan3d is the hosted version at **[app.openplan3d.com](https://app.openplan3d.com/)** — no install needed.

To run it locally, use Node.js 24 (see `.nvmrc`) and npm:

```bash
# Clone the repository
git clone https://github.com/laanlabs/openPlan3D.git
cd openPlan3D

# Install dependencies
npm ci

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

See [CONTRIBUTING.md](CONTRIBUTING.md) for fixture-based reports, focused checks
and pull requests. Maintainers can use the [release checklist](docs/release-checklist.md).

### Development Checks

```bash
npm test
npm run check
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

GitHub Actions runs these checks for pull requests and pushes to `main`.
The regression suite covers local storage failures, autosave status, room metadata
and exports, and keyboard tools. Use `npm run test:watch` while working on a fix.
Production-browser CI runs the same regression suite in Chromium, Firefox and
WebKit, covering import/edit/undo/save/reload/export, damaged-file recovery,
iPhone project packages, photos, catalog loading, 3D and cold/warm asset transfers.
Each engine runs in a separate job against the same production build, with an
isolated Node server and analytics/cloud uploads disabled. The final `check` job
requires the build, every browser job and the rendering benchmark assertions to pass. Engine-specific failure
screenshots/traces and HTML reports are retained for seven days; the shared build
expires after one day. To run one engine, use
`npm run test:browser -- --project=firefox` (or `chromium` / `webkit`).
Firefox's Linux CI job uses a virtual display and software OpenGL for real 3D
rendering (`xvfb-run -a npm run test:browser -- --project=firefox --headed`).
Linux WebKit is engine coverage, not a substitute for shipping Safari or physical
iPhone/iPad checks. Drawing, touch gestures and native share sheets still need
separate interactive/device checks.

Furnished-home benchmarks run in two Chromium profile jobs against that same build.
`npm run benchmark:fixtures` generates three importable local projects;
`npm run benchmark:viewer` measures desktop and DPR-2 phone viewports and writes
JSON metrics to `benchmark-results`. CI retains these artifacts for three days.
Timings on shared software-rendered runners are informational; allocation,
resource-release and local-only request checks are enforced. See
[the benchmark method and limits](docs/reviews/2026-09-07-rendering-benchmarks.md).

### Production Build

```bash
npm run build
npm run preview
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `V` | Select tool |
| `W` | Wall tool |
| `D` | Door tool |
| `T` | Text / annotation tool |
| `H` | Pan (hand) mode |
| `R` | Rotate selected furniture |
| `Tab` | Toggle 2D / 3D view |
| `Delete` / `Backspace` | Delete selected element(s) |
| `Escape` | Deselect / cancel |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+S` | Save project |

---

## 🛠️ Tech Stack

- **[SvelteKit](https://svelte.dev)** — Application framework
- **[Three.js](https://threejs.org)** — 3D rendering engine
- **[Tailwind CSS](https://tailwindcss.com)** — Styling
- **[TypeScript](https://www.typescriptlang.org)** — Type safety
- **[jsPDF](https://github.com/parallax/jsPDF)** — PDF generation
- **[dxf-writer](https://github.com/nicholaschiasson/dxf-writer)** — DXF export
- **[Firebase](https://firebase.google.com)** — Hosting, analytics and temporary iPhone handoffs; projects stay local

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a branch** for your feature: `git checkout -b feature/my-feature`
3. **Make your changes** and run `npm test`, `npm run check`, and `npm run build`
4. **Submit a pull request** with a clear description of your changes

Please keep PRs focused and include screenshots for UI changes.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <b>Built with ❤️ for architects, designers, and anyone who needs a floor plan.</b>
</p>

---

## 📱 iOS capture handoff

The companion iOS app can share an edited plan or [Apple RoomPlan](https://developer.apple.com/augmented-reality/roomplan/) scan with the web editor. Local **Export Editable Plan (JSON)** requires no cloud upload.

1. The updated iOS app posts JSON to `/api/handoffs`, which validates it and reserves quota before creating `inbox/{CODE}.json` in `openplan3d.firebasestorage.app`. The code excludes I, O, 0 and 1. Unchanged plans reuse a valid link. Older distributed builds still upload directly to Storage during migration.
2. The app shows a QR code / link of the form:

   ```
   https://app.openplan3d.com/editor?import=CODE
   ```

3. When the editor opens with an `import` query param, it downloads the JSON straight from Firebase Storage (no SDK needed):

   ```
   https://firebasestorage.googleapis.com/v0/b/openplan3d.firebasestorage.app/o/inbox%2F{CODE}.json?alt=media
   ```

   and imports it as a new project. Prepared iPhone exports preserve their angles by default; raw captures retain their scan-cleanup defaults. On success the `import` param is replaced with the new project's `id` so a refresh won't re-import.

[`storage.rules`](storage.rules) allows public reads of a capture by its code and no public writes, so every capture passes the endpoint's admission limits. The endpoint enforces 1 MiB per capture, 1,000 reservations / 250 MiB per UTC day, and 10 reservations per minute. See [configuration, costs and the cutover record](docs/handoff-quotas.md). These limits are not a cap on Firebase spending.

### Assistant shares

`POST /api/assistant-shares` accepts a whole project package for the assistant
skills, keeps only the plan and referenced attachments for seven days, and returns
a share code and secret. `POST /mcp` is a read-only Model Context Protocol server
whose tools take that pair. Disabled until `ASSISTANT_SHARES_ENABLED` is `"true"`;
see [docs/assistant-shares.md](docs/assistant-shares.md).

### One-time setup (project owner)

1. **Enable Storage** for the `openplan3d` project in the [Firebase console](https://console.firebase.google.com/project/openplan3d/storage) if it isn't already.
2. **Deploy the rules:**

   ```bash
   firebase deploy --only storage
   ```

3. **Auto-delete stale captures** — set a lifecycle rule that makes objects under the `inbox/` prefix eligible for deletion at age 1 day (prefix-scoped lifecycle uses `matchesPrefix`; deletion is asynchronous). Save this as `lifecycle.json`:

   ```json
   {
     "rule": [
       {
         "action": { "type": "Delete" },
         "condition": { "age": 1, "matchesPrefix": ["inbox/"] }
       }
     ]
   }
   ```

   Then apply it with either:

   ```bash
   gcloud storage buckets update gs://openplan3d.firebasestorage.app --lifecycle-file=lifecycle.json
   # or
   gsutil lifecycle set lifecycle.json gs://openplan3d.firebasestorage.app
   ```

   Review the bucket's soft-delete, versioning, and retention settings as well.
   Deleted objects can remain billable during soft-delete retention; a one-day
   lifecycle does not guarantee one day of billed storage. Consider disabling
   recovery only for a bucket dedicated to reproducible temporary transfers,
   after confirming originals remain safely stored on-device. See the
   [live configuration audit and cost plan](docs/reviews/2026-09-05-firebase-cost-audit.md)
   and [Cloud Storage soft-delete guidance](https://docs.cloud.google.com/storage/docs/soft-delete).

4. **CORS** — the editor downloads captures from the browser, so the bucket must allow
   cross-origin GETs (without this the import fails with a CORS error in the console).
   Save this as `cors.json`:

   ```json
   [
     {
       "origin": [
         "https://app.openplan3d.com",
         "https://openplan3d--openplan3d.us-east4.hosted.app",
         "http://localhost:5173"
       ],
       "method": ["GET"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

   Then apply it (changes take a minute or two to propagate):

   ```bash
   gcloud storage buckets update gs://openplan3d.firebasestorage.app --cors-file=cors.json
   ```

### Local render lab (experimental)

A separate `/render-lab` page tests Blender-prepared GLB scenes with Three.js
interactive rendering and progressive GPU path tracing. It reads local files
without uploading them. See [developer setup and limitations](docs/render-lab.md).

---

## 🛡️ SpatialGuard Quality Engineering

> *Every change has a geometry. Every release needs proof.*

**SpatialGuard** is an AI-orchestrated quality engineering and spatial verification core built for OpenPlan3D. While web applications typically rely on unit tests and visual screenshots, spatial applications introduce unique failure modes where plans compile and pass basic tests yet produce invalid geometry (e.g., doors overflowing wall endpoints, corrupted matrix conversions during interchange export, or collapsed room areas).

### Implemented Spatial Invariants (Phase 1)

1. **`INV-OPENING-001` (Opening Attachment & Boundary Containment):**  
   Verifies that every door and window is anchored to a valid host wall on the same floor, has positive width $\le L_{wall}$, and that its physical jamb span $[\text{center} - w/2, \text{center} + w/2]$ is strictly contained within $[0, L_{wall}]$ without overflowing wall corners.
2. **`INV-INTERCHANGE-001` (Prepared RoomPlan Spatial Conservation):**  
   Verifies that exporting to prepared RoomPlan JSON (`projectToPreparedRoomPlan`) and re-importing (`createProjectFromRoomPlan`) strictly conserves wall segment lengths, relative opening parameters, opening widths, and reconstructed room areas against independent analytical expectations.
3. **`INV-ROOM-001` (Room Boundary Enclosure & Area Non-Degeneracy):**  
   Verifies that planar closed loops detect exact mathematical room areas, and that broken wall perimeters deterministically invalidate enclosure.

For full contract specifications and mathematical definitions, see [docs/spatialguard/INVARIANTS.md](docs/spatialguard/INVARIANTS.md) and the baseline audit in [SPATIALGUARD_BASELINE.md](SPATIALGUARD_BASELINE.md).

### Running Spatial Verification

Execute the dedicated spatial invariant test suite independently:

```bash
npm run test:spatial
```

This generates machine-readable test evidence in:
- `test-results/spatial-results.json` (Structured Vitest JSON report containing test status, delta measurements, and assertion evidence)

### GitLab Duo Agent Platform Workflow (Phase 2 Implemented)

SpatialGuard connects deterministic spatial verification to **GitLab Duo Agent Platform** via a 3-stage agentic workflow:

1. **Spatial Impact Agent (`src/lib/spatialguard/agent/impactAnalyzer.ts`):**  
   Inspects merge request diffs and changed symbols, mapping them to affected spatial invariants and computing a risk classification (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `NEGLIGIBLE`).
2. **Spatial Evidence Investigator (`src/lib/spatialguard/agent/evidenceInvestigator.ts`):**  
   Ingests CI test report artifacts (`test-results/spatial-results.json`), validates artifact freshness, and diagnoses root causes with exact metric deltas (e.g. wall overflow amounts or area discrepancies).
3. **Spatial Release Assessor (`src/lib/spatialguard/agent/releaseAssessor.ts`):**  
   Synthesizes impact and test evidence into an authoritative engineering advisory:
   - `READY_FOR_FURTHER_REVIEW`: All spatial checks verified and passed (ready for human code review).
   - `BLOCKED`: A spatial invariant failed or geometric regression was detected.
   - `INCONCLUSIVE`: Test evidence is missing, corrupted, or stale.

- **GitLab Duo Custom Flow:** Defined in [`.gitlab/duo/flows/spatialguard-investigate.yml`](.gitlab/duo/flows/spatialguard-investigate.yml)
- **Agent Configuration:** Defined in [`.gitlab/duo/agent-config.yml`](.gitlab/duo/agent-config.yml)
- **GitLab CI/CD Job:** Configured in [`.gitlab-ci.yml`](.gitlab-ci.yml)
- **Full Architecture & Setup:** See [docs/spatialguard/PHASE2_AGENT_ARCHITECTURE.md](docs/spatialguard/PHASE2_AGENT_ARCHITECTURE.md).

### Autonomous Remediation & Regression Verification (Phase 3 Implemented)

SpatialGuard autonomously investigates spatial regressions, formulates targeted corrective patches, and verifies them with paired regression tests:

1. **Failure Classification (`src/lib/spatialguard/remediation/classifier.ts`):**  
   Categorizes pipeline events into 7 distinct cases, distinguishing confirmed geometry regressions from non-spatial, environmental, stale, or already-resolved failures.
2. **Root Cause Analysis (`src/lib/spatialguard/remediation/investigator.ts`):**  
   Analyzes geometric failure mechanisms (e.g. wall interval overflow, matrix precision loss, unclosed boundary polygons) with confirmed observations and hypothesis tracking.
3. **Bounded Patch Synthesis & Regression Tests (`src/lib/spatialguard/remediation/generator.ts`):**  
   Produces minimal unified diffs and pairs them with independent Vitest regression tests that fail on defective geometry and pass on corrected code.
4. **Finite Retry Bounds & Idempotency (`src/lib/spatialguard/remediation/loopPrevention.ts`):**  
   Enforces a strict retry limit (max 3 attempts) and SHA-based idempotency keys to prevent recursive pipeline loops.
5. **Supervised Autonomy & Reviewable Output (`src/lib/spatialguard/remediation/remediator.ts`):**  
   Renders explicit terminal statuses (`FIXED_AND_VERIFIED`, `PATCH_PROPOSED_UNVERIFIED`, `UNRESOLVED`, `BLOCKED`, `INCONCLUSIVE`). Patches are prepared for human peer review—automated merging and direct pushes to `main` are strictly forbidden.

- **Remediation Specification & Architecture:** See [docs/spatialguard/PHASE3_REMEDIATION.md](docs/spatialguard/PHASE3_REMEDIATION.md).
- **Remediation Test Suite:** Verified via `tests/spatialguard/remediation.test.ts` (12 adversarial & functional scenarios).

### Complete DevSecOps Pipeline, Security & Supervised Deployment (Phase 4 Implemented)

SpatialGuard integrates geometry verification into a full 9-stage DevSecOps release pipeline:

1. **Security & Supply Chain Gates (`src/lib/spatialguard/release/securityScanner.ts`):**  
   - Secret Detection: Identifies exposed private keys, GitLab personal access tokens, AWS keys, and credentials.
   - Static Analysis (SAST): Blocks dynamic eval and unsanitized DOM manipulation.
   - Dependency Software Composition Analysis (SCA): Parses `npm audit` and enforces zero critical CVEs.
   - Software Bill of Materials (SBOM): Generates real SBOM manifests covering direct and transitive dependencies.
2. **Reproducible Packaging & Integrity Manifest (`src/lib/spatialguard/release/evidenceCollector.ts`):**  
   - Node.js SSR bundle generation via `@sveltejs/adapter-node`.
   - Immutable artifact SHA-256 manifests prevent release drift and detect build tampering.
3. **Automated Staging Smoke Tests & DAST (`src/lib/spatialguard/release/stagingDeployer.ts`):**  
   - Probes live staging endpoints (`/`, `/health`, `/api/version`) and audits HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, CSP).
4. **Cryptographic Release Evidence Bundle (`scripts/generate-release-evidence.ts`):**  
   - Canonical SHA-256 hashed JSON bundle combining test outcomes, spatial invariants, SBOM, artifact digests, and staging verification into an auditable proof.
5. **Supervised Production Promotion (`src/lib/spatialguard/release/promotionGate.ts`):**  
   - Human approval boundary: AI agents can prepare releases but cannot promote to production.
   - Production promotion requires an explicit human decision (`when: manual` in `.gitlab-ci.yml`) and verifies post-release runtime health.

- **DevSecOps Architecture & Specification:** See [docs/spatialguard/PHASE4_DEVSECOPS_RELEASE.md](docs/spatialguard/PHASE4_DEVSECOPS_RELEASE.md).
- **Release Verification Test Suite:** Verified via `tests/spatialguard/release.test.ts` (18 scenarios).

### Production Operations, Runtime Observability & Safe Recovery (Phase 5 Implemented)

SpatialGuard actively monitors live deployed environments and manages safe, supervised recovery:

1. **Runtime Identity & Native Endpoints (`src/routes/health`, `src/routes/api/version`):**  
   - Native SvelteKit endpoints exposing real runtime health status, uptime, active Git commit SHA, and pipeline ID.
2. **Live Remote Verification (`src/lib/spatialguard/operations/liveVerifier.ts`):**  
   - Probes live staging and production instances, auditing security headers and detecting runtime version drift without false-success fallbacks.
3. **Incident Correlation & Alert Spam Prevention (`src/lib/spatialguard/operations/incidentCorrelator.ts`):**  
   - Clusters repetitive outages using SHA-256 failure fingerprints, tracking incident occurrences and marking status `RECOVERED` upon verified health restoration.
4. **Structured Operational Reporting:**  
   - Generates machine-readable `OperationalReport` artifacts linking target URLs, response latencies, endpoint breakdowns, and active incidents.
5. **Safe Supervised Recovery & Rollback (`src/lib/spatialguard/operations/recoveryEngine.ts`):**  
   - Evaluates unhealthy deployments and formulates rollback recommendations targeting only verified release candidates (`releaseDecision === 'PASS'`).
   - Strictly enforces the human approval boundary (`requiresHumanApproval: true`), preventing autonomous unapproved production modifications.

- **Operations Architecture & Specification:** See [docs/spatialguard/PHASE5_OPERATIONS.md](docs/spatialguard/PHASE5_OPERATIONS.md).
- **Operations & Recovery Test Suite:** Verified via `tests/spatialguard/operations.test.ts` (12 scenarios).

---
