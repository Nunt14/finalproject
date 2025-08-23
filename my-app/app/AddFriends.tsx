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
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        );
      }
      if (isPending) return <Text style={styles.pendingText}>Pending</Text>;
      if (isReceived) {
        return (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.acceptButton, { marginRight: 5 }]} 
              onPress={() => handleAcceptRequest(user.user_id)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.declineButton} 
              onPress={() => handleDeclineRequest(user.user_id)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Decline</Text>
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
          <Text style={styles.buttonText}>Add</Text>
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
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (type === 'pending') return <Text style={styles.pendingText}>Pending</Text>;
    if (type === 'received') {
      return (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.acceptButton, { marginRight: 5 }]} 
            onPress={() => handleAcceptRequest(user.user_id)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.declineButton} 
            onPress={() => handleDeclineRequest(user.user_id)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Decline</Text>
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
        const confirmedFriendIds = friendsData ? friendsData.map(friend => 
          friend.user_two_id === currentUserId ? friend.user_one_id : friend.user_two_id
        ) : [];
        
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
      
      const { error: insertError1 } = await supabase
        .from('friends')
        .insert({ user_one_id: userId, user_two_id: senderId });
      const { error: insertError2 } = await supabase
        .from('friends')
        .insert({ user_one_id: senderId, user_two_id: userId });
        
      if (insertError1 || insertError2) throw new Error(insertError1?.message || insertError2?.message);

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

  const groups = [
    { name: 'Nakhon NaYok Trip', image: 'https://source.unsplash.com/100x100/?car,road', expense: false },
    { name: 'Chiang Mai', image: 'https://source.unsplash.com/100x100/?chiangmai', expense: true },
    { name: 'เกาะล้าน', image: 'https://source.unsplash.com/100x100/?beach,thailand', expense: true },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Friends</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'friends' && styles.activeTab]}
          onPress={() => setSelectedTab('friends')}
        >
          <Text style={selectedTab === 'friends' ? styles.activeTabText : styles.tabText}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'group' && styles.activeTab]}
          onPress={() => setSelectedTab('group')}
        >
          <Text style={selectedTab === 'group' ? styles.activeTabText : styles.tabText}>Group</Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'friends' ? (
        <>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by full name"
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
                  <Text style={styles.emptyText}>ไม่พบผู้ใช้</Text>
                </View>
              )}
            />
          ) : (
            <FlatList
              data={friendListItems}
              keyExtractor={(item, index) => item.type === 'header' ? `header-${item.title}` : `${item.user_id}-${item.type}-${index}`}
              renderItem={({ item }) => {
                if (item.type === 'header') {
                  return <Text style={styles.sectionHeader}>{item.title}</Text>;
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
                  <Text style={styles.emptyText}>คุณยังไม่มีเพื่อนหรือคำขอเป็นเพื่อน</Text>
                </View>
              )}
            />
          )}
        </>
      ) : (
          <FlatList
          data={groups}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ paddingVertical: 10 }}
          renderItem={({ item }) => (
            <View style={styles.groupItem}>
              <Image source={{ uri: item.image }} style={styles.groupImage} />
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={{ color: item.expense ? 'red' : 'gray', fontSize: 12 }}>
                  {item.expense ? 'with expenses' : 'no expenses'}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.bottomButton}>
        <Text style={styles.bottomButtonText}>
          {selectedTab === 'friends' ? 'Add Friends' : 'New Group'}
        </Text>
      </TouchableOpacity>

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
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#45647C',
  },
  tabText: {
    color: '#555',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
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
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
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
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  addedText: {
    color: '#666',
    fontWeight: 'bold',
  },
  pendingText: {
    color: '#FFA500',
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  declineButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  viewProfileButton: {
    backgroundColor: '#007bff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  groupImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomButton: {
    backgroundColor: '#45647C',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  bottomButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyList: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
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
