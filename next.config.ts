import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    "/api/**/*": ["./reference/**/*"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
