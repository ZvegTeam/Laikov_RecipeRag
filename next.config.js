/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Do not bundle these; they use native .node binaries (onnxruntime-node)
    serverComponentsExternalPackages: ["@xenova/transformers", "onnxruntime-node"],
  },
};

module.exports = nextConfig;
