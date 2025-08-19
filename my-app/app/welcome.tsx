import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';
import { supabase, hardResetAuth } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Welcome'>>();

  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ฟังก์ชันสำหรับกระดิ่งแจ้งเตือน
  const handleNotificationPress = () => {
    navigation.navigate('Notification');
  };

  // ฟังก์ชันสำหรับเมนูสามเส้น
  const handleMenuPress = () => {
    Alert.alert('เมนู', 'เลือกตัวเลือกที่ต้องการ');
    // สามารถเพิ่มการนำทางไปยังหน้าต่างๆ ได้ที่นี่
    // navigation.navigate('Settings');
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
      }

      setLoading(false);
    };

    fetchTrips();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Title */}
        <Text style={styles.title}>Welcome {'\n'}to Harnty, {'\n'}User!</Text>

        <Image
          source={require('../assets/images/img.png')}
          style={styles.imgImage}
          resizeMode="contain"
        />

        {/* Search */}
        <TextInput placeholder="Search" style={styles.searchBox} />

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All You Trip !</Text>
          <View style={styles.iconsRight}>
            <TouchableOpacity onPress={handleNotificationPress}>
              <Ionicons name="notifications" size={20} color="red" style={{ marginRight: 10 }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleMenuPress}>
              <Ionicons name="menu" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trip Card จากฐานข้อมูล เฉพาะของ user */}
        {!loading && trips.length > 0 && trips.map((trip) => (
          <TouchableOpacity key={trip.trip_id} style={styles.card} onPress={() => router.push({ pathname: '/Trip', params: { tripId: trip.trip_id } })}>
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
        ))}
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
  searchBox: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginTop: 15,
    borderRadius: 10,
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
  imgImage: {
    position: 'absolute',
    top: 7,
    right: 10,
    width: 150,
    height: 120,
    borderRadius: 10,
  },
});
