import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';
import { supabase, hardResetAuth } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useLanguage } from './contexts/LanguageContext';

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Welcome'>>();
  const { t } = useLanguage();

  const [trips, setTrips] = useState<any[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [userFullName, setUserFullName] = useState<string>('User');
  const [sortMode, setSortMode] = useState<'date' | 'alphabetical'>('date'); // 'date' is default (original order)

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
        'ยืนยันการลบทริป',
        `คุณแน่ใจหรือไม่ว่าต้องการลบทริป "${tripName}"?`,
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

                Alert.alert('สำเร็จ', 'ลบทริปเรียบร้อยแล้ว');
              } catch (error) {
                console.error('Error deleting trip:', error);
                Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถลบทริปได้ในขณะนี้');
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
  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true);

      // ตรวจสอบ session จาก Supabase Auth
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        await hardResetAuth();
        router.replace('/login');
        setLoading(false);
        return;
      }

      // ดึงข้อมูลผู้ใช้
      const { data: userData, error: userError } = await supabase
        .from('user')
        .select('full_name')
        .eq('user_id', userId)
        .single();

      if (!userError && userData?.full_name) {
        setUserFullName(userData.full_name);
      }

      // ดึงทริปผ่าน trip_member ที่ active
      const { data: memberRows, error: memberErr } = await supabase
        .from('trip_member')
        .select('trip_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      if (memberErr) {
        console.log('Error fetching memberships:', memberErr);
        setTrips([]);
        setLoading(false);
        return;
      }
      const tripIds = (memberRows || []).map((m: any) => m.trip_id);
      if (tripIds.length === 0) {
        setTrips([]);
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
      } else {
        setTrips(data || []);
        setFilteredTrips(data || []);
      }

      setLoading(false);
    };

    fetchTrips();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Title */}
        <Text style={styles.title}>{t('welcome.title')} {'\n'}{userFullName}!</Text>

        <Image
          source={require('../assets/images/img.png')}
          style={styles.imgImage}
          resizeMode="contain"
        />

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
          <View style={styles.iconsRight}>
            <TouchableOpacity onPress={handleNotificationPress}>
              <Ionicons name="notifications" size={20} color="red" style={{ marginRight: 10 }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMenuPress}>
              <Ionicons name="menu" size={20} />
            </TouchableOpacity>
          </View>
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
              ) : null}
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
      <View style={styles.navbar}>
        <Ionicons name="home" size={30} color="#fff" />

        <TouchableOpacity onPress={() => navigation.navigate('AddFriends')}>
          <Ionicons name="people" size={40} color="#fff" />
        </TouchableOpacity>

        {/* Floating Add Button */}
        <TouchableOpacity
          style={styles.fabContainer}
          onPress={() => navigation.navigate('AddTrip')}>
          <Ionicons name="add" size={55} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Debt')}>
          <Ionicons name="wallet" size={30} color="#fff" />
        </TouchableOpacity>

        {/* ปุ่มโปรไฟล์เดียวเท่านั้น */}
        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Ionicons name="person" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 90,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 35,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginTop: 15,
    paddingHorizontal: 10,
  },
  searchBox: {
    flex: 1,
    padding: 10,
    paddingLeft: 10,
  },
  searchIcon: {
    marginRight: 5,
  },
  noResultsText: {
    marginTop: 20,
    textAlign: 'center',
    color: '#666',
  },
  sectionHeader: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  iconsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#eee',
    position: 'relative',
    paddingBottom: -5, // Add space for delete button
  },
  cardContent: {
    paddingBottom: 1, // Add some padding at the bottom
  },
  image: {
    height: 150,
    width: '100%',
  },
  tripInfo: {
    padding: 10,
  },
  tripTitle: {
    fontWeight: 'bold',
    color: '#1A3C6B',
  },
  tripNote: {
    color: 'red',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#45647C',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  fabContainer: {
    position: 'absolute',
    top: -30,
    alignSelf: 'center',
    backgroundColor: '#1A3C6B',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  deleteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    padding: 5,
  },
  imgImage: {
    position: 'absolute',
    top: 7,
    right: 10,
    width: 150,
    height: 120,
    borderRadius: 10,
  },
});
