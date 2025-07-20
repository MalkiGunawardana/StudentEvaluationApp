// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add the 'electron' directory to the blockList.
// This will prevent the bundler from trying to resolve files in that folder.
config.resolver.blockList = [].concat(config.resolver.blockList, /electron\/.*/);

module.exports = config;