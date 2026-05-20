import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { writeFileSync } from "node:fs";
import { componentTagger } from "lovable-tagger";

// Generate version info at config load (runs for every build)
function makeVersionInfo() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const version = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(
    now.getDate()
  )}.${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return {
    version,
    buildId: `build_${now.getTime()}`,
    deployedAt: now.toISOString(),
  };
}

const VERSION_INFO = makeVersionInfo();

// Vite plugin: writes /version.json into public/ before build,
// and serves a fresh /version.json from dev server.
function versionJsonPlugin(): Plugin {
  return {
    name: "cwf-version-json",
    apply: "build",
    buildStart() {
      try {
        writeFileSync(
          path.resolve(__dirname, "public/version.json"),
          JSON.stringify(VERSION_INFO, null, 2) + "\n"
        );
      } catch (e) {
        console.warn("[cwf-version-json] failed to write version.json", e);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    versionJsonPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(VERSION_INFO.version),
    __BUILD_ID__: JSON.stringify(VERSION_INFO.buildId),
    __DEPLOYED_AT__: JSON.stringify(VERSION_INFO.deployedAt),
  },
}));
