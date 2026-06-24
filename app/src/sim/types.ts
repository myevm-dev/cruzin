export interface Telemetry {
  speedMph: number;
  sessionSecs: number;
  tileBytes: number;
  tileReqs: number;
  mbPerHour: number | null;
  meterBlind: boolean;
}

export type CameraMode = "chase" | "fp";

export interface Origin {
  lon: number;
  lat: number;
  ground: number;
}
