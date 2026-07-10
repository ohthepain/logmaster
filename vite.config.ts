import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { VitePWA } from "vite-plugin-pwa";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      outDir: "dist/client",
      includeAssets: [
        "favicon.ico",
        "favicon-16.png",
        "favicon-32.png",
        "apple-touch-icon.png",
        "logo192.png",
        "logo512.png",
        "offline.html",
        "logmaster_logo_transparent.png",
      ],
      manifest: {
        name: "logmaster",
        short_name: "logmaster",
        description: "Sailing logbook for trips, events, notes, and media.",
        theme_color: "#eb4539",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "logo192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "logo512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "logo512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // TanStack Start sets build.ssr=true for all environments, so vite-plugin-pwa
      // does not emit sw.js. Workbox runs post-build in scripts/generate-sw.mjs.
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
