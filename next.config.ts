import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'trailerimages.haletrailer.com',
      },
      {
        protocol: 'https',
        hostname: '*.haletrailer.com',
      },
      {
        protocol: 'https',
        hostname: 'www.pinnacletrailers.com',
      },
      {
        protocol: 'https',
        hostname: '*.pinnacletrailers.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;
