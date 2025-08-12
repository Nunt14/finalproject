import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';
import { supabase } from '../constants/supabase';
import { router } from 'expo-router';

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Welcome'>>();

  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // โหลดข้อมูลจาก Supabase เฉพาะของ user ที่ล็อกอิน
  useEffect(() => {
    const fetchTrips = async () => {
      setLoading(true);

      // ดึงข้อมูล user ที่ล็อกอิน
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.log('Error getting user:', userError);
        setLoading(false);
        return;
      }

      if (!user) {
        setTrips([]);
        setLoading(false);
        return;
      }

      // ดึงเฉพาะทริปของ user นี้
      const { data, error } = await supabase
        .from('TRIP')
        .select('*')
        .eq('created_by', user.id) // ถ้าเก็บเป็น int ต้องแก้เป็น id mapping
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
          <Ionicons name="notifications" size={20} color="red" style={{ marginRight: 10 }} />
          <Ionicons name="menu" size={20} />
        </View>
      </View>

      {/* Trip Card จากฐานข้อมูล เฉพาะของ user */}
      {!loading && trips.length > 0 && trips.map((trip) => (
        <View key={trip.trip_id} style={styles.card}>
          {trip.trip_image_url ? (
            <Image source={{ uri: trip.trip_image_url }} style={styles.image} />
          ) : null}
          <View style={styles.tripInfo}>
            <Text style={styles.tripTitle}>{trip.trip_name}</Text>
            {trip.trip_status ? (
              <Text style={styles.tripNote}>{trip.trip_status}</Text>
            ) : null}
          </View>
        </View>
      ))}

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
    top: 70,
    right: 45,
    width: 150,
    height: 120,
    borderRadius: 10,
  },
});
