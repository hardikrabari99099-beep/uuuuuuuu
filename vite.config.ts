// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import netlify from "@netlify/vite-plugin-tanstack-start";

// Deploy target switch. Default (no variable) = Netlify, exactly as before.
// Render builds set DEPLOY_TARGET=render (see "build:render" in package.json and render.yaml):
// the Netlify plugin is skipped and nitro builds a plain Node server in .output/server.
const isRender = process.env["DEPLOY_TARGET"] === "render";

export default defineConfig({
  // Netlify: the Netlify TanStack Start plugin builds the SSR function, so nitro is disabled.
  // Render: nitro's "node-server" preset builds the standalone server that "start:render" runs.
  nitro: isRender ? { preset: "node-server" } : false,
  plugins: isRender ? [] : [netlify()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "@tanstack/react-router",
        "@tanstack/react-query",
        "axios",
        "lucide-react",
        "sonner",
        "clsx",
        "tailwind-merge",
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
      hmr: process.env["DISABLE_HMR"] !== "true",
      watch: process.env["DISABLE_HMR"] === "true" ? null : {},
    },
  },
});
