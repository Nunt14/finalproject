import { useEffect } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import { router } from 'expo-router';
import { Fonts } from './utils/fonts';

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/register'); // ไป login หลัง 2 วิ
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/logo.png')}  // ✅ ใช้ path ที่ถูกต้อง
        style={styles.logoImage}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    fontFamily: Fonts.medium,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
  text: {
    fontFamily: Fonts.medium,
  },
});
