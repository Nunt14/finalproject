import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../constants/supabase';

// ประเภทข้อมูลสำหรับการ์ดแบบรวมต่อผู้ให้เครดิต (หนึ่งการ์ดต่อหนึ่งผู้ให้เครดิต)
type DebtItem = {
  creditor_id: string;
  creditor_name: string;
  creditor_profile_image?: string | null;
  total_amount: number; // รวมจากทุกทริปที่ยังไม่ชำระ
  trip_count: number; // จำนวนทริปที่ติดหนี้กับผู้ใช้คนนี้
  last_created_ts?: number; // สำหรับเรียงเวลา
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
  const [pendingConfirms, setPendingConfirms] = useState<Array<{ creditor_id: string; creditor_name: string; creditor_profile_image?: string | null; total_amount: number }>>([]);
  const [confirmedPays, setConfirmedPays] = useState<Array<{ creditor_id: string; creditor_name: string; creditor_profile_image?: string | null; total_amount: number }>>([]);

  useEffect(() => {
    fetchDebts();
  }, []);

  // รีเฟรชทุกครั้งเมื่อหน้าได้รับโฟกัส (หลังอัปโหลดสลิปแล้วกลับมา)
  useFocusEffect(
    React.useCallback(() => {
      fetchDebts();
    }, [])
  );

  const fetchDebts = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    // 1) ดึงรายการ bill_share ที่ผู้ใช้เป็นลูกหนี้ (unpaid)
    const { data: billShares, error: billShareErr } = await supabase
      .from('bill_share')
      .select(`bill_share_id, bill_id, amount_share, status, bill:bill_id (trip_id, paid_by_user_id, created_at)`)
      .eq('user_id', userId)
      .eq('status', 'unpaid');

    if (billShareErr) {
      console.error(billShareErr);
      return;
    }

    const shares = billShares || [];

    // 2) รวมยอดตามผู้ให้เครดิต (paid_by_user_id) และนับจำนวนทริป
    type Acc = { total: number; tripIds: Set<string>; lastCreated: number };
    const byCreditor = new Map<string, Acc>();
    const creditorIds = new Set<string>();

    if (shares.length > 0) {
      for (const s of shares as any[]) {
        const bill = s.bill;
        if (!bill) continue;
        const creditorId = String(bill.paid_by_user_id);
        const tripId = bill.trip_id ? String(bill.trip_id) : '';
        const createdTs = bill.created_at ? new Date(bill.created_at).getTime() : 0;
        const amount = Number(s.amount_share || 0);

        creditorIds.add(creditorId);
        const acc = byCreditor.get(creditorId) || { total: 0, tripIds: new Set<string>(), lastCreated: 0 };
        acc.total += amount;
        if (tripId) acc.tripIds.add(tripId);
        acc.lastCreated = Math.max(acc.lastCreated, createdTs);
        byCreditor.set(creditorId, acc);
      }
    }

    // 3) อ่านสถานะการชำระจาก payment_proof ของผู้ใช้นี้
    const { data: proofs } = await supabase
      .from('payment_proof')
      .select('creditor_id, amount, status')
      .eq('debtor_user_id', userId)
      .in('status', ['pending', 'approved']);

    const aggPending = new Map<string, number>();
    const aggConfirmed = new Map<string, number>();
    const proofCreditorIds = new Set<string>();
    (proofs || []).forEach((p: any) => {
      const cid = String(p.creditor_id);
      const amt = Number(p.amount || 0);
      proofCreditorIds.add(cid);
      if (p.status === 'pending') aggPending.set(cid, (aggPending.get(cid) || 0) + amt);
      if (p.status === 'approved') aggConfirmed.set(cid, (aggConfirmed.get(cid) || 0) + amt);
    });

    // 3.1) Fallback: อ่านจากตาราง payment (กรณีไม่ได้เขียน payment_proof)
    try {
      const { data: payRows } = await supabase
        .from('payment')
        .select('payment_id, bill_share_id, amount, status')
        .in('status', ['pending', 'approved']);
      const payments = (payRows || []) as any[];
      if (payments.length > 0) {
        const bsIds = Array.from(new Set(payments.map((p) => String(p.bill_share_id)).filter(Boolean)));
        let bsMap = new Map<string, { user_id: string; bill_id: string }>();
        if (bsIds.length > 0) {
          const { data: bsRows } = await supabase
            .from('bill_share')
            .select('bill_share_id, user_id, bill_id')
            .in('bill_share_id', bsIds);
          (bsRows || []).forEach((bs: any) => bsMap.set(String(bs.bill_share_id), { user_id: String(bs.user_id), bill_id: String(bs.bill_id) }));
        }
        const billIds = Array.from(new Set(Array.from(bsMap.values()).map((v) => v.bill_id)));
        let billToCreditor = new Map<string, string>();
        if (billIds.length > 0) {
          const { data: billRows } = await supabase
            .from('bill')
            .select('bill_id, paid_by_user_id')
            .in('bill_id', billIds);
          (billRows || []).forEach((b: any) => billToCreditor.set(String(b.bill_id), String(b.paid_by_user_id)));
        }

        for (const p of payments) {
          const bs = bsMap.get(String(p.bill_share_id));
          if (!bs || String(bs.user_id) !== String(userId)) continue; // ensure debtor is current user
          const creditor = billToCreditor.get(bs.bill_id);
          if (!creditor) continue;
          const amt = Number(p.amount || 0);
          proofCreditorIds.add(creditor);
          if (p.status === 'pending') aggPending.set(creditor, (aggPending.get(creditor) || 0) + amt);
          if (p.status === 'approved') aggConfirmed.set(creditor, (aggConfirmed.get(creditor) || 0) + amt);
        }
      }
    } catch {}

    // 4) ดึงข้อมูลผู้ให้เครดิตทั้งหมด (รวมจาก unpaid และ proofs)
    const ids = Array.from(new Set<string>([...Array.from(creditorIds), ...Array.from(proofCreditorIds)]));
    let userMap = new Map<string, { full_name: string | null; profile_image_url: string | null }>();
    if (ids.length > 0) {
      const { data: users } = await supabase
        .from('user')
        .select('user_id, full_name, profile_image_url')
        .in('user_id', ids);
      userMap = new Map((users || []).map((u: any) => [String(u.user_id), { full_name: u.full_name ?? null, profile_image_url: u.profile_image_url ?? null }]));
    }

    // 4) แปลงเป็นรายการการ์ด (Waiting for pay)
    const items: DebtItem[] = Array.from(byCreditor.entries()).map(([cid, acc]) => ({
      creditor_id: cid,
      creditor_name: userMap.get(cid)?.full_name || 'Unknown',
      creditor_profile_image: userMap.get(cid)?.profile_image_url || null,
      total_amount: acc.total,
      trip_count: acc.tripIds.size,
      last_created_ts: acc.lastCreated,
    }));

    // 5) เรียงตามยอดรวมมากไปน้อย หรือเวลาล่าสุด
    items.sort((a, b) => b.total_amount - a.total_amount || (b.last_created_ts || 0) - (a.last_created_ts || 0));

    setDebts(items);

    // 6) สร้างรายการ Already Paid (pending/confirmed)
    const pendings = Array.from(aggPending.entries()).map(([cid, total]) => ({
      creditor_id: cid,
      creditor_name: userMap.get(cid)?.full_name || 'Unknown',
      creditor_profile_image: userMap.get(cid)?.profile_image_url || null,
      total_amount: total,
    }));
    const confirmeds = Array.from(aggConfirmed.entries()).map(([cid, total]) => ({
      creditor_id: cid,
      creditor_name: userMap.get(cid)?.full_name || 'Unknown',
      creditor_profile_image: userMap.get(cid)?.profile_image_url || null,
      total_amount: total,
    }));
    setPendingConfirms(pendings);
    setConfirmedPays(confirmeds);
  };

  const renderDebtCard = (debt: DebtItem) => (
    <View key={debt.creditor_id} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.amount}>
          {Number(debt.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿
        </Text>
        {debt.creditor_profile_image ? (
          <Image source={{ uri: debt.creditor_profile_image }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={36} color="#bbb" />
        )}
      </View>

      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <FontAwesome5 name="globe" size={18} color="#45647C" style={{ marginRight: 6 }} />
          <Text style={styles.totalList}>Total : {debt.trip_count} list</Text>
        </View>
        <TouchableOpacity onPress={() => router.push({ pathname: '/PayDetail', params: { creditorId: debt.creditor_id } })}>
          <Ionicons name="eye" size={24} color="#45647C" />
        </TouchableOpacity>
      </View>
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

        {(pendingConfirms.length > 0 || confirmedPays.length > 0) && (
          <>
            <Text style={[styles.subHeader, { marginTop: 12 }]}>Already Paid</Text>
            {pendingConfirms.map((p) => (
              <View key={`p-${p.creditor_id}`} style={[styles.card, { borderColor: '#FFE7A2' }]}> 
                <View style={styles.rowBetween}>
                  <Text style={[styles.amount, { color: '#F4B400' }]}>{Number(p.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</Text>
                  {p.creditor_profile_image ? (
                    <Image source={{ uri: p.creditor_profile_image }} style={styles.avatar} />
                  ) : (
                    <Ionicons name="person-circle" size={36} color="#F4B400" />
                  )}
                </View>
                <View style={styles.rowBetween}>
                  <View style={styles.row}>
                    <FontAwesome5 name="clock" size={18} color="#F4B400" style={{ marginRight: 6 }} />
                    <Text style={styles.totalList}>Waiting for confirm</Text>
                  </View>
                </View>
              </View>
            ))}
            {confirmedPays.map((c) => (
              <View key={`c-${c.creditor_id}`} style={[styles.card, { borderColor: '#B7EAC8' }]}> 
                <View style={styles.rowBetween}>
                  <Text style={[styles.amount, { color: '#2FBF71' }]}>{Number(c.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿</Text>
                  {c.creditor_profile_image ? (
                    <Image source={{ uri: c.creditor_profile_image }} style={styles.avatar} />
                  ) : (
                    <Ionicons name="person-circle" size={36} color="#2FBF71" />
                  )}
                </View>
                <View style={styles.rowBetween}>
                  <View style={styles.row}>
                    <FontAwesome5 name="check-circle" size={18} color="#2FBF71" style={{ marginRight: 6 }} />
                    <Text style={styles.totalList}>Confirmed</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
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
