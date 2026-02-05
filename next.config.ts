import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(self)',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
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
