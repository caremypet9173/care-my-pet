import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  turbopack: { root: process.cwd() },
  images: { formats: ["image/avif", "image/webp"] },
};

export default createNextIntlPlugin()(config);
