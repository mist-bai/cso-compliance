/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backend = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8200";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backend}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
