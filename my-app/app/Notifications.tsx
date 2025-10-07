import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from './utils/fonts';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  sender_id: string;
  trip_id?: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserAndNotifications();
  }, []);

  const fetchUserAndNotifications = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        router.replace('/login');
        return;
      }

      setUserId(session.user.id);

      // Fetch notifications with sender information
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          title,
          message,
          sender_id,
          trip_id,
          is_read,
          created_at
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (notificationsError) throw notificationsError;

      if (notificationsData && notificationsData.length > 0) {
        // Get sender information for notifications that have sender_id
        const senderIds = notificationsData
          .filter(n => n.sender_id)
          .map(n => n.sender_id);

        if (senderIds.length > 0) {
          const { data: sendersData, error: sendersError } = await supabase
            .from('user')
            .select('user_id, full_name')
            .in('user_id', senderIds);

          if (sendersError) throw sendersError;

          // Map sender names to notifications
          const notificationsWithSenders = notificationsData.map(notification => ({
            ...notification,
            sender_name: sendersData?.find(s => s.user_id === notification.sender_id)?.full_name || 'Unknown User'
          }));

          setNotifications(notificationsWithSenders);
        } else {
          setNotifications(notificationsData);
        }
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // You might want to show an alert here
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (!error) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, is_read: true } : notif
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (!error) {
        setNotifications(prev =>
          prev.map(notif => ({ ...notif, is_read: true }))
        );
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read when pressed
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Handle different notification types
    switch (notification.type) {
      case 'friend_request':
        // Navigate to friend requests or accept/decline
        router.push('/AddFriends');
        break;
      case 'friend_accepted':
        router.push('/AddFriends');
        break;
      case 'trip_invite':
        if (notification.trip_id) {
          router.push(`/Trip?tripId=${notification.trip_id}`);
        }
        break;
      default:
        // Handle other types or just mark as read
        break;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.is_read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        <Ionicons
          name={getNotificationIcon(item.type)}
          size={24}
          color={!item.is_read ? '#1A3C6B' : '#888'}
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[
          styles.notificationTitle,
          !item.is_read && styles.unreadText
        ]}>
          {item.title}
        </Text>
        <Text style={[
          styles.notificationMessage,
          !item.is_read && styles.unreadText
        ]}>
          {item.message}
        </Text>
        <Text style={styles.notificationTime}>
          {formatTime(item.created_at)}
        </Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return 'person-add';
      case 'friend_accepted':
        return 'checkmark-circle';
      case 'trip_invite':
        return 'airplane';
      default:
        return 'notifications';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'เมื่อสักครู่';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} ชั่วโมงที่แล้ว`;
    } else {
      return date.toLocaleDateString('th-TH');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserAndNotifications();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
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
            <Text style={styles.headerTitle}>{t('notifications.title') || 'การแจ้งเตือน'}</Text>
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Text style={styles.markAllText}>{t('notifications.mark_all_read') || 'อ่านทั้งหมด'}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#45647C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1A3C6B', '#45647C', '#6B8E9C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('notifications.title') || 'การแจ้งเตือน'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#fff', marginRight: 10 }}>
              {t('notifications.mark_all_read') || 'อ่านทั้งหมด'}
            </Text>
            <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>{t('notifications.empty') || 'ไม่มีการแจ้งเตือน'}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginLeft: -30,
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  markAllText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 15,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  unreadNotification: {
    backgroundColor: '#f8f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#1A3C6B',
  },
  notificationIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
  },
  unreadText: {
    color: '#1A3C6B',
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1A3C6B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
});
