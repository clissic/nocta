const { getDefaultConfig } = require("expo/metro-config");

/** Expo SDK 52+ ya soporta npm workspaces; no pisar watchFolders/nodeModulesPaths. */
const config = getDefaultConfig(__dirname);

module.exports = config;
