import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "radix-ui"],
  },
  async redirects() {
    return [
      {
        source: "/book/:slug",
        destination: "/rezerwacje/:slug",
        permanent: true,
      },
      {
        source: "/book/:slug/success",
        destination: "/rezerwacje/:slug/success",
        permanent: true,
      },
      {
        source: "/rejestracja",
        destination: "/signup",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
