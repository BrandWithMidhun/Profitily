import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hide the dev-mode indicator so it never bleeds into visual snapshots (the visual
  // baselines are generated against `next dev` — see e2e/visual/README.md).
  devIndicators: false,
};

export default nextConfig;
