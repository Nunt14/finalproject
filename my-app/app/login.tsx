import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../constants/supabase';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './contexts/LanguageContext';
import { SafeSupabase } from '../utils/safeSupabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { t } = useLanguage();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('login.required_fields'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('login.error_title'), t('login.min_chars_hint'));
      return;
    }

    try {
      // ล็อกอินด้วย Supabase Auth แบบปกติ (จะไม่ต้องยืนยันอีเมล หากปิดที่ Dashboard)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.log('Login error details:', error);
        
        // แสดงข้อผิดพลาดที่เฉพาะเจาะจงมากขึ้น
        let errorMessage = t('login.invalid_credentials');
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        } else if (error.message.includes('Email not confirmed')) {
          // ถ้ายังไม่ได้ยืนยันอีเมล ให้ส่งอีเมลยืนยันใหม่
          Alert.alert(
            'กรุณายืนยันอีเมล',
            'ระบบจะส่งลิงก์ยืนยันไปยังอีเมลของคุณ',
            [
              { text: 'ยกเลิก', style: 'cancel' },
              { 
                text: 'ส่งใหม่', 
                onPress: async () => {
                  try {
                    const { error: resendError } = await supabase.auth.resend({
                      type: 'signup',
                      email: email
                    });
                    if (resendError) {
                      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถส่งอีเมลยืนยันได้');
                    } else {
                      Alert.alert('สำเร็จ', 'ส่งอีเมลยืนยันแล้ว กรุณาตรวจสอบอีเมล');
                    }
                  } catch (err) {
                    Alert.alert('ข้อผิดพลาด', 'ไม่สามารถส่งอีเมลยืนยันได้');
                  }
                }
              }
            ]
          );
          return;
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่';
        } else {
          errorMessage = `เกิดข้อผิดพลาด: ${error.message}`;
        }
        
        Alert.alert(t('login.error_title'), errorMessage);
        return;
      }

      if (data.session) {
        const userId = data.session.user.id;
        await AsyncStorage.setItem('user_id', userId);

        // ไปหน้า welcome ทันทีเพื่อให้ผู้ใช้รู้สึกเร็วขึ้น
        router.replace('/welcome');

        // ทำ insert แบบ non-blocking (ไม่ขวาง UI และไม่เด้ง error box)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (async () => {
          // ใช้ insertUserWithCheck เพื่อจัดการ duplicate email
          const { error: userError } = await SafeSupabase.insertUserWithCheck({
            user_id: userId,
            email,
          });
          if (userError) {
            console.debug('user insert with check error (ignored):', userError);
          }
        })();
      } else {
        Alert.alert(t('login.error_title'), t('login.no_active_session'));
      }
    } catch (err) {
      console.log('Login catch error:', err);
      Alert.alert(t('login.error_title'), 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
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
  container: { 
    flex: 1, 
    padding: 20, 
    paddingTop: 80, 
    backgroundColor: '#fff',
    fontFamily: 'Prompt-Medium',
  },
  header: { 
    fontSize: 24, 
    fontFamily: 'Prompt-Medium',
    fontWeight: 'bold', 
    marginBottom: 30,
    color: '#1A3C6B',
  },
  input: {
    borderColor: '#ddd', 
    borderWidth: 1, 
    borderRadius: 10,
    paddingHorizontal: 15, 
    paddingVertical: 12, 
    marginBottom: 15,
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
    backgroundColor: '#f5f5f5'
  },
  hint: {
    fontSize: 14,
    fontFamily: 'Prompt-Medium',
    color: '#666',
    marginBottom: 20,
    textAlign: 'left',
  },
  link: { 
    color: '#333', 
    fontWeight: '600', 
    fontFamily: 'Prompt-Medium',
  },
  button: {
    backgroundColor: '#1A3C6B',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
  },
});
