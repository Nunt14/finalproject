import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [defaultImageColor, setDefaultImageColor] = useState<string>('#5DADE2');

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        encoding: 'base64',
      });
      const arrayBuffer = decodeBase64(base64);

      const extensionMatch = imageUri.match(/\.([a-zA-Z0-9]+)$/);
      const extension = (extensionMatch ? extensionMatch[1] : 'jpg').toLowerCase();
      const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
      const filename = `${uuidv4()}.${extension}`;
      const filePath = `${pathPrefix}/${filename}`;

      const { data, error } = await supabase
        .storage
        .from('trips')
        .upload(filePath, arrayBuffer, {
          cacheControl: '3600',
          upsert: false,
          contentType,
        });

      if (error) throw error;
      
      const { data: publicUrl } = supabase
        .storage
        .from('trips')
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

    setLoading(true);
    try {
      // 1) สร้างทริปก่อน (ยังไม่ใส่รูปภาพ)
      const { data: tripData, error: tripError } = await supabase
        .from('trip')
        .insert({
          trip_name: tripName,
          created_by: userId,
          trip_status: 'active',
          // trip_color: selectedImage ? null : defaultImageColor, // เก็บสีถ้าไม่มีรูป (ปิดชั่วคราว)
        })
        .select();

      if (tripError) throw tripError;

      const newTripId = tripData && tripData[0]?.trip_id;
      if (!newTripId) {
        throw new Error('ไม่พบรหัสทริปที่สร้าง');
      }

      // 2) อัปโหลดรูปภาพไปยังโฟลเดอร์ของทริป แล้วอัปเดต URL ลงทริป (ถ้ามี)
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage as string, `trips/${newTripId}`);
        if (!imageUrl) {
          throw new Error('อัปโหลดรูปภาพไม่สำเร็จ');
        }

        const { error: updateTripError } = await supabase
          .from('trip')
          .update({ trip_image_url: imageUrl })
          .eq('trip_id', newTripId);
        if (updateTripError) throw updateTripError;
      }

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
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#1A3C6B', '#45647C', '#6B8E9C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('addtrip.header')}</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Image Upload Section */}
        <View style={styles.imageSection}>
          <Text style={styles.sectionTitle}>Cover Image</Text>
          <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.tripImage} />
            ) : (
              <View style={[styles.defaultImageContainer, { backgroundColor: defaultImageColor }]}>
                <View style={styles.cameraIconContainer}>
                  <View style={styles.cameraIconBackground}>
                    <Ionicons name="camera" size={32} color="#fff" />
                  </View>
                  <Text style={styles.cameraIconText}>Add Photo</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
          {!selectedImage && (
            <View style={styles.colorPickerContainer}>
              <Text style={styles.colorPickerLabel}>Choose default color:</Text>
              <View style={styles.colorOptions}>
                {['#5DADE2', '#F39C12', '#F5B7B1', '#E74C3C', '#58D68D', '#BB8FCE'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      defaultImageColor === color && styles.colorOptionSelected
                    ]}
                    onPress={() => setDefaultImageColor(color)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Title input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t('addtrip.title_label')}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              value={tripName}
              onChangeText={setTripName}
              style={styles.input}
              placeholder={t('addtrip.title_placeholder')}
              placeholderTextColor="#999"
            />
          </View>
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
            </View>
          )}
        </View>

        {/* Bottom buttons - moved inside ScrollView */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmText}>{t('addtrip.confirm')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/welcome')}>
            <Text style={styles.backText}>{t('addtrip.back')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  headerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#fff',
    marginLeft: 10, 
    flex: 1, 
    textAlign: 'center' 
  },
  scrollView: { 
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 25,
    paddingHorizontal: 20,
    paddingBottom: 30, // ลดพื้นที่ด้านล่างเพราะปุ่มอยู่ใน ScrollView แล้ว
  },
  imageSection: {
    marginBottom: 35,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A3C6B',
    marginBottom: 20,
    textAlign: 'center',
  },
  imageBox: {
    alignSelf: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#1A3C6B',
    borderRadius: 20,
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginBottom: 20,
  },
  tripImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  cameraIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconBackground: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8F4FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cameraIconText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  defaultImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  colorPickerLabel: {
    fontSize: 14,
    color: '#1A3C6B',
    fontWeight: '600',
    marginBottom: 12,
  },
  colorOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  colorOptionSelected: {
    borderColor: '#1A3C6B',
    borderWidth: 3,
    elevation: 4,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  inputGroup: { 
    marginBottom: 30 
  },
  label: { 
    fontSize: 16,
    fontWeight: 'bold', 
    color: '#1A3C6B',
    marginBottom: 12 
  },
  inputContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 5,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  input: { 
    fontSize: 16,
    paddingVertical: 12,
    color: '#333',
  },
  memberSection: { 
    marginBottom: 35 
  },
  memberScrollView: { 
    paddingVertical: 15,
    marginBottom: 20,
  },
  memberScrollContent: { 
    paddingHorizontal: 10 
  },
  memberAvatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  memberAvatarSelected: {
    borderWidth: 3,
    borderColor: '#1A3C6B',
    elevation: 4,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 27.5,
  },
  memberAvatarText: {
    fontSize: 20,
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
    marginBottom: 25,
    marginLeft: 10,
    padding: 15,
    borderRadius: 15,
    backgroundColor: '#f8f9fa',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1A3C6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: '#1A3C6B',
    borderColor: '#1A3C6B',
  },
  everyoneLabel: { 
    fontSize: 16, 
    color: '#1A3C6B',
    fontWeight: '600',
  },
  buttonContainer: { 
    marginTop: 30,
    marginBottom: 20,
  },
  confirmBtn: { 
    backgroundColor: '#1A3C6B', 
    padding: 18, 
    borderRadius: 25, 
    marginBottom: 15, 
    width: '100%',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  confirmText: { 
    color: '#fff', 
    textAlign: 'center', 
    fontWeight: 'bold',
    fontSize: 16,
  },
  backBtn: { 
    backgroundColor: '#6c757d', 
    padding: 18, 
    borderRadius: 25, 
    width: '100%',
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backText: { 
    color: '#fff', 
    textAlign: 'center', 
    fontWeight: 'bold',
    fontSize: 16,
  },
});
