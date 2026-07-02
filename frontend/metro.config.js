const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit max workers to 1 to prevent Out of Memory (OOM) crashes on 6GB RAM systems
config.maxWorkers = 1;

module.exports = config;
