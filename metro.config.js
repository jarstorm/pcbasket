const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Metro doesn't ship with .ogg in its default asset extensions — needed for
// one of the background music tracks (see src/state/MusicContext.js).
config.resolver.assetExts.push("ogg");

module.exports = config;
