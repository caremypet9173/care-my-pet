import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./src/content/legal/*.md"],
  },
  agentRules: false,
  turbopack: { root: process.cwd() },
  images: { formats: ["image/avif", "image/webp"] },
};

export default createNextIntlPlugin()(config);
