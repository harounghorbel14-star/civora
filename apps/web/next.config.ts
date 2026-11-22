import type { NextConfig } from 'next';

/** Origins allowed to call server actions besides this host (behind a reverse proxy); comma-separated host names. */
const allowedOrigins = (process.env.SERVER_ACTION_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins, bodySizeLimit: '64kb' } },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        // Codes and states travel in URLs during sign-in and identity links: never send them to another site.
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      ],
    }];
  },
};

export default nextConfig;
