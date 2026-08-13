import type { NextConfig } from "next";

const apiUrl = process.env.API_URL;
if (!apiUrl) throw new Error("API_URL must be configured");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@atelier/shared"],
  images: {
    // Media are served directly by the API/object storage; no resizing endpoint is available yet.
    unoptimized: true,
  },
  async rewrites() {
    return [{ source: "/backend/:path*", destination: `${apiUrl.replace(/\/$/, "")}/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
