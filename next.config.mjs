/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "randomuser.me",
      },
      {
        protocol: "https",
        hostname: "example.com",
      },
    ],
  },

  logging: {
    fetches: {
      fullUrl: false, // hides full fetch logs
    },
  },
};

export default nextConfig;