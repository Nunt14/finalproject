import { useFonts } from 'expo-font';

export function useCustomFonts() {
  const [fontsLoaded] = useFonts({
    'Prompt-Medium': require('../assets/fonts/Prompt-Medium.ttf'),
  });

  return { fontsLoaded };
}
