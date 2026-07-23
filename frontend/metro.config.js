const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit max workers to 1 to prevent Out of Memory (OOM) crashes on 6GB RAM systems
config.maxWorkers = 1;

// Ignore gradle-plugin build folders inside node_modules to prevent watcher ENOENT crashes on Windows
config.resolver.blockList = [
  /.*[\\\/]node_modules[\\\/]@react-native[\\\/]gradle-plugin[\\\/].*[\\\/]build[\\\/].*/,
];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      type: 'empty',
    };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
