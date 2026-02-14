import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const seedDbDir = path.resolve(__dirname, "../lib/seed-ts/src/main/resources/seed/data/sqlite");
const seedDbAbsolutePath = path
  .resolve(__dirname, "../lib/seed-ts/src/main/resources/seed/data/sqlite/seed.db")
  .replace(/\\/g, "/");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@seed": path.resolve(__dirname, "../lib/seed-ts/src"),
    },
  },
  define: {
    __SEED_DB_DEV_URL__: JSON.stringify(`/@fs/${seedDbAbsolutePath}`),
  },
  server: {
    fs: {
      allow: [workspaceRoot, seedDbDir],
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
