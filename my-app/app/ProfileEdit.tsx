// File: screens/ProfileEditScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Text } from '@/components';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from './contexts/LanguageContext';
import CacheDebugger from '../components/CacheDebugger';

function ProfileEditScreen() {
  const { t } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('THB');
  const [language, setLanguage] = useState('TH');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [qrImage, setQRImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showCacheDebugger, setShowCacheDebugger] = useState(false);
  const [imageLoading, setImageLoading] = useState<{[key: string]: boolean}>({});
  const [imageError, setImageError] = useState<{[key: string]: boolean}>({});

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
        .maybeSingle();
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

  // แก้ไขฟังก์ชัน uploadToStorage ให้ใช้ bucket ที่ถูกต้อง
  const uploadToStorage = async (imageUri: string, bucketName: string): Promise<string | null> => {
    try {
      console.log(`Starting upload to ${bucketName}...`);

      // อ่านไฟล์เป็น Blob ผ่าน fetch (รองรับ file:// และ content:// บน RN)
      const resp = await fetch(imageUri);
      const blob = await resp.blob();

      if (!blob) {
        throw new Error('Failed to read image blob');
      }

      // สร้างชื่อไฟล์จากนามสกุลจริง
      const extMatch = imageUri.match(/\.([a-zA-Z0-9]+)$/);
      const ext = (extMatch ? extMatch[1] : 'jpg').toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${user?.user_id}/${uuidv4()}.${ext}`;

      // อัปโหลดไป Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, blob, {
          contentType,
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        const msg = String(uploadError.message || '').toLowerCase();
        if (msg.includes('row-level security') || msg.includes('permission')) {
          Alert.alert('Storage Permission', 'ไม่สามารถอัปโหลดได้: โปรดเพิ่มนโยบาย RLS สำหรับ bucket นี้ (allow insert for authenticated)');
        } else if (msg.includes('bucket')) {
          Alert.alert('Storage Bucket', `ไม่พบบัคเก็ต "${bucketName}" โปรดสร้างให้ตรงชื่อและตั้งค่า public/read policy`);
        } else {
          Alert.alert('Upload Failed', uploadError.message);
        }
        return null;
      }

      console.log('Upload successful!');

      // สร้าง public URL ที่ถูกต้อง
      const { data } = await supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      const publicUrl = data?.publicUrl || null;
      console.log('Generated public URL:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Upload to storage error:', error);
      return null;
    }
  };

  const handleImagePick = async (type: 'profile' | 'qr') => {
    try {
      console.log('Requesting media library permissions...');
      // ขอ permission ก่อน
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }
      console.log('Media library permission granted');

      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets?.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log('Image selected:', imageUri);

        // ตรวจสอบ session ก่อนอัปโหลดเสมอ
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !sessionData?.session?.user) {
          console.log('No active session while uploading image');
          Alert.alert('Session', 'Please log in again.');
          router.replace('/login');
          return;
        }

        if (type === 'profile') {
          setIsUploading(true);
          console.log('Uploading profile image...');
          // แสดงรูปทันทีเป็นพรวิวแบบ local ก่อน
          setProfileImage(imageUri);

          try {
          // อัปโหลดไปยัง bucket โปรไฟล์
          const publicUrl = await uploadToStorage(imageUri, 'profiles');
            if (!publicUrl) {
              console.error('Failed to upload profile image');
              Alert.alert('Upload Failed', 'Failed to upload profile image. Please try again.');
              setIsUploading(false);
              return;
            }
            console.log('Profile image uploaded successfully:', publicUrl);

            // แทนที่ URL local ด้วย public URL หลังอัปโหลดสำเร็จ และกันแคช
            const bustUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
            setProfileImage(bustUrl);

            // บันทึกลงฐานข้อมูล
            const { error: updateError } = await supabase
              .from('user')
              .update({ profile_image_url: publicUrl })
              .eq('user_id', user.user_id);

            if (updateError) {
              console.error('Database update error:', updateError);
              Alert.alert('Database Error', 'Failed to save profile image URL to database.');
              // ถ้าบันทึกไม่สำเร็จ ให้คงรูป local ไว้ชั่วคราว
            } else {
              console.log('Profile image URL saved to database');
              Alert.alert('Success', 'Profile image updated successfully!');
            }
          } catch (error) {
            console.error('Upload error:', error);
            Alert.alert('Error', 'An error occurred while uploading the image.');
          } finally {
            setIsUploading(false);
          }
        } else {
          console.log('Uploading QR image...');
          // อัปโหลดไปยัง bucket qr-codes
          const publicUrl = await uploadToStorage(imageUri, 'qr-codes');
          if (!publicUrl) {
            console.error('Failed to upload QR image');
            Alert.alert('Upload Failed', 'Failed to upload QR image. Please try again.');
            return;
          }
          console.log('QR image uploaded successfully:', publicUrl);
          setQRImage(publicUrl);

          // บันทึกลงฐานข้อมูล
          const { error: updateError } = await supabase
            .from('user')
            .update({ qr_code_img: publicUrl })
            .eq('user_id', user.user_id);

          if (updateError) {
            console.error('Database update error:', updateError);
            Alert.alert('Database Error', 'Failed to save QR image URL to database.');
          } else {
            console.log('QR image URL saved to database');
          }
        }
      } else {
        console.log('Image picker was canceled');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'An error occurred while selecting the image.');
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
      Alert.alert(t('profileedit.updated'));
      router.replace('/ProfileView');
    }
  };

  if (showCacheDebugger) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setShowCacheDebugger(false)} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <CacheDebugger />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>{t('profileedit.title')}</Text>
        <TouchableOpacity
          style={styles.debugButton}
          onPress={() => setShowCacheDebugger(true)}
        >
          <Ionicons name="analytics" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <Image
          source={profileImage ? { uri: profileImage } : require('../assets/images/logo.png')}
          style={styles.profileImage}
          onLoadStart={() => {
            console.log('Starting to load image:', profileImage);
            setImageLoading((prev: {[key: string]: boolean}) => ({ ...prev, profile: true }));
          }}
          onLoadEnd={() => {
            console.log('Finished loading image');
            setImageLoading((prev: {[key: string]: boolean}) => ({ ...prev, profile: false }));
          }}
          onError={(error) => {
            console.error('Image load error:', error.nativeEvent.error);
            console.error('Failed image URL:', profileImage);
            setImageError((prev: {[key: string]: boolean}) => ({ ...prev, profile: true }));
            setImageLoading((prev: {[key: string]: boolean}) => ({ ...prev, profile: false }));
          }}
          onLoad={() => {
            console.log('Image loaded successfully');
            setImageError((prev: {[key: string]: boolean}) => ({ ...prev, profile: false }));
          }}
          key={profileImage} // เพิ่ม key เพื่อ force re-render
        />
        <TouchableOpacity
          style={[styles.cameraIcon, isUploading && styles.cameraIconDisabled]}
          onPress={() => !isUploading && handleImagePick('profile')}
          disabled={isUploading}
        >
          <Ionicons name={isUploading ? "hourglass" : "camera"} size={20} color="#fff" />
        </TouchableOpacity>
        {isUploading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Uploading...</Text>
          </View>
        )}
        {imageLoading.profile && !imageError.profile && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
      </View>

      <TextInput style={styles.input} placeholder={t('profileedit.fullname')} value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder={t('profileedit.phone')} value={phone} onChangeText={setPhone} />
      <TextInput style={styles.input} placeholder={t('profileedit.currency')} value={currency} onChangeText={setCurrency} />
      <TextInput style={styles.input} placeholder={t('profileedit.language')} value={language} onChangeText={setLanguage} />

      <TouchableOpacity onPress={() => handleImagePick('qr')} style={styles.qrButton}>
        <Text style={styles.qrButtonText}>{t('profileedit.change_qr')}</Text>
      </TouchableOpacity>

      {qrImage && (
        <Image
          source={{ uri: qrImage }}
          style={styles.qrImage}
          onLoadStart={() => {
            console.log('Starting to load QR image:', qrImage);
            setImageLoading((prev: {[key: string]: boolean}) => ({ ...prev, qr: true }));
          }}
          onLoadEnd={() => {
            console.log('Finished loading QR image');
            setImageLoading((prev: {[key: string]: boolean}) => ({ ...prev, qr: false }));
          }}
          onError={(error) => {
            console.error('QR Image load error:', error.nativeEvent.error);
            console.error('Failed QR URL:', qrImage);
            setImageError((prev: {[key: string]: boolean}) => ({ ...prev, qr: true }));
            setImageLoading((prev: {[key: string]: boolean}) => ({ ...prev, qr: false }));
          }}
          onLoad={() => {
            console.log('QR Image loaded successfully');
            setImageError((prev: {[key: string]: boolean}) => ({ ...prev, qr: false }));
          }}
          key={qrImage} // เพิ่ม key เพื่อ force re-render
        />
      )}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>{t('profileedit.save')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  backButton: { marginBottom: 10 },
  header: {
    fontSize: 22,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    alignSelf: 'center',
    marginBottom: 20,
    color: '#1A3C6B',
  },
  profileSection: { alignItems: 'center', marginBottom: 20 },
  profileImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 10 },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: '42%',
    backgroundColor: '#007AFF',
    borderRadius: 20,
    padding: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#1A3C6B',
    fontFamily: 'Prompt-Medium',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
  },
  saveButton: {
    backgroundColor: '#1A3C6B',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
  },
  qrButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
  },
  qrImage: { width: 180, height: 115, borderRadius: 12, alignSelf: 'center', marginBottom: 15 },
  cameraIconDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  loadingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  debugButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
});

export default ProfileEditScreen;
