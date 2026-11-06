import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "CrocTrack Field Capture",
        short_name: "CrocTrack",
        description: "Offline-capable crocodile inspection capture for remote farm zones.",
        start_url: "/capture",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        // Lets the installed app appear in Android's Share menu, so a photo taken
        // in a USB camera app can be shared straight into the current entry.
        share_target: {
          action: "/share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: { files: [{ name: "photo", accept: ["image/*", "image/jpeg", "image/png"] }] },
        },
        theme_color: "#ffffff",
        icons: [
          { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        importScripts: ["/share-target-sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            // HTML navigations: always try the network first, fall back to cache offline.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20 },
            },
          },
          {
            // Hashed, same-origin build assets are immutable.
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/assets/") &&
              (request.destination === "script" || request.destination === "style" || request.destination === "image" || request.destination === "font"),
            handler: "CacheFirst",
            options: {
              cacheName: "build-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com" || url.origin === "https://fonts.googleapis.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@/integrations/supabase/client": path.resolve(__dirname, "./src/integrations/cloud-data/client.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
