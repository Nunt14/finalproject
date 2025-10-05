import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TextInput, Image, TouchableOpacity, Alert, ScrollView, Dimensions } from 'react-native';
import { Text } from '@/components';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';
import { supabase, hardResetAuth } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Welcome'>>();
  const { t } = useLanguage();

  const [trips, setTrips] = useState<any[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userFullName, setUserFullName] = useState<string>('User');
  const [sortMode, setSortMode] = useState<'date' | 'alphabetical'>('date'); // 'date' is default (original order)
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [totalTrips, setTotalTrips] = useState<number>(0);
  const [pendingDebts, setPendingDebts] = useState<number>(0);
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [greeting, setGreeting] = useState<string>('Good day');

  // ฟังก์ชันสำหรับคำทักทายตามเวลา
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // ฟังก์ชันสำหรับกระดิ่งแจ้งเตือน
  const handleNotificationPress = () => {
    navigation.navigate('Notification');
  };

  // ฟังก์ชันสำหรับเมนูสามเส้น - สลับระหว่างเรียง A-Z และเรียงตามวันที่สร้าง
  const handleMenuPress = () => {
    let sortedTrips;
    
    if (sortMode === 'date') {
      // เรียงตาม A-Z
      sortedTrips = [...filteredTrips].sort((a, b) => {
        const nameA = a.trip_name?.toLowerCase() || '';
        const nameB = b.trip_name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      });
      setSortMode('alphabetical');
    } else {
      // เรียงตามวันที่สร้าง (ใหม่ไปเก่า)
      sortedTrips = [...filteredTrips].sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setSortMode('date');
    }
    
    setFilteredTrips(sortedTrips);
  };

  // ฟังก์ชันสำหรับลบทริป
  const handleDeleteTrip = async (tripId: string, tripName: string) => {
    try {
      // แสดงกล่องยืนยันการลบ
      Alert.alert(
        t('welcome.delete_trip.title'),
        t('welcome.delete_trip.message').replace('{name}', tripName),
        [
          {
            text: t('welcome.delete_trip.cancel'),
            style: 'cancel',
          },
          {
            text: t('welcome.delete_trip.ok'),
            style: 'destructive',
            onPress: async () => {
              try {
                // Robust manual cascade delete to ensure DB is cleaned even if FKs are missing
                // 0. ค้นหาบิลทั้งหมดในทริปนี้
                const { data: billRows, error: billFetchError } = await supabase
                  .from('bill')
                  .select('bill_id')
                  .eq('trip_id', tripId);
                if (billFetchError) throw billFetchError;

                const billIds = (billRows || []).map((b: any) => b.bill_id);

                if (billIds.length > 0) {
                  // 0.1 ค้นหา bill_share ที่เกี่ยวข้อง
                  const { data: bsRows, error: bsFetchError } = await supabase
                    .from('bill_share')
                    .select('bill_share_id')
                    .in('bill_id', billIds);
                  if (bsFetchError) throw bsFetchError;

                  const billShareIds = (bsRows || []).map((r: any) => r.bill_share_id);

                  // 0.2 ลบ payment ที่อ้างถึง bill_share เหล่านี้
                  if (billShareIds.length > 0) {
                    const { error: payErr } = await supabase
                      .from('payment')
                      .delete()
                      .in('bill_share_id', billShareIds);
                    if (payErr) throw payErr;
                  }

                  // 0.3 ลบ payment_proof ที่อ้างถึง bill เหล่านี้ (ถ้ามีตารางนี้)
                  try {
                    const { error: ppErr } = await supabase
                      .from('payment_proof')
                      .delete()
                      .in('bill_id', billIds);
                    if (ppErr) throw ppErr;
                  } catch {}

                  // 0.4 ลบ bill_share ที่อ้างถึง bill เหล่านี้
                  const { error: bsDelErr } = await supabase
                    .from('bill_share')
                    .delete()
                    .in('bill_id', billIds);
                  if (bsDelErr) throw bsDelErr;

                  // 0.5 ลบ bill ทั้งหมดในทริปนี้
                  const { error: billDelErr } = await supabase
                    .from('bill')
                    .delete()
                    .in('bill_id', billIds);
                  if (billDelErr) throw billDelErr;
                }

                // 1. ลบสรุปหนี้ (debt_summary) ของทริปนี้ หากมี
                try {
                  await supabase
                    .from('debt_summary')
                    .delete()
                    .eq('trip_id', tripId);
                } catch {}

                // 2. ลบการแจ้งเตือนที่อ้างถึงทริปนี้ (ถ้ามี)
                try {
                  await supabase
                    .from('notification')
                    .delete()
                    .eq('trip_id', tripId);
                } catch {}

                // 3. ลบสมาชิกทริป
                const { error: memberError } = await supabase
                  .from('trip_member')
                  .delete()
                  .eq('trip_id', tripId);
                if (memberError) throw memberError;

                // 4. ลบทริป
                const { error: tripError } = await supabase
                  .from('trip')
                  .delete()
                  .eq('trip_id', tripId);
                if (tripError) throw tripError;

                // 5. อัปเดต state หลัง DB ลบสำเร็จ
                setTrips(prevTrips => prevTrips.filter(trip => trip.trip_id !== tripId));
                setFilteredTrips(prevTrips => prevTrips.filter(trip => trip.trip_id !== tripId));

                Alert.alert(t('welcome.delete_trip.success_title'), t('welcome.delete_trip.success_msg'));
              } catch (error) {
                console.error('Error deleting trip:', error);
                Alert.alert(t('welcome.delete_trip.error_title'), t('welcome.delete_trip.error_msg'));
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error showing delete confirmation:', error);
    }
  };

  // โหลดข้อมูลจาก Supabase เฉพาะทริปที่ผู้ใช้อยู่ในทริปและ active
  const fetchTrips = async () => {
    setLoading(true);

    // ตรวจสอบ session จาก Supabase Auth
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) {
      await hardResetAuth();
      router.replace('/login');
      setLoading(false);
      return;
    }

    // โหลดข้อมูลผู้ใช้ และสมาชิกทริป แบบขนาน
    const [userRes, memberRes] = await Promise.all([
      supabase
        .from('user')
        .select('full_name, profile_image_url, email, phone_number')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('trip_member')
        .select('trip_id')
        .eq('user_id', userId)
        .eq('is_active', true),
    ]);

    const userData = (userRes as any)?.data;
    const userError = (userRes as any)?.error;
    
    console.log('User ID:', userId);
    console.log('User data from welcome screen:', userData);
    console.log('User response error:', userError);
    
    if (userError) {
      console.log('Error details:', userError.message, userError.details, userError.hint);
      
      // ถ้า user ไม่มีในตาราง ให้สร้าง user record ใหม่
      if (userError.code === 'PGRST116' || userError.message?.includes('No rows found')) {
        console.log('User not found, creating new user record...');
        try {
          const { data: authUser } = await supabase.auth.getUser();
          if (authUser?.user) {
            const { data: newUser, error: createError } = await supabase
              .from('user')
              .insert({
                user_id: userId,
                email: authUser.user.email,
                full_name: authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'User',
                created_at: new Date().toISOString(),
              })
              .select()
              .maybeSingle();
            
            if (createError) {
              console.log('Error creating user:', createError);
            } else {
              console.log('User created successfully:', newUser);
              // ตั้งค่าข้อมูล user ใหม่
              if (newUser?.full_name) {
                setUserFullName(newUser.full_name);
              }
              if (newUser?.profile_image_url) {
                setUserAvatar(newUser.profile_image_url);
              }
            }
          }
        } catch (createErr) {
          console.log('Error in user creation process:', createErr);
        }
      }
    }
    
    if (userData?.full_name) {
      setUserFullName(userData.full_name);
    } else {
      // ถ้าไม่มี full_name ให้ใช้ email แทน
      if (userData?.email) {
        const emailName = userData.email.split('@')[0];
        setUserFullName(emailName);
      }
    }
    
    // ดึงรูปโปรไฟล์ (ใช้ field ที่ถูกต้องตามตาราง)
    if (userData?.profile_image_url) {
      console.log('Profile image URL found:', userData.profile_image_url);
      setUserAvatar(userData.profile_image_url);
    } else {
      console.log('No profile image found, using placeholder');
      // ถ้าไม่มีรูป ให้ใช้ default avatar
      setUserAvatar('');
    }
    
    // ตั้งค่าคำทักทาย
    setGreeting(getGreeting());

    // นับจำนวนการแจ้งเตือนที่ยังไม่อ่าน
    try {
      const { count } = await supabase
        .from('notification')
        .select('notification_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      setNotificationCount(count || 0);
    } catch (err) {
      console.log('Error counting notifications:', err);
    }

    const memberRows = (memberRes as any)?.data || [];
    const memberErr = (memberRes as any)?.error;
    if (memberErr) {
      console.log('Error fetching memberships:', memberErr);
      setTrips([]);
      setFilteredTrips([]);
      setLoading(false);
      return;
    }

    const tripIds = memberRows.map((m: any) => m.trip_id);
    if (tripIds.length === 0) {
      setTrips([]);
      setFilteredTrips([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('trip')
      .select('*')
      .in('trip_id', tripIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Error fetching trips:', error);
      setTrips([]);
      setFilteredTrips([]);
    } else {
      setTrips(data || []);
      setFilteredTrips(data || []);
      setTotalTrips(data?.length || 0);
    }

    // โหลดข้อมูลหนี้ที่ค้าง (ใช้วิธีเดียวกับหน้า Debt.tsx)
    try {
      console.log('Fetching debts for user:', userId);
      
      // 1) ดึง bill ทั้งหมดของทริปที่ผู้ใช้เป็นสมาชิก (รวมผู้ที่เป็นเจ้าของบิล)
      const { data: billRows, error: billErr } = await supabase
        .from('bill')
        .select('bill_id, trip_id, paid_by_user_id')
        .in('trip_id', tripIds);
      
      if (billErr) {
        console.log('Error fetching bills:', billErr);
        setPendingDebts(0);
        return;
      }
      
      const allowedBillIds = (billRows || []).map((b: any) => String(b.bill_id));
      const billIdToCreditor = new Map<string, string>((billRows || []).map((b: any) => [String(b.bill_id), String(b.paid_by_user_id)]));
      
      if (allowedBillIds.length === 0) {
        setPendingDebts(0);
        return;
      }
      
      // 2) ดึงรายการ bill_share ที่ผู้ใช้เป็นลูกหนี้ (unpaid)
      // ใช้ schema เดียวกับหน้า Debt.tsx -> field คือ user_id และ status = 'unpaid'
      const { data: shareRows, error: shareErr } = await supabase
        .from('bill_share')
        .select('bill_share_id, bill_id')
        .in('bill_id', allowedBillIds)
        .eq('user_id', userId)
        .eq('status', 'unpaid');
      
      if (shareErr) {
        console.log('Error fetching bill_shares:', shareErr);
        setPendingDebts(0);
        return;
      }
      
      // 3) นับเฉพาะแถวหนี้ที่ยังไม่ชำระ และบิลนั้นต้องไม่ใช่ของเราเอง (เราเป็นเจ้าของไม่ต้องจ่าย)
      const debtCount = (shareRows || []).filter((s: any) => {
        const creditorId = billIdToCreditor.get(String((s as any).bill_id));
        return creditorId && String(creditorId) !== String(userId);
      }).length;
      console.log('Unpaid bill_share rows count:', debtCount);
      setPendingDebts(debtCount);
      
    } catch (error) {
      console.log('Error fetching debts:', error);
      setPendingDebts(0);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  // เรียก fetchTrips ทุกครั้งที่หน้า Welcome ถูก focus (เช่น กลับมาจากหน้า profile)
  useFocusEffect(
    React.useCallback(() => {
      fetchTrips();
    }, [])
  );

  // realtime subscribe สำหรับการแจ้งเตือนใหม่และอัปเดตสถานะอ่าน
  useEffect(() => {
    let channel: any;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;
      channel = supabase
        .channel(`welcome-notifications-${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notification', filter: `user_id=eq.${userId}` },
          () => setNotificationCount((c) => c + 1)
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notification', filter: `user_id=eq.${userId}` },
          (payload: any) => {
            const wasRead = (payload.old?.is_read === false) && (payload.new?.is_read === true);
            const becameUnread = (payload.old?.is_read === true) && (payload.new?.is_read === false);
            setNotificationCount((c) => c + (becameUnread ? 1 : 0) - (wasRead ? 1 : 0));
          }
        )
        .subscribe();
    })();
    return () => { try { if (channel) supabase.removeChannel(channel); } catch {} };
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Modern Card Header */}
        <LinearGradient
          colors={['#1A3C6B', '#45647C', '#6B8E9C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={styles.headerContent}>
            {/* Top Row - Greeting and Avatar */}
            <View style={styles.headerTopRow}>
              <View style={styles.greetingContainer}>
                <Text style={styles.greetingText}>{greeting}</Text>
                <View style={styles.welcomeContainer}>
                  <Text style={styles.welcomeText}>Welcome to </Text>
                  <Text style={styles.harntyText}>Harnty</Text>
                </View>
                <Text style={styles.userNameText}>{userFullName}!</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.avatarContainer}
                onPress={() => router.push('/profile')}
              >
                {userAvatar ? (
                  <Image 
                    source={{ uri: userAvatar }} 
                    style={styles.avatarImage}
                    onError={() => setUserAvatar('')}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={30} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Quick Stats Row */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="airplane" size={20} color="#fff" />
                </View>
                <Text style={styles.statNumber}>{totalTrips}</Text>
                <Text style={styles.statLabel}>Active Trips</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => navigation.navigate('Debt')}
              >
                <View style={styles.statIconContainer}>
                  <Ionicons name="wallet" size={20} color="#fff" />
                </View>
                <Text style={styles.statNumber}>{pendingDebts}</Text>
                <Text style={styles.statLabel}>Pending Debts</Text>
              </TouchableOpacity>
              
              <View style={styles.statDivider} />
              
              <TouchableOpacity 
                style={styles.statItem}
                onPress={handleNotificationPress}
              >
                <View style={styles.statIconContainer}>
                  <Ionicons name="notifications" size={20} color="#fff" />
                </View>
                <Text style={styles.statNumber}>{notificationCount}</Text>
                <Text style={styles.statLabel}>Notifications</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput 
            style={styles.searchBox} 
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text === '') {
                setFilteredTrips(trips);
              } else {
                const searchText = text.toLowerCase();
                const filtered = trips.filter(trip => {
                  const nameMatch = trip.trip_name?.toLowerCase().includes(searchText) || false;
                  const descMatch = trip.description?.toLowerCase().includes(searchText) || false;
                  return nameMatch || descMatch;
                });
                setFilteredTrips(filtered);
              }
            }}
          />
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('welcome.all_trips')}</Text>
          <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
            <Ionicons name="menu" size={20} color="#1A3C6B" />
          </TouchableOpacity>
        </View>

        {/* Trip List */}
        {filteredTrips.length === 0 ? (
          <Text style={styles.noResultsText}>{t('welcome.no_results')}</Text>
        ) : (
          filteredTrips.map((trip) => (
          <View key={trip.trip_id} style={styles.card}>
            <TouchableOpacity 
              style={styles.cardContent}
              onPress={() => router.push({ pathname: '/Trip', params: { tripId: trip.trip_id } })}
            >
              {trip.trip_image_url ? (
                <Image source={{ uri: trip.trip_image_url }} style={styles.image} />
              ) : (
                <View style={[styles.defaultTripImage, { backgroundColor: '#5DADE2' }]}>
                  <View style={styles.tripIconContainer}>
                    <Ionicons name="airplane" size={40} color="#fff" />
                  </View>
                </View>
              )}
              <View style={styles.tripInfo}>
                <Text style={styles.tripTitle}>{trip.trip_name}</Text>
                {trip.trip_status ? (
                  <Text style={styles.tripNote}>{trip.trip_status}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => handleDeleteTrip(trip.trip_id, trip.trip_name)}
            >
              <Ionicons name="trash" size={24} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        )))}
      </ScrollView>

      {/* Navigation Bar */}
      <LinearGradient
        colors={['#1A3C6B', '#45647C', '#6B8E9C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.navbar}
      >
        <View style={styles.navbarContent}>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="home" size={28} color="#fff" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navItem}
            onPress={() => navigation.navigate('AddFriends')}
          >
            <Ionicons name="people" size={28} color="#fff" />
            <Text style={styles.navLabel}>Friends</Text>
          </TouchableOpacity>

          {/* Floating Add Button */}
          <TouchableOpacity
            style={styles.fabContainer}
            onPress={() => navigation.navigate('AddTrip')}>
            <Ionicons name="add" size={50} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navItem}
            onPress={() => navigation.navigate('Debt')}
          >
            <Ionicons name="wallet" size={28} color="#fff" />
            <Text style={styles.navLabel}>Debt</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navItem}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person" size={28} color="#fff" />
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 0,
    paddingHorizontal: 0,
    paddingBottom: 90,
    backgroundColor: '#fff',
  },
  // Modern Card Header Styles
  headerCard: {
    paddingTop: 60,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  headerContent: {
    paddingTop: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greetingContainer: {
    flex: 1,
    paddingRight: 15,
  },
  greetingText: {
    fontSize: 16,
    color: '#E8F4FD',
    fontFamily: 'Prompt-Medium',
    fontWeight: '500',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  welcomeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 24,
    color: '#fff',
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  harntyText: {
    fontSize: 28,
    color: '#fff',
    fontFamily: 'Prompt-Medium',
    fontWeight: '700',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  userNameText: {
    fontSize: 32,
    color: '#fff',
    fontFamily: 'Prompt-Medium',
    fontWeight: 'bold',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 25,
    paddingVertical: 18,
    paddingHorizontal: 15,
    marginTop: 5,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 18,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Prompt-Medium',
    color: '#E8F4FD',
    textAlign: 'center',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginHorizontal: 8,
  },
  menuButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    marginTop: 25,
    marginHorizontal: 20,
    paddingHorizontal: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  searchBox: {
    flex: 1,
    padding: 10,
    paddingLeft: 10,
    fontFamily: 'Prompt-Medium',
    color: '#333',
    fontSize: 16,
  },
  searchIcon: {
    marginRight: 5,
  },
  noResultsText: {
    marginTop: 20,
    marginHorizontal: 20,
    textAlign: 'center',
    color: '#666',
  },
  sectionHeader: {
    marginTop: 30,
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    fontSize: 18,
    color: '#1A3C6B',
  },
  card: {
    marginTop: 15,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    position: 'relative',
    paddingBottom: -5, // Add space for delete button
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardContent: {
    paddingBottom: 1, // Add some padding at the bottom
  },
  image: {
    height: 150,
    width: '100%',
  },
  defaultTripImage: {
    height: 150,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tripInfo: {
    padding: 15,
  },
  tripTitle: {
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#1A3C6B',
    fontSize: 16,
  },
  tripNote: {
    color: 'red',
  },
  navbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  navbarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    height: '100%',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 15,
    minWidth: 50,
  },
  navLabel: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Prompt-Medium',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  fabContainer: {
    position: 'absolute',
    top: -35,
    alignSelf: 'center',
    backgroundColor: '#1A3C6B',
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: '#fff',
  },
  deleteButton: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
});
