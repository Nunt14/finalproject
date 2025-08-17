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

type Member = {
  user_id: string;
  full_name: string | null;
  profile_image_url: string | null;
};

export default function AddTripScreen() {
  const router = useRouter();
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
          Alert.alert('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบก่อนเพิ่มทริป');
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
        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลเพื่อนได้: ' + message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'กรุณาอนุญาตการเข้าถึงคลังรูปภาพเพื่อเลือกรูปภาพ');
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
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถอัปโหลดรูปภาพได้: ' + message);
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
      Alert.alert('ข้อผิดพลาด', 'กรุณาใส่ชื่อทริป');
      return;
    }
    if (!selectedImage) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาเลือกรูปภาพสำหรับทริป');
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
      
      Alert.alert('สำเร็จ', 'เพิ่มทริปเรียบร้อยแล้ว!');
      router.replace('/welcome');

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Confirm error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถสร้างทริปได้: ' + message);
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
        <Text style={styles.headerTitle}>Add new trip</Text>
      </View>

      {/* Camera Icon or Selected Image */}
      <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={styles.tripImage} />
        ) : (
          <MaterialIcons name="photo-camera" size={40} color="#1A3C6B" />
        )}
      </TouchableOpacity>

      {/* Title input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>title :</Text>
        <TextInput
          value={tripName}
          onChangeText={setTripName}
          style={styles.input}
          placeholder="Enter trip title"
        />
      </View>

      {/* Member section */}
      <Text style={styles.label}>Member :</Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#1A3C6B" />
      ) : (
        <View>
          {/* removed small horizontal avatar list per request */}
          <TouchableOpacity 
            style={styles.everyoneBox}
            onPress={handleSelectAll}
          >
            <Ionicons 
              name={selectAll ? "checkbox" : "square-outline"} 
              size={20} 
              color={selectAll ? "#1A3C6B" : "#888"}
            />
            <Text style={styles.everyoneLabel}>Everyone</Text>
          </TouchableOpacity>
          {/* รายชื่อเพื่อนแบบมีชื่อและรูปโปรไฟล์ให้เลือก */}
          <View style={styles.memberList}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {members.map((member) => {
              const isSelected = selectedMembers.includes(member.user_id);
              return (
                <TouchableOpacity
                  key={member.user_id}
                  style={[styles.memberListItem, isSelected && styles.memberListItemSelected]}
                  onPress={() => handleMemberSelect(member.user_id)}
                >
                  {member.profile_image_url ? (
                    <Image source={{ uri: member.profile_image_url }} style={[styles.memberListAvatar, isSelected && styles.memberListAvatarSelected]} />
                  ) : (
                    <View style={[styles.memberListAvatarPlaceholder, isSelected && styles.memberListAvatarSelected]}>
                      <Text style={styles.memberListAvatarInitial}>
                        {member.full_name ? member.full_name.charAt(0) : '?'}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.full_name || 'Unnamed'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            </View>
          </View>
        </View>
      )}

      {/* Buttons */}
      <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={loading}>
        <Text style={styles.confirmText}>{loading ? 'Saving...' : 'Confirm'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/welcome')}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Decorative image */}
      <Image
        source={require('../assets/images/bg.png')}
        style={styles.bgImage}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, paddingHorizontal: 20, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  imageBox: {
    alignSelf: 'center',
    backgroundColor: '#9EC4C2',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  inputGroup: { marginBottom: 20 },
  label: { fontWeight: 'bold', marginBottom: 5 },
  input: { borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 5 },
  memberRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15, gap: 10 },
  memberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden', // เพิ่ม overflow เพื่อให้รูปภาพไม่เกินขอบ
  },
  selectedMember: {
    borderColor: '#1A3C6B',
  },
  memberText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  everyoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    marginLeft: 10,
    padding: 5,
    borderRadius: 5,
  },
  everyoneLabel: { fontSize: 14, color: '#888', marginLeft: 10 },
  confirmBtn: { backgroundColor: '#1A3C6B', padding: 15, borderRadius: 10, marginBottom: 10 },
  confirmText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  backBtn: { backgroundColor: '#333', padding: 15, borderRadius: 10 },
  backText: { color: '#fff', textAlign: 'center' },
  bgImage: { width: '111%', height: 235, bottom: -154, alignSelf: 'center' },
  memberList: { marginTop: 10 },
  memberListItem: {
    width: '33.33%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberListItemSelected: {
    backgroundColor: '#eef5ff',
    borderRadius: 10,
  },
  memberListAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 8,
  },
  memberListAvatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#bbb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  memberListAvatarInitial: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 28,
  },
  memberName: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 110,
  },
  memberListAvatarSelected: {
    borderWidth: 3,
    borderColor: '#1A3C6B',
  },
});
