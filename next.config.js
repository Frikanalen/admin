/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ["knex"],
  },
  webpack: (
    config,
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {
    config.externals.push({
      knex: "commonjs knex",
    });
    // Important: return the modified config
    return config;
  },
};

module.exports = nextConfig;
