import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';

// ประเภทข้อมูลสำหรับแต่ละเจ้าหนี้
type DebtGroup = {
  creditor_id: string;
  creditor_name: string;
  creditor_profile_image?: string | null;
  total_amount: number;
  list_count: number;
  category_icon?: string;
  category_color?: string;
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
  const [debts, setDebts] = useState<DebtGroup[]>([]);

  useEffect(() => {
    fetchDebts();
  }, []);

  const fetchDebts = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    // 1. ดึง bill_share ที่ user เป็นลูกหนี้และยังไม่จ่าย
    const { data: billShares, error } = await supabase
      .from('bill_share')
      .select(`
        bill_share_id,
        bill_id,
        amount_share,
        status,
        bill:bill_id (
          bill_id,
          paid_by_user_id,
          category_id
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'unpaid');

    if (error) {
      console.error(error);
      return;
    }

    // 2. รวมยอดตาม creditor (paid_by_user_id) + category
    const groupMap: { [key: string]: DebtGroup } = {};
    for (const row of billShares || []) {
      const creditorId = row.bill?.paid_by_user_id;
      const categoryId = row.bill?.category_id?.toString() || '1';
      if (!creditorId) continue;
      const groupKey = `${creditorId}_${categoryId}`;
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = {
          creditor_id: creditorId,
          creditor_name: '',
          creditor_profile_image: '',
          total_amount: 0,
          list_count: 0,
          category_icon: CATEGORY_ICON[categoryId]?.icon || 'car',
          category_color: CATEGORY_ICON[categoryId]?.color || '#45647C',
        };
      }
      groupMap[groupKey].total_amount += Number(row.amount_share || 0);
      groupMap[groupKey].list_count += 1;
    }

    // 3. ดึงข้อมูล creditor (user) ทีเดียว
    const creditorIds = Array.from(new Set(Object.values(groupMap).map(g => g.creditor_id)));
    let creditors: any[] = [];
    if (creditorIds.length > 0) {
      const { data: userRows } = await supabase
        .from('user')
        .select('user_id, full_name, profile_image')
        .in('user_id', creditorIds);
      creditors = userRows || [];
    }

    // 4. ใส่ชื่อและรูป creditor
    Object.values(groupMap).forEach(g => {
      const u = creditors.find(u => u.user_id === g.creditor_id);
      g.creditor_name = u?.full_name || 'Unknown';
      g.creditor_profile_image = u?.profile_image || null;
    });

    setDebts(Object.values(groupMap));
  };

  const renderDebtCard = (debt: DebtGroup) => (
    <View key={debt.creditor_id + debt.category_icon} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.amount}>
          {debt.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿
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
          <Text style={styles.totalList}>Total: {debt.list_count} list</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/PayDetail', params: { creditorId: debt.creditor_id } })}
        >
          <Ionicons name="eye" size={24} color="#45647C" />
        </TouchableOpacity>
      </View>
      <Text style={styles.creditorName}>{debt.creditor_name}</Text>
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
  totalList: { color: '#45647C' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee' },
  creditorName: { fontSize: 15, color: '#333', fontWeight: 'bold', marginTop: 2, marginLeft: 2 },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});
