import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../constants/supabase';

export default function FriendProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    fetchFriendProfile();
  }, [userId]);

  const fetchFriendProfile = async () => {
    try {
      setLoading(true);
      
      // ตรวจสอบ session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        Alert.alert('Error', 'กรุณาเข้าสู่ระบบก่อน');
        router.replace('/login');
        return;
      }
      
      const currentUser = session.user.id;
      setCurrentUserId(currentUser);

      // ดึงข้อมูลเพื่อน
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      setFriend(data);
    } catch (err) {
      console.error('Fetch friend profile error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลเพื่อนได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFriend = async () => {
    Alert.alert(
      'ยืนยันการลบเพื่อน',
      'คุณต้องการลบเพื่อนคนนี้ออกจากรายการเพื่อนหรือไม่?',
      [
        {
          text: 'ยกเลิก',
          style: 'cancel',
        },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // ลบความสัมพันธ์เพื่อนจากตาราง friends
              const { error: deleteError1 } = await supabase
                .from('friends')
                .delete()
                .eq('user_one_id', currentUserId)
                .eq('user_two_id', userId);
              
              const { error: deleteError2 } = await supabase
                .from('friends')
                .delete()
                .eq('user_one_id', userId)
                .eq('user_two_id', currentUserId);

              if (deleteError1 || deleteError2) {
                throw new Error(deleteError1?.message || deleteError2?.message);
              }

              Alert.alert('สำเร็จ', 'ลบเพื่อนแล้ว', [
                {
                  text: 'ตกลง',
                  onPress: () => router.back(),
                },
              ]);
            } catch (err) {
              console.error('Delete friend error:', err);
              Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบเพื่อนได้: ' + err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#45647C" />
        <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  if (!friend) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>ไม่พบข้อมูลเพื่อน</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>โปรไฟล์เพื่อน</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Image */}
        <View style={styles.profileImageContainer}>
          {friend.profile_image_url ? (
            <Image source={{ uri: friend.profile_image_url }} style={styles.profileImage} />
          ) : (
            <View style={styles.defaultProfileImage}>
              <Text style={styles.defaultProfileText}>
                {friend.full_name ? friend.full_name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{friend.full_name || 'ไม่มีชื่อ'}</Text>
          
          {friend.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call" size={20} color="#666" style={styles.infoIcon} />
              <Text style={styles.infoText}>{friend.phone}</Text>
            </View>
          )}

          {friend.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={20} color="#666" style={styles.infoIcon} />
              <Text style={styles.infoText}>{friend.email}</Text>
            </View>
          )}

          {friend.birth_date && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color="#666" style={styles.infoIcon} />
              <Text style={styles.infoText}>
                {new Date(friend.birth_date).toLocaleDateString('th-TH')}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.messageButton}>
            <Ionicons name="chatbubble" size={20} color="#fff" />
            <Text style={styles.buttonText}>ส่งข้อความ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteFriend}>
            <Ionicons name="trash" size={20} color="#fff" />
            <Text style={styles.buttonText}>ลบเพื่อน</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Background Image */}
      <View style={styles.backgroundContainer}>
        <Image
          source={require('../assets/images/bg.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    color: '#45647C',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 24,
  },
  backButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileImageContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#45647C',
  },
  defaultProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#45647C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#45647C',
  },
  defaultProfileText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    marginBottom: 40,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  infoIcon: {
    marginRight: 15,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  messageButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  backgroundContainer: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    marginTop: 20,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
});
