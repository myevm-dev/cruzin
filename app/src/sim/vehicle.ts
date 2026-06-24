import * as Cesium from "cesium";
import type { Origin } from "./types";

export interface VehiclePart {
  off: Cesium.Cartesian3;
  pos: Cesium.Cartesian3;
  quat: Cesium.Quaternion;
  steer: boolean;
  tilt: boolean;
  entity: Cesium.Entity;
}

const PALETTE = {
  body: "#f3f0df",
  nose: "#d94b4b",
  cockpit: "#263746",
  wing: "#d8d2bd",
  tail: "#c9c2ad",
  accent: "#ff5555",
  prop: "#191b1f",
  light: "#fff2bf",
};

interface PartSpec {
  dim: [number, number, number];
  color: string;
  off: [number, number, number];
  steer?: boolean;
  tilt?: boolean;
}

// Local frame: x = forward, y = left, z = up.
// Dimensions map to: length, width, height.
const LAYOUT: PartSpec[] = [
  // Main fuselage
  {
    dim: [6.4, 0.85, 0.85],
    color: PALETTE.body,
    off: [0, 0, 0.85],
    tilt: true,
  },

  // Nose
  {
    dim: [1.0, 0.7, 0.7],
    color: PALETTE.nose,
    off: [3.5, 0, 0.85],
    tilt: true,
  },

  // Rear fuselage / tail boom
  {
    dim: [2.4, 0.55, 0.55],
    color: PALETTE.tail,
    off: [-3.0, 0, 0.85],
    tilt: true,
  },

  // Cockpit
  {
    dim: [1.35, 0.78, 0.42],
    color: PALETTE.cockpit,
    off: [1.05, 0, 1.38],
    tilt: true,
  },

  // Main wing, left/right as one long piece
  {
    dim: [1.15, 8.2, 0.18],
    color: PALETTE.wing,
    off: [0.35, 0, 0.88],
    tilt: true,
  },

  // Slight center wing fairing
  {
    dim: [1.4, 2.0, 0.24],
    color: PALETTE.body,
    off: [0.35, 0, 0.93],
    tilt: true,
  },

  // Horizontal tail wing
  {
    dim: [0.7, 3.0, 0.16],
    color: PALETTE.tail,
    off: [-3.9, 0, 1.0],
    tilt: true,
  },

  // Vertical tail fin
  {
    dim: [0.65, 0.18, 1.35],
    color: PALETTE.accent,
    off: [-4.05, 0, 1.55],
    tilt: true,
  },

  // Propeller hub
  {
    dim: [0.18, 0.45, 0.45],
    color: PALETTE.prop,
    off: [4.1, 0, 0.85],
    tilt: true,
  },

  // Propeller blade vertical
  {
    dim: [0.08, 0.14, 1.65],
    color: PALETTE.prop,
    off: [4.23, 0, 0.85],
    tilt: true,
  },

  // Propeller blade horizontal
  {
    dim: [0.08, 1.65, 0.14],
    color: PALETTE.prop,
    off: [4.24, 0, 0.85],
    tilt: true,
  },

  // Wing tip lights
  {
    dim: [0.18, 0.18, 0.16],
    color: PALETTE.light,
    off: [0.35, 4.2, 0.9],
    tilt: true,
  },
  {
    dim: [0.18, 0.18, 0.16],
    color: PALETTE.accent,
    off: [0.35, -4.2, 0.9],
    tilt: true,
  },

  // Small landing skids/wheels, optional visual reference
  {
    dim: [0.5, 0.18, 0.18],
    color: PALETTE.prop,
    off: [1.25, 0.72, 0.32],
    tilt: true,
  },
  {
    dim: [0.5, 0.18, 0.18],
    color: PALETTE.prop,
    off: [1.25, -0.72, 0.32],
    tilt: true,
  },
  {
    dim: [0.45, 0.16, 0.16],
    color: PALETTE.prop,
    off: [-2.6, 0, 0.35],
    tilt: true,
  },
];

export function createVehicle(viewer: Cesium.Viewer, origin: Origin): VehiclePart[] {
  const startHeight =
    (origin as Origin & { altitude?: number }).altitude ?? origin.ground;

  return LAYOUT.map((spec) => {
    const part: VehiclePart = {
      off: new Cesium.Cartesian3(spec.off[0], spec.off[1], spec.off[2]),
      pos: Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, startHeight),
      quat: Cesium.Quaternion.clone(Cesium.Quaternion.IDENTITY),
      steer: !!spec.steer,
      tilt: !!spec.tilt,
      entity: undefined as unknown as Cesium.Entity,
    };

    part.entity = viewer.entities.add({
      position: new Cesium.CallbackPositionProperty(() => part.pos, false),
      orientation: new Cesium.CallbackProperty(() => part.quat, false),
      box: {
        dimensions: new Cesium.Cartesian3(spec.dim[0], spec.dim[1], spec.dim[2]),
        material: Cesium.Color.fromCssColorString(spec.color),
      },
    });

    return part;
  });
}