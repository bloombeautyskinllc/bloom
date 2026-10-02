import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a verification build (NEXT_DIST_DIR=.next-check) run without touching the running dev server's .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default withNextIntl(nextConfig);
