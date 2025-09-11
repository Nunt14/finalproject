import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../constants/supabase';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './contexts/LanguageContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { t } = useLanguage();

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

      // ไปหน้า welcome ทันทีเพื่อให้ผู้ใช้รู้สึกเร็วขึ้น
      router.replace('/welcome');

      // ทำ upsert แบบ non-blocking (ไม่ขวาง UI และไม่เด้ง error box)
      supabase
        .from('user')
        .upsert(
          [
            {
              user_id: userId,
              email,
            },
          ],
          { onConflict: 'user_id', ignoreDuplicates: true }
        )
        .then(() => {})
        .catch(() => {});
    } else {
      Alert.alert('Login Failed', 'No active session. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('login.title')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('login.email_placeholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <TextInput
        style={styles.input}
        placeholder={t('login.password_placeholder')}
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <Text style={styles.hint}>
        {t('login.min_chars_hint')}   
        <Text 
          style={styles.link}
          onPress={() => router.push('/forgot-password')}
        >
          {t('login.forgot_password')}
        </Text>
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>{t('login.next')}</Text>
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
