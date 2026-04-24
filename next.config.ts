import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Apex → www so cookies, NextAuth, and the tracker origin stay on one host.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "commithappens.com" }],
        destination: "https://www.commithappens.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
