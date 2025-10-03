// File: screens/ProfileViewScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './contexts/LanguageContext';
import { DataCache, CACHE_KEYS } from '../utils/dataCache';
import { SafeSupabase } from '../utils/safeSupabase';
import EmptyUserProfile from '../components/EmptyUserProfile';

export default function ProfileViewScreen() {
  const [user, setUser] = useState<any>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        router.replace('/login');
        return;
      }

      try {
        // Use safe query to avoid .single() errors
        const userData = await SafeSupabase.getUserProfile(userId);
        if (userData) {
          setUser(userData);
        } else {
          console.log('User profile not found, this is normal for new users');
          // ไม่แสดง error ให้ผู้ใช้ เพราะเป็นเรื่องปกติที่ user ใหม่ยังไม่มีข้อมูล
        }
      } catch (error) {
        console.log('User profile not found, this is normal for new users');
        // ไม่แสดง error ให้ผู้ใช้ เพราะเป็นเรื่องปกติที่ user ใหม่ยังไม่มีข้อมูล
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyUserProfile />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.header}>{t('profileview.title')}</Text>
      <View style={styles.profileSection}>
        <Image
          source={user.profile_image_url ? { uri: user.profile_image_url } : require('../assets/images/logo.png')}
          style={styles.profileImage}
          onError={(error) => {
            console.error('Image load error:', error);
          }}
          onLoad={() => {
            console.log('Image loaded successfully:', user.profile_image_url);
          }}
        />
        <Text style={styles.userName}>{user.full_name || t('profileview.user_fallback')}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>
      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Ionicons name="call-outline" size={20} color="#1A3C6B" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoLabel}>{t('profileview.phone')}</Text>
            <Text style={styles.infoValue}>{user.phone_number || 'N/A'}</Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="cash-outline" size={20} color="#1A3C6B" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoLabel}>{t('profileview.currency')}</Text>
            <Text style={styles.infoValue}>{user.currency_preference || 'THB'}</Text>
          </View>
        </View>
        
        <View style={[styles.infoItem, { borderBottomWidth: 0 }]}>
          <Ionicons name="language-outline" size={20} color="#1A3C6B" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoLabel}>{t('profileview.language')}</Text>
            <Text style={styles.infoValue}>
              {user.language_preference === 'TH' ? 'ไทย' : 'English'}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.editButton} onPress={() => router.push('/ProfileEdit')}>
        <Text style={styles.editButtonText}>{t('profileview.edit')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>{t('profileview.logout')}</Text>
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
    color: '#1A3C6B' 
  },
  profileSection: { alignItems: 'center', marginVertical: 20 },
  profileImage: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center', marginVertical: 20 },
  userName: { 
    fontSize: 20, 
    fontFamily: 'Prompt-Medium',
    fontWeight: '600', 
    textAlign: 'center', 
    marginBottom: 5,
    color: '#1A3C6B' 
  },
  userEmail: { 
    fontSize: 16, 
    fontFamily: 'Prompt-Medium',
    color: '#666', 
    textAlign: 'center', 
    marginBottom: 20 
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoIcon: {
    marginRight: 15,
    width: 24,
    textAlign: 'center',
  },
  infoLabel: {
    fontSize: 16, 
    fontFamily: 'Prompt-Regular',
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#1A3C6B',
    fontFamily: 'Prompt-Medium',
    fontWeight: '500',
  },
  editButton: { backgroundColor: '#3f5b78', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  editButtonText: { color: '#fff', fontWeight: 'bold' },
  logoutButton: { backgroundColor: '#222', padding: 14, borderRadius: 10, alignItems: 'center' },
  logoutButtonText: { color: '#fff', fontWeight: 'bold' },
});
