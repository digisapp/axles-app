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
      {
        protocol: 'https',
        hostname: 'cdn11.bigcommerce.com',
      },
      {
        protocol: 'https',
        hostname: '*.bigcommerce.com',
      },
    ],
  },
};

export default nextConfig;
