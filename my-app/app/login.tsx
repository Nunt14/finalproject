import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../constants/supabase';
import { router } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Please enter email and password');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error && error.message !== 'Email not confirmed') {
      Alert.alert('Login Failed', error.message);
      return;
    }
    // ดำเนินการ login ต่อแม้ error เป็น Email not confirmed
    // ตรวจสอบว่ามีข้อมูลในตาราง user หรือยัง
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('user_id')
      .eq('email', email)
      .single();

    if (!userData && !userError) {
      // ถ้ายังไม่มี ให้บันทึกข้อมูลลงตาราง user พร้อม field ตาม schema
      await supabase.from('user').insert([
        {
          email: email,
          password: password, // ควรเข้ารหัสก่อนบันทึกจริง
          full_name: null,
          phone_number: null,
          profile_image: null,
          gender: null,
          language_preference: null,
          currency_preference: null,
          is_verified: false,
          created_at: null
        }
      ]);
    }
    // เรียกดูข้อมูลผู้ใช้จากตาราง user
    const { data: userInfo, error: userInfoError } = await supabase
      .from('user')
      .select('*')
      .eq('email', email)
      .single();

    if (userInfo) {
      Alert.alert(
        'Login Success',
        `Email: ${userInfo.email}\nFull Name: ${userInfo.full_name || '-'}\nPhone: ${userInfo.phone_number || '-'}`,
        [
          { text: 'OK', onPress: () => router.replace('/welcome') }
        ]
      );
    } else {
      router.replace('/welcome');
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

      <Text style={styles.hint}>Minimum 8 characters   <Text style={styles.link}>Forgot password</Text></Text>

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
