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
        // `same-origin`, not `no-referrer`: with no-referrer a browser sends `Origin: null` on a plain form post, and
        // Next refuses that server action (CSRF check), so no form worked without scripts (found 27 Nov 2026).
        { key: 'Referrer-Policy', value: 'same-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      ],
    }];
  },
};

export default nextConfig;
