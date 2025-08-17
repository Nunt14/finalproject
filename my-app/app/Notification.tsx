// นำเข้า React และ components ที่จำเป็น
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';
import { supabase } from '../constants/supabase';

// Type definitions
interface Notification {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  trip_id?: string;
  created_at: string;
}

interface NotificationGroup {
  title: string;
  data: Notification[];
}

// หน้าจอการแจ้งเตือน (Notification Screen)
export default function NotificationScreen() {
  // ใช้ navigation hook สำหรับการนำทางระหว่างหน้าจอ
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Notification'>>();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  // รีเฟรชทุกครั้งเมื่อหน้าได้รับโฟกัส
  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [])
  );

  // Polling แบบง่ายทุก 10 วินาที
  useEffect(() => {
    const id = setInterval(() => {
      fetchNotifications();
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      // ตรวจสอบ session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        Alert.alert('Error', 'กรุณาเข้าสู่ระบบก่อน');
        return;
      }
      
      const currentUserId = session.user.id;
      setUserId(currentUserId);

      // ดึงการแจ้งเตือนจากฐานข้อมูล (แบบง่าย)
      const { data, error } = await supabase
        .from('notification')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // ตั้งค่าการแจ้งเตือนโดยตรง (ไม่ต้องดึงข้อมูล sender แยก)
      setNotifications(data || []);
    } catch (err) {
      console.error('Fetch notifications error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดการแจ้งเตือนได้');
    } finally {
      setLoading(false);
    }
  };

  // สมัครรับเหตุการณ์ realtime เมื่อมีการเพิ่ม/อัปเดตการแจ้งเตือนของผู้ใช้คนนี้
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const row = payload.new as any;
          setNotifications(prev => [{
            notification_id: row.notification_id,
            user_id: row.user_id,
            title: row.title,
            message: row.message,
            is_read: row.is_read,
            trip_id: row.trip_id ?? undefined,
            created_at: row.created_at,
          } as Notification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notification', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const row = payload.new as any;
          setNotifications(prev => prev.map(n => n.notification_id === row.notification_id ? {
            ...n,
            title: row.title,
            message: row.message,
            is_read: row.is_read,
            trip_id: row.trip_id ?? undefined,
            created_at: row.created_at,
          } : n));
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notification')
        .update({ is_read: true })
        .eq('notification_id', notificationId);

      if (error) throw error;

      // อัปเดตสถานะใน state
      setNotifications(prev => 
        prev.map(notif => 
          notif.notification_id === notificationId 
            ? { ...notif, is_read: true }
            : notif
        )
      );
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  };

  const handleOpenNotification = async (item: Notification) => {
    await markAsRead(item.notification_id);
    const title = (item.title || '').toLowerCase();
    const message = (item.message || '').toLowerCase();
    // หากเป็นเรื่องเพื่อน ให้พาไปหน้า AddFriends
    if (title.includes('เพื่อน') || message.includes('เพื่อน')) {
      // @ts-ignore: our navigator supports this route
      navigation.navigate('AddFriends');
      return;
    }
    // หากเป็นทริปหรือบิล และมี trip_id ให้พาไปหน้า Trip ของทริปนั้นทันที
    if (item.trip_id && (title.includes('ทริป') || message.includes('ทริป') || title.includes('บิล') || message.includes('บิล'))) {
      // @ts-ignore: our navigator supports this route
      navigation.navigate('Trip', { tripId: item.trip_id });
      return;
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const getNotificationIcon = (item: Notification) => {
      // ใช้ title หรือ message เพื่อระบุประเภทการแจ้งเตือน
      const title = item.title?.toLowerCase() || '';
      const message = item.message?.toLowerCase() || '';
      
      if (title.includes('เพื่อน') || message.includes('เพื่อน')) {
        if (title.includes('ตอบรับ') || message.includes('ตอบรับ')) {
          return { name: 'checkmark-circle' as const, color: '#2196F3' };
        } else {
          return { name: 'person-add' as const, color: '#4CAF50' };
        }
      } else if (title.includes('ทริป') || message.includes('ทริป')) {
        return { name: 'car' as const, color: '#FF9800' };
      } else if (title.includes('เงิน') || message.includes('เงิน')) {
        return { name: 'card' as const, color: '#4CAF50' };
      } else {
        return { name: 'notifications' as const, color: '#9C27B0' };
      }
    };

    const getNotificationText = (item: Notification) => {
      // ใช้ title และ message ที่มีอยู่แล้ว
      if (item.title && item.message) {
        return `${item.title}: ${item.message}`;
      } else if (item.title) {
        return item.title;
      } else if (item.message) {
        return item.message;
      } else {
        return 'การแจ้งเตือนใหม่';
      }
    };

    const icon = getNotificationIcon(item);
    const notificationText = getNotificationText(item);
    const isUnread = !item.is_read;

    return (
      <View style={[styles.notificationItem, isUnread && styles.unreadNotification]}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => handleOpenNotification(item)}>
          <View style={[styles.profileIcon, { backgroundColor: icon.color }]}>
            <Ionicons name={icon.name} size={20} color="white" />
          </View>
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationText, isUnread && styles.unreadText]}>
              {notificationText}
            </Text>
            <Text style={styles.timeText}>
              {new Date(item.created_at).toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        </TouchableOpacity>
        {isUnread && <View style={styles.unreadDot} />}
      </View>
    );
  };

  const groupedNotifications = (): NotificationGroup[] => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayNotifications = notifications.filter(notif => {
      const notifDate = new Date(notif.created_at);
      return notifDate.toDateString() === today.toDateString();
    });

    const yesterdayNotifications = notifications.filter(notif => {
      const notifDate = new Date(notif.created_at);
      return notifDate.toDateString() === yesterday.toDateString();
    });

    const olderNotifications = notifications.filter(notif => {
      const notifDate = new Date(notif.created_at);
      return notifDate < yesterday;
    });

    return [
      { title: 'Today', data: todayNotifications },
      { title: 'Yesterday', data: yesterdayNotifications },
      { title: 'Earlier', data: olderNotifications }
    ].filter(group => group.data.length > 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#45647C" />
        <Text style={styles.loadingText}>กำลังโหลดการแจ้งเตือน...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ส่วนหัวของหน้าจอ */}
      <View style={styles.header}>
        {/* ปุ่มย้อนกลับ */}
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        {/* ชื่อหน้าจอ */}
        <Text style={styles.headerTitle}>Notification</Text>
        {/* ตัวช่วยจัดตำแหน่งให้ชื่ออยู่ตรงกลาง */}
        <View style={styles.headerSpacer} />
      </View>

      {/* ส่วนเนื้อหาหลักที่สามารถเลื่อนได้ */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off" size={64} color="#ccc" />
          <Text style={styles.emptyText}>ไม่มีการแจ้งเตือน</Text>
          <Text style={styles.emptySubText}>คุณจะเห็นการแจ้งเตือนที่นี่เมื่อมีกิจกรรมใหม่</Text>
        </View>
      ) : (
        <FlatList
          data={groupedNotifications()}
          keyExtractor={(item, index) => `group-${index}`}
          renderItem={({ item: group }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{group.title}</Text>
              {group.data.map((notification) => (
                <View key={notification.notification_id}>
                  {renderNotificationItem({ item: notification })}
                </View>
              ))}
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        />
      )}

      {/* ภาพประกอบภูเขาด้านล่าง */}
      <View style={styles.mountainContainer}>
        <Image
          source={require('../assets/images/bg.png')}
          style={styles.mountainImage}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

// สไตล์ของคอมโพเนนต์ทั้งหมด
const styles = StyleSheet.create({
  // คอนเทนเนอร์หลัก
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // ส่วนหัวของหน้าจอ
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
  // ชื่อหน้าจอ
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
  // ตัวช่วยจัดตำแหน่งให้ชื่ออยู่ตรงกลาง
  headerSpacer: {
    width: 24,
  },
  // ส่วนเนื้อหาหลัก
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // ส่วนของแต่ละหมวดหมู่
  section: {
    marginTop: 20,
  },
  // ชื่อหมวดหมู่
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 15,
  },
  // รายการการแจ้งเตือนแต่ละรายการ
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  
  // ไอคอนโปรไฟล์
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  // เนื้อหาการแจ้งเตือน
  notificationContent: {
    flex: 1,
  },
  // ข้อความการแจ้งเตือน
  notificationText: {
    fontSize: 14,
    color: 'black',
    lineHeight: 20,
  },
  // ชื่อผู้ใช้ (ตัวหนา)
  nameText: {
    fontWeight: '600',
  },
  // ชื่อทริป (สีน้ำเงิน)
  tripText: {
    color: '#1A3C6B',
    fontWeight: '600',
  },
  // จำนวนเงิน (สีเขียว)
  amountText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  // ปุ่มดูรายละเอียด
  viewButton: {
    backgroundColor: '#1A3C6B',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  // ข้อความในปุ่มดูรายละเอียด
  viewButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // คอนเทนเนอร์ของภาพประกอบภูเขา
  mountainContainer: {
    height: 200,
    marginTop: 40,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
  },
  // รูปภูเขาพื้นหลัง
  mountainImage: {
    width: '100%',
    height: '100%',
  },
  // สถานะการแจ้งเตือนที่ไม่อ่าน
  unreadNotification: {
    backgroundColor: '#f0f0f0', // สีพื้นหลังที่ไม่อ่าน
  },
  // ข้อความการแจ้งเตือนที่ไม่อ่าน
  unreadText: {
    fontWeight: '600', // ตัวหนา
  },
  // จุดสัญญาณที่ไม่อ่าน
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B', // สีจุดที่ไม่อ่าน
    marginLeft: 10,
  },
  // สถานะการโหลด
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  // ข้อความการโหลด
  loadingText: {
    marginTop: 10,
    color: '#45647C',
  },
  // คอนเทนเนอร์ที่ว่าง
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    backgroundColor: '#fff',
  },
  // ข้อความที่ว่าง
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  // ข้อความย่อยที่ว่าง
  emptySubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  // ข้อความเวลา
  timeText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
   
});
