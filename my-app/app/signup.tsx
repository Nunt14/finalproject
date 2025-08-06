import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';

export default function SignUpStep1() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleNext = () => {
    if (!email || !password) {
      Alert.alert('Please enter both email and password');
      return;
    }

    // ส่ง email/password ไปหน้า signup2 ผ่าน params
    router.push({
      pathname: '/signup2',
      params: { email, password }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Sign up</Text>

      <TextInput
        placeholder="Email address"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <TextInput
        placeholder="Password"
        style={styles.input}
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <Text style={styles.hint}>Minimum 8 characters</Text>

      <TouchableOpacity style={styles.button} onPress={handleNext}>
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
  button: {
    backgroundColor: '#3f5b78',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    bottom: -25,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
