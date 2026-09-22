import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin access to dev resources by default. The
  // e2e suite drives the browser from http://127.0.0.1:3000 and the dev
  // server also announces a LAN address, so allow both (localhost is
  // allowed by default) or the login page renders but its client JS dies
  // with "Blocked cross-origin request to Next.js dev resource".
  allowedDevOrigins: ["127.0.0.1", "192.168.0.108"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000", "192.168.0.108:3000"],
    },
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Handle native node modules for thermal printing
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        printer: "commonjs printer",
      });
    }
    return config;
  },
};

export default nextConfig;
