/**
 * Shared PWA / Workbox options for @ducanh2912/next-pwa (Next 14).
 * Service worker is disabled in development; build output lands in public/.
 *
 * Install: Chrome/Edge → address-bar install icon, or DevTools → Application → Manifest.
 * Verify: Application → Service Workers; Lighthouse → Progressive Web App.
 */
const isDev = process.env.NODE_ENV === "development";

/** @type {import('@ducanh2912/next-pwa').PluginOptions} */
const pwaOptions = {
  dest: "public",
  disable: isDev,
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  // Light shell caching; avoid aggressive HTML caching for auth/admin UIs
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  fallbacks: {
    document: "/offline",
  },
  // Do not precache large media from /public (runtime CacheFirst still applies)
  publicExcludes: [
    "!**/*.{mp4,webm,gif}",
    "!**/hero-background*",
    "!**/footerbg*",
    "!**/smart-city*",
    "!**/gov.gif",
    "!**/health.gif",
  ],
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Never cache auth / admin / proxy API traffic
        urlPattern: /\/api\/(?:auth|admin|proxy)(?:\/|$)/i,
        handler: "NetworkOnly",
        method: "GET",
      },
      {
        // Same-origin API: network-first, short TTL
        urlPattern: /\/api\/.*/i,
        handler: "NetworkFirst",
        method: "GET",
        options: {
          cacheName: "bqi-api-cache",
          networkTimeoutSeconds: 8,
          expiration: {
            maxEntries: 48,
            maxAgeSeconds: 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        // Remote FastAPI / Render backends: network-first, short TTL
        urlPattern:
          /^https?:\/\/[^/]*(?:onrender\.com|api\.bqitech\.com)\/.*/i,
        handler: "NetworkFirst",
        method: "GET",
        options: {
          cacheName: "bqi-remote-api-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
};

module.exports = { pwaOptions };
