import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  allowedDevOrigins: ['app.lbpw.loc', 'www.app.lbpw.loc', 'localhost:3000'],
  transpilePackages: ['three'],
};

export default withNextIntl(nextConfig);
