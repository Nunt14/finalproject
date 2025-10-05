import { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text } from '@/components';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useLanguage } from './contexts/LanguageContext';
import { SafeSupabase } from '../utils/safeSupabase';

export default function SignUpStep2() {
  const { email, password } = useLocalSearchParams();
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSignUp = async () => {
    if (!fullName || !phone) {
      Alert.alert('Please fill in all fields');
      return;
    }

    try {
      // 1) สมัครสมาชิกกับ Supabase Auth (จะ reject ถ้าอีเมลนี้ถูกใช้ไปแล้ว)
      const { data, error } = await supabase.auth.signUp({
        email: String(email),
        password: String(password),
        options: {
          data: {
            full_name: fullName,
            phone_number: phone,
          },
        },
      });

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already registered')) {
          Alert.alert('Email already registered', 'Please log in instead.');
          router.replace('/login');
          return;
        }
        Alert.alert('Sign Up Failed', error.message);
        return;
      }

      // 2) บันทึกลงตาราง user ของเราแบบ insertUserWithUpsert
      if (data && data.user) {
        const { error: userError } = await SafeSupabase.insertUserWithUpsert({
          user_id: data.user.id,
          email: data.user.email,
          full_name: fullName,
          phone_number: phone,
          is_verified: true,
          created_at: data.user.created_at,
          updated_at: data.user.created_at,
        });

        if (userError) {
          console.debug('user insert with upsert error (ignored):', userError);
          // ไม่แสดง error ให้ผู้ใช้ เพราะอาจเป็น duplicate ที่ไม่เป็นปัญหา
        }
      }

      // 3) ตรวจสอบว่าต้องยืนยันอีเมลหรือไม่
      if (data.user && data.session) {
        // มี session แสดงว่าเข้าสู่ระบบได้เลย (ไม่ต้องยืนยันอีเมล)
        Alert.alert('สำเร็จ', 'สร้างบัญชีสำเร็จ กำลังเข้าสู่ระบบ...');
        router.replace('/welcome');
      } else if (data.user && !data.session) {
        // ไม่มี session แสดงว่าต้องยืนยันอีเมล
        Alert.alert(
          'กรุณายืนยันอีเมล', 
          'ระบบได้ส่งลิงก์ยืนยันไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมลและคลิกลิงก์ยืนยัน',
          [
            {
              text: 'ส่งอีเมลยืนยันใหม่',
              onPress: async () => {
                try {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email: String(email)
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
            },
            { text: 'ไปหน้าเข้าสู่ระบบ', onPress: () => router.replace('/login') }
          ]
        );
      } else {
        Alert.alert('สำเร็จ', 'สร้างบัญชีสำเร็จ กรุณาเข้าสู่ระบบ');
        router.replace('/login');
      }
    } catch (err) {
      console.log('Signup catch error:', err);
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการสร้างบัญชี กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('signup2.title')}</Text>
      <TextInput
        placeholder={t('signup2.fullname')}
        style={styles.input}
        onChangeText={setFullName}
        value={fullName}
      />
      <TextInput
        placeholder={t('signup2.phone')}
        keyboardType="phone-pad"
        style={styles.input}
        onChangeText={setPhone}
        value={phone}
      />
      <Text style={styles.hint}>
        {t('signup2.currency_hint')} <Text style={{ fontWeight: 'bold' }}>THB (฿)</Text> {t('signup2.currency_change') ? t('signup2.currency_change') : ''}
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>{t('signup2.next')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80, backgroundColor: '#fff' },
  header: { 
    fontSize: 24, 
    fontFamily: 'Prompt-Medium',
    fontWeight: '600', 
    marginBottom: 30,
    color: '#1A3C6B' 
  },
  input: {
    borderColor: '#ddd', borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 15, paddingVertical: 12, marginBottom: 15,
    backgroundColor: '#f5f5f5'
  },
  hint: { fontSize: 12, color: '#666', marginBottom: 20 },
  link: { color: '#333', fontWeight: '600' },
  button: {
    backgroundColor: '#1A3C6B',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    fontSize: 16,
  }
});