import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';

type BillItem = {
  bill_id: string;
  trip_id: string;
  note?: string | null;
  total_amount: number;
  payer_user_id?: string | null;
  per_user?: Array<{ user_id: string; amount: number }>; // optional breakdown
  created_at?: string;
};

export default function TripScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [trip, setTrip] = useState<any | null>(null);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!tripId) return;

        // ดึงข้อมูลทริป
        const { data: tripRows } = await supabase
          .from('trip')
          .select('*')
          .eq('trip_id', tripId)
          .limit(1);
        setTrip(tripRows?.[0] || null);

        // ถ้ายังไม่มีตารางบิลในฐานข้อมูล โค้ดนี้จะแสดงตัวอย่าง placeholder UI
        // หากมีตารางจริง ให้เปลี่ยนการ query ที่นี่ เช่น .from('bill')/.from('expenses') เป็นต้น
        const { data: billRows } = await supabase
          .from('bill')
          .select('bill_id, trip_id, note, total_amount, payer_user_id, created_at')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: false });

        if (billRows) {
          setBills(
            billRows.map((b: any) => ({
              bill_id: String(b.bill_id),
              trip_id: String(b.trip_id),
              note: b.note,
              total_amount: Number(b.total_amount || 0),
              payer_user_id: b.payer_user_id,
              created_at: b.created_at,
            }))
          );
        } else {
          setBills([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tripId]);

  const totalAmount = useMemo(() => bills.reduce((sum, b) => sum + (b.total_amount || 0), 0), [bills]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Trip</Text>
      </View>

      {/* Trip summary */}
      <View style={{ paddingHorizontal: 4 }}>
        <Text style={styles.tripName}>{trip?.trip_name || 'Trip'}</Text>
        <Text style={styles.totalText}>Total {totalAmount.toLocaleString()} ฿</Text>
      </View>

      {/* Bills list */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {bills.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={{ color: '#666' }}>ยังไม่มีบิลในทริปนี้</Text>
          </View>
        )}

        {bills.map((bill) => (
          <View key={bill.bill_id} style={styles.billCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.amount}>{bill.total_amount.toLocaleString()} ฿</Text>
              <Ionicons name="person-circle" size={30} color="#4C6EF5" />
            </View>
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.noteText}>Note: {bill.note || '-'}</Text>
            </View>
            <TouchableOpacity style={styles.payButton}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Pay</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Bottom actions (mock) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.push('/Debt')}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bag" size={26} color="#fff" />
            <Text style={styles.bagText}>DEBT</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.circleBtn} onPress={() => router.push(`/AddBill?tripId=${tripId}`)}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.circleBtn}>
          <FontAwesome5 name="dollar-sign" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  tripName: { fontWeight: 'bold', color: '#1A3C6B', marginBottom: 4 },
  totalText: { color: '#2FBF71', fontWeight: 'bold' },
  billCard: {
    backgroundColor: '#f7f7fb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  amount: { fontSize: 18, fontWeight: 'bold', color: 'red' },
  noteText: { color: '#888' },
  payButton: { backgroundColor: '#1A3C6B', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 10,
    left: 16,
    right: 16,
    height: 72,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 10,
  },
  circleBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A3C6B', alignItems: 'center', justifyContent: 'center' },
  bagText: { position: 'absolute', bottom: 8, color: '#fff', fontSize: 10, fontWeight: 'bold' },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, alignSelf: 'center', zIndex: -1 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
});


