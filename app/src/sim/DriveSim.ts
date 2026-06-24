import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { createVehicle, type VehiclePart } from "./vehicle";
import type { CameraMode, Telemetry } from "./types";

// Old Town Fort Collins, College Ave & Mountain Ave, heading south.
// You can swap this for a bigger city later for better 3D tile quality.
const START = { lon: -105.07758, lat: 40.58526, heading: 178 };
const FALLBACK_GROUND = 1525;
const START_ALTITUDE = FALLBACK_GROUND + 180;
const TILE_HOST = "tile.googleapis.com";

const MAX_FWD = 65;
const MAX_REV = -10;
const ACCEL = 18;
const BRAKE = 24;
const FRICTION = 5.5;
const STEER = 55;

const CLIMB_SPEED = 45;
const MIN_ABOVE_GROUND = 35;
const MAX_ABOVE_GROUND = 1500;

// Higher / farther chase camera fits the 3D tiles better than street-level driving.
const CHASE_OFF = new Cesium.Cartesian3(-32, 0, 14);
const FP_OFF = new Cesium.Cartesian3(3, 0, 0.9);
const ZERO = new Cesium.Cartesian3(0, 0, 0);

const rad = (d: number) => Cesium.Math.toRadians(d);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function rmap(h: number): Cesium.Matrix3 {
  const s = Math.sin(h);
  const c = Math.cos(h);

  return Cesium.Matrix3.fromColumnMajorArray(
    [s, c, 0, -c, s, 0, 0, 0, 1],
    new Cesium.Matrix3()
  );
}

function quatFrom(enuRot: Cesium.Matrix3, carRot: Cesium.Matrix3): Cesium.Quaternion {
  const ecef = Cesium.Matrix3.multiply(enuRot, carRot, new Cesium.Matrix3());
  return Cesium.Quaternion.fromRotationMatrix(ecef, new Cesium.Quaternion());
}

interface CarState {
  lon: number;
  lat: number;
  heading: number;
  speed: number;
  pitch: number;
  ground: number;
  altitude: number;
  verticalSpeed: number;
  prevSpeed: number;
  steer: number;
  dive: number;
  lean: number;
}

export interface DriveSimOptions {
  container: HTMLElement;
  apiKey: string;
  onTelemetry?: (t: Telemetry) => void;
  onCameraMode?: (m: CameraMode) => void;
}

export class DriveSim {
  private viewer: Cesium.Viewer;
  private scene: Cesium.Scene;
  private tileset: Cesium.Cesium3DTileset;
  private parts: VehiclePart[] = [];
  private exclude: Cesium.Entity[] = [];
  private car: CarState;
  private keys: Record<string, boolean> = {};
  private camMode: CameraMode = "chase";
  private lastM4: Cesium.Matrix4 | null = null;
  private running = false;
  private last = performance.now();
  private groundTick = 0;
  private grounded = false;
  private hudTick = 0;
  private lastHud = performance.now();

  private meter = { bytes: 0, reqs: 0, start: 0, blind: false };
  private observer: PerformanceObserver | null = null;
  private removeListeners: () => void = () => {};
  private opts: DriveSimOptions;

  private constructor(opts: DriveSimOptions, tileset: Cesium.Cesium3DTileset) {
    this.opts = opts;
    this.tileset = tileset;

    this.car = {
      lon: START.lon,
      lat: START.lat,
      heading: START.heading,
      speed: 0,
      pitch: -8,
      ground: FALLBACK_GROUND,
      altitude: START_ALTITUDE,
      verticalSpeed: 0,
      prevSpeed: 0,
      steer: 0,
      dive: 0,
      lean: 0,
    };

    this.viewer = new Cesium.Viewer(opts.container, {
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      scene3DOnly: true,
    });

    this.scene = this.viewer.scene;

    // Important: add the Google 3D tileset to the scene.
    this.scene.primitives.add(this.tileset);

    // Lower number means sharper tiles, but more loading.
    this.tileset.maximumScreenSpaceError = 4;
    this.tileset.preloadWhenHidden = true;
    this.tileset.preloadFlightDestinations = true;

    this.scene.globe.show = false;
    this.scene.globe.depthTestAgainstTerrain = false;

    if (this.scene.skyAtmosphere) this.scene.skyAtmosphere.show = true;
    if (this.scene.fog) this.scene.fog.enabled = true;

    // Pin lighting to local midday so the city is always daylit.
    const noon = Cesium.JulianDate.fromIso8601("2024-06-21T19:00:00Z");
    this.viewer.clock.currentTime = noon.clone();
    this.viewer.clock.shouldAnimate = false;

    this.parts = createVehicle(this.viewer, this.car);
    this.exclude = this.parts.map((p) => p.entity);

    this.startMeter();
    this.bindInput();
    this.scene.preUpdate.addEventListener(this.tick);
    this.flyIn();
  }

  static async create(opts: DriveSimOptions): Promise<DriveSim> {
    const rootUrl = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(
      opts.apiKey
    )}`;

    let resp: Response;

    try {
      resp = await fetch(rootUrl);
    } catch {
      throw new Error(
        "Couldn't reach Google's tile server. Confirm you're on a real origin, not file://."
      );
    }

    if (!resp.ok) {
      let detail = "";

      try {
        const j = await resp.json();
        detail = j?.error?.message ?? "";
      } catch {
        // ignore
      }

      if (resp.status === 403) {
        throw new Error(
          `Google says 403. Usually this means no billing account is linked to this project. ${detail}`
        );
      }

      if (resp.status === 400) {
        throw new Error(`Google says 400. Key looks invalid or malformed. ${detail}`);
      }

      if (resp.status === 429) {
        throw new Error(`Google says 429. Over quota for the day. ${detail}`);
      }

      throw new Error(`Google returned HTTP ${resp.status}. ${detail}`);
    }

    const tileset = await Cesium.Cesium3DTileset.fromUrl(rootUrl, {
      showCreditsOnScreen: true,
      maximumScreenSpaceError: 4,
    });

    return new DriveSim(opts, tileset);
  }

  private startMeter() {
    this.meter.start = performance.now();

    if (typeof PerformanceObserver === "undefined") return;

    try {
      this.observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name && e.name.indexOf(TILE_HOST) !== -1) {
            this.meter.reqs++;

            const r = e as PerformanceResourceTiming;
            const sz = r.transferSize || r.encodedBodySize || 0;

            this.meter.bytes += sz;

            if (sz === 0) this.meter.blind = true;
          }
        }
      });

      this.observer.observe({ type: "resource", buffered: true });
    } catch {
      // ignore
    }
  }

  private bindInput() {
    const track = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "Space",
      "ShiftLeft",
      "ShiftRight",
    ];

    const down = (e: KeyboardEvent) => {
      if (e.code === "KeyC") this.toggleCamera();

      if (track.includes(e.code)) {
        this.keys[e.code] = true;
        e.preventDefault();
      }
    };

    const up = (e: KeyboardEvent) => {
      if (track.includes(e.code)) {
        this.keys[e.code] = false;
        e.preventDefault();
      }
    };

    const blur = () => {
      this.keys = {};
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    this.removeListeners = () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }

  setKey(code: string, isDown: boolean) {
    this.keys[code] = isDown;
  }

  toggleCamera() {
    this.camMode = this.camMode === "chase" ? "fp" : "chase";
    this.opts.onCameraMode?.(this.camMode);
  }

  private async flyIn() {
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        this.car.lon,
        this.car.lat,
        this.car.altitude + 500
      ),
      orientation: {
        heading: rad(this.car.heading),
        pitch: rad(-45),
        roll: 0,
      },
    });

    const g = await this.sampleGround(this.car.lon, this.car.lat, FALLBACK_GROUND);

    this.car.ground = g;
    this.car.altitude = g + 220;

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(this.car.lon, this.car.lat, this.car.altitude + 220),
      orientation: {
        heading: rad(this.car.heading),
        pitch: rad(-30),
        roll: 0,
      },
      duration: 2.0,
      complete: () => {
        this.running = true;
      },
    });
  }

  private async sampleGround(lon: number, lat: number, fallback: number): Promise<number> {
    for (let i = 0; i < 24; i++) {
      const g = this.scene.sampleHeight
        ? this.scene.sampleHeight(Cesium.Cartographic.fromDegrees(lon, lat), this.exclude)
        : undefined;

      if (typeof g === "number" && isFinite(g)) return g;

      await new Promise((r) => setTimeout(r, 250));
    }

    return fallback;
  }

  private tick = () => {
    const now = performance.now();
    let dt = (now - this.last) / 1000;

    this.last = now;

    if (dt > 0.1) dt = 0.1;

    const car = this.car;
    const keys = this.keys;

    if (this.running) {
      if (keys.KeyW) {
        car.speed += ACCEL * dt;
      } else if (keys.KeyS) {
        car.speed -= BRAKE * dt;
      } else {
        const f = FRICTION * dt;

        if (car.speed > f) {
          car.speed -= f;
        } else if (car.speed < -f) {
          car.speed += f;
        } else {
          car.speed = 0;
        }
      }

      car.speed = Math.max(MAX_REV, Math.min(MAX_FWD, car.speed));

      const steerGain = Math.min(1, Math.abs(car.speed) / 14 + 0.2);

      if (keys.KeyA) car.heading -= STEER * steerGain * dt;
      if (keys.KeyD) car.heading += STEER * steerGain * dt;

      if (car.heading < 0) car.heading += 360;
      if (car.heading >= 360) car.heading -= 360;

      // In flight mode:
      // ArrowUp pitches nose down.
      // ArrowDown pitches nose up.
      if (keys.ArrowUp) car.pitch = clamp(car.pitch - 35 * dt, -45, 25);
      if (keys.ArrowDown) car.pitch = clamp(car.pitch + 35 * dt, -45, 25);

      // Space climbs. Shift descends.
      if (keys.Space) {
        car.verticalSpeed = CLIMB_SPEED;
      } else if (keys.ShiftLeft || keys.ShiftRight) {
        car.verticalSpeed = -CLIMB_SPEED;
      } else {
        car.verticalSpeed = 0;
      }

      if (car.speed !== 0) {
        const d = car.speed * dt;
        const h = rad(car.heading);
        const pitch = rad(car.pitch);

        const horizontalD = d * Math.cos(pitch);
        const verticalD = d * Math.sin(pitch);

        const mPerLat = 111320;
        const mPerLon = 111320 * Math.cos(rad(car.lat));

        car.lat += (horizontalD * Math.cos(h)) / mPerLat;
        car.lon += (horizontalD * Math.sin(h)) / mPerLon;
        car.altitude += verticalD;
      }

      car.altitude += car.verticalSpeed * dt;

      // Occasionally sample the tile height only as a floor, not as a road to stick to.
      this.groundTick += dt;

      if (this.groundTick > 0.5) {
        this.groundTick = 0;

        const g = this.scene.sampleHeight
          ? this.scene.sampleHeight(Cesium.Cartographic.fromDegrees(car.lon, car.lat), this.exclude)
          : undefined;

        if (typeof g === "number" && isFinite(g)) {
          if (!this.grounded) {
            car.ground = g;
            this.grounded = true;
          } else {
            const diff = g - car.ground;

            if (Math.abs(diff) < 60) {
              car.ground += diff * 0.2;
            }
          }
        }
      }

      const minAltitude = car.ground + MIN_ABOVE_GROUND;
      const maxAltitude = car.ground + MAX_ABOVE_GROUND;

      car.altitude = clamp(car.altitude, minAltitude, maxAltitude);

      const steerTarget = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);

      car.steer += (steerTarget * 0.5 - car.steer) * Math.min(1, dt * 5);

      // No ground-car nose bounce.
      car.prevSpeed = car.speed;
      car.dive = rad(car.pitch);

      // Small banking effect while turning.
      car.lean +=
        (-car.steer * Math.min(1, Math.abs(car.speed) / 45) * 0.35 - car.lean) *
        Math.min(1, dt * 4);
    }

    this.updateVehicle();

    if (this.running) this.updateCamera();

    this.emitTelemetry(now);
  };

  private updateVehicle() {
    const car = this.car;
    const h = rad(car.heading);

    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(car.lon, car.lat, car.altitude)
    );

    const enuRot = Cesium.Matrix4.getMatrix3(enu, new Cesium.Matrix3());
    const rm = rmap(h);

    const M = Cesium.Matrix4.multiply(
      enu,
      Cesium.Matrix4.fromRotationTranslation(rm, ZERO, new Cesium.Matrix4()),
      new Cesium.Matrix4()
    );

    const Rt = Cesium.Matrix3.multiply(
      Cesium.Matrix3.fromRotationX(car.lean),
      Cesium.Matrix3.fromRotationY(car.dive),
      new Cesium.Matrix3()
    );

    const qBody = quatFrom(enuRot, Cesium.Matrix3.multiply(rm, Rt, new Cesium.Matrix3()));
    const qFlat = quatFrom(enuRot, rm);

    const qSteer = quatFrom(
      enuRot,
      Cesium.Matrix3.multiply(rm, Cesium.Matrix3.fromRotationZ(car.steer), new Cesium.Matrix3())
    );

    for (const p of this.parts) {
      Cesium.Matrix4.multiplyByPoint(M, p.off, p.pos);
      p.quat = p.steer ? qSteer : p.tilt ? qBody : qFlat;
    }

    this.lastM4 = M;
  }

  private updateCamera() {
    if (!this.lastM4) return;

    const off = this.camMode === "chase" ? CHASE_OFF : FP_OFF;
    const dest = Cesium.Matrix4.multiplyByPoint(
      this.lastM4,
      off,
      new Cesium.Cartesian3()
    );

    this.viewer.camera.setView({
      destination: dest,
      orientation: {
        heading: rad(this.car.heading),
        pitch: rad(this.camMode === "chase" ? -16 : this.car.pitch),
        roll: 0,
      },
    });
  }

  private emitTelemetry(now: number) {
    this.hudTick += now - this.lastHud;
    this.lastHud = now;

    if (this.hudTick < 120) return;

    this.hudTick = 0;

    if (!this.opts.onTelemetry) return;

    const secs = (now - this.meter.start) / 1000;
    const mb = this.meter.bytes / 1e6;

    this.opts.onTelemetry({
      speedMph: Math.round(Math.abs(this.car.speed) * 2.23694),
      sessionSecs: secs,
      tileBytes: this.meter.bytes,
      tileReqs: this.meter.reqs,
      mbPerHour: secs > 6 && mb > 0 ? mb / (secs / 3600) : null,
      meterBlind: this.meter.blind,
    });
  }

  dispose() {
    this.scene?.preUpdate.removeEventListener(this.tick);
    this.removeListeners();
    this.observer?.disconnect();

    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
    }
  }
}