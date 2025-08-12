import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../constants/supabase';

export default function SignUpStep2() {
  const { email, password } = useLocalSearchParams();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSignUp = async () => {
    if (!fullName || !phone) {
      Alert.alert('Please fill in all fields');
      return;
    }

    // 1. ลงทะเบียนผู้ใช้กับ Supabase Auth
    // ข้อมูล fullName และ phone_number จะถูกบันทึกลงใน auth.users.user_metadata
    const { data, error } = await supabase.auth.signUp({
      email: String(email),
      password: String(password),
      options: {
        data: {
          full_name: fullName,
          phone_number: phone,
        }
      }
    });

    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    } else {
      // 2. หากการลงทะเบียนสำเร็จ และมีการยืนยันอีเมลแล้ว
      // บันทึกข้อมูลลงในตาราง 'user' ของคุณ
      // ใช้ user.id ที่ได้จาก auth.users มาเป็น user_id ในตารางของคุณ
      if (data && data.user) {
        const { error: insertError } = await supabase.from('user').insert([
          {
            user_id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            phone_number: phone,
            is_verified: false,
            created_at: data.user.created_at,
            updated_at: data.user.created_at,
          }
        ]);

        if (insertError) {
          Alert.alert('Database Insert Failed', insertError.message);
        } else {
          Alert.alert('Success', 'Check your email to confirm!');
          router.replace('/login');
        }
      } else {
        // กรณีที่การลงทะเบียนสำเร็จ แต่ไม่มีข้อมูลผู้ใช้
        Alert.alert('Success', 'Check your email to confirm!');
        router.replace('/login');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Sign up</Text>
      <TextInput
        placeholder="Full name"
        style={styles.input}
        onChangeText={setFullName}
        value={fullName}
      />
      <TextInput
        placeholder="Phone number"
        keyboardType="phone-pad"
        style={styles.input}
        onChangeText={setPhone}
        value={phone}
      />
      <Text style={styles.hint}>
        I use <Text style={{ fontWeight: 'bold' }}>THB (฿)</Text> as my currency. <Text style={styles.link}>Change</Text>
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 80, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  input: {
    borderColor: '#ddd', borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 15, paddingVertical: 12, marginBottom: 15,
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