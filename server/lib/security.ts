import { secureHeaders } from "hono/secure-headers";
import type { MiddlewareHandler } from "hono";
import { env } from "../env";

/**
 * Production-grade security headers via Hono's `secureHeaders` middleware.
 *
 * Defaults (per https://hono.dev/docs/middleware/builtin/secure-headers):
 *   - Strict-Transport-Security: max-age=15552000; includeSubDomains
 *   - X-Frame-Options: SAMEORIGIN
 *   - X-Content-Type-Options: nosniff
 *   - X-Permitted-Cross-Domain-Policies: none
 *   - Referrer-Policy: no-referrer
 *   - Cross-Origin-Opener-Policy: same-origin
 *   - Cross-Origin-Embedder-Policy: require-corp
 *   - Cross-Origin-Resource-Policy: same-origin
 *   - Origin-Agent-Cluster: ?1
 *   - Remove-Powered-By: true  (no X-Powered-By: Hono)
 *   - Server: ""               (no Server: Hono)
 *
 * We override:
 *   - CSP: report-only by default in development, enforced in production.
 *   - Permissions-Policy: deny sensitive features we don't use.
 *
 * NOTE: the iframe on /app/results embeds the e2b preview (different
 * origin). `frameAncestors` allows the frontend origin to embed the
 * preview; the preview itself loads in an iframe with `sandbox=...`
 * attributes, so cross-frame scripting is already locked down.
 */
export function securityHeaders(): MiddlewareHandler {
  const isProd = env.NODE_ENV === "production";

  const csp = {
    defaultSrc: ["'self'"],
    // Tailwind CDN in dev, esbuild local in prod. Allow https: for the
    // generated clone's <img> tags (screenshot data URLs are 'self' but
    // we also want to permit https for any future image-proxy).
    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "https:"],
    // e2b preview URLs are https://<sandbox>.e2b.dev. Connect to our own
    // API too (XHR/fetch). Stripe + Clerk webhooks are server-to-server,
    // not in CSP.
    connectSrc: ["'self'", "https://*.e2b.dev", "https://api.stripe.com", "https://clerk.clonecraft.dev"],
    frameSrc: ["'self'", "https://*.e2b.dev"],
    frameAncestors: [env.NODE_ENV === "production" ? env.VITE_APP_URL : "'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: isProd ? [] : undefined,
  };

  return secureHeaders({
    contentSecurityPolicy: isProd ? csp : undefined,
    // In dev, log-only so we don't break HMR. CSP-related console messages
    // are noisy but useful.
    contentSecurityPolicyReportOnly: isProd ? undefined : csp,
    crossOriginEmbedderPolicy: false, // breaks the e2b iframe in some browsers
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: [],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: [],
    },
    strictTransportSecurity: isProd ? "max-age=63072000; includeSubDomains; preload" : false,
  });
}
