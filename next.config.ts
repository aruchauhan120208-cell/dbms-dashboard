import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // This app is fully dynamic (every page reads live SQLite / OpenWeather), so
  // the experimental cacheComponents/partialPrefetching features are disabled.
  cacheComponents: false,
  // Serverless deployers (Vercel) trace server file dependencies statically;
  // db/heatwave.sqlite is opened by path at runtime, so force-include it in
  // every API function bundle, otherwise the lambda ships without the DB.
  outputFileTracingIncludes: {
    '/api/**': ['./db/**'],
  },
  // Pin the workspace root to this project so Turbopack does not pick up an
  // unrelated lockfile higher up the filesystem.
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
