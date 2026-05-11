import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./app/i18n.ts');

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '550mb',
    },
  },
  async redirects() {
    return [
      {
        source: '/:locale/dashboard/bots/:botId/editor',
        destination: '/:locale/workspace/bots/:botId/editor',
        permanent: false,
      },
      {
        source: '/:locale/dashboard/bots/:botId/editor/:path*',
        destination: '/:locale/workspace/bots/:botId/editor/:path*',
        permanent: false,
      },
      {
        source: '/:locale/dashboard/subscription',
        destination: '/:locale/workspace?globalSettings=subscription',
        permanent: false,
      },
      {
        source: '/:locale/dashboard/profile',
        destination: '/:locale/workspace?globalSettings=profile',
        permanent: false,
      },
      {
        source: '/:locale/dashboard/settings',
        destination: '/:locale/workspace?globalSettings=settings',
        permanent: false,
      },
      {
        source: '/:locale/workspace/subscription',
        destination: '/:locale/workspace?globalSettings=subscription',
        permanent: false,
      },
      {
        source: '/:locale/workspace/profile',
        destination: '/:locale/workspace?globalSettings=profile',
        permanent: false,
      },
      {
        source: '/:locale/workspace/settings',
        destination: '/:locale/workspace?globalSettings=settings',
        permanent: false,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/:locale/workspace',
        destination: '/:locale/dashboard',
      },
      {
        source: '/:locale/workspace/bots/:botId/editor',
        destination: '/:locale/dashboard/bots/:botId/editor',
      },
      {
        source: '/:locale/workspace/bots/:botId/editor/:path*',
        destination: '/:locale/dashboard/bots/:botId/editor/:path*',
      },
    ]
  },
};

export default withNextIntl(nextConfig);
