import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useFocusEffect } from '@react-navigation/native';

type Proof = {
  id: string;
  bill_id: string;
  creditor_id: string;
  debtor_user_id: string;
  amount: number | null;
  image_uri_local?: string | null;
  status?: string | null;
  created_at?: string;
  payment_id?: string | null; // ถ้ามาจากตาราง payment
  source?: 'proof' | 'payment';
};

type UserLite = { user_id: string; full_name: string | null; profile_image_url: string | null };

export default function ConfirmPaymentsScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [userMap, setUserMap] = useState<Map<string, UserLite>>(new Map());
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (!uid) return;

      await fetchProofs(uid);
    };
    run();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (currentUserId) {
        fetchProofs(currentUserId);
      }
    }, [currentUserId])
  );

  // realtime subscribe for new/updated payment proofs for this creditor
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`payment-proofs-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payment_proof', filter: `creditor_id=eq.${currentUserId}` },
        async (payload: any) => {
          const row = payload.new as any;
          const newProof: Proof = {
            id: String(row.id),
            bill_id: String(row.bill_id),
            creditor_id: String(row.creditor_id),
            debtor_user_id: String(row.debtor_user_id),
            amount: row.amount != null ? Number(row.amount) : null,
            image_uri_local: row.image_uri_local ?? null,
            status: row.status ?? null,
            created_at: row.created_at,
          };
          setProofs(prev => [newProof, ...prev]);
          // ensure debtor info is loaded
          if (!userMap.has(newProof.debtor_user_id)) {
            try {
              const { data: users } = await supabase
                .from('user')
                .select('user_id, full_name, profile_image_url')
                .eq('user_id', newProof.debtor_user_id)
                .limit(1);
              if (users && users.length > 0) {
                const u = users[0] as any;
                setUserMap(prev => {
                  const next = new Map(prev);
                  next.set(String(u.user_id), {
                    user_id: String(u.user_id),
                    full_name: u.full_name ?? null,
                    profile_image_url: u.profile_image_url ?? null,
                  });
                  return next;
                });
              }
            } catch {}
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payment' },
        async (payload: any) => {
          const row = payload.new as any;
          if (!row || row.status !== 'pending') return;
          try {
            const { data: bs } = await supabase
              .from('bill_share')
              .select('bill_id, user_id')
              .eq('bill_share_id', row.bill_share_id)
              .single();
            const billId = (bs as any)?.bill_id ? String((bs as any).bill_id) : null;
            const debtorId = (bs as any)?.user_id ? String((bs as any).user_id) : null;
            if (!billId || !debtorId) return;
            const { data: b } = await supabase
              .from('bill')
              .select('paid_by_user_id')
              .eq('bill_id', billId)
              .single();
            const creditor = (b as any)?.paid_by_user_id ? String((b as any).paid_by_user_id) : null;
            if (creditor !== currentUserId) return;
            let imageUrl: string | null = null;
            try {
              const { data: pr } = await supabase
                .from('payment_proof')
                .select('image_uri_local, status')
                .eq('bill_id', billId)
                .eq('debtor_user_id', debtorId)
                .eq('status', 'pending')
                .limit(1)
                .single();
              imageUrl = (pr as any)?.image_uri_local ?? null;
            } catch {}
            const newItem: Proof = {
              id: String(row.payment_id),
              payment_id: String(row.payment_id),
              bill_id: billId,
              creditor_id: currentUserId,
              debtor_user_id: debtorId,
              amount: row.amount != null ? Number(row.amount) : null,
              image_uri_local: imageUrl,
              status: 'pending',
              created_at: row.created_at,
              source: 'payment',
            };
            setProofs(prev => [newItem, ...prev]);
          } catch {}
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payment_proof', filter: `creditor_id=eq.${currentUserId}` },
        (payload: any) => {
          const row = payload.new as any;
          const updatedStatus = row.status as string | null;
          // remove if no longer pending
          if (updatedStatus && updatedStatus !== 'pending') {
            setProofs(prev => prev.filter(x => x.id !== String(row.id)));
          } else {
            setProofs(prev => prev.map(x => x.id === String(row.id) ? {
              ...x,
              amount: row.amount != null ? Number(row.amount) : x.amount,
              image_uri_local: row.image_uri_local ?? x.image_uri_local,
              status: updatedStatus,
            } : x));
          }
        }
      )
      .subscribe();

    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [currentUserId, userMap]);

  const fetchProofs = async (uid: string) => {
    setRefreshing(true);
    try {
      const { data } = await supabase
        .from('payment_proof')
        .select('id, bill_id, creditor_id, debtor_user_id, amount, image_uri_local, status, created_at')
        .eq('creditor_id', uid)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const proofRows: Proof[] = (data || []).map((p: any) => ({
        id: String(p.id),
        bill_id: String(p.bill_id),
        creditor_id: String(p.creditor_id),
        debtor_user_id: String(p.debtor_user_id),
        amount: p.amount != null ? Number(p.amount) : null,
        image_uri_local: p.image_uri_local ?? null,
        status: p.status ?? null,
        created_at: p.created_at,
        payment_id: null,
        source: 'proof',
      }));
      let combined: Proof[] = [...proofRows];
      let paymentsDebugCount = 0;

      // เพิ่มเติม: ดึงจากตาราง payment (pending) แล้ว map เข้ามาเป็นคำขอยืนยัน
      try {
        const { data: pay } = await supabase
          .from('payment')
          .select('payment_id, bill_share_id, amount, status, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        const payments = (pay || []) as any[];
        paymentsDebugCount = payments.length;
        if (payments.length > 0) {
          const billShareIds = payments.map((x) => x.bill_share_id).filter(Boolean);
          let billShareMap = new Map<string, { bill_id: string; debtor_user_id: string }>();
          if (billShareIds.length > 0) {
            const { data: bsRows } = await supabase
              .from('bill_share')
              .select('bill_share_id, bill_id, user_id')
              .in('bill_share_id', billShareIds);
            (bsRows || []).forEach((bs: any) => {
              billShareMap.set(String(bs.bill_share_id), {
                bill_id: String(bs.bill_id),
                debtor_user_id: String(bs.user_id),
              });
            });
          }

          // เตรียมโหลด bill เพื่อหา trip_id และ paid_by_user_id (เจ้าหนี้)
          const billIds = Array.from(new Set(
            Array.from(billShareMap.values()).map((v) => v.bill_id)
          ));
          let billIdToTripId = new Map<string, string | null>();
          let billIdToCreditor = new Map<string, string | null>();
          if (billIds.length > 0) {
            const { data: billRows } = await supabase
              .from('bill')
              .select('bill_id, trip_id, paid_by_user_id')
              .in('bill_id', billIds);
            (billRows || []).forEach((b: any) => {
              billIdToTripId.set(String(b.bill_id), (b.trip_id ? String(b.trip_id) : null));
              billIdToCreditor.set(String(b.bill_id), (b.paid_by_user_id ? String(b.paid_by_user_id) : null));
            });
          }

          // ใช้ bill.paid_by_user_id เป็นตัวระบุ creditor อย่างชัดเจน

          // พยายามดึงรูปจาก payment_proof ถ้ามี
          // เตรียม key สำหรับค้นหา proof: bill_id + debtor_user_id
          const candidatePairs: { bill_id: string; debtor_user_id: string }[] = [];
          payments.forEach((pmt) => {
            const bs = billShareMap.get(String(pmt.bill_share_id));
            if (bs) {
              const billCreditor = billIdToCreditor.get(bs.bill_id);
              if (billCreditor === uid) {
                candidatePairs.push({ bill_id: bs.bill_id, debtor_user_id: bs.debtor_user_id });
              }
            }
          });
          let pairToImage = new Map<string, string | null>();
          if (candidatePairs.length > 0) {
            const uniqueDebtors = Array.from(new Set(candidatePairs.map((c) => c.debtor_user_id)));
            const uniqueBills = Array.from(new Set(candidatePairs.map((c) => c.bill_id)));
            const { data: pr } = await supabase
              .from('payment_proof')
              .select('bill_id, debtor_user_id, image_uri_local, status')
              .in('bill_id', uniqueBills)
              .in('debtor_user_id', uniqueDebtors)
              .eq('status', 'pending');
            (pr || []).forEach((row: any) => {
              pairToImage.set(`${String(row.bill_id)}|${String(row.debtor_user_id)}`, row.image_uri_local ?? null);
            });
          }

          const fromPayments: Proof[] = payments
            .map((pmt) => {
              const bsInfo = billShareMap.get(String(pmt.bill_share_id));
              if (!bsInfo) return null;
              const billCreditor = billIdToCreditor.get(bsInfo.bill_id);
              if (billCreditor !== uid) return null;
              const key = `${bsInfo.bill_id}|${bsInfo.debtor_user_id}`;
              const img = pairToImage.get(key) ?? null;
              return {
                id: String(pmt.payment_id),
                payment_id: String(pmt.payment_id),
                bill_id: bsInfo.bill_id,
                creditor_id: uid,
                debtor_user_id: bsInfo.debtor_user_id,
                amount: pmt.amount != null ? Number(pmt.amount) : null,
                image_uri_local: img,
                status: pmt.status ?? 'pending',
                created_at: pmt.created_at,
                source: 'payment',
              } as Proof;
            })
            .filter(Boolean) as Proof[];

          // กันซ้ำ: ถ้า payment_proof อันเดิมมีอยู่แล้ว ไม่ต้องเพิ่มซ้ำ
          const proofKeys = new Set(proofRows.map((r) => `${r.bill_id}|${r.debtor_user_id}|${r.amount ?? ''}`));
          const uniquePayments = fromPayments.filter((r) => !proofKeys.has(`${r.bill_id}|${r.debtor_user_id}|${r.amount ?? ''}`));
          combined = [...proofRows, ...uniquePayments];
        }
      } catch {}

      setProofs(combined);
      try {
        console.log('[ConfirmPayments] fetchProofs', {
          uid,
          proofRows: proofRows.length,
          paymentRows: paymentsDebugCount,
          combined: combined.length,
        });
      } catch {}

      const uids = Array.from(new Set(combined.map((r) => r.debtor_user_id)));
      if (uids.length > 0) {
        const { data: users } = await supabase
          .from('user')
          .select('user_id, full_name, profile_image_url')
          .in('user_id', uids);
        const map = new Map<string, UserLite>();
        (users || []).forEach((u: any) => map.set(String(u.user_id), {
          user_id: String(u.user_id),
          full_name: u.full_name ?? null,
          profile_image_url: u.profile_image_url ?? null,
        }));
        setUserMap(map);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // เติมรูปให้คำขอจาก payment ที่ยังไม่มีรูป โดยค้นหาจาก payment_proof ล่าสุดตาม bill_id + debtor_user_id
  useEffect(() => {
    const run = async () => {
      const targets = proofs.filter(p => p.source === 'payment' && !p.image_uri_local);
      if (targets.length === 0) return;
      const billIds = Array.from(new Set(targets.map(t => t.bill_id)));
      const debtorIds = Array.from(new Set(targets.map(t => t.debtor_user_id)));
      try {
        const { data: pr } = await supabase
          .from('payment_proof')
          .select('bill_id, debtor_user_id, image_uri_local, created_at')
          .in('bill_id', billIds)
          .in('debtor_user_id', debtorIds)
          .order('created_at', { ascending: false });
        const latestMap = new Map<string, string | null>();
        (pr || []).forEach((row: any) => {
          const key = `${String(row.bill_id)}|${String(row.debtor_user_id)}`;
          if (!latestMap.has(key)) latestMap.set(key, row.image_uri_local ?? null);
        });
        if (latestMap.size > 0) {
          setProofs(prev => prev.map(p => {
            if (p.source === 'payment' && !p.image_uri_local) {
              const key = `${p.bill_id}|${p.debtor_user_id}`;
              const img = latestMap.get(key) ?? null;
              return img ? { ...p, image_uri_local: img } : p;
            }
            return p;
          }));
        }
      } catch {}
    };
    run();
  }, [proofs]);

  const onApprove = async (p: Proof) => {
    try {
      if (p.source === 'payment' && p.payment_id) {
        await supabase.from('payment').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('payment_id', p.payment_id);
      } else {
        await supabase.from('payment_proof').update({ status: 'approved' }).eq('id', p.id);
      }

      if (p.bill_id && p.debtor_user_id) {
        await supabase
          .from('bill_share')
          .update({ status: 'paid', amount_paid: p.amount ?? null, is_confirmed: true })
          .eq('bill_id', p.bill_id)
          .eq('user_id', p.debtor_user_id);

        // อัปเดตสถานะ payment สำหรับ bill_share นี้
        try {
          const { data: bs } = await supabase
            .from('bill_share')
            .select('bill_share_id')
            .eq('bill_id', p.bill_id)
            .eq('user_id', p.debtor_user_id)
            .single();
          const billShareId = (bs as any)?.bill_share_id as string | undefined;
          if (billShareId) {
            await supabase
              .from('payment')
              .update({ status: 'approved', updated_at: new Date().toISOString() })
              .eq('bill_share_id', billShareId);
          }
        } catch {}

        // เพิ่มยอดจ่ายใน debt_summary และอัปเดตสถานะ
        try {
          const { data: currentSession } = await supabase.auth.getSession();
          const creditorUid = currentSession?.session?.user?.id ?? null;
          const { data: bill } = await supabase
            .from('bill')
            .select('trip_id')
            .eq('bill_id', p.bill_id)
            .single();
          const tripId = (bill as any)?.trip_id ?? null;

          if (creditorUid && tripId) {
            const { data: ds } = await supabase
              .from('debt_summary')
              .select('debt_id, amount_owed, amount_paid')
              .eq('trip_id', tripId)
              .eq('debtor_user', p.debtor_user_id)
              .eq('creditor_user', creditorUid)
              .single();

            const prevPaid = (ds as any)?.amount_paid ?? 0;
            const owed = (ds as any)?.amount_owed ?? null;
            const newPaid = prevPaid + (p.amount ?? 0);
            const newStatus = owed != null && newPaid >= Number(owed) ? 'settled' : 'partial';

            if (ds) {
              await supabase
                .from('debt_summary')
                .update({ amount_paid: newPaid, status: newStatus, last_update: new Date().toISOString() })
                .eq('debt_id', (ds as any).debt_id);
            }
          }

          // ส่งการแจ้งเตือนไปยังลูกหนี้ว่าได้รับการยืนยันการชำระเงินแล้ว
          try {
            await supabase.from('notification').insert({
              user_id: p.debtor_user_id,
              title: 'การชำระเงิน',
              message: 'ชำระเงินเสร็จสิ้น ระบบได้ยืนยันแล้ว',
              is_read: false,
              trip_id: (bill as any)?.trip_id ?? null,
            });
          } catch {}
        } catch {}
      }

      setProofs((prev) => prev.filter((x) => x.id !== p.id));
      Alert.alert('Confirmed', 'ยืนยันการชำระเงินเรียบร้อย');
    } catch (e) {
      Alert.alert('Error', 'ไม่สามารถยืนยันได้');
    }
  };

  const onReject = async (p: Proof) => {
    try {
      if (p.source === 'payment' && p.payment_id) {
        await supabase.from('payment').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('payment_id', p.payment_id);
      } else {
        await supabase.from('payment_proof').update({ status: 'rejected' }).eq('id', p.id);
      }
      // อัปเดต payment ให้เป็น rejected ด้วย
      try {
        const { data: bs } = await supabase
          .from('bill_share')
          .select('bill_share_id')
          .eq('bill_id', p.bill_id)
          .eq('user_id', p.debtor_user_id)
          .single();
        const billShareId = (bs as any)?.bill_share_id as string | undefined;
        if (billShareId) {
          await supabase
            .from('payment')
            .update({ status: 'rejected', updated_at: new Date().toISOString() })
            .eq('bill_share_id', billShareId);
        }
      } catch {}
      setProofs((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      Alert.alert('Error', 'ไม่สามารถปฏิเสธได้');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
            else router.replace('/');
          }}
        >
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Payment</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: proofs.length === 0 ? 1 : undefined }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => currentUserId && fetchProofs(currentUserId)} />}
      >
        {proofs.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="document-text-outline" size={48} color="#ccc" />
            <Text style={{ marginTop: 12, color: '#666' }}>ยังไม่มีคำขอยืนยันการชำระเงิน</Text>
            <TouchableOpacity style={[styles.circle, { backgroundColor: '#234080', marginTop: 14 }]} onPress={() => currentUserId && fetchProofs(currentUserId)}>
              <Ionicons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : proofs.map((p) => {
          const debtor = userMap.get(p.debtor_user_id);
          return (
            <View key={p.id} style={styles.card}>
              {p.image_uri_local ? (
                <Image source={{ uri: p.image_uri_local }} style={styles.thumb} />
              ) : (
                <View style={styles.thumbPlaceholder}>
                  <Ionicons name="image" size={20} color="#666" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.amountText}>{(p.amount ?? 0).toLocaleString()} ฿</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  {debtor?.profile_image_url ? (
                    <Image source={{ uri: debtor.profile_image_url }} style={styles.avatar} />
                  ) : (
                    <Ionicons name="person-circle" size={26} color="#4C6EF5" />
                  )}
                  <Text style={{ marginLeft: 6 }}>{debtor?.full_name || 'User'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => router.push({ pathname: '/ConfirmSlip', params: p.source === 'payment' ? { imageUri: p.image_uri_local || '' } : { proofId: p.id } })}
              >
                <Ionicons name="eye" size={20} color="#213a5b" />
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.circle, { backgroundColor: '#ff3b30' }]} onPress={() => onReject(p)}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.circle, { backgroundColor: '#2fbf71' }]} onPress={() => onApprove(p)}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumb: { width: 64, height: 64, borderRadius: 8, marginRight: 10 },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountText: { fontSize: 18, fontWeight: 'bold', color: '#e53935' },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  eyeBtn: { paddingHorizontal: 10 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  circle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});


