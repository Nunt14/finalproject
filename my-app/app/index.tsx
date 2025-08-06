import { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';

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
  },
  logoImage: {
    width: 500,
    height: 200,
  },
});
