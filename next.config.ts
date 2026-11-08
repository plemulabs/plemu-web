import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));
const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  turbopack: { root: appRoot },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value:
              "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
          },
        ],
      },
      {
        source: "/:runtime(emulator|emulator-snes)/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/:runtime(emulator|emulator-snes)/frame.html",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; script-src 'self' 'unsafe-eval' blob:; connect-src 'self' blob:; worker-src blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src blob:; frame-ancestors 'self'; form-action 'none'; base-uri 'none'",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/creator", destination: "/create", permanent: false },
      { source: "/create/:path+", destination: "/create", permanent: false },
      { source: "/game/:path+", destination: "/discover", permanent: false },
      { source: "/rankings", destination: "/discover", permanent: false },
    ];
  },
};

export default nextConfig;
