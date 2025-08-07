import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { supabase } from '../constants/supabase';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('THB');
  const [language, setLanguage] = useState('TH');
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    // ดึงข้อมูล user จาก supabase
    const fetchUser = async () => {
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user) {
        const email = authUser.user.email;
        const { data, error } = await supabase
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
        }
      }
    };
    fetchUser();
  }, []);

  const handleSave = async () => {
    if (!user || !user.user_id) return;
    const { error } = await supabase
      .from('user')
      .update({
        full_name: fullName,
        phone_number: phone,
        currency_preference: currency,
        language_preference: language,
        profile_image: profileImage,
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
      <Text style={styles.header}>Account</Text>
      <View style={styles.profileSection}>
        <View style={styles.profileImageWrapper}>
          <Image
            source={profileImage ? { uri: profileImage } : require('../assets/images/logo.png')}
            style={styles.profileImage}
          />
          <TouchableOpacity style={styles.cameraIcon}>
            <Text style={{ fontSize: 18 }}>📷</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{fullName || 'User'}</Text>
        <Text style={styles.email}>{user && user.email ? user.email : 'user@email.com'}</Text>
      </View>
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Phone number</Text>
          <Text style={styles.value}>{phone || '089-xxx-xxxx'}</Text>
          <TouchableOpacity style={styles.editIcon} onPress={() => setEditMode(true)}>
            <Text>✏️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Password</Text>
          <Text style={styles.value}>**********</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Your Payment</Text>
          <View style={styles.qrBox}>
            <Text style={styles.qrText}>บัญชีผู้รับ: เทสบัญชี
พร้อมเพย์ เบอร์มือถือ
080-987-4366</Text>
          </View>
          <TouchableOpacity style={styles.editIcon} onPress={() => setEditMode(true)}>
            <Text>✏️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Default currency</Text>
          <Text style={styles.value}>{currency}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Trip History</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Language</Text>
          <Text style={styles.value}>{language}</Text>
        </View>
      </View>
      {editMode && (
        <View style={styles.editSection}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.editButton} onPress={() => setEditMode(true)}>
        <Text style={styles.editButtonText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
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
  editIcon: { marginLeft: 8 },
  qrBox: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 5 },
  qrImage: { width: 120, height: 120, marginBottom: 5 },
  qrText: { fontSize: 12, color: '#666', textAlign: 'center' },
  editSection: { marginBottom: 20 },
  input: { borderColor: '#ddd', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 10, backgroundColor: '#f5f5f5' },
  saveButton: { backgroundColor: '#3f5b78', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  editButton: { backgroundColor: '#3f5b78', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  editButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  logoutButton: { backgroundColor: '#222', padding: 14, borderRadius: 10, alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
