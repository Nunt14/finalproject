// นำเข้า React และ components ที่จำเป็น
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../constants/types';

// หน้าจอการแจ้งเตือน (Notification Screen)
export default function NotificationScreen() {
  // ใช้ navigation hook สำหรับการนำทางระหว่างหน้าจอ
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Notification'>>();

  return (
    <View style={styles.container}>
      {/* ส่วนหัวของหน้าจอ */}
      <View style={styles.header}>
        {/* ปุ่มย้อนกลับ */}
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        {/* ชื่อหน้าจอ */}
        <Text style={styles.headerTitle}>Notification</Text>
        {/* ตัวช่วยจัดตำแหน่งให้ชื่ออยู่ตรงกลาง */}
        <View style={styles.headerSpacer} />
      </View>

      {/* ส่วนเนื้อหาหลักที่สามารถเลื่อนได้ */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* ส่วนการแจ้งเตือนของวันนี้ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>
          
          {/* การแจ้งเตือนแรก: Few เพิ่มคุณเข้าไปในทริป */}
          <View style={styles.notificationItem}>
            {/* ไอคอนโปรไฟล์สีชมพูอ่อน */}
            <View style={[styles.profileIcon, { backgroundColor: '#FFB6C1' }]}>
              <Ionicons name="person" size={20} color="white" />
            </View>
            {/* เนื้อหาการแจ้งเตือน */}
            <View style={styles.notificationContent}>
              <Text style={styles.notificationText}>
                <Text style={styles.nameText}>Few</Text> added you to{' '}
                <Text style={styles.tripText}>Nakhon NaYok Trip</Text>
              </Text>
            </View>
            {/* ปุ่มดูรายละเอียด */}
            <TouchableOpacity style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View</Text>
            </TouchableOpacity>
          </View>

          {/* การแจ้งเตือนที่สอง: Bam จ่ายเงินให้คุณ */}
          <View style={styles.notificationItem}>
            {/* ไอคอนโปรไฟล์สีเขียวอ่อน */}
            <View style={[styles.profileIcon, { backgroundColor: '#90EE90' }]}>
              <Ionicons name="person" size={20} color="white" />
            </View>
            {/* เนื้อหาการแจ้งเตือน */}
            <View style={styles.notificationContent}>
              <Text style={styles.notificationText}>
                <Text style={styles.nameText}>Bam</Text> paid you{' '}
                <Text style={styles.amountText}>130.00 ฿</Text>
              </Text>
              <Text style={styles.notificationText}>
                Bill Food from{' '}
                <Text style={styles.tripText}>Nakhon NaYok Trip</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* ส่วนการแจ้งเตือนของเมื่อวาน */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yesterday</Text>
          
          {/* การแจ้งเตือน: Jenny จ่ายเงินให้คุณ */}
          <View style={styles.notificationItem}>
            {/* ไอคอนโปรไฟล์สีแดง */}
            <View style={[styles.profileIcon, { backgroundColor: '#FF6B6B' }]}>
              <Ionicons name="person" size={20} color="white" />
            </View>
            {/* เนื้อหาการแจ้งเตือน */}
            <View style={styles.notificationContent}>
              <Text style={styles.notificationText}>
                <Text style={styles.nameText}>Jenny</Text> paid you{' '}
                <Text style={styles.amountText}>850.00 ฿</Text>
              </Text>
              <Text style={styles.notificationText}>
                Bill Accomodation from{' '}
                <Text style={styles.tripText}>Chiang Mai</Text>
              </Text>
            </View>
          </View>
        </View>

        
      </ScrollView>
    </View>
  );
}

// สไตล์ของคอมโพเนนต์ทั้งหมด
const styles = StyleSheet.create({
  // คอนเทนเนอร์หลัก
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // ส่วนหัวของหน้าจอ
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  // ชื่อหน้าจอ
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
  // ตัวช่วยจัดตำแหน่งให้ชื่ออยู่ตรงกลาง
  headerSpacer: {
    width: 24,
  },
  // ส่วนเนื้อหาหลัก
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // ส่วนของแต่ละหมวดหมู่
  section: {
    marginTop: 20,
  },
  // ชื่อหมวดหมู่
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 15,
  },
  // รายการการแจ้งเตือนแต่ละรายการ
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  // ไอคอนโปรไฟล์
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  // เนื้อหาการแจ้งเตือน
  notificationContent: {
    flex: 1,
  },
  // ข้อความการแจ้งเตือน
  notificationText: {
    fontSize: 14,
    color: 'black',
    lineHeight: 20,
  },
  // ชื่อผู้ใช้ (ตัวหนา)
  nameText: {
    fontWeight: '600',
  },
  // ชื่อทริป (สีน้ำเงิน)
  tripText: {
    color: '#1A3C6B',
    fontWeight: '600',
  },
  // จำนวนเงิน (สีเขียว)
  amountText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  // ปุ่มดูรายละเอียด
  viewButton: {
    backgroundColor: '#1A3C6B',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  // ข้อความในปุ่มดูรายละเอียด
  viewButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // คอนเทนเนอร์ของภาพประกอบภูเขา
  mountainContainer: {
    height: 200,
    marginTop: 40,
    position: 'relative',
  },
  
});
