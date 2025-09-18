import { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text } from '@/components';
import { router } from 'expo-router';
import { useLanguage } from './contexts/LanguageContext';

export default function SignUpStep1() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { t } = useLanguage();

  const handleNext = () => {
    if (!email || !password) {
      Alert.alert(t('signup.alert_fill'));
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
      <Text style={styles.header}>{t('signup.title')}</Text>

      <TextInput
        placeholder={t('signup.email')}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <TextInput
        placeholder={t('signup.password')}
        style={styles.input}
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <Text style={styles.hint}>{t('signup.min_hint')}</Text>

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>{t('signup.next')}</Text>
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
    borderColor: '#ddd', 
    borderWidth: 1, 
    borderRadius: 10,
    paddingHorizontal: 15, 
    paddingVertical: 12, 
    marginBottom: 15,
    backgroundColor: '#f5f5f5'
  },
  hint: { fontSize: 12, color: '#666', marginBottom: 20 },
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
