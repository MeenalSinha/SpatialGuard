# SpatialGuard — Application Media & Demonstrations

This folder contains screenshots and screen recordings demonstrating the live deployed **SpatialGuard** application on Google Cloud Run, organized according to the [User Guide](../docs/user-guide.md).

## Files Overview

| File | Description | User Guide Reference |
| :--- | :--- | :--- |
| **`spatialguard_demo_recording.webp`** | **Full Screen Recording**: Complete user journey from project selection to 2D drafting, 3D orbit, and telemetry | All (§1–§9) |
| **`01_project_library.png`** | **Project Library & Welcome Screen**: Local project storage, library actions, and templates entry | §1. Getting started |
| **`02_templates_modal.png`** | **Architectural Templates**: Pre-configured apartments and houses with spatial invariant compliance | §1.3 Templates |
| **`03_editor_2d_layout.png`** | **2D CAD Floor Plan Editor**: Interactive drawing canvas, real-time measurements, and layout constraints | §2–§5 Drawing & Rooms |
| **`04_editor_3d_view.png`** | **3D Real-Time Rendering**: Extruded walls, floor slabs, textures, and camera orbit controls | §8. 3D view |
| **`05_editor_3d_catalog.png`** | **Objects & Furniture Catalog**: Searchable 3D asset library alongside perspective viewport | §6. Furniture & models |
| **`06_health_endpoint.png`** | **Live Production Health & Telemetry**: `/health` endpoint output confirming uptime and security headers | §9. Settings & Ops |

## Live Deployment Links
- **Primary App**: https://spatialguard-799175996958.us-central1.run.app
- **Health Check**: https://spatialguard-799175996958.us-central1.run.app/health
- **Version Endpoint**: https://spatialguard-799175996958.us-central1.run.app/api/version
