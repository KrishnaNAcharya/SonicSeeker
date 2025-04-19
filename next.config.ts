import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverRuntimeConfig: {
    PROJECT_ROOT: __dirname
  }
};

export default nextConfig;
