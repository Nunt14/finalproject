import React from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { LanguageProvider } from './contexts/LanguageContext';
import { loadFonts } from '../config/fonts';
import { CacheManager } from '../utils/cacheManager';
import { clearOldCache } from '../utils/clearOldCache';

// Custom loading component
function Loading() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    'Prompt-Medium': require('../assets/fonts/Prompt-Medium.ttf'),
  });

  // Load fonts and initialize cache when component mounts
  React.useEffect(() => {
    loadFonts();
    // Clear old cache when switching to new database
    clearOldCache().then(() => {
      CacheManager.initialize().then(() => {
        // Log cache usage after initialization
        CacheManager.logCacheUsage();
        CacheManager.logCachePerformance();
      });
    });
  }, []);

  if (!fontsLoaded) {
    return <Loading />;
  }

  return (
    <View style={{ flex: 1 }}>
      <LanguageProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            headerTitleStyle: {
              fontFamily: 'Prompt-Medium',
            },
          }}
        />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </LanguageProvider>
    </View>
  );
}
