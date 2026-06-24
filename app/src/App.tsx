import { useEffect, useRef, useState } from "react";
import { DriveSim } from "./sim/DriveSim";
import type { CameraMode, Telemetry } from "./sim/types";
import StartGate from "./components/StartGate";
import Hud from "./components/Hud";
import TouchControls from "./components/TouchControls";

type Status = "idle" | "loading" | "running";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<DriveSim | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");

  useEffect(() => {
    return () => {
      simRef.current?.dispose();
      simRef.current = null;
    };
  }, []);

  async function handleStart(apiKey: string) {
    if (!containerRef.current || simRef.current) return;
    setStatus("loading");
    setError("");
    try {
      simRef.current = await DriveSim.create({
        container: containerRef.current,
        apiKey,
        onTelemetry: setTelemetry,
        onCameraMode: setCameraMode,
      });
      setStatus("running");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setStatus("idle");
    }
  }

  return (
    <div className="app">
      <div ref={containerRef} className="cesium-root" />
      {status !== "running" && (
        <StartGate loading={status === "loading"} error={error} onStart={handleStart} />
      )}
      {status === "running" && (
        <>
          <Hud telemetry={telemetry} cameraMode={cameraMode} />
          <TouchControls
            onKey={(code, down) => simRef.current?.setKey(code, down)}
            onToggleCamera={() => simRef.current?.toggleCamera()}
          />
        </>
      )}
    </div>
  );
}
