const { getDefaultConfig } = require("expo/metro-config");

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);
  
  // Add svg to both assetExts and sourceExts to support both use cases
  config.resolver.assetExts.push("svg");
  config.resolver.sourceExts.push("svg");
  
  return config;
})();
