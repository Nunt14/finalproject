import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';

// ประเภทข้อมูลสำหรับแต่ละบิลที่ค้างจ่าย (หนึ่งการ์ดต่อหนึ่งบิล)
type DebtItem = {
  bill_id: string;
  amount_share: number;
  creditor_id: string;
  creditor_name: string;
  creditor_profile_image?: string | null;
  category_icon?: string;
  category_color?: string;
  bill_label?: string | null;
  trip_name?: string | null;
  created_ts?: number;
  trip_id: string;
};

const CATEGORY_ICON: Record<string, { icon: string; color: string }> = {
  // ตัวอย่าง mapping category_id เป็น icon และสี
  '1': { icon: 'car', color: '#45647C' },
  '2': { icon: 'utensils', color: '#F44336' },
  '3': { icon: 'user', color: '#E91E63' },
  // เพิ่มตาม category_id จริงในฐานข้อมูล
};

export default function DebtScreen() {
  const router = useRouter();
  const [debts, setDebts] = useState<DebtItem[]>([]);

  useEffect(() => {
    fetchDebts();
  }, []);

  const fetchDebts = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    // 1) ดึงรายการ bill_share ที่ผู้ใช้เป็นลูกหนี้ (unpaid)
    const { data: billShares, error: billShareErr } = await supabase
      .from('bill_share')
      .select(`bill_share_id, bill_id, amount_share, status, bill:bill_id (trip_id, paid_by_user_id, category_id, created_at)`)
      .eq('user_id', userId)
      .eq('status', 'unpaid');

    if (billShareErr) {
      console.error(billShareErr);
      return;
    }

    const shares = billShares || [];
    if (shares.length === 0) {
      setDebts([]);
      return;
    }

    // 2) ดึงข้อมูลบิลทั้งหมดที่เกี่ยวข้อง พร้อมข้อมูลผู้จ่าย (payer)
    const billIds = Array.from(new Set(shares.map((s: any) => String(s.bill_id))));
    const { data: billRows, error: billErr } = await supabase
      .from('bill')
      .select('bill_id, trip_id, paid_by_user_id, category_id, created_at, payer:paid_by_user_id ( user_id, full_name, profile_image_url )')
      .in('bill_id', billIds);

    if (billErr) {
      console.error(billErr);
      return;
    }

    const bills = (billRows || []).map((b: any) => ({
      bill_id: String(b.bill_id),
      trip_id: String(b.trip_id),
      paid_by_user_id: String(b.paid_by_user_id),
      category_id: b.category_id == null ? null : String(b.category_id),
      created_at: b.created_at ? new Date(b.created_at).getTime() : 0,
      payer_full_name: b.payer?.full_name ?? null,
      payer_profile_image: (b.payer?.profile_image_url ?? null) as string | null,
    }));

    // 3) ดึงชื่อทริป
    const tripIds = Array.from(new Set(bills.map((b) => b.trip_id)));
    let tripMap = new Map<string, string | null>();
    if (tripIds.length > 0) {
      const { data: tripRows } = await supabase
        .from('trip')
        .select('trip_id, trip_name')
        .in('trip_id', tripIds);
      tripMap = new Map((tripRows || []).map((t: any) => [String(t.trip_id), t.trip_name ?? null]));
    }

    // 4) สร้างรายการการ์ดหนี้แบบต่อบิล
    const items: DebtItem[] = [];
    for (const share of shares) {
      const billId = String(share.bill_id);
      const amountShare = Number(share.amount_share || 0);
      const bill = bills.find((b) => b.bill_id === billId);
      if (!bill) continue;

      const categoryId = bill.category_id || '1';
      const icon = CATEGORY_ICON[categoryId]?.icon || 'car';
      const color = CATEGORY_ICON[categoryId]?.color || '#45647C';

      const shortId = bill.bill_id.slice(-6).toUpperCase();
      items.push({
        bill_id: bill.bill_id,
        amount_share: amountShare,
        creditor_id: bill.paid_by_user_id,
        creditor_name: bill.payer_full_name || 'Unknown',
        creditor_profile_image: bill.payer_profile_image || null,
        category_icon: icon,
        category_color: color,
        bill_label: `Bill #${shortId}`,
        trip_name: tripMap.get(bill.trip_id) || null,
        created_ts: bill.created_at || 0,
        trip_id: bill.trip_id,
      });
    }

    // 5) เรียงรายการตามวันที่ล่าสุด
    items.sort((a, b) => (b.created_ts || 0) - (a.created_ts || 0));

    setDebts(items);
  };

  const renderDebtCard = (debt: DebtItem) => (
    <View key={debt.bill_id} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.amount}>
          {debt.amount_share.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿
        </Text>
        {debt.creditor_profile_image ? (
          <Image
            source={{ uri: debt.creditor_profile_image }}
            style={styles.avatar}
          />
        ) : (
          <Ionicons name="person-circle" size={36} color="#bbb" />
        )}
      </View>

      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <FontAwesome5
            name={debt.category_icon as any}
            size={18}
            color={debt.category_color}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.totalList}>{debt.creditor_name}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/PayDetail', params: { creditorId: debt.creditor_id, tripId: debt.trip_id } })}
        >
          <Ionicons name="eye" size={24} color="#45647C" />
        </TouchableOpacity>
      </View>

      {!!debt.bill_label && (
        <Text style={{ color: '#666', marginTop: 2 }}>Bill: {debt.bill_label}</Text>
      )}
      {!!debt.trip_name && (
        <Text style={{ color: '#666', marginTop: 2 }}>Trip: {debt.trip_name}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debt</Text>
      </View>

      <Text style={styles.subHeader}>Waiting for pay</Text>
      <ScrollView style={styles.scrollContainer}>
        {debts.length === 0 ? (
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 30 }}>ไม่พบหนี้ที่ต้องชำระ</Text>
        ) : (
          debts.map(renderDebtCard)
        )}
      </ScrollView>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: 15 },
  subHeader: { fontSize: 16, color: '#666', marginVertical: 10 },
  scrollContainer: { paddingVertical: 10 },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  amount: { fontSize: 20, fontWeight: 'bold', color: 'red' },
  totalList: { color: '#45647C', fontWeight: '600' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee' },
  creditorName: { fontSize: 15, color: '#333', fontWeight: 'bold', marginTop: 2, marginLeft: 2 },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});
