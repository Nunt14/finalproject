import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
// import 'react-native-reanimated'; // Temporarily disabled

import { useColorScheme } from '@/hooks/useColorScheme';
import { LanguageProvider } from './contexts/LanguageContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  // เพิ่ม return นี้เพื่อให้แอปแสดงผลหน้าจอ
  return (
     <LanguageProvider>
       <Stack
        screenOptions={{
          headerShown: false, // ❌ ปิด header ทุกหน้า
        }}
      />
     </LanguageProvider>
  );
}
