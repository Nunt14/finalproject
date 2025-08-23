import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../constants/supabase';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Please enter email and password');
      return;
    }

    // ล็อกอินด้วย Supabase Auth แบบปกติ (จะไม่ต้องยืนยันอีเมล หากปิดที่ Dashboard)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      Alert.alert('Login Failed', error.message);
      return;
    }

    if (data.session) {
      const userId = data.session.user.id;
      await AsyncStorage.setItem('user_id', userId);

      // อัปเซิร์ตแถวผู้ใช้ของเราให้สอดคล้องกับ schema
      const { error: upsertError } = await supabase
        .from('user')
        .upsert(
          [
            {
              user_id: userId,
              email,
              full_name: null,
              phone_number: null,
              profile_image_url: null,
              gender: null,
              language_preference: null,
              currency_preference: null,
              qr_code_img: null,
              is_verified: true,
            },
          ],
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
      if (upsertError) {
        Alert.alert('Database Insert Failed', upsertError.message);
        return;
      }

      router.replace('/welcome');
    } else {
      Alert.alert('Login Failed', 'No active session. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Log in</Text>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <Text style={styles.hint}>
        Minimum 8 characters   
        <Text 
          style={styles.link}
          onPress={() => router.push('/forgot-password')}
        >
          Forgot password
        </Text>
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  input: {
    borderColor: '#ddd', 
    borderWidth: 1, 
    borderRadius: 10,
    paddingHorizontal: 15, 
    paddingVertical: 12, 
    marginBottom: 15,
    backgroundColor: '#f5f5f5'
  },
  hint: { fontSize: 12, color: '#666', marginBottom: 20 },
  link: { color: '#333', fontWeight: '600' },
  button: {
    backgroundColor: '#3f5b78',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    bottom: -25,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
