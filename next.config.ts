import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mssql/tedious use dynamic requires; keep them external to the server bundle.
  serverExternalPackages: ["mssql", "tedious"],
  experimental: {
    // proxy.ts runs on /api/*, so Next buffers each request body to allow a
    // second read in the route handler. The 10 MB default silently truncates
    // anything larger, which breaks multipart parsing before the uploader's own
    // size check can return a clean error. Sits above MAX_UPLOAD_BYTES (15 MB)
    // with headroom for multipart overhead.
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
