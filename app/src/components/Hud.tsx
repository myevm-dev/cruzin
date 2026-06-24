import type { CameraMode, Telemetry } from "../sim/types";

interface Props {
  telemetry: Telemetry | null;
  cameraMode: CameraMode;
}

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Hud({ telemetry, cameraMode }: Props) {
  const t = telemetry;
  return (
    <>
      <div className="panel keys">
        <div className="hdr">Drive</div>
        <div className="line"><span className="k">W</span><b>Throttle</b></div>
        <div className="line"><span className="k">S</span><b>Brake / reverse</b></div>
        <div className="line"><span className="k">A</span><span className="k">D</span><b>Steer</b></div>
        <div className="line"><span className="k">↑</span><span className="k">↓</span><b>Look pitch</b></div>
        <div className="line"><span className="k">C</span><b>{cameraMode === "chase" ? "→ first-person" : "→ chase"}</b></div>
      </div>

      <div className="panel data">
        <div className="hdr">Telemetry</div>
        <div className="row"><span>Session</span><span>{t ? fmtTime(t.sessionSecs) : "0:00"}</span></div>
        <div className="row"><span>Tile data</span><span>{t ? (t.tileBytes / 1e6).toFixed(1) : "0.0"} MB</span></div>
        <div className="row"><span>Rate</span><span>{t?.mbPerHour != null ? `${t.mbPerHour.toFixed(0)} MB/hr` : "— MB/hr"}</span></div>
        <div className="row"><span>Tile fetches</span><span>{t ? t.tileReqs.toLocaleString() : "0"}</span></div>
        <div className="note" style={t?.meterBlind ? { color: "var(--warn)" } : undefined}>
          {t?.meterBlind
            ? "Byte sizes hidden by CORS — fetch count is exact, MB is a floor. Use DevTools › Network for the true figure."
            : "Measuring egress from Google's tile servers."}
        </div>
      </div>

      <div className="panel speedo">
        <div className="val">{t ? t.speedMph : 0}</div>
        <div className="unit">mph</div>
      </div>
    </>
  );
}
