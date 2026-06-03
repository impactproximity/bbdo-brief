import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mssql/tedious use dynamic requires; keep them external to the server bundle.
  serverExternalPackages: ["mssql", "tedious"],
};

export default nextConfig;
