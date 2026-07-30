/**
 * Next.js configuration.
 *
 * This file uses the `.mjs` extension and `export default` because the project
 * is an ES Modules project (`"type": "module"` in package.json). Naming it
 * `.mjs` keeps it unambiguous for both Node and the Vercel build image.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
