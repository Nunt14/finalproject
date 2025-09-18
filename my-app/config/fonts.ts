import * as Font from 'expo-font';

export const loadFonts = async () => {
  await Font.loadAsync({
    'Prompt-Medium': require('../assets/fonts/Prompt-Medium.ttf'),
  });
};

// This will be used to apply the font globally
export const fontConfig = {
  default: {
    regular: {
      fontFamily: 'Prompt-Medium',
      fontWeight: 'normal' as const,
    },
    medium: {
      fontFamily: 'Prompt-Medium',
      fontWeight: '500' as const,
    },
    light: {
      fontFamily: 'Prompt-Medium',
      fontWeight: '300' as const,
    },
    thin: {
      fontFamily: 'Prompt-Medium',
      fontWeight: '100' as const,
    },
  },
};
