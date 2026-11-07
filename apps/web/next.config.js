/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ciphershare/shared'],
  webpack: (config) => {
    // Required for pdfjs-dist and web crypto in client
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
