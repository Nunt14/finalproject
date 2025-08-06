import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';

export default function LoginScreen() {
  const goToWelcome = () => {
    router.replace('/welcome');
  };

  return (
    <View style={styles.container}>
      {/* แสดงรูปโลโก้แทนที่ Text */}
      <Image
        source={require('../assets/images/logo.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />

      <TouchableOpacity style={styles.button} onPress={() => router.replace('/signup')}>
        <Text style={styles.buttonText}>Sign up</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#333' }]} onPress={() => router.replace('/login')}>
        <Text style={styles.buttonText}>Log in</Text>
      </TouchableOpacity>

      <Image
        source={require('../assets/images/bg.png')}
        style={styles.bgImage}
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
    // เพิ่ม paddingBottom เพื่อเว้นระยะจากขอบด้านล่างให้มองเห็นรูปภาพ bg ได้ชัดเจนขึ้น
    paddingBottom: 150,
  },
  logoImage: {
    width: 600,
    height: 200,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#1A3C6B',
    padding: 16,
    borderRadius: 10,
    width: 300,
    marginVertical: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  bgImage: {
    // ปรับแก้ไขส่วนนี้
    width: '100%',
    height: 235,
    position: 'absolute',
    bottom: -5,
  },
});