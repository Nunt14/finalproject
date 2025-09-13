module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Temporarily disable reanimated plugin to fix worklets error
      // 'react-native-reanimated/plugin',
    ],
  };
};
