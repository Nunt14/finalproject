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
} from 'react-native';
import { supabase } from '../constants/supabase';
import { router, useFocusEffect } from 'expo-router';
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

  const fetchUser = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const userId = authData.user.id;
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
        setLanguage(data.language_preference || 'TH');
        setProfileImage(data.profile_image || null);
        setQRImage(data.qr_image || null);
      }
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

  const handleImagePick = async (type: 'profile' | 'qr') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions. Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const imageUri = result.assets[0].uri;

      if (type === 'profile') {
        setProfileImage(imageUri);
      } else if (type === 'qr') {
        setQRImage(imageUri);
      }
    }
  };

  const handleSave = async () => {
    if (!user || !user.user_id) return;

    // อัปเดตข้อมูลในตาราง user
    const { error } = await supabase
      .from('user')
      .update({
        phone_number: phone,
        currency_preference: currency,
        language_preference: language,
        profile_image: profileImage,
        qr_image: qrImage,
      })
      .eq('user_id', user.user_id);

    if (error) {
      Alert.alert('Update Failed', error.message);
      return;
    }

    // อัปเดตรหัสผ่าน (ถ้ากรอก)
    if (password.trim() !== '') {
      const { error: passError } = await supabase.auth.updateUser({ password });
      if (passError) {
        Alert.alert('Password Update Failed', passError.message);
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
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>

      <Text style={styles.header}>Account</Text>

      <View style={styles.profileSection}>
  <View style={styles.profileImageWrapper}>
    <Image
      source={
        profileImage ? { uri: profileImage } : require('../assets/images/pf.png')
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
            <Image source={require('../assets/images/edit.png')} style={styles.iconEdit} />
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
            <Image source={require('../assets/images/edit.png')} style={styles.iconEdit} />
          </TouchableOpacity>
        </View>

        <View style={styles.qrBox}>
          {qrImage && <Image source={{ uri: qrImage }} style={styles.qrImage} />}
          <Text style={styles.qrText}>
            QR ของคุณได้ถูกสร้างขึ้นแล้ว{'\n'}ผู้ใช้งานสามารถสแกนเพื่อชำระเงินได้
          </Text>
        </View>

        {/* CURRENCY */}
        <View style={styles.infoRow}>
          <Ionicons name="cash-outline" size={18} color="#3f5b78" style={styles.iconLeft} />
          <Text style={styles.label}>Default currency</Text>
          {editMode ? (
            <TextInput
              style={styles.inlineInput}
              value={currency}
              onChangeText={setCurrency}
              placeholder="e.g., THB"
            />
          ) : (
            <Text style={styles.value}>{currency}</Text>
          )}
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

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  backButton: {
    marginBottom: 10,
  },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, alignSelf: 'center' },
  profileSection: { alignItems: 'center', marginBottom: 20 },
  profileImageWrapper: { position: 'relative', marginBottom: 10 },
  profileImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eee' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 15, padding: 3 },
  name: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  email: { fontSize: 14, color: '#666' },
  infoSection: { marginBottom: 20 },
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
  qrBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
    width: '60%',
    alignSelf: 'center',
    marginBottom: 25,
  },
  qrImage: { width: 180, borderRadius: 25, height: 115, marginBottom: 10 },
  qrText: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 16 },
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
});
