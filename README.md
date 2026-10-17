# AUTARX // ABYSSAL_VECTOR v1.0

**AUTARX // ABYSSAL_VECTOR** is an interactive browser prototype for a cooperative deep-sea robotic fleet simulator, real-time 3D bathymetric sonar pilot deck, and autonomous surface-to-trench economic management game set in **Mariana Hadal Sector 09 (11°21'N 142°12'E)**.

Inspired by wireframe terrain navigation displays (*Nostromo* landing contours) and Rutt/Etra scan-processor elevation graphics, the interface combines a procedural Three.js WebGL seafloor viewport with a hardware-inspired submarine CRT instrument cluster, a 2D topographic contour tactical map, and a real-time surface-to-trench economic loop.

---

## Collaborative & Asymmetric Co-Op Vision

**AUTARX // ABYSSAL_VECTOR** is designed from the ground up around **interdependent, asymmetric multiplayer crew stations**. Rather than having every player perform identical tasks, a crew operates a single integrated oceanic command network where surface logistics and deep-trench piloting depend on one another in real time:

1. **`[01 // HELM & 3D SONAR PILOT]` (`IZZY :: HELM`)**
   - Pilots the hazard-yellow deep-submergence vehicle **`DSV-AUTARX-01`** through high-pressure hadal canyons using 3D bathymetric wireframe terrain and volumetric floodlights.
   - Emits active 3D sonar torus waves to reveal hidden **Hydrothermal Vents** and **Polymetallic Nodule Fields**, maneuvering within extraction range (`<120m`) to deploy the articulated collector claw while monitoring hydrostatic crush depth limits.

2. **`[02 // BATHYMETRIC TACTICAL MAP]` (`AUTARX_BOT :: SONAR`)**
   - Operates the regional 2D topographic contour map, analyzing acoustic returns across the trench axis.
   - Vectors autonomous reconnaissance drones (`AUV-VANGUARD-1`, `AUV-SONDE-2`) into uncharted sectors and plots long-range navigation beacons (`WP-ALPHA`) that synchronize directly into the 3D pilot's HUD and autopilot computer.

3. **`[03 // SURFACE BARGES & FLEET ECONOMY]` (`LUCAS :: LOGISTICS`)**
   - Manages the `0m` surface infrastructure array: constructing **Solar Panel Barges** (`+45 kW`), **Desalination & Distillation Rigs** (`+15 L/s H2O`), and **Autonomous Seabed Harvesters**.
   - Routes **Battery Relay Drones** down vertical tethers into the trench so the helm pilot never runs out of capacitor charge mid-dive.
   - Executes live supply contracts with passing commercial and research vessels (`MV PACIFIC HORIZON`, `RV KRONOS`, `SS POSEIDON VANGUARD`) and funds **Submersible Engineering Upgrades** (Titanium Hull Reinforcement, Solid-State Capacitor Banks, and Wide-Spectrum Phased Sonar) that immediately expand what the helm pilot can survive and discover in 3D space.

### Single-Player & Pitch Prototype Mode
In this prototype, players can view all stations simultaneously via **`[00 // UNIFIED COMMAND DECK]`** or switch into dedicated full-screen crew views (`01`, `02`, `03`). Toggling **`[SIMULATE CO-OP CREW ACTIONS: ON]`** in the top telemetry bar activates simulated crewmates who periodically calibrate sonar, purge electrolysis rigs, and log live callouts in the bottom **`[AUTARX_NET // CREW_LOG]`** terminal.

---

## Controls & Station Reference

| Action | Keyboard / Input | On-Screen Control |
| :--- | :--- | :--- |
| **Thrust Forward / Reverse** | `W` / `S` or `↑` / `↓` | `[FWD]` / `[REV]` in 3D Helm Dock |
| **Yaw Left / Right** | `A` / `D` or `←` / `→` | `[YAW L]` / `[YAW R]` in 3D Helm Dock |
| **Ascend / Descend Depth** | `Q` / `E` or `Shift` / `Ctrl` | `[Q: UP]` / `[E: DN]` in 3D Helm Dock |
| **Active 3D Sonar Pulse** | `Spacebar` | `[PING SONAR]` |
| **Harvest Mineral / Vent Node** | Click button when `<120m` | `[DEPLOY COLLECTOR CLAW]` / `[EXTRACT SAMPLE]` |
| **Set Navigation Waypoint** | Click anywhere on 2D Contour Map | Sets `WP-ALPHA` in 2D Map & 3D Scene |

---

## Local Development & Unit Testing

### Prerequisites
- **Node.js** `v20+` (Node `v22+` recommended for native TypeScript unit test execution)
- **npm** `v10+`

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
Runs the Vite development server on port `3000`:
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Run Unit Tests & Type Check
Core simulation math—including procedural bathymetric elevation, hydrostatic pressure (`MPa`), crush depth thresholds, ASCII telemetry bars, economic tick calculations, and sonar discovery radii—is decoupled in `src/game/rules.ts` and verified with Node's test runner:
```bash
node --test src/game/rules.test.ts
npm run lint
```

---

## Deployment Instructions

### Production Build
Compile and bundle the TypeScript and Vite production assets into the `dist/` directory:
```bash
npm run build
```
To preview the production build locally before deploying:
```bash
npm run preview -- --port 3000 --host 0.0.0.0
```

### Option A: Container / Google Cloud Run Deployment
Because the application is a self-contained client-side WebGL/React bundle with zero external texture or asset URL dependencies, it can be served from any container or static host:

1. Build the production bundle via `npm run build`.
2. Serve the generated `dist/` directory on port `3000` (or `$PORT` in Cloud Run) using `vite preview` or a lightweight static file server (`serve -s dist -l 3000` or Nginx).

### Option B: Static Hosting (Firebase Hosting, Vercel, Netlify, Cloudflare Pages)
- **Build Command:** `npm run build`
- **Output / Publish Directory:** `dist`
- **Node Version:** `22.x`

---

## Project Structure

```text
├── index.html                           # Application entry & font preconnects
├── metadata.json                        # Applet metadata configuration
├── src/
│   ├── App.tsx                          # Unified Command Deck state & 1000ms economic loop
│   ├── index.css                        # Tailwind CSS & CRT scanline styling
│   ├── components/
│   │   ├── TopTelemetryBus.tsx          # Module A: Sector telemetry, resource bus & station tabs
│   │   ├── AbyssalViewport3D.tsx        # Module B: Three.js seafloor, DSV-AUTARX-01 & 3D sonar
│   │   ├── CrtInstrumentDashboard.tsx   # Module C: Depth/crush gauge, capacitor & SVG gyro
│   │   ├── BathymetricTacticalMap.tsx   # Module D: 2D contour map, WP-ALPHA & AUV dispatch
│   │   ├── FleetEconomyDeck.tsx         # Module E: Surface barges, ship trade & hull upgrades
│   │   └── CrewLogTerminal.tsx          # Bottom [AUTARX_NET // CREW_LOG] comms ticker
│   └── game/
│       ├── types.ts                     # Shared TypeScript interfaces
│       ├── rules.ts                     # Pure bathymetric, pressure, sonar & economic logic
│       ├── rules.test.ts                # Automated unit tests (node:test)
│       ├── seed.ts                      # Initial Mariana Hadal nodes, drones, vessels & logs
│       └── sound.ts                     # Procedural Web Audio API synthesizer
```
