import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Fonts } from './utils/fonts';

// Component for rendering a single user item with actions
interface UserItemProps {
  user: {
    user_id: string;
    full_name: string;
    profile_image_url?: string;
  };
  type: string;
  handleAddFriend: (userId: string) => void;
  handleAcceptRequest: (userId: string) => void;
  handleDeclineRequest: (userId: string) => void;
  handleDeleteFriend: (userId: string) => void;
  loading: boolean;
  friendsList: any[];
  pendingRequests: any[];
  receivedRequests: any[];
}

const UserItem = React.memo(({ user, type, handleAddFriend, handleAcceptRequest, handleDeclineRequest, handleDeleteFriend, loading, friendsList, pendingRequests, receivedRequests }: UserItemProps) => {
  const { t } = useLanguage();
  const renderAction = () => {
    // Determine the action button/text based on the user's status
    // แก้ไขโดยใช้ optional chaining (?.) เพื่อป้องกัน TypeError หาก props เป็น undefined
    const isFriend = friendsList?.some(f => f.user_id === user.user_id);
    const isPending = pendingRequests?.some(r => r.user_id === user.user_id);
    const isReceived = receivedRequests?.some(r => r.user_id === user.user_id);

    if (type === 'search') {
      if (isFriend) {
        return (
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => handleDeleteFriend(user.user_id)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{t('friends.action.delete')}</Text>
          </TouchableOpacity>
        );
      }
      if (isPending) return <Text style={styles.pendingText}>{t('friends.action.pending')}</Text>;
      if (isReceived) {
        return (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.acceptButton, { marginRight: 5 }]} 
              onPress={() => handleAcceptRequest(user.user_id)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{t('friends.action.accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.declineButton} 
              onPress={() => handleDeclineRequest(user.user_id)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{t('friends.action.decline')}</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddFriend(user.user_id)}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{t('friends.action.add')}</Text>
        </TouchableOpacity>
      );
    }
    
    // Actions for pre-sorted lists
    if (type === 'friend') {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => handleDeleteFriend(user.user_id)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{t('friends.action.delete')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (type === 'pending') return <Text style={styles.pendingText}>{t('friends.action.pending')}</Text>;
    if (type === 'received') {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.acceptButton, { marginRight: 5 }]} 
            onPress={() => handleAcceptRequest(user.user_id)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{t('friends.action.accept')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.declineButton} 
            onPress={() => handleDeclineRequest(user.user_id)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{t('friends.action.decline')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };
  
  return (
    <View style={styles.friendItem}>
      {user.profile_image_url ? (
        <Image source={{ uri: user.profile_image_url }} style={styles.profileImage} />
      ) : (
        <View style={styles.friendIcon}>
          <Text style={styles.initialText}>{user.full_name ? user.full_name.charAt(0) : '?'}</Text>
        </View>
      )}
      <Text style={styles.friendName}>{user.full_name}</Text>
      {renderAction()}
    </View>
  );
});


export default function AddFriendsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState('friends');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
          Alert.alert('Error', 'กรุณาเข้าสู่ระบบก่อน');
          router.replace('/login');
          return;
        }
        const currentUserId = session.user.id;
        setUserId(currentUserId);
        
        // Fetch all friend-related data
        const { data: friendsData, error: friendsError } = await supabase
          .from('friends')
          .select('user_two_id, user_one_id')
          .or(`user_one_id.eq.${currentUserId},user_two_id.eq.${currentUserId}`); 
        if (friendsError) throw friendsError;
        
        // Use Set to deduplicate friend IDs
        const friendIdSet = new Set<string>();
        friendsData?.forEach(friend => {
          const friendId = friend.user_two_id === currentUserId ? friend.user_one_id : friend.user_two_id;
          friendIdSet.add(friendId);
        });
        const confirmedFriendIds = Array.from(friendIdSet);
        
        const { data: sentRequests, error: sentError } = await supabase
          .from('friend_requests')
          .select('receiver_id')
          .eq('sender_id', currentUserId)
          .eq('status', 'pending');
        if (sentError) throw sentError;
        const pendingRequestIds = sentRequests ? sentRequests.map(req => req.receiver_id) : [];
        
        const { data: receivedRequests, error: receivedError } = await supabase
          .from('friend_requests')
          .select('sender_id')
          .eq('receiver_id', currentUserId)
          .eq('status', 'pending');
        if (receivedError) throw receivedError;
        const receivedRequestIds = receivedRequests ? receivedRequests.map(req => req.sender_id) : [];

        const allUserIds = [...new Set([...confirmedFriendIds, ...pendingRequestIds, ...receivedRequestIds])];

        if (allUserIds.length > 0) {
          const { data: userData, error: userError } = await supabase
            .from('user')
            .select('user_id, full_name, profile_image_url')
            .in('user_id', allUserIds);

          if (userError) throw userError;

          const userMap = new Map(userData.map(user => [user.user_id, user]));

          setFriendsList(confirmedFriendIds.map(id => userMap.get(id)).filter(Boolean));
          setPendingRequests(pendingRequestIds.map(id => userMap.get(id)).filter(Boolean));
          setReceivedRequests(receivedRequestIds.map(id => userMap.get(id)).filter(Boolean));
        }

      } catch (err) {
        console.error('Fetch data error:', err);
        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [router]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(async () => {
      if (!searchQuery) {
        setSearchResults([]);
        return;
      }
      Keyboard.dismiss();
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user')
          .select('user_id, full_name, profile_image_url')
          .ilike('full_name', `%${searchQuery}%`)
          .neq('user_id', userId); 
        if (error) throw error;
        setSearchResults(data || []); 
      } catch (err: any) {
        console.error('Search user error:', err);
        Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการค้นหา');
      } finally {
        setLoading(false);
      }
    }, 500) as unknown as NodeJS.Timeout;

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, userId]);

  const handleAddFriend = async (receiverId: string) => {
    setLoading(true);
    try {
      // 1) เช็คว่าเป็นเพื่อนกันอยู่แล้วหรือไม่
      const { data: friendRows, error: friendCheckErr } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_one_id.eq.${userId},user_two_id.eq.${receiverId}),and(user_one_id.eq.${receiverId},user_two_id.eq.${userId})`);
      if (friendCheckErr) throw friendCheckErr;
      if (friendRows && friendRows.length > 0) {
        Alert.alert('แจ้งเตือน', 'คุณเป็นเพื่อนกันอยู่แล้ว');
        setLoading(false);
        return;
      }

      // 2) เช็คเฉพาะคำขอที่ยังค้างอยู่ (status = pending) เท่านั้น
      const { data: pendingRows, error: checkError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status') 
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${userId})`)
        .eq('status', 'pending');

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      if (pendingRows && pendingRows.length > 0) {
        const hasSent = pendingRows.some(r => r.sender_id === userId && r.receiver_id === receiverId);
        const hasReceived = pendingRows.some(r => r.sender_id === receiverId && r.receiver_id === userId);
        if (hasSent) {
          Alert.alert('แจ้งเตือน', 'คุณส่งคำขอนี้ไปแล้ว');
          setLoading(false);
          return;
        }
        if (hasReceived) {
          Alert.alert('แจ้งเตือน', 'มีคำขอจากผู้ใช้นี้อยู่แล้ว กรุณาไปที่คำขอที่ได้รับเพื่อยอมรับ');
          setLoading(false);
          return;
        }
      }

      // 3) พยายามสร้างคำขอใหม่ ถ้ามี record เดิม (unique) ให้สลับเป็นอัปเดตสถานะกลับไปเป็น pending
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: userId,
          receiver_id: receiverId,
          status: 'pending',
        });

      if (error) {
        // duplicate key จาก unique (sender_id, receiver_id)
        if ((error as any)?.code === '23505') {
          const { error: updateErr } = await supabase
            .from('friend_requests')
            .update({ status: 'pending', created_at: new Date().toISOString() })
            .eq('sender_id', userId)
            .eq('receiver_id', receiverId);
          if (updateErr) throw updateErr;
        } else {
          throw error as any;
        }
      }
      
      // แจ้งเตือนผู้รับผ่าน RPC (ใช้ SECURITY DEFINER บนฐานข้อมูล)
      const { error: notificationError } = await supabase.rpc('notify_user', {
        p_user_id: receiverId,
        p_title: 'คำขอเป็นเพื่อนใหม่',
        p_message: 'คุณได้รับคำขอเป็นเพื่อนใหม่',
        p_trip_id: null,
      });
      if (notificationError) console.error('Create notification error:', notificationError);
      
      const { data: newPendingUser, error: newPendingError } = await supabase
          .from('user')
          .select('user_id, full_name, profile_image_url')
          .eq('user_id', receiverId)
          .single();

      if (newPendingError) throw newPendingError;
      
      setPendingRequests([...pendingRequests, newPendingUser]);
      Alert.alert('สำเร็จ', 'ส่งคำขอเป็นเพื่อนเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error('Add friend error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถส่งคำขอเป็นเพื่อนได้: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('sender_id', senderId)
        .eq('receiver_id', userId);
      
      if (updateError) throw updateError;
      
      // Insert only one friendship record (bidirectional relationship)
      const { error: insertError } = await supabase
        .from('friends')
        .insert({ user_one_id: userId, user_two_id: senderId });
        
      if (insertError) throw insertError;

      // แจ้งเตือนผู้ส่งผ่าน RPC
      const { error: notificationError } = await supabase.rpc('notify_user', {
        p_user_id: senderId,
        p_title: 'คำขอเป็นเพื่อนถูกตอบรับ',
        p_message: 'คำขอเป็นเพื่อนของคุณถูกตอบรับแล้ว',
        p_trip_id: null,
      });
      if (notificationError) console.error('Create notification error:', notificationError);

      const acceptedUser = receivedRequests.find(user => user.user_id === senderId);
      
      setFriendsList([...friendsList, acceptedUser]);
      setReceivedRequests(receivedRequests.filter(user => user.user_id !== senderId));
      Alert.alert('สำเร็จ', 'คุณตอบรับคำขอเป็นเพื่อนแล้ว');
    } catch (err: any) {
      console.error('Accept request error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถยอมรับคำขอเป็นเพื่อนได้: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineRequest = async (senderId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('sender_id', senderId)
        .eq('receiver_id', userId);
        
      if (error) throw error;

      setReceivedRequests(receivedRequests.filter(user => user.user_id !== senderId));
      Alert.alert('สำเร็จ', 'คุณปฏิเสธคำขอเป็นเพื่อนแล้ว');

      // แจ้งเตือนผู้ส่งว่าโดนปฏิเสธ (ผ่าน RPC)
      const { error: notificationError } = await supabase.rpc('notify_user', {
        p_user_id: senderId,
        p_title: 'ปฏิเสธคำขอเป็นเพื่อน',
        p_message: 'คำขอเป็นเพื่อนของคุณถูกปฏิเสธ',
        p_trip_id: null,
      });
      if (notificationError) console.error('Create notification error:', notificationError);
    } catch (err: any) {
      console.error('Decline request error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถปฏิเสธคำขอเป็นเพื่อนได้: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFriend = async (friendId: string) => {
    setLoading(true);
    try {
      const { error: deleteError1 } = await supabase
        .from('friends')
        .delete()
        .eq('user_one_id', userId)
        .eq('user_two_id', friendId);
      const { error: deleteError2 } = await supabase
        .from('friends')
        .delete()
        .eq('user_one_id', friendId)
        .eq('user_two_id', userId);

      if (deleteError1 || deleteError2) throw new Error(deleteError1?.message || deleteError2?.message);

      // ลบจากรายการเพื่อนทั้งหมด
      setFriendsList(friendsList.filter(user => user.user_id !== friendId));
      Alert.alert('สำเร็จ', 'ลบเพื่อนแล้ว');

    } catch (err: any) {
      console.error('Delete friend error:', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบเพื่อนได้: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };



  
  // Memoized data for the main friends list to avoid redundant calculations
  const friendListItems = useMemo(() => {
    const items = [];
    if (receivedRequests.length > 0) {
      items.push({ type: 'header', title: 'คำขอเป็นเพื่อนที่ได้รับ' });
      items.push(...receivedRequests.map(user => ({ ...user, type: 'received' })));
    }
    if (pendingRequests.length > 0) {
      items.push({ type: 'header', title: 'คำขอที่ส่งออกไป' });
      items.push(...pendingRequests.map(user => ({ ...user, type: 'pending' })));
    }
    if (friendsList.length > 0) {
      items.push({ type: 'header', title: 'เพื่อนของฉัน' });
      items.push(...friendsList.map(user => ({ ...user, type: 'friend' })));
    }
    return items;
  }, [receivedRequests, pendingRequests, friendsList]);

  const [trips, setTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  // Fetch user's trips
  useEffect(() => {
    const fetchTrips = async () => {
      if (!userId) return;
      
      setLoadingTrips(true);
      try {
        // Get trip memberships for current user
        const { data: memberRows, error: memberErr } = await supabase
          .from('trip_member')
          .select('trip_id')
          .eq('user_id', userId)
          .eq('is_active', true);
          
        if (memberErr) throw memberErr;
        
        const tripIds = (memberRows || []).map((m: any) => m.trip_id);
        if (tripIds.length === 0) {
          setTrips([]);
          return;
        }
        
        // Get trip details
        const { data: tripData, error: tripErr } = await supabase
          .from('trip')
          .select('*')
          .in('trip_id', tripIds)
          .order('created_at', { ascending: false });
          
        if (tripErr) throw tripErr;
        
        setTrips(tripData || []);
      } catch (err) {
        console.error('Error fetching trips:', err);
        Alert.alert('Error', 'Failed to load trips');
      } finally {
        setLoadingTrips(false);
      }
    };
    
    fetchTrips();
  }, [userId]);

  return (
    <SafeAreaView style={styles.container}>
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
          <View style={{ flex: 1 }} />
          <Text style={styles.headerTitle}>{t('friends.title')}</Text>
        </View>
      </LinearGradient>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'friends' && styles.activeTab]}
          onPress={() => setSelectedTab('friends')}
        >
          <Ionicons name="people" size={20} color={selectedTab === 'friends' ? '#fff' : '#1A3C6B'} />
          <Text style={[styles.tabText, selectedTab === 'friends' && styles.activeTabText]}>{t('friends.tab.friends')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'group' && styles.activeTab]}
          onPress={() => setSelectedTab('group')}
        >
          <Ionicons name="folder" size={20} color={selectedTab === 'group' ? '#fff' : '#1A3C6B'} />
          <Text style={[styles.tabText, selectedTab === 'group' && styles.activeTabText]}>{t('friends.tab.group')}</Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'friends' ? (
        <>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('friends.search_placeholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          {loading && !searchQuery ? (
            <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#45647C" />
          ) : searchQuery ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.user_id}
              renderItem={({ item }) => (
                <UserItem
                  user={item}
                  type="search"
                  friendsList={friendsList}
                  pendingRequests={pendingRequests}
                  receivedRequests={receivedRequests}
                  handleAddFriend={handleAddFriend}
                  handleAcceptRequest={handleAcceptRequest}
                  handleDeclineRequest={handleDeclineRequest}
                  handleDeleteFriend={handleDeleteFriend}
                  loading={loading}
                />
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>{t('friends.empty.users')}</Text>
                </View>
              )}
            />
          ) : (
            <FlatList
              data={friendListItems}
              keyExtractor={(item, index) => item.type === 'header' ? `header-${item.title}` : `${item.user_id}-${item.type}-${index}`}
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return <Text style={styles.sectionHeader}>{
                    item.title === 'คำขอเป็นเพื่อนที่ได้รับ' ? t('friends.header.received') :
                    item.title === 'คำขอที่ส่งออกไป' ? t('friends.header.sent') :
                    item.title === 'เพื่อนของฉัน' ? t('friends.header.my') : item.title
                  }</Text>;
                }
                return (
                  <UserItem
                    user={item}
                    type={item.type}
                    handleAddFriend={handleAddFriend}
                    handleAcceptRequest={handleAcceptRequest}
                    handleDeclineRequest={handleDeclineRequest}
                    handleDeleteFriend={handleDeleteFriend}
                    loading={loading}
                    friendsList={friendsList}
                    pendingRequests={pendingRequests}
                    receivedRequests={receivedRequests}
                  />
                );
              }}
              ListEmptyComponent={() => (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>{t('friends.empty.none')}</Text>
                </View>
              )}
            />
          )}
        </>
      ) : (
        loadingTrips ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#45647C" />
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyList}>
            <Ionicons name="sad-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>{t('friends.group.empty.title')}</Text>
            <Text style={styles.emptyStateSubtext}>{t('friends.group.empty.subtitle')}</Text>
          </View>
        ) : (
          <FlatList
            data={trips}
            keyExtractor={(item) => item.trip_id}
            contentContainerStyle={{ paddingVertical: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.groupItem}
                onPress={() => router.push(`/Trip?tripId=${item.trip_id}`)}
              >
                {item.trip_image_url ? (
                  <Image source={{ uri: item.trip_image_url }} style={styles.groupImage} />
                ) : (
                  <View style={[styles.groupImage, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="images" size={32} color="#999" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName}>{item.trip_name}</Text>
                  <Text style={{ color: '#666', fontSize: 12 }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      )}

      {/* bottom button removed per request */}

      <Image
        source={require('../assets/images/bg.png')}
        style={styles.bgImage}
        resizeMode="contain"
      />
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    padding: 5,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
  },
  activeTab: {
    backgroundColor: '#1A3C6B',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 16,
    color: '#1A3C6B',
    fontFamily: Fonts.medium,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  sectionHeader: {
    fontSize: 18,
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
    color: '#1A3C6B',
    marginTop: 10,
    marginBottom: 5,
    marginHorizontal: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  friendIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
    backgroundColor: '#bbb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
  },
  initialText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  friendName: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.medium,
  },
  addButton: {
    backgroundColor: '#1A3C6B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonText: {
    color: '#fff',
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
  },
  addedText: {
    color: '#666',
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
  },
  pendingText: {
    color: '#FFA500',
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#1A3C6B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  declineButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  viewProfileButton: {
    backgroundColor: '#007bff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  groupImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  groupName: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
  },
  bottomButton: {
    backgroundColor: '#45647C',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 50, // Increased from 20 to 40 to move button up
  },
  bottomButtonText: {
    color: '#fff',
    fontFamily: Fonts.medium,
    fontWeight: 'bold',
  },
  emptyList: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    fontFamily: Fonts.medium,
    marginTop: 10,
  },
  emptyStateSubtext: {
    color: '#999',
    fontSize: 14,
    fontFamily: Fonts.medium,
    marginTop: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgImage: {
    width: '111%',
    height: 235,
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    zIndex: -1,
  },
});
