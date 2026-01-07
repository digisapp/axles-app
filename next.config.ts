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
      {
        protocol: 'https',
        hostname: 'd17qgzvii7d4wm.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: 'royaltrailersales.com',
      },
      {
        protocol: 'https',
        hostname: 'midcosales.com',
      },
      {
        protocol: 'https',
        hostname: 'www.jhtt.com',
      },
      {
        protocol: 'https',
        hostname: 'jhtt.com',
      },
      {
        protocol: 'https',
        hostname: 'www.truckpaper.com',
      },
      {
        protocol: 'https',
        hostname: '*.truckpaper.com',
      },
    ],
  },
};

export default nextConfig;
