const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  // Get the default Expo webpack config.
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Add your custom path alias.
  config.resolve.alias = {
    ...config.resolve.alias,
    '@': path.resolve(__dirname, './'),
  };

  // Add fallbacks for Node.js core modules
  config.resolve.fallback = {
    ...(config.resolve.fallback || {}),
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),  // <-- add this line
    vm: require.resolve('vm-browserify'),
  };

  return config;
};
