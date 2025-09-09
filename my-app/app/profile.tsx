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
} from 'react-native';
import { supabase } from '../constants/supabase';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState('THB');
  const [language, setLanguage] = useState('TH');
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
        setLanguage(data.language_preference || 'TH');
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
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
   

      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
           <Text style={styles.header}>Account</Text> 
           
           </View>


      <View style={styles.profileSection}>
  <View style={styles.profileImageWrapper}>
    <Image
      source={
                profileImage ? { uri: profileImage } : require('../assets/images/icon.png')
      }
      style={styles.profileImage}
    />
    <TouchableOpacity style={styles.cameraIcon} onPress={() => handleImagePick('profile')}>
      <Ionicons name="camera" size={18} color="#000" />
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
          <Ionicons name="call-outline" size={18} color="#3f5b78" style={styles.iconLeft} />
          <Text style={styles.label}>Phone number</Text>
          {editMode ? (
            <TextInput
              style={styles.inlineInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="089-xxx-xxxx"
            />
          ) : (
            <Text style={[styles.value, { color: '#3366cc' }]}>{phone || '089-xxx-xxxx'}</Text>
          )}
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <Ionicons name="create-outline" size={18} color="#3f5b78" />
          </TouchableOpacity>
        </View>

        {/* PASSWORD */}
        <View style={styles.infoRow}>
          <Ionicons name="lock-closed-outline" size={18} color="#3f5b78" style={styles.iconLeft} />
          <Text style={styles.label}>Password</Text>
          {editMode ? (
            <TextInput
              style={styles.inlineInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Enter new password"
            />
          ) : (
            <Text style={styles.value}>**********</Text>
          )}
        </View>

        {/* PAYMENT */}
        <View style={styles.infoRow}>
          <Ionicons name="qr-code-outline" size={18} color="#3f5b78" style={styles.iconLeft} />
          <Text style={styles.label}>Your Payment</Text>
          <TouchableOpacity onPress={() => handleImagePick('qr')}>
            <Ionicons name="create-outline" size={18} color="#3f5b78" />
          </TouchableOpacity>
        </View>

        <View style={styles.qrBox}>
          <TouchableOpacity style={styles.qrEditIcon} onPress={() => handleImagePick('qr')}>
            <Ionicons name="create-outline" size={16} color="#777" />
          </TouchableOpacity>
          {qrImage ? (
            <Image source={{ uri: qrImage }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <Ionicons name="qr-code-outline" size={64} color="#bbb" style={{ marginVertical: 24 }} />
          )}
          <Text style={styles.qrText}>
            QR ของคุณได้ถูกสร้างขึ้นแล้ว{'\n'}ผู้ใช้งานสามารถสแกนเพื่อชำระเงินได้
          </Text>
        </View>

        {/* CURRENCY */}
        <View style={styles.infoRow}>
          <Ionicons name="cash-outline" size={18} color="#3f5b78" style={styles.iconLeft} />
          <Text style={styles.label}>Default currency</Text>
          <TouchableOpacity style={styles.currencyPill} onPress={() => setShowCurrencyPicker(true)}>
            <Text style={styles.currencyPillText}>{currency}</Text>
            <Ionicons name="chevron-down" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* LANGUAGE */}
        <View style={styles.infoRow}>
          <Ionicons name="language-outline" size={18} color="#3f5b78" style={styles.iconLeft} />
          <Text style={styles.label}>Language</Text>
          {editMode ? (
            <TextInput
              style={styles.inlineInput}
              value={language}
              onChangeText={setLanguage}
              placeholder="TH / EN"
            />
          ) : (
            <Text style={styles.value}>{language}</Text>
          )}
        </View>
      </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>

      {/* Currency picker modal */}
      <Modal transparent visible={showCurrencyPicker} animationType="fade" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={{ fontWeight: '600', marginBottom: 10 }}>Select currency</Text>
            {currencyOptions.map((c) => (
              <TouchableOpacity key={c} style={styles.pickerRow} onPress={() => handleCurrencyUpdate(c)}>
                <Text style={{ color: '#333' }}>{c}</Text>
                {currency === c ? <Ionicons name="checkmark" size={18} color="#1A3C6B" /> : null}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.pickerRow, { justifyContent: 'center' }]} onPress={() => setShowCurrencyPicker(false)}>
              <Text style={{ color: '#1A3C6B', fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: -3,
    marginTop: 40,
    position: 'relative',
    width: '100%',
  },

  backButton: {
    padding: 8,
    position: 'absolute',
    left: -8,
    zIndex: 1,
  },
  
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  profileSection: { alignItems: 'center', marginBottom: 24 },
  profileImageWrapper: { position: 'relative', marginBottom: 12 },
  profileImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#eee', borderWidth: 3, borderColor: '#f2f2f2' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 15, padding: 3 },
  name: { fontSize: 20, fontWeight: 'bold', marginTop: 6, color: '#1A3C6B' },
  email: { fontSize: 13, color: '#7a7a7a', marginTop: 2 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#ececec', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  infoSection: { marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  label: { flex: 1, fontSize: 15, color: '#333' },
  value: { flex: 1, fontSize: 15, color: '#555' },
  iconEdit: { width: 18, height: 18 },
  iconLeft: { marginRight: 6 },
  inlineInput: {
    flex: 1,
    fontSize: 15,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 4,
    marginRight: 10,
    color: '#333',
  },
  inlineInputTouchable: {
    flex: 1,
    fontSize: 15,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 8,
    marginRight: 10,
  },
  currencyPill: {
    backgroundColor: '#1A3C6B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyPillText: { color: '#fff', fontWeight: '700' },
  qrBox: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    width: '90%',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ECECEC',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  qrEditIcon: { position: 'absolute', top: 10, right: 10, padding: 6, backgroundColor: '#f7f7f7', borderRadius: 12 },
  qrImage: { width: 240, height: 240, borderRadius: 12, marginBottom: 10 },
  qrText: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 2, marginBottom: 6 },
  saveButton: {
    backgroundColor: '#3f5b78',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutButton: {
    backgroundColor: '#222',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  pickerCard: { backgroundColor: '#fff', width: '80%', borderRadius: 12, padding: 16 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
});
