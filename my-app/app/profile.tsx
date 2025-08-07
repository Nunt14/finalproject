import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { supabase } from '../constants/supabase';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('THB');
  const [language, setLanguage] = useState('TH');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [qrImage, setQRImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user) {
        const email = authUser.user.email;
        const { data } = await supabase
          .from('user')
          .select('*')
          .eq('email', email)
          .single();
        if (data) {
          setUser(data);
          setFullName(data.full_name || '');
          setPhone(data.phone_number || '');
          setCurrency(data.currency_preference || 'THB');
          setLanguage(data.language_preference || 'TH');
          setProfileImage(data.profile_image || null);
          setQRImage(data.qr_image || null);
        }
      }
    };
    fetchUser();
  }, []);

  const handleImagePick = async (type: 'profile' | 'qr') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const imageUri = result.assets[0].uri;

      if (type === 'profile') {
        setProfileImage(imageUri);
        await supabase.from('user').update({ profile_image: imageUri }).eq('user_id', user.user_id);
      } else if (type === 'qr') {
        setQRImage(imageUri);
        await supabase.from('user').update({ qr_image: imageUri }).eq('user_id', user.user_id);
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
      setEditMode(false);
    }
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
            source={profileImage ? { uri: profileImage } : require('../assets/images/logo.png')}
            style={styles.profileImage}
          />
          <TouchableOpacity style={styles.cameraIcon} onPress={() => handleImagePick('profile')}>
            <Ionicons name="camera" size={18} color="#000" />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{fullName || 'User'}</Text>
        <Text style={styles.email}>{user?.email || 'user@email.com'}</Text>
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
          <Text style={styles.value}>**********</Text>
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
          <Text style={styles.qrText}>QR ของคุณได้ถูกสร้างขึ้นแล้ว{'\n'}ผู้ใช้งานสามารถสแกนเพื่อชำระเงินได้</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            <Text style={styles.qrSubText}>ชื่อบัญชี{'\n'}เลขบัญชี</Text>
            <Text style={[styles.qrSubText, { color: '#3366cc', textAlign: 'right' }]}>นับถือศา บลอคเจีย{'\n'}080-987-4366</Text>
          </View>
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

        {/* TRIP HISTORY */}
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={18} color="#3f5b78" style={styles.iconLeft} />
          <Text style={styles.label}>Trip History</Text>
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
    marginBottom: 10 ,
    
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
  qrSubText: { fontSize: 12, color: '#333' },
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