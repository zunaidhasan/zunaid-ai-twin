import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Pin workspace root so a stray lockfile in $HOME can't confuse build tracing.
  outputFileTracingRoot: path.join(import.meta.dirname),
  // The AI Twin ships as static assets + 3 tiny serverless routes (chat proxy,
  // leave-a-message, analytics). Works out of the box on Vercel and Netlify.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
