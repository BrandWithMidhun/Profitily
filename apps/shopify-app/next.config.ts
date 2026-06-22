import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hide the dev-mode indicator so it never bleeds into visual snapshots.
  devIndicators: false,
};

export default nextConfig;
