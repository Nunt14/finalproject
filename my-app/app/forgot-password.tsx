import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Image, ScrollView, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../constants/supabase';
import { router } from 'expo-router';
import { useLanguage } from './contexts/LanguageContext';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert(t('common.error_title'), t('forgot.email_required'));
      return;
    }

    setIsLoading(true);
    try {
      // Use app linking to build a reliable redirect URL for deep link flows
      const redirectTo = Linking.createURL('reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      const template = t('forgot.reset_link_sent_message');
      const message = template.replace('{email}', email);
      Alert.alert(
        t('forgot.reset_link_sent_title'),
        message,
        [
          { text: t('forgot.open_mail') ?? 'Open Mail', onPress: () => Linking.openURL(`mailto:${email}`) },
          { text: t('common.ok'), onPress: () => router.replace('/login') }
        ]
      );
    } catch (error: any) {
      console.error('Detailed reset password error:', JSON.stringify(error, null, 2));
      Alert.alert(
        t('common.error_title'), 
        error.message 
          ? `${t('forgot.reset_error_prefix')}: ${error.message}`
          : t('forgot.reset_error')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>{t('forgot.title')}</Text>
          <Text style={styles.subtitle}>{t('forgot.subtitle')}</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#888" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={t('forgot.email')}
              placeholderTextColor="#888"
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={setEmail}
              value={email}
              autoFocus
            />
          </View>

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? t('forgot.processing') : t('forgot.reset')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>{t('forgot.back_to_login')}</Text>
          </TouchableOpacity>

          <View style={styles.imageContainer}>
            <Image 
              source={require('../assets/images/bg3.png')} 
              style={styles.backgroundImage}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

interface Styles {
  container: ViewStyle;
  contentContainer: ViewStyle;
  scrollContainer: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  inputContainer: ViewStyle;
  inputIcon: TextStyle;
  input: TextStyle;
  button: ViewStyle;
  buttonDisabled: ViewStyle;
  buttonText: TextStyle;
  backButton: ViewStyle;
  backButtonText: TextStyle;
  imageContainer: ViewStyle;
  backgroundImage: ImageStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    padding: 24,
    paddingTop: 90,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 18,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
    color: '#6c757d',
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    color: '#212529',
    fontFamily: 'System',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  button: {
    backgroundColor: '#3f5b78',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#3f5b78',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    transform: [{ scale: 1 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  backButton: {
    backgroundColor: '#3f5b78',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    shadowColor: '#3f5b78',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  backButtonText: { 
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  backgroundImage: {
    width: 300,
    height: 250,
  }
});
