import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: 60 * 1024 * 1024,
    serverActions: {
      bodySizeLimit: "20mb"
    }
  }
};

export default nextConfig;
