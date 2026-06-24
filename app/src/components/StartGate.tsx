import { useState } from "react";

interface Props {
  loading: boolean;
  error: string;
  onStart: (apiKey: string) => void;
}

export default function StartGate({ loading, error, onStart }: Props) {
  const [key, setKey] = useState("");
  const ready = key.trim().length >= 20 && !loading;

  return (
    <div className="gate">
      <div className="card">
        <div className="eyebrow">Photorealistic 3D Tiles · Prototype</div>
        <h1>
          Fort Collins <b>Drive</b>
        </h1>
        <p>
          A street-level drive through Old Town, streamed live from Google's 3D mesh. Validates look,
          feel, and the real data rate behind your cost model. Runs entirely on your own API key.
        </p>
        <label htmlFor="key">Google Maps API key</label>
        <input
          id="key"
          type="password"
          placeholder="AIza…"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready) onStart(key.trim());
          }}
        />
        <button className="btn" disabled={!ready} onClick={() => onStart(key.trim())}>
          {loading ? "Loading tiles…" : "Start driving"}
        </button>
        {error && <div className="err">{error}</div>}
        <div className="fine">
          Needs the <b>Map Tiles API</b> enabled in Google Cloud, with billing on. The key is used only
          in your browser. Lock it down with an HTTP-referrer restriction before reusing it anywhere
          public.
          <br />
          <a
            href="https://developers.google.com/maps/documentation/tile/get-api-key"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get a key →
          </a>
        </div>
      </div>
    </div>
  );
}
