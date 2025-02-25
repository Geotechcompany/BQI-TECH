/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["bqitech.com", "img.clerk.com", "new-domain.com"], // Add any new domains here
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }

    config.module.rules.push({
      test: /\.(mpwebm)$/,
      use: {
        loader: "file-loader",
        options: {
          publicPath: "/_next/static/videos/",
          outputPath: "static/videos/",
          name: "[name].[hash].[ext]",
        },
      },
    });

    return config;
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/overview',
        permanent: true,
      },
     
    ];
  },
  transpilePackages: ['@uiw/react-md-editor'],
};

module.exports = nextConfig;
