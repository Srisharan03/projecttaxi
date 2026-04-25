import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  // ✅ FIX HERE
  allowedDevOrigins: ["10.100.9.40"],
};

export default nextConfig;