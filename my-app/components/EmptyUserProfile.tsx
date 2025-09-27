import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface EmptyUserProfileProps {
  onCompleteProfile?: () => void;
}

export default function EmptyUserProfile({ onCompleteProfile }: EmptyUserProfileProps) {
  const handleCompleteProfile = () => {
    if (onCompleteProfile) {
      onCompleteProfile();
    } else {
      // ไปที่หน้า ProfileEdit เพื่อเพิ่มข้อมูล
      router.push('/ProfileEdit');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="person-outline" size={64} color="#666" />
      </View>
      
      <Text style={styles.title}>โปรไฟล์ของคุณยังไม่สมบูรณ์</Text>
      <Text style={styles.subtitle}>
        กรุณาเพิ่มข้อมูลส่วนตัวของคุณเพื่อใช้งานแอปได้อย่างเต็มที่
      </Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleCompleteProfile}
      >
        <Text style={styles.buttonText}>เพิ่มข้อมูลโปรไฟล์</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
