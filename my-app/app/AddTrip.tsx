import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import * as ImagePicker from 'expo-image-picker';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function AddTripScreen() {
  const router = useRouter();
  const [tripName, setTripName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [userId, setUserId] = useState(null);

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

        // ดึงรายชื่อเพื่อนของผู้ใช้ปัจจุบัน (ใช้ชื่อตาราง 'friend' ตัวเล็ก)
        // ** แก้ไข: ใช้ 'user_id' และเลือก 'friend_email' ตามโครงสร้างฐานข้อมูลใหม่
        const { data: friendsData, error: friendsError } = await supabase
          .from('friend')
          .select('friend_email')
          .eq('user_id', currentUserId);
        
        if (friendsError) throw friendsError;

        if (friendsData.length > 0) {
          // ดึงข้อมูลเต็มของเพื่อนจากตาราง user โดยใช้ email ที่ได้
          const friendEmails = friendsData.map(friend => friend.friend_email);
          const { data: friendUsers, error: usersError } = await supabase
            .from('user')
            .select('user_id, full_name, profile_image_url')
            .in('email', friendEmails);
          
          if (usersError) throw usersError;
          setMembers(friendUsers);
        }

      } catch (err) {
        console.error('Fetch data error:', err);
        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลเพื่อนได้: ' + err.message);
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
      // ** แก้ไข: ใช้ ImagePicker.MediaType แทน ImagePicker.MediaTypeOptions
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (imageUri) => {
    if (!imageUri) return null;

    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const filename = `${uuidv4()}.png`;
      const filePath = `${userId}/${filename}`;

      const { data, error } = await supabase
        .storage
        .from('trip-images')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;
      
      const { data: publicUrl } = supabase
        .storage
        .from('trip-images')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;

    } catch (err) {
      console.error('Image upload error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถอัปโหลดรูปภาพได้: ' + err.message);
      return null;
    }
  };

  const handleMemberSelect = (memberId) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId));
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
      setSelectedMembers(members.map(member => member.user_id));
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
      // 1. อัปโหลดรูปภาพ
      const imageUrl = await uploadImage(selectedImage);
      if (!imageUrl) {
        setLoading(false);
        return;
      }

      // 2. เพิ่มข้อมูลทริปลงในตาราง trip (ใช้ชื่อตาราง 'trip' ตัวเล็ก)
      const { data: tripData, error: tripError } = await supabase
        .from('trip')
        .insert({
          trip_name: tripName,
          trip_image_url: imageUrl,
          created_by: userId,
          trip_status: 'active',
          location: 'default location', // ใส่ค่าเริ่มต้นหรือค่าจริงตามต้องการ
          budget: 0, // ใส่ค่าเริ่มต้นหรือค่าจริงตามต้องการ
        })
        .select();

      if (tripError) throw tripError;

      const newTripId = tripData[0].trip_id;

      // 3. เพิ่มข้อมูลสมาชิกในทริปลงในตาราง trip_member (ใช้ชื่อตาราง 'trip_member' ตัวเล็ก)
      const membersToInsert = [
        { trip_id: newTripId, user_id: userId, is_admin: true, is_active: true }, // ผู้สร้างทริปเป็น admin
        ...selectedMembers.map(memberId => ({
          trip_id: newTripId,
          user_id: memberId,
          is_admin: false,
          is_active: true,
        }))
      ];
      
      const { error: membersError } = await supabase
        .from('trip_member')
        .insert(membersToInsert);
      
      if (membersError) throw membersError;
      
      Alert.alert('สำเร็จ', 'เพิ่มทริปเรียบร้อยแล้ว!');
      router.replace('/welcome');

    } catch (err) {
      console.error('Confirm error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถสร้างทริปได้: ' + err.message);
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
          <View style={styles.memberRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {members.map((member) => (
                <TouchableOpacity
                  key={member.user_id}
                  style={[
                    styles.memberCircle,
                    selectedMembers.includes(member.user_id) && styles.selectedMember
                  ]}
                  onPress={() => handleMemberSelect(member.user_id)}
                >
                  {member.profile_image_url ? (
                    <Image source={{ uri: member.profile_image_url }} style={styles.profileImage} />
                  ) : (
                    <Text style={styles.memberText}>
                      {member.full_name ? member.full_name.charAt(0) : '?'}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.memberCircle,
                  { backgroundColor: '#ccc' },
                  selectedMembers.length === 0 && !selectAll && styles.selectedMember
                ]}
              >
                <Ionicons name="person-add-sharp" size={20} color="#666" />
              </TouchableOpacity>
            </ScrollView>
          </View>
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
});
