/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production builds resilient during the prototype; linting is run
  // separately. (Revisited in Phase 11.)
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
