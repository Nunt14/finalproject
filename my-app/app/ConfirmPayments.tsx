import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, RefreshControl, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../constants/supabase';
import { runOcrOnImage } from '../utils/ocr';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

type Proof = {
  id: string;
  bill_id: string;
  creditor_id: string;
  debtor_user_id: string;
  amount: number | null;
  image_uri_local?: string | null;
  slip_qr?: string | null;
  status?: string | null;
  created_at?: string;
  payment_id?: string | null; 
  source?: 'proof' | 'payment';
};

type UserLite = { user_id: string; full_name: string | null; profile_image_url: string | null };

export default function ConfirmPaymentsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { t } = useLanguage();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [userMap, setUserMap] = useState<Map<string, UserLite>>(new Map());
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [ocrMap, setOcrMap] = useState<Map<string, { loading: boolean; amount: number | null; status: 'pending' | 'matched' | 'mismatch' | 'error' }>>(new Map());
  const [totalDebt, setTotalDebt] = useState<number>(0);

  const fetchTotalDebt = async (userId: string) => {
    try {
      // If tripId is provided, compute outstanding from base tables for accuracy
      if (tripId) {
        const { data: bills, error: billsErr } = await supabase
          .from('bill')
          .select('bill_id')
          .eq('trip_id', tripId)
          .eq('paid_by_user_id', userId);
        if (billsErr) throw billsErr;
        const billIds = (bills || []).map((b: any) => String(b.bill_id));
        if (billIds.length === 0) {
          setTotalDebt(0);
          return;
        }

        const { data: shares, error: sharesErr } = await supabase
          .from('bill_share')
          .select('bill_share_id, amount_share, bill_id, user_id')
          .in('bill_id', billIds)
          .neq('user_id', userId);
        if (sharesErr) throw sharesErr;
        const shareIds = (shares || []).map((s: any) => String(s.bill_share_id));

        let approvedByShare = new Map<string, number>();
        if (shareIds.length > 0) {
          const { data: pays } = await supabase
            .from('payment')
            .select('bill_share_id, amount, status')
            .eq('status', 'approved')
            .in('bill_share_id', shareIds);
          (pays || []).forEach((p: any) => {
            const id = String(p.bill_share_id);
            const prev = approvedByShare.get(id) || 0;
            approvedByShare.set(id, prev + Number(p.amount || 0));
          });
        }

        const totalOutstanding = (shares || []).reduce((sum: number, s: any) => {
          const owed = Number(s.amount_share || 0);
          const approved = approvedByShare.get(String(s.bill_share_id)) || 0;
          const remain = Math.max(0, owed - approved);
          return sum + remain;
        }, 0);
        setTotalDebt(totalOutstanding);
        return;
      }

      // Fallback: sum across all trips from debt_summary
      const { data, error } = await supabase
        .from('debt_summary')
        .select('amount_owed, amount_paid')
        .eq('creditor_user', userId);
      if (error) throw error;
      const total = data?.reduce((sum, item) => sum + ((Number(item.amount_owed) || 0) - (Number(item.amount_paid) || 0)), 0) || 0;
      setTotalDebt(total);
    } catch (error) {
      console.error('Error fetching total debt:', error);
    }
  };

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (!uid) return;

      await Promise.all([
        fetchProofs(uid),
        fetchTotalDebt(uid)
      ]);
    };
    run();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (currentUserId) {
        Promise.all([
          fetchProofs(currentUserId),
          fetchTotalDebt(currentUserId)
        ]);
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
            slip_qr: row.slip_qr ?? null,
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
              .maybeSingle();
            const billId = (bs as any)?.bill_id ? String((bs as any).bill_id) : null;
            const debtorId = (bs as any)?.user_id ? String((bs as any).user_id) : null;
            if (!billId || !debtorId) return;
            const { data: b } = await supabase
              .from('bill')
              .select('paid_by_user_id')
              .eq('bill_id', billId)
              .maybeSingle();
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
                .maybeSingle();
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
              slip_qr: row.slip_qr ?? null,
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
              slip_qr: row.slip_qr ?? x.slip_qr,
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
      let base = supabase
        .from('payment_proof')
        .select('id, bill_id, creditor_id, debtor_user_id, amount, image_uri_local, slip_qr, status, created_at')
        .eq('creditor_id', uid)
        .eq('status', 'pending');
      if (tripId) {
        const { data: billsInTrip } = await supabase.from('bill').select('bill_id').eq('trip_id', tripId);
        const ids = (billsInTrip || []).map((b: any) => b.bill_id);
        base = base.in('bill_id', ids);
      }
      const { data } = await base.order('created_at', { ascending: false });

      const proofRows: Proof[] = (data || []).map((p: any) => ({
        id: String(p.id),
        bill_id: String(p.bill_id),
        creditor_id: String(p.creditor_id),
        debtor_user_id: String(p.debtor_user_id),
        amount: p.amount != null ? Number(p.amount) : null,
        image_uri_local: p.image_uri_local ?? null,
        slip_qr: p.slip_qr ?? null,
        status: p.status ?? null,
        created_at: p.created_at,
        payment_id: null,
        source: 'proof',
      }));
      let combined: Proof[] = [...proofRows];
      let paymentsDebugCount = 0;

      // เพิ่มเติม: ดึงจากตาราง payment (pending) แล้ว map เข้ามาเป็นคำขอยืนยัน
      try {
        let payQuery = supabase
          .from('payment')
          .select('payment_id, bill_share_id, amount, status, created_at, slip_qr')
          .eq('status', 'pending');
        if (tripId) {
          const { data: bsBills } = await supabase
            .from('bill_share')
            .select('bill_share_id, bill_id');
          const { data: billRows } = await supabase
            .from('bill')
            .select('bill_id')
            .eq('trip_id', tripId);
          const billIdSet = new Set((billRows || []).map((b: any) => String(b.bill_id)));
          const billShareIds = (bsBills || [])
            .filter((x: any) => billIdSet.has(String(x.bill_id)))
            .map((x: any) => String(x.bill_share_id));
          payQuery = payQuery.in('bill_share_id', billShareIds);
        }
        const { data: pay } = await payQuery.order('created_at', { ascending: false });

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

          const fromPayments: Proof[] = payments
            .map((pmt) => {
              const bsInfo = billShareMap.get(String(pmt.bill_share_id));
              if (!bsInfo) return null;
              const billCreditor = billIdToCreditor.get(bsInfo.bill_id);
              if (billCreditor !== uid) return null;
              return {
                id: String(pmt.payment_id),
                payment_id: String(pmt.payment_id),
                bill_id: bsInfo.bill_id,
                creditor_id: uid,
                debtor_user_id: bsInfo.debtor_user_id,
                amount: pmt.amount != null ? Number(pmt.amount) : null,
                image_uri_local: null, // ไม่ใช้ image_uri_local สำหรับ payment
                slip_qr: pmt.slip_qr ?? null,
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

  const toPublicUrl = (imageUri: string | null | undefined): string | null => {
    if (!imageUri) return null;
    if (imageUri.startsWith('http')) return imageUri;
    try {
      const cleaned = imageUri.replace('payment-proofs/', '').replace('slips/', '');
      const { data } = supabase.storage.from('payment-proofs').getPublicUrl(cleaned);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const amountsClose = (a: number, b: number): boolean => {
    const tol = 1; // THB tolerance
    return Math.abs(a - b) <= tol;
  };

  const downloadToLocal = async (remoteUrl: string): Promise<string | null> => {
    try {
      const filename = `ocr_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const cacheDir = await FileSystem.Paths.cache;
      const target = `${cacheDir}/${filename}`;
      const res = await FileSystem.downloadAsync(remoteUrl, target);
      return res.uri;
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  };

  const ensureOcrForProof = async (p: Proof): Promise<void> => {
    const key = p.id;
    if (!key) return;
    if (ocrMap.has(key)) return; // already processed/processing
    const imageUri = p.slip_qr || p.image_uri_local;
    const publicUrl = toPublicUrl(imageUri);
    if (!publicUrl || p.amount == null) return;
    setOcrMap(prev => new Map(prev).set(key, { loading: true, amount: null, status: 'pending' }));
    try {
      const local = await downloadToLocal(publicUrl);
      if (!local) throw new Error('dl');
      const result = await runOcrOnImage({ localUri: local });
      const readAmount = result.amount ?? null;
      const matched = readAmount != null && amountsClose(Number(p.amount), readAmount);
      setOcrMap(prev => new Map(prev).set(key, { loading: false, amount: readAmount, status: matched ? 'matched' : 'mismatch' }));
      if (matched) {
        try { await onApprove(p); } catch {}
      }
    } catch {
      setOcrMap(prev => new Map(prev).set(key, { loading: false, amount: null, status: 'error' }));
    }
  };

  useEffect(() => {
    proofs.forEach((p) => {
      const imageUri = p.slip_qr || p.image_uri_local;
      if (imageUri) ensureOcrForProof(p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofs]);

  const getImageUrl = (imageUri: string | null | undefined): string | null => {
    if (!imageUri) return null;
    
    // If it's already a full URL, return as is
    if (imageUri.startsWith('http')) return imageUri;
    
    // If it's a Supabase storage path, construct the full URL
    if (imageUri.startsWith('payment-proofs/')) {
      const { data } = supabase.storage.from('payment-proofs').getPublicUrl(imageUri.replace('payment-proofs/', ''));
      return data.publicUrl;
    }
    
    // For other storage paths, try to construct URL
    try {
      const { data } = supabase.storage.from('payment-proofs').getPublicUrl(imageUri);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

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
            .maybeSingle();
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
            .maybeSingle();
          const tripId = (bill as any)?.trip_id ?? null;

          if (creditorUid && tripId) {
            const { data: ds } = await supabase
              .from('debt_summary')
              .select('debt_id, amount_owed, amount_paid')
              .eq('trip_id', tripId)
              .eq('debtor_user', p.debtor_user_id)
              .eq('creditor_user', creditorUid)
              .maybeSingle();

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

      // Update the total debt by subtracting the approved amount
      if (p.amount) {
        setTotalDebt(prev => Math.max(0, prev - p.amount!));
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
          .maybeSingle();
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
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#1A3C6B', '#45647C', '#6B8E9C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
              else router.replace('/');
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('confirm.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {/* Add Total Debt Card */}
      <View style={styles.totalDebtCard}>
        <Text style={styles.totalDebtLabel}>{t('confirm.total_owed_label')}</Text>
        <Text style={styles.totalDebtAmount}>
          {Math.max(0, totalDebt).toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿
        </Text>
        <Text style={styles.totalDebtNote}>{t('confirm.total_note')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: proofs.length === 0 ? 1 : undefined }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              if (currentUserId) {
                Promise.all([
                  fetchProofs(currentUserId),
                  fetchTotalDebt(currentUserId)
                ]);
              }
            }} 
          />
        }
      >
        {proofs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="document-text-outline" size={32} color="#1A3C6B" />
            </View>
            <Text style={styles.emptyText}>{t('confirm.empty')}</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={() => currentUserId && fetchProofs(currentUserId)}>
              <Ionicons name="refresh" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : proofs.map((p) => {
          const debtor = userMap.get(p.debtor_user_id);
          const imageUri = p.slip_qr || p.image_uri_local; // ใช้ slip_qr เป็นหลัก แล้วค่อย fallback ไป image_uri_local
          const ocr = ocrMap.get(p.id);
          return (
            <View key={p.id} style={styles.card}>
              {!imageUri ? (
                <View style={styles.thumbPlaceholder}>
                  <Ionicons name="image" size={20} color="#666" />
                </View>
              ) : (
                <Image 
                  source={{ uri: getImageUrl(imageUri) || '' }} 
                  style={styles.thumb} 
                  onError={() => {
                    console.error('Failed to load thumbnail:', imageUri);
                    // Don't set imageUri to null here to avoid re-rendering the list
                    // Just let it show the error state
                  }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.amountText}>{(p.amount ?? 0).toLocaleString()} ฿</Text>
                {ocr ? (
                  <Text style={{ marginTop: 2, fontSize: 12, color: ocr.status === 'matched' ? '#2e7d32' : ocr.status === 'mismatch' ? '#c0392b' : '#666' }}>
                    {ocr.loading ? t('confirm.ocr.loading') : ocr.status === 'matched' ? `${t('confirm.ocr.matched')} (${(ocr.amount ?? 0).toLocaleString()} ฿)` : ocr.status === 'mismatch' ? `${t('confirm.ocr.mismatch')} (${ocr.amount != null ? ocr.amount.toLocaleString() + ' ฿' : '-'})` : t('confirm.ocr.error')}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  {debtor?.profile_image_url ? (
                    <Image source={{ uri: debtor.profile_image_url }} style={styles.avatar} />
                  ) : (
                    <Ionicons name="person-circle" size={26} color="#1A3C6B" />
                  )}
                  <Text style={{ marginLeft: 6 }}>{debtor?.full_name || 'User'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => router.push({ pathname: '/ConfirmSlip', params: p.source === 'payment' ? { imageUri: getImageUrl(imageUri || '') } : { proofId: p.id } })}
              >
                <Ionicons name="eye" size={20} color="#1A3C6B" />
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  headerGradient: {
    paddingTop: 0,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#fff',
    marginLeft: 10, 
    flex: 1, 
    textAlign: 'center' 
  },
  totalDebtCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderLeftWidth: 4,
    borderLeftColor: '#1A3C6B',
  },
  totalDebtLabel: {
    fontSize: 14,
    color: '#1A3C6B',
    marginBottom: 4,
    fontWeight: '600',
  },
  totalDebtAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2FBF71',
    marginBottom: 4,
  },
  totalDebtNote: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
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
  amountText: { fontSize: 18, fontWeight: 'bold', color: '#FF3B30' },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  eyeBtn: { paddingHorizontal: 10 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  circle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#1A3C6B',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A3C6B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});
