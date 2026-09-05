import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/brandary/anfrage",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://bybrandary.de https://www.bybrandary.de",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
