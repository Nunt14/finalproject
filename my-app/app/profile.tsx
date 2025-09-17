import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Modal,
  SafeAreaView,
} from 'react-native';
import { supabase } from '../constants/supabase';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState('THB');
  const { language, setLanguage, t } = useLanguage();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const languageOptions = ['TH', 'EN'];
  const languageNames = {
    'TH': 'ไทย',
    'EN': 'English'
  };
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [qrImage, setQRImage] = useState<string | null>(null);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const currencyOptions = ['THB', 'USD', 'EUR', 'JPY', 'GBP'];

  const fetchUser = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      router.replace('/login');
      return;
    }
    const { data, error } = await supabase
      .from('user')
      .select('*')
      .eq('user_id', userId)
      .single();

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (data) {
        setUser(data);
        setPhone(data.phone_number || '');
        setCurrency(data.currency_preference || 'THB');
        AsyncStorage.setItem('user_currency', data.currency_preference || 'THB');
        // Sync global language only if different
        if ((data.language_preference === 'TH' || data.language_preference === 'EN') && data.language_preference !== language) {
          setLanguage(data.language_preference);
        }
        setProfileImage(data.profile_image_url || null);
        setQRImage(data.qr_code_img || null);
      }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  // เรียก fetchUser ทุกครั้งที่หน้า Profile ถูก focus
  useFocusEffect(
    React.useCallback(() => {
      fetchUser();
    }, [])
  );

  const uploadToStorage = async (localUri: string, keyPrefix: string): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) return null;

      // Detect extension and contentType
      const match = localUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const ext = (match?.[1] || 'jpg').toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      // Read the file as Base64 and convert to ArrayBuffer (RN-safe)
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
      const arrayBuffer = decodeBase64(base64);
      const filePath = `${keyPrefix}/${uid}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, arrayBuffer, { contentType, upsert: true });
      if (uploadError) {
        Alert.alert('Upload Failed', uploadError.message || 'ไม่สามารถอัปโหลดไฟล์ได้');
        return null;
      }

      const { data: pub } = await supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);
      let publicUrl = (pub as any)?.publicUrl ?? null;
      if (!publicUrl) {
        // Try signed URL fallback if bucket is private
        const { data: signed } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(filePath, 60 * 60 * 24);
        publicUrl = (signed as any)?.signedUrl ?? null;
      }
      return publicUrl;
    } catch {
      return null;
    }
  };

  const handleImagePick = async (type: 'profile' | 'qr') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const imageUri = result.assets[0].uri;

      if (type === 'profile') {
        const publicUrl = await uploadToStorage(imageUri, 'user-profile');
        if (!publicUrl) return;
        setProfileImage(publicUrl);
        if (user?.user_id) {
          await supabase.from('user').update({ profile_image_url: publicUrl }).eq('user_id', user.user_id);
        }
      } else if (type === 'qr') {
        const publicUrl = await uploadToStorage(imageUri, 'user-qr');
        if (!publicUrl) return;
        setQRImage(publicUrl);
        if (user?.user_id) {
          await supabase.from('user').update({ qr_code_img: publicUrl }).eq('user_id', user.user_id);
        }
      }
    }
  };

  const handleCurrencyUpdate = async (newCurrency: string) => {
    setCurrency(newCurrency);
    setShowCurrencyPicker(false);
    AsyncStorage.setItem('user_currency', newCurrency);

    if (!user || !user.user_id) return;

    const { error } = await supabase
      .from('user')
      .update({ currency_preference: newCurrency })
      .eq('user_id', user.user_id);

    if (error) {
      Alert.alert('Currency Update Failed', error.message);
    }
  };

  const handleSave = async () => {
    if (!user || !user.user_id) return;

    // อัปเดตข้อมูลในตาราง user
    const { error } = await supabase
      .from('user')
      .update({
        phone_number: phone,
        language_preference: language,
        profile_image_url: profileImage,
        qr_code_img: qrImage,
      })
      .eq('user_id', user.user_id);

    if (error) {
      Alert.alert('Update Failed', error.message);
      return;
    }

    // อัปเดตรหัสผ่าน (ถ้ากรอก) ลงในตาราง user โดยตรง
    if (password.trim() !== '') {
      const { error: passUpdateError } = await supabase
        .from('user')
        .update({ password })
        .eq('user_id', user.user_id);
      if (passUpdateError) {
        Alert.alert('Password Update Failed', passUpdateError.message);
        return;
      }
    }

    Alert.alert('Profile Updated');
    setEditMode(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#1A3C6B', '#45647C', '#6B8E9C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 80 }}>


        <View style={styles.profileSection}>
          <View style={styles.profileImageWrapper}>
            <Image
              source={
                profileImage ? { uri: profileImage } : require('../assets/images/icon.png')
              }
              style={styles.profileImage}
            />
            <TouchableOpacity style={styles.cameraIcon} onPress={() => handleImagePick('profile')}>
              <Ionicons name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* แสดงชื่อ ถ้ามี full_name */}
          {user?.full_name ? (
            <Text style={styles.name}>{user.full_name}</Text>
          ) : null}

          {/* แสดงอีเมล ถ้ามี */}
          {user?.email ? (
            <Text style={styles.email}>{user.email}</Text>
          ) : null}
        </View>


      <View style={styles.sectionCard}>
      <View style={styles.infoSection}>
        {/* PHONE */}
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="call-outline" size={20} color="#1A3C6B" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>{t('profile.phone')}</Text>
            {editMode ? (
              <TextInput
                style={styles.inlineInput}
                value={phone}
                onChangeText={setPhone}
                placeholder={t('profile.default_phone_placeholder')}
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.value}>{phone || t('profile.default_phone_placeholder')}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setEditMode(!editMode)} style={styles.editButton}>
            <Ionicons name="create-outline" size={18} color="#1A3C6B" />
          </TouchableOpacity>
        </View>

        {/* PASSWORD */}
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#1A3C6B" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>{t('profile.password')}</Text>
            {editMode ? (
              <TextInput
                style={styles.inlineInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={t('profile.new_password_placeholder')}
                placeholderTextColor="#999"
              />
            ) : (
              <Text style={styles.value}>**********</Text>
            )}
          </View>
        </View>

        {/* PAYMENT */}
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="qr-code-outline" size={20} color="#1A3C6B" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>{t('profile.payment')}</Text>
            <Text style={styles.value}>{qrImage ? 'QR Code Set' : 'No QR Code'}</Text>
          </View>
          <TouchableOpacity onPress={() => handleImagePick('qr')} style={styles.editButton}>
            <Ionicons name="create-outline" size={18} color="#1A3C6B" />
          </TouchableOpacity>
        </View>

        <View style={styles.qrBox}>
          <TouchableOpacity style={styles.qrEditIcon} onPress={() => handleImagePick('qr')}>
            <Ionicons name="create-outline" size={16} color="#1A3C6B" />
          </TouchableOpacity>
          {qrImage ? (
            <Image source={{ uri: qrImage }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <Ionicons name="qr-code-outline" size={64} color="#1A3C6B" style={{ marginVertical: 24 }} />
          )}
          <Text style={styles.qrText}>{t('profile.qr_text')}</Text>
        </View>

        {/* CURRENCY */}
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="cash-outline" size={20} color="#1A3C6B" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>{t('profile.currency')}</Text>
            <Text style={styles.value}>{currency}</Text>
          </View>
          <TouchableOpacity style={styles.currencyPill} onPress={() => setShowCurrencyPicker(true)}>
            <Text style={styles.currencyPillText}>{currency}</Text>
            <Ionicons name="chevron-down" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* LANGUAGE */}
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="language-outline" size={20} color="#1A3C6B" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.label}>{t('profile.language')}</Text>
            <Text style={styles.value}>{languageNames[language as keyof typeof languageNames]}</Text>
          </View>
          <TouchableOpacity 
            style={styles.currencyPill} 
            onPress={() => setShowLanguagePicker(true)}
          >
            <Text style={styles.currencyPillText}>
              {language}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{t('common.save')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language picker modal */}
      <Modal transparent visible={showLanguagePicker} animationType="fade" onRequestClose={() => setShowLanguagePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={{ fontWeight: '600', marginBottom: 10 }}>{t('common.select_language')}</Text>
            {languageOptions.map((lang) => (
              <TouchableOpacity 
                key={lang}
                style={styles.pickerRow}
                onPress={() => {
                  setLanguage(lang as any);
                  setShowLanguagePicker(false);
                  if (user?.user_id) {
                    supabase
                      .from('user')
                      .update({ language_preference: lang })
                      .eq('user_id', user.user_id);
                  }
                }}
              >
                <Text style={{ color: '#333' }}>{languageNames[lang as keyof typeof languageNames]}</Text>
                {language === lang && <Ionicons name="checkmark" size={18} color="#1A3C6B" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={[styles.pickerRow, { justifyContent: 'center' }]} 
              onPress={() => setShowLanguagePicker(false)}
            >
              <Text style={{ color: '#1A3C6B', fontWeight: '600' }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Currency picker modal */}
      <Modal transparent visible={showCurrencyPicker} animationType="fade" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={{ fontWeight: '600', marginBottom: 10 }}>{t('common.select_currency')}</Text>
            {currencyOptions.map((c) => (
              <TouchableOpacity key={c} style={styles.pickerRow} onPress={() => handleCurrencyUpdate(c)}>
                <Text style={{ color: '#333' }}>{c}</Text>
                {currency === c ? <Ionicons name="checkmark" size={18} color="#1A3C6B" /> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.pickerRow, { justifyContent: 'center' }]} onPress={() => setShowCurrencyPicker(false)}>
              <Text style={{ color: '#1A3C6B', fontWeight: '600' }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  headerGradient: {
    paddingTop: 0,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: { 
    alignItems: 'center', 
    marginTop: 20,
    marginBottom: 30,
    paddingVertical: 20,
  },
  profileImageWrapper: { 
    position: 'relative', 
    marginBottom: 16,
  },
  profileImage: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    backgroundColor: '#f8f9fa', 
    borderWidth: 4, 
    borderColor: '#1A3C6B',
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraIcon: { 
    position: 'absolute', 
    bottom: 0, 
    right: 0, 
    backgroundColor: '#1A3C6B', 
    borderRadius: 18, 
    padding: 6,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  name: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginTop: 8, 
    color: '#1A3C6B',
    textAlign: 'center',
  },
  email: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 4,
    textAlign: 'center',
  },
  sectionCard: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: '#f0f0f0', 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 4, 
    shadowOffset: { width: 0, height: 2 }, 
    elevation: 2 
  },
  infoSection: { marginBottom: 8 },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20,
    paddingVertical: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoContent: {
    flex: 1,
  },
  label: { 
    fontSize: 14, 
    color: '#666', 
    marginBottom: 2,
    fontWeight: '500',
  },
  value: { 
    fontSize: 16, 
    color: '#1A3C6B',
    fontWeight: '600',
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  inlineInput: {
    fontSize: 16,
    borderBottomWidth: 2,
    borderColor: '#1A3C6B',
    paddingVertical: 6,
    color: '#1A3C6B',
    fontWeight: '600',
  },
  currencyPill: {
    backgroundColor: '#1A3C6B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  currencyPillText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 14,
  },
  qrBox: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#1A3C6B',
    borderStyle: 'dashed',
    shadowColor: '#1A3C6B',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  qrEditIcon: { 
    position: 'absolute', 
    top: 12, 
    right: 12, 
    padding: 8, 
    backgroundColor: '#1A3C6B', 
    borderRadius: 16,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  qrImage: { 
    width: 200, 
    height: 200, 
    borderRadius: 16, 
    marginBottom: 12,
    backgroundColor: '#fff',
    padding: 10,
  },
  qrText: { 
    fontSize: 13, 
    color: '#1A3C6B', 
    textAlign: 'center', 
    marginTop: 4, 
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#1A3C6B',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  logoutButton: {
    backgroundColor: '#6c757d',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#6c757d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutButtonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  pickerCard: { 
    backgroundColor: '#fff', 
    width: '80%', 
    borderRadius: 20, 
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  pickerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
});
