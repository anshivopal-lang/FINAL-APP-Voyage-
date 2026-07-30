/**
 * PostCSS configuration.
 *
 * `.mjs` + `export default` because the project is ESM (`"type": "module"`).
 * A plain `postcss.config.js` using `module.exports` would throw
 * "module is not defined in ES module scope" during the Vercel build.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
