import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

// vite-plugin-cesium copies Cesium's Workers/Assets/Widgets and sets CESIUM_BASE_URL.
export default defineConfig({
  plugins: [react(), cesium()],
  server: { host: true, port: 5173 },
});
