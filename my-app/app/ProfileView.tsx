// File: screens/ProfileViewScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileViewScreen() {
  const [user, setUser] = useState<any>(null);

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
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.header}>Account</Text>
      <View style={styles.profileSection}>
        <Image
          source={user.profile_image ? { uri: user.profile_image } : require('../assets/images/logo.png')}
          style={styles.profileImage}
        />
        <Text style={styles.name}>{user.full_name || 'User'}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>
      <View style={styles.infoSection}>
        <Text style={styles.label}>Phone number: {user.phone_number || 'N/A'}</Text>
        <Text style={styles.label}>Currency: {user.currency_preference || 'THB'}</Text>
        <Text style={styles.label}>Language: {user.language_preference || 'TH'}</Text>
      </View>
      <TouchableOpacity style={styles.editButton} onPress={() => router.push('/ProfileEdit')}>
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
  backButton: { marginBottom: 10 },
  header: { fontSize: 22, fontWeight: 'bold', alignSelf: 'center' },
  profileSection: { alignItems: 'center', marginVertical: 20 },
  profileImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eee' },
  name: { fontSize: 18, fontWeight: 'bold', marginTop: 5 },
  email: { fontSize: 14, color: '#666' },
  infoSection: { marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 10 },
  editButton: { backgroundColor: '#3f5b78', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  editButtonText: { color: '#fff', fontWeight: 'bold' },
  logoutButton: { backgroundColor: '#222', padding: 14, borderRadius: 10, alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontWeight: 'bold' },
});
