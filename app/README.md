# Fort Collins Drive

A browser prototype that drives a low-poly car through Old Town Fort Collins using
**Google Photorealistic 3D Tiles**, rendered with **CesiumJS**. Built with **Vite + React + TypeScript**.

Its purpose: validate look and feel, prove that your own 3D objects overlay correctly on Google's
tiles, and measure the real **MB/hr** data rate behind your cost model.

## Run it in GitHub Codespaces

1. Push this folder to a GitHub repo.
2. Click **Code → Codespaces → Create codespace on main**. The devcontainer runs `npm install` for you.
3. In the terminal: `npm run dev`
4. Codespaces forwards port **5173** — open the preview, paste your Google Maps API key, and drive.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build
```

## You need a Google Maps API key

- Enable the **Map Tiles API** in Google Cloud, and make sure the project has an **active billing account**
  (the API serves nothing without billing, even though usage stays free under the caps).
- The key lives only in the browser. For anything public, restrict it: **Application restrictions →
  Websites**, and add your deployed domain. Leave restrictions as **None** only while testing on localhost.

## Controls

- **W / S** throttle / brake-reverse · **A / D** steer · **↑ / ↓** look pitch · **C** chase ⇄ first-person
- On mobile, on-screen buttons (GAS / BRK / steer / CAM) appear automatically.

## Project layout

```
src/
  main.tsx               React entry
  App.tsx                wires the start gate, HUD, and sim together
  components/
    StartGate.tsx        API-key entry screen
    Hud.tsx              speed + live data-rate telemetry
    TouchControls.tsx    mobile on-screen controls
  sim/
    DriveSim.ts          framework-agnostic Cesium driving engine (tiles, car, camera, meter)
    vehicle.ts           procedural low-poly car (body, roof, wheels, lights)
    types.ts             shared types
```

The driving engine in `sim/` is plain TypeScript with no React dependency, so it can be lifted into
another host (or swapped for a Cesium-for-Unreal/Unity port) later.

## Known rough edges (tune once running)

- **Ride height / lean direction** were tuned without a live render. If the car floats or sinks, adjust
  the wheel `z` offsets in `src/sim/vehicle.ts`. If it leans the wrong way in turns, flip the sign of
  `car.lean` in `src/sim/DriveSim.ts`.
- The in-app **MB** figure is best-effort; browsers often hide cross-origin byte sizes. For the true
  number use **DevTools → Network**, filter `tile.googleapis.com`.

## Policy note

Google's Map Tiles API terms allow overlaying your own objects on the tiles, but prohibit caching the
mesh, machine-deriving geometry (e.g. auto-generating collision) from it, and require the on-screen
Google attribution to stay visible. Keep those in mind as this grows toward a real game.
