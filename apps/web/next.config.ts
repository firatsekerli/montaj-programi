import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Point the plugin at our request config (single-locale "tr" setup).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The rules/shared packages are TS source consumed directly from the monorepo.
  transpilePackages: ["@montaj/rules", "@montaj/shared"],
};

export default withNextIntl(nextConfig);
