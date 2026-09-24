import type { NextConfig } from "next";

function networkDevelopmentHost() {
  try {
    return process.env.TEST_LAN_URL ? new URL(process.env.TEST_LAN_URL).hostname : undefined;
  } catch {
    return undefined;
  }
}

const developmentHost = networkDevelopmentHost();

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: developmentHost ? [developmentHost] : [],
};

export default nextConfig;
