import React from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';
import { supabase } from '../constants/supabase';



export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Welcome'>>();

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

      {/* Trip Card */}
      <View style={styles.card}>
        <Image
          source={{ uri: 'https://source.unsplash.com/600x400/?chiangmai' }}
          style={styles.image}
        />
        <View style={styles.tripInfo}>
          <Text style={styles.tripTitle}>Chiang Mai</Text>
          <Text style={styles.tripNote}>with expenses</Text>
        </View>
      </View>

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

        <TouchableOpacity onPress={() => navigation.navigate('AddFriends')}></TouchableOpacity>
        <Ionicons name="wallet" size={30} color="#fff" />
        
        <Ionicons name="person" size={30} color="#fff" />
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
    height: 15,
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
  position: 'absolute',     // ทำให้สามารถวางซ้อนและย้ายตำแหน่งได้
  top: 70,                  // ระยะห่างจากด้านบน
  right: 45,                // ระยะห่างจากด้านขวา
  width:150,                // ปรับขนาดให้เล็กลง
  height: 120,
  borderRadius: 10,         // (ไม่บังคับ) ทำให้มุมโค้งเล็กน้อย
},

});
