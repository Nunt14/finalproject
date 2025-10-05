// นำเข้า React และ components ที่จำเป็น
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, FlatList, 
  ActivityIndicator, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';
import { supabase } from '../constants/supabase';
import { useLanguage } from './contexts/LanguageContext';

// Type definitions
interface Notification {
  notification_id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  trip_id?: string;
  created_at: string;
  data?: {
    amount?: string | number;
    trip_name?: string;
    [key: string]: any; // For any additional dynamic properties
  };
}

interface NotificationGroup {
  title: string;
  data: Notification[];
}

export default function NotificationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Notification'>>();
  const { t } = useLanguage();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { fetchNotifications(); }, []);
  useFocusEffect(React.useCallback(() => { fetchNotifications(); }, []));
  useEffect(() => { const id = setInterval(fetchNotifications, 10000); return () => clearInterval(id); }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        Alert.alert('Error', 'กรุณาเข้าสู่ระบบก่อน');
        return;
      }
      const currentUserId = session.user.id;
      setUserId(currentUserId);

      const { data, error } = await supabase
        .from('notification')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Fetch notifications error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดการแจ้งเตือนได้');
    } finally {
      setLoading(false);
    }
  };

  // ✅ realtime subscribe
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

    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notification')
        .update({ is_read: true })
        .eq('notification_id', notificationId);
      if (error) throw error;
      setNotifications(prev => prev.map(n => 
        n.notification_id === notificationId ? { ...n, is_read: true } : n
      ));
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  };

  const handleOpenNotification = async (item: Notification) => {
    await markAsRead(item.notification_id);
    const title = (item.title || '').toLowerCase();
    const message = (item.message || '').toLowerCase();
    if (title.includes('เพื่อน') || message.includes('เพื่อน')) {
      // @ts-ignore
      navigation.navigate('AddFriends'); return;
    }
    if (item.trip_id && (title.includes('ทริป') || message.includes('ทริป') || title.includes('บิล') || message.includes('บิล'))) {
      // @ts-ignore
      navigation.navigate('Trip', { tripId: item.trip_id }); return;
    }
  };

  // Map notification content to translation keys and extract variables
  const getNotificationDetails = (title: string, message: string, data: any = {}) => {
    const titleLower = title?.toLowerCase() || '';
    const messageLower = message?.toLowerCase() || '';
    let key = 'notifications.generic';
    const variables: Record<string, string> = {};
    
    // Extract amount from message if it contains numbers
    const amountMatch = message.match(/\d+(\.\d{1,2})?/);
    if (amountMatch) {
      variables.amount = amountMatch[0];
    }
    
    // Extract trip name from data or message
    if (data.trip_name) {
      variables.tripName = data.trip_name;
    } else {
      // Try to extract trip name from message (this is a simple example)
      const tripMatch = message.match(/ทริป(.+)/) || message.match(/trip(.+)/i);
      if (tripMatch && tripMatch[1]) {
        variables.tripName = tripMatch[1].trim();
      }
    }
    
    // Determine notification type
    if (titleLower.includes('เพื่อน') || messageLower.includes('เพื่อน')) {
      if (titleLower.includes('ตอบรับ') || messageLower.includes('ตอบรับ')) {
        key = 'notifications.friendRequestAccepted';
      } else {
        key = 'notifications.newFriendRequest';
      }
    } else if (titleLower.includes('บิล') || messageLower.includes('บิล')) {
      key = 'notifications.newBillInTrip';
    } else if (titleLower.includes('ทริป') || messageLower.includes('ทริป') || 
              titleLower.includes('trip') || messageLower.includes('trip')) {
      key = 'notifications.addedToNewTrip';
    } else if (titleLower.includes('เงิน') || messageLower.includes('เงิน') || 
              titleLower.includes('payment') || messageLower.includes('payment')) {
      key = 'notifications.payment';
    } else if (titleLower.includes('ยืนยัน') || messageLower.includes('ยืนยัน') || 
              titleLower.includes('confirmed') || messageLower.includes('confirmed')) {
      key = 'notifications.paymentConfirmed';
    }
    
    return { key, variables };
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const getNotificationIcon = (item: Notification) => {
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

    // Get notification details and variables
    const { key: translationKey, variables } = getNotificationDetails(
      item.title || '', 
      item.message || '',
      item.data || {}
    );
    
    // Get the translated text and replace variables
    let notificationText = t(translationKey);
    Object.entries(variables).forEach(([key, value]) => {
      notificationText = notificationText.replace(`{${key}}`, value);
    });
    
    const isUnread = !item.is_read;
    const icon = getNotificationIcon(item);

    return (
      <View style={[styles.notificationItem, isUnread && styles.unreadNotification]}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => handleOpenNotification(item)}>
          <View style={[styles.profileIcon, { backgroundColor: icon.color }]}>
            <Ionicons name={icon.name} size={20} color="white" />
          </View>
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationText, isUnread && styles.unreadText]}>{notificationText}</Text>
            <Text style={styles.timeText}>
              {new Date(item.created_at).toLocaleDateString('th-TH', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
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
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const todayNotifications = notifications.filter(n => new Date(n.created_at).toDateString() === today.toDateString());
    const yesterdayNotifications = notifications.filter(n => new Date(n.created_at).toDateString() === yesterday.toDateString());
    const olderNotifications = notifications.filter(n => new Date(n.created_at) < yesterday);
    return [
      { title: t('notify.group.today'), data: todayNotifications },
      { title: t('notify.group.yesterday'), data: yesterdayNotifications },
      { title: t('notify.group.earlier'), data: olderNotifications }
    ].filter(g => g.data.length > 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#45647C" />
        <Text style={styles.loadingText}>{t('notify.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notify.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off" size={64} color="#ccc" />
          <Text style={styles.emptyText}>{t('notify.empty.title')}</Text>
          <Text style={styles.emptySubText}>{t('notify.empty.subtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={groupedNotifications()}
          keyExtractor={(item, index) => `group-${index}`}
          renderItem={({ item: group }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{group.title}</Text>
              {group.data.map(n => (
                <View key={n.notification_id}>{renderNotificationItem({ item: n })}</View>
              ))}
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        />
      )}
    </View>
  );
}

// ✅ Styles
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    fontFamily: 'Prompt-Medium',
    backgroundColor: '#fff', // ใช้พื้นหลังสีขาวแทน
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
  headerTitle: { fontSize: 20, fontFamily: 'Prompt-Medium', fontWeight: 'bold', color: 'black', flex: 1, textAlign: 'right' },
  
  headerSpacer: { width: 24 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontFamily: 'Prompt-Medium', fontWeight: 'bold', color: 'black', marginBottom: 15 },

  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 15,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 15,
  },
  notificationContent: { flex: 1 },
  notificationText: { fontSize: 14, fontFamily: 'Prompt-Medium', color: 'black', lineHeight: 20 },
  unreadNotification: { backgroundColor: '#f9f9f9' },
  unreadText: { fontWeight: '600', fontFamily: 'Prompt-Medium' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B6B', marginLeft: 10 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#45647C', fontFamily: 'Prompt-Medium' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 20, fontFamily: 'Prompt-Medium', fontWeight: 'bold', color: '#333', marginTop: 20 },
  emptySubText: { fontSize: 14, fontFamily: 'Prompt-Medium', color: '#666', marginTop: 5, textAlign: 'center' },
  timeText: { 
    fontSize: 12, 
    fontFamily: 'Prompt-Medium', 
    color: '#888', 
    marginTop: 4 
  },
});
