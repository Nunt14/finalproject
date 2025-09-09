import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from './contexts/LanguageContext';

type Member = {
  user_id: string;
  full_name: string | null;
  profile_image_url: string | null;
};

export default function AddTripScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tripName, setTripName] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  // ดึงข้อมูลผู้ใช้ปัจจุบันและเพื่อนเมื่อหน้าจอโหลด
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          Alert.alert('Error', 'Please sign in before creating a trip');
          router.replace('/login');
          return;
        }

        const currentUserId = session.user.id;
        setUserId(currentUserId);

        // ดึงรายชื่อเพื่อนที่ยืนยันแล้วจากตาราง 'friends'
        const { data: friendsRows, error: friendsError } = await supabase
          .from('friends')
          .select('user_two_id, user_one_id')
          .or(`user_one_id.eq.${currentUserId},user_two_id.eq.${currentUserId}`);

        if (friendsError) throw friendsError;

        const friendIds = (friendsRows || []).map((f: any) => (
          f.user_two_id === currentUserId ? f.user_one_id : f.user_two_id
        ));
        const uniqueFriendIds = Array.from(new Set(friendIds)).filter(Boolean);

        if (uniqueFriendIds.length > 0) {
          const { data: friendUsers, error: usersError } = await supabase
            .from('user')
            .select('user_id, full_name, profile_image_url')
            .in('user_id', uniqueFriendIds);

          if (usersError) throw usersError;
          setMembers((friendUsers || []).map((u: any) => ({
            user_id: String(u.user_id),
            full_name: u.full_name ?? null,
            profile_image_url: u.profile_image_url ?? null,
          })) as Member[]);
        } else {
          setMembers([]);
        }

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Fetch data error:', err);
        Alert.alert('Error', 'Failed to load friends: ' + message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access to pick an image');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]?.uri ?? null);
    }
  };

  const uploadImage = async (imageUri: string, pathPrefix: string): Promise<string | null> => {
    if (!imageUri) return null;

    try {
      // อ่านไฟล์เป็น base64 แล้วแปลงเป็น ArrayBuffer (สำหรับ React Native)
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decodeBase64(base64);

      const extensionMatch = imageUri.match(/\.([a-zA-Z0-9]+)$/);
      const extension = (extensionMatch ? extensionMatch[1] : 'jpg').toLowerCase();
      const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const filename = `${uuidv4()}.${extension}`;
      const filePath = `${pathPrefix}/${filename}`;

      const { data, error } = await supabase
        .storage
        .from('Trip-image')
        .upload(filePath, arrayBuffer, {
          cacheControl: '3600',
          upsert: false,
          contentType,
        });

      if (error) throw error;
      
      const { data: publicUrl } = supabase
        .storage
        .from('Trip-image')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Image upload error:', err);
      Alert.alert('Error', 'Unable to upload image: ' + message);
      return null;
    }
  };

  const handleMemberSelect = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter((id: string) => id !== memberId));
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
    // ถ้ามีการเลือกสมาชิกทุกคนแบบ manual ให้เปลี่ยนสถานะ selectAll
    if (selectedMembers.length + 1 === members.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members.map((member: Member) => member.user_id));
    }
    setSelectAll(!selectAll);
  };

  const handleConfirm = async () => {
    if (!tripName.trim()) {
      Alert.alert('Error', 'Please enter a trip name');
      return;
    }
    if (!selectedImage) {
      Alert.alert('Error', 'Please select a cover image for the trip');
      return;
    }

    setLoading(true);
    try {
      // 1) สร้างทริปก่อน (ยังไม่ใส่รูปภาพ)
      const { data: tripData, error: tripError } = await supabase
        .from('trip')
        .insert({
          trip_name: tripName,
          created_by: userId,
          trip_status: 'active',
        })
        .select();

      if (tripError) throw tripError;

      const newTripId = tripData && tripData[0]?.trip_id;
      if (!newTripId) {
        throw new Error('ไม่พบรหัสทริปที่สร้าง');
      }

      // 2) อัปโหลดรูปภาพไปยังโฟลเดอร์ของทริป แล้วอัปเดต URL ลงทริป
      const imageUrl = await uploadImage(selectedImage as string, `trips/${newTripId}`);
      if (!imageUrl) {
        throw new Error('อัปโหลดรูปภาพไม่สำเร็จ');
      }

      const { error: updateTripError } = await supabase
        .from('trip')
        .update({ trip_image_url: imageUrl })
        .eq('trip_id', newTripId);
      if (updateTripError) throw updateTripError;

      // 3) เพิ่มข้อมูลสมาชิกในทริปลงในตาราง trip_member (ใช้ชื่อตาราง 'trip_member' ตัวเล็ก)
      const membersToInsert = [
        { trip_id: newTripId, user_id: userId, is_admin: true, is_active: true },
        ...selectedMembers.map((memberId: string) => ({
          trip_id: newTripId,
          user_id: memberId,
          is_admin: false,
          is_active: true, // no accept flow per new requirement
        }))
      ];
      
      const { error: membersError } = await supabase
        .from('trip_member')
        .insert(membersToInsert);
      
      if (membersError) throw membersError;
      
      // Create notifications for invited members (exclude creator)
      try {
        const invited = selectedMembers.filter((m) => m !== userId);
        if (invited.length > 0) {
          const notifications = invited.map((uid) => ({
            user_id: uid,
            title: 'ถูกเพิ่มเข้าทริปใหม่',
            message: `คุณถูกเพิ่มเข้าไปในทริป ${tripName}`,
            trip_id: String(newTripId),
            is_read: false,
          }));
          await supabase.from('notification').insert(notifications);
        }
      } catch (notifyErr) {
        console.warn('Notify trip members failed', notifyErr);
      }
      
      Alert.alert('Success', 'Trip created successfully!');
      router.replace('/welcome');

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Confirm error:', err);
      Alert.alert('Error', 'Failed to create trip: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('addtrip.header')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.scrollView}>
        {/* Camera Icon or Selected Image */}
        <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.tripImage} />
          ) : (
            <View style={styles.cameraIconContainer}>
              <MaterialIcons name="add-photo-alternate" size={36} color="#6b7280" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.helperText}>{t('') || 'Tap to add a cover image'}</Text>

        {/* Title input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('addtrip.title_label')}</Text>
          <TextInput
            value={tripName}
            onChangeText={setTripName}
            style={styles.input}
            placeholder={t('addtrip.title_placeholder')}
            placeholderTextColor="#999"
          />
        </View>

        {/* Member section */}
        <View style={styles.memberSection}>
          <Text style={styles.label}>{t('addtrip.member_label')}</Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#1A3C6B" />
          ) : (
            <View>
              {/* Member avatars in horizontal scroll */}
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.memberScrollView}
                contentContainerStyle={styles.memberScrollContent}
              >
                {members.map((member, index) => {
                  const isSelected = selectedMembers.includes(member.user_id);
                  const colors = ['#5DADE2', '#F39C12', '#F5B7B1', '#E74C3C'];
                  return (
                    <TouchableOpacity
                      key={member.user_id}
                      style={[
                        styles.memberAvatar,
                        { backgroundColor: colors[index % colors.length] },
                        isSelected && styles.memberAvatarSelected
                      ]}
                      onPress={() => handleMemberSelect(member.user_id)}
                    >
                      {member.profile_image_url ? (
                        <Image source={{ uri: member.profile_image_url }} style={styles.memberAvatarImage} />
                      ) : (
                        <Text style={styles.memberAvatarText}>
                          {member.full_name ? member.full_name.charAt(0).toUpperCase() : '?'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Everyone checkbox */}
              <TouchableOpacity 
                style={styles.everyoneBox}
                onPress={handleSelectAll}
              >
                <View style={[styles.checkbox, selectAll && styles.checkboxSelected]}>
                  {selectAll && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.everyoneLabel}>{t('addtrip.everyone')}</Text>
              </TouchableOpacity>

              <Image
                source={require('../assets/images/bg4.png')}
                style={styles.bg4Image}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </View>

      {/* Bottom buttons */}
      <View style={styles.buttonContainer} pointerEvents="box-none">
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={loading}>
          <Text style={styles.confirmText}>{loading ? t('addtrip.saving') : t('addtrip.confirm')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/welcome')}>
          <Text style={styles.backText}>{t('addtrip.back')}</Text>
        </TouchableOpacity>
      </View>

      {/* Background images */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 72, paddingHorizontal: 20, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10, flex: 1, textAlign: 'right' },
  scrollView: { flex: 1, paddingVertical: 20 },
  imageBox: {
    alignSelf: 'center',
    backgroundColor: '#f5f7f9',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 14,
    marginBottom: 10,
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  cameraIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: { marginBottom: 20 },
  label: { fontWeight: 'bold', marginBottom: 5 },
  input: { borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 5 },
  helperText: { color: '#6b7280', fontSize: 12, textAlign: 'center', marginBottom: 18 },
  memberSection: { marginBottom: 20 },
  memberScrollView: { paddingVertical: 10 },
  memberScrollContent: { paddingHorizontal: 10 },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarSelected: {
    borderWidth: 3,
    borderColor: '#1A3C6B',
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  moreIndicator: {
    backgroundColor: '#ddd',
  },
  moreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  everyoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    marginLeft: 10,
    padding: 5,
    borderRadius: 5,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxSelected: {
    backgroundColor: '#1A3C6B',
    borderColor: '#1A3C6B',
  },
  everyoneLabel: { fontSize: 14, color: '#888' },
  buttonContainer: { position: 'absolute', left: 20, right: 20, bottom: 20 },
  confirmBtn: { backgroundColor: '#1A3C6B', padding: 15, borderRadius: 10, marginBottom: 14, width: '100%' },
  confirmText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  backBtn: { backgroundColor: '#333', padding: 15, borderRadius: 10, width: '100%' , marginBottom: 30, },
  backText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  bg4Image: { alignSelf: 'center', width: 380, height: 135, marginTop: 15 },
});
