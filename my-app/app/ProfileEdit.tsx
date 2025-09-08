// File: screens/ProfileEditScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';

export default function ProfileEditScreen() {
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('THB');
  const [language, setLanguage] = useState('TH');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [qrImage, setQRImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase
        .from('user')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (data) {
        setUser(data);
        setFullName(data.full_name || '');
        setPhone(data.phone_number || '');
        setCurrency(data.currency_preference || 'THB');
        setLanguage(data.language_preference || 'TH');
        setProfileImage(data.profile_image_url || null);
        setQRImage(data.qr_code_img || null);
      }
    };
    fetchUser();
  }, []);

  const uploadToStorage = async (localUri: string, keyPrefix: string): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) return null;

      // detect ext/content-type
      const match = localUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const ext = (match?.[1] || 'jpg').toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decodeBase64(base64);
      const filePath = `${keyPrefix}/${uid}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, arrayBuffer, { contentType, upsert: true });
      if (uploadError) return null;

      const { data: pub } = await supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);
      const publicUrl = (pub as any)?.publicUrl ?? null;
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
        if (!publicUrl) {
          Alert.alert('Upload Failed', 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้');
          return;
        }
        setProfileImage(publicUrl);
        await supabase.from('user').update({ profile_image_url: publicUrl }).eq('user_id', user.user_id);
      } else {
        const publicUrl = await uploadToStorage(imageUri, 'user-qr');
        if (!publicUrl) {
          Alert.alert('Upload Failed', 'ไม่สามารถอัปโหลดรูป QR ได้');
          return;
        }
        setQRImage(publicUrl);
        await supabase.from('user').update({ qr_code_img: publicUrl }).eq('user_id', user.user_id);
      }
    }
  };

  const handleSave = async () => {
    if (!user || !user.user_id) return;
    const { error } = await supabase
      .from('user')
      .update({
        full_name: fullName,
        phone_number: phone,
        currency_preference: currency,
        language_preference: language,
      })
      .eq('user_id', user.user_id);

    if (error) {
      Alert.alert('Update Failed', error.message);
    } else {
      Alert.alert('Profile Updated');
      router.replace('/ProfileView');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.header}>Edit Profile</Text>

      <View style={styles.profileSection}>
        <Image
          source={profileImage ? { uri: profileImage } : require('../assets/images/logo.png')}
          style={styles.profileImage}
        />
        <TouchableOpacity style={styles.cameraIcon} onPress={() => handleImagePick('profile')}>
          <Ionicons name="camera" size={18} color="#000" />
        </TouchableOpacity>
      </View>

      <TextInput style={styles.input} placeholder="Full Name" value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Phone Number" value={phone} onChangeText={setPhone} />
      <TextInput style={styles.input} placeholder="Currency (e.g. THB)" value={currency} onChangeText={setCurrency} />
      <TextInput style={styles.input} placeholder="Language (e.g. TH)" value={language} onChangeText={setLanguage} />

      <TouchableOpacity onPress={() => handleImagePick('qr')} style={styles.qrButton}>
        <Text style={styles.qrButtonText}>Change QR Image</Text>
      </TouchableOpacity>

      {qrImage && <Image source={{ uri: qrImage }} style={styles.qrImage} />}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  backButton: { marginBottom: 10 },
  header: { fontSize: 22, fontWeight: 'bold', alignSelf: 'center', marginBottom: 10 },
  profileSection: { alignItems: 'center', marginBottom: 20 },
  profileImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eee' },
  cameraIcon: { position: 'absolute', bottom: 0, right: '42%', backgroundColor: '#fff', borderRadius: 15, padding: 3 },
  input: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
  },
  saveButton: {
    backgroundColor: '#3f5b78',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  qrButton: {
    backgroundColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  qrButtonText: { color: '#333' },
  qrImage: { width: 180, height: 115, borderRadius: 12, alignSelf: 'center', marginBottom: 15 },
});
