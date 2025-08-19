import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../constants/supabase';

type BillDetail = {
  bill_id: string;
  trip_name?: string;
  amount_share: number;
  status: string;
  bill_created_at?: string;
};

export default function PayDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { creditorId } = route.params as { creditorId: string };
  const [bills, setBills] = useState<BillDetail[]>([]);
  const [creditor, setCreditor] = useState<{ full_name: string; profile_image?: string | null } | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchPayDetail();
  }, []);

  const fetchPayDetail = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    // 1. ดึง bill_share ที่ต้องจ่ายให้ creditor นี้
    const { data, error } = await supabase
      .from('bill_share')
      .select(`
        bill_id,
        amount_share,
        status,
        bill:bill_id (
          created_at,
          trip:trip_id (
            trip_name
          ),
          paid_by_user_id
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'unpaid');

    if (error) {
      console.error(error);
      return;
    }

    // 2. filter เฉพาะ bill ที่ paid_by_user_id === creditorId
    const filtered = (data || []).filter((row: any) => row.bill?.paid_by_user_id === creditorId);

    // 3. ดึงข้อมูล creditor (user)
    let creditorInfo = null;
    if (filtered.length > 0) {
      const { data: userRows } = await supabase
        .from('user')
        .select('full_name, profile_image')
        .eq('user_id', creditorId)
        .single();
      creditorInfo = userRows;
    }

    // 4. สร้าง list และยอดรวม
    let sum = 0;
    const billList: BillDetail[] = [];
    filtered.forEach((row: any) => {
      sum += Number(row.amount_share || 0);
      billList.push({
        bill_id: row.bill_id,
        trip_name: row.bill?.trip?.trip_name || '-',
        amount_share: row.amount_share,
        status: row.status,
        bill_created_at: row.bill?.created_at,
      });
    });

    setBills(billList);
    setTotal(sum);
    setCreditor(creditorInfo);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Waiting for pay</Text>
      </View>

      <View style={styles.creditorSection}>
        {creditor?.profile_image ? (
          <Image source={{ uri: creditor.profile_image }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={50} color="#bbb" />
        )}
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.creditorName}>{creditor?.full_name || '-'}</Text>
          <Text style={styles.unpaidText}>Unpaid</Text>
        </View>
        <Text style={styles.totalAmount}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</Text>
      </View>

      <Text style={styles.allListTitle}>All List</Text>
      <ScrollView style={{ flex: 1 }}>
        {bills.map((bill) => (
          <View key={bill.bill_id} style={styles.billCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripName}>{bill.trip_name}</Text>
              <Text style={styles.billAmount}>{bill.amount_share.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</Text>
            </View>
            <TouchableOpacity style={styles.payButton}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Pay</Text>
            </TouchableOpacity>
            <Ionicons name="eye" size={22} color="#45647C" style={{ marginLeft: 10 }} />
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.payAllButton}>
        <Text style={styles.payAllButtonText}>Pay All</Text>
      </TouchableOpacity>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  creditorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
  creditorName: { fontSize: 18, fontWeight: 'bold' },
  unpaidText: { color: 'red', fontWeight: 'bold', fontSize: 15 },
  totalAmount: { marginLeft: 'auto', color: 'red', fontWeight: 'bold', fontSize: 20 },
  allListTitle: { fontSize: 16, color: '#666', marginVertical: 10 },
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tripName: { fontSize: 15, fontWeight: 'bold', color: '#234' },
  billAmount: { color: 'red', fontWeight: 'bold', fontSize: 14 },
  payButton: {
    backgroundColor: '#234080',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 10,
  },
  payAllButton: {
    backgroundColor: '#234080',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  payAllButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});