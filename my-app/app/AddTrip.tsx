import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // ✅ ใช้อันนี้

export default function AddTripScreen() {
  const router = useRouter(); // ✅ ใช้อันนี้แทน navigation
  const [title, setTitle] = useState('');
  const members = ['#4F83FF', '#FFA726', '#F8BBD0', '#EF5350'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add new trip</Text>
      </View>

      {/* Camera Icon */}
      <TouchableOpacity style={styles.imageBox}>
        <MaterialIcons name="photo-camera" size={40} color="#1A3C6B" />
      </TouchableOpacity>

      {/* Title input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>title :</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          placeholder="Enter trip title"
        />
      </View>

      {/* Member section */}
      <Text style={styles.label}>Member :</Text>
      <View style={styles.memberRow}>
        <Ionicons name="chevron-back" size={20} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {members.map((color, index) => (
            <View key={index} style={[styles.memberCircle, { backgroundColor: color }]} />
          ))}
        </ScrollView>
        <Ionicons name="chevron-forward" size={20} />
      </View>
      <Text style={styles.everyoneLabel}>☑ everyone</Text>

      {/* Buttons */}
      <TouchableOpacity style={styles.confirmBtn}>
        <Text style={styles.confirmText}>Confirm</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/welcome')}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Decorative image */}
      <Image
        source={require('../assets/images/bg.png')}
        style={styles.bgImage}
        resizeMode="contain"
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  imageBox: {
    alignSelf: 'center',
    backgroundColor: '#9EC4C2',
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
    gap: 10,
  },
  memberCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  everyoneLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 30,
    marginLeft: 10,
  },
  confirmBtn: {
    backgroundColor: '#1A3C6B',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  confirmText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  backBtn: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 10,
  },
  backText: {
    color: '#fff',
    textAlign: 'center',
  },
  bottomImage: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  bgImage: {
    // ปรับแก้ไขส่วนนี้
    width: '111%',
    height: 235,
    bottom: -154,
    alignSelf: 'center',

  },
});
