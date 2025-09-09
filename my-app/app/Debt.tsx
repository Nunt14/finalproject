import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './contexts/LanguageContext';

// ประเภทข้อมูลสำหรับการ์ดแบบรวมต่อผู้ให้เครดิต (หนึ่งการ์ดต่อหนึ่งผู้ให้เครดิต)
type DebtItem = {
  creditor_id: string;
  creditor_name: string;
  creditor_profile_image?: string | null;
  total_amount: number; // รวมจากทุกทริปที่ยังไม่ชำระ
  trip_count: number; // จำนวนทริปที่ติดหนี้กับผู้ใช้คนนี้
  last_created_ts?: number; // สำหรับเรียงเวลา
};

type PaymentProof = {
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

const CATEGORY_ICON: Record<string, { icon: string; color: string }> = {
  // ตัวอย่าง mapping category_id เป็น icon และสี
  '1': { icon: 'car', color: '#45647C' },
  '2': { icon: 'utensils', color: '#F44336' },
  '3': { icon: 'user', color: '#E91E63' },
  // เพิ่มตาม category_id จริงในฐานข้อมูล
};

export default function DebtScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [pendingConfirms, setPendingConfirms] = useState<Array<{ creditor_id: string; creditor_name: string; creditor_profile_image?: string | null; total_amount: number }>>([]);
  const [confirmedPays, setConfirmedPays] = useState<Array<{ creditor_id: string; creditor_name: string; creditor_profile_image?: string | null; total_amount: number }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("฿");
  const [activeTab, setActiveTab] = useState<'debt' | 'payment'>('debt');
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [userMap, setUserMap] = useState<Map<string, { full_name: string | null; profile_image_url: string | null }>>(new Map());
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const getCurrency = async () => {
      const currencyCode = await AsyncStorage.getItem("user_currency");
      switch (currencyCode) {
        case "USD":
          setCurrencySymbol("$");
          break;
        case "EUR":
          setCurrencySymbol("€");
          break;
        case "JPY":
          setCurrencySymbol("¥");
          break;
        case "GBP":
          setCurrencySymbol("£");
          break;
        case "THB":
        default:
          setCurrencySymbol("฿");
          break;
      }
    };
    getCurrency();
    fetchDebts();
  }, []);

  // รีเฟรชทุกครั้งเมื่อหน้าได้รับโฟกัส (หลังอัปโหลดสลิปแล้วกลับมา)
  useFocusEffect(
    React.useCallback(() => {
      fetchDebts();
      if (activeTab === 'payment' && currentUserId) {
        fetchPaymentProofs(currentUserId);
      }
    }, [activeTab, currentUserId])
  );

  const fetchDebts = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;
    setCurrentUserId(userId);

    // 0) ดึงทริปที่ผู้ใช้เห็นในหน้าแรก (อ้างอิงตรรกะเดียวกับหน้า Welcome: เป็นสมาชิกและ active)
    const { data: memberRows, error: memberErr } = await supabase
      .from('trip_member')
      .select('trip_id')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (memberErr) {
      console.error(memberErr);
      return;
    }
    const tripIds = (memberRows || []).map((m: any) => String(m.trip_id));
    if (tripIds.length === 0) {
      setDebts([]);
      setPendingConfirms([]);
      setConfirmedPays([]);
      return;
    }

    // ตรวจว่าทริปเหล่านี้ยังมีอยู่จริงในตาราง trip (กันกรณีแถว trip ถูกลบไปแล้ว)
    const { data: existingTrips, error: tripErr } = await supabase
      .from('trip')
      .select('trip_id')
      .in('trip_id', tripIds);
    if (tripErr) {
      console.error(tripErr);
      return;
    }
    const existingTripIds = (existingTrips || []).map((t: any) => String(t.trip_id));
    if (existingTripIds.length === 0) {
      setDebts([]);
      setPendingConfirms([]);
      setConfirmedPays([]);
      return;
    }

    // 1) ดึง bill ทั้งหมดของทริปที่ผู้ใช้มีสิทธิ์เห็น
    const { data: billRows, error: billErr } = await supabase
      .from('bill')
      .select('bill_id, trip_id, paid_by_user_id, created_at')
      .in('trip_id', existingTripIds);
    if (billErr) {
      console.error(billErr);
      return;
    }
    const allowedBillIds = new Set<string>((billRows || []).map((b: any) => String(b.bill_id)));
    const billInfoById = new Map<string, { trip_id: string; paid_by_user_id: string; created_at: string }>(
      (billRows || []).map((b: any) => [String(b.bill_id), { trip_id: String(b.trip_id), paid_by_user_id: String(b.paid_by_user_id), created_at: String(b.created_at) }])
    );

    // 2) ดึงรายการ bill_share ที่ผู้ใช้เป็นลูกหนี้ (unpaid) และอยู่ในทริปที่อนุญาต
    const { data: billShares, error: billShareErr } = await supabase
      .from('bill_share')
      .select('bill_share_id, bill_id, amount_share, status')
      .eq('user_id', userId)
      .eq('status', 'unpaid')
      .in('bill_id', Array.from(allowedBillIds));

    if (billShareErr) {
      console.error(billShareErr);
      return;
    }

    const shares = (billShares || []).filter((s: any) => allowedBillIds.has(String(s.bill_id)));

    // 3) รวมยอดตามผู้ให้เครดิต (paid_by_user_id) และนับจำนวนทริป
    type Acc = { total: number; tripIds: Set<string>; lastCreated: number };
    const byCreditor = new Map<string, Acc>();
    const creditorIds = new Set<string>();

    if (shares.length > 0) {
      for (const s of shares as any[]) {
        const bill = billInfoById.get(String(s.bill_id));
        if (!bill) continue;
        const creditorId = String(bill.paid_by_user_id);
        // อย่าแสดงหนี้ที่ผู้ให้เครดิตเป็นตัวเราเอง
        if (creditorId === String(userId)) continue;
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

    // 4) อ่านสถานะการชำระจาก payment_proof ของผู้ใช้นี้ (จำกัดเฉพาะบิลในทริปที่อนุญาต)
    const { data: proofs } = await supabase
      .from('payment_proof')
      .select('creditor_id, amount, status, bill_id')
      .eq('debtor_user_id', userId)
      .in('status', ['pending', 'approved']);

    const aggPending = new Map<string, number>();
    const aggConfirmed = new Map<string, number>();
    const proofCreditorIds = new Set<string>();
    const dsCreditorIds = new Set<string>();
    (proofs || []).forEach((p: any) => {
      // แสดงทุกรายการที่เกี่ยวกับผู้ใช้นี้ ไม่จำกัดเฉพาะบิลในทริปที่อนุญาต
      const cid = String(p.creditor_id);
      if (cid === String(userId)) return; // ข้ามของตัวเอง
      const amt = Number(p.amount || 0);
      proofCreditorIds.add(cid);
      if (p.status === 'pending') aggPending.set(cid, (aggPending.get(cid) || 0) + amt);
      if (p.status === 'approved') aggConfirmed.set(cid, (aggConfirmed.get(cid) || 0) + amt);
    });

    // 4.1) Fallback: อ่านจากตาราง payment (กรณีไม่ได้เขียน payment_proof)
    // เดิมกรองเฉพาะ bill_share ที่ยังเป็น unpaid ทำให้เมื่ออนุมัติแล้ว (bill_share = paid) การ์ด Confirmed ไม่ขึ้น
    // ปรับใหม่: ดึง payment ทั้งหมด (pending/approved) แล้ว join หา bill_share ที่เป็นของผู้ใช้ ไม่จำกัดสถานะ
    try {
      const { data: payRows } = await supabase
        .from('payment')
        .select('payment_id, bill_share_id, amount, status')
        .in('status', ['pending', 'approved']);
      const payments = (payRows || []) as any[];
      if (payments.length > 0) {
        const bsIdsAll = Array.from(new Set(payments.map((p) => String(p.bill_share_id)).filter(Boolean)));
        let bsMap = new Map<string, { user_id: string; bill_id: string }>();
        if (bsIdsAll.length > 0) {
          const { data: bsRows } = await supabase
            .from('bill_share')
            .select('bill_share_id, user_id, bill_id')
            .in('bill_share_id', bsIdsAll);
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
          if (!bs || String(bs.user_id) !== String(userId)) continue; // ต้องเป็นลูกหนี้คนนี้
          const creditor = billToCreditor.get(bs.bill_id);
          if (!creditor || creditor === String(userId)) continue; // ข้ามของตัวเอง
          const amt = Number(p.amount || 0);
          proofCreditorIds.add(creditor);
          if (p.status === 'pending') aggPending.set(creditor, (aggPending.get(creditor) || 0) + amt);
          if (p.status === 'approved') aggConfirmed.set(creditor, (aggConfirmed.get(creditor) || 0) + amt);
        }
      }
    } catch {}

    // 4.2) เติมข้อมูลจาก debt_summary (สำหรับยอดที่ยืนยันแล้วแน่นอน)
    try {
      const { data: dsRows } = await supabase
        .from('debt_summary')
        .select('creditor_user, amount_paid')
        .eq('debtor_user', userId)
        .gt('amount_paid', 0);
      (dsRows || []).forEach((r: any) => {
        const cid = String(r.creditor_user);
        const amt = Number(r.amount_paid || 0);
        dsCreditorIds.add(cid);
        aggConfirmed.set(cid, (aggConfirmed.get(cid) || 0) + amt);
      });
    } catch {}

    // 5) ดึงข้อมูลผู้ให้เครดิตทั้งหมด (รวมจาก unpaid, proofs/payments และ debt_summary)
    const ids = Array.from(new Set<string>([...Array.from(creditorIds), ...Array.from(proofCreditorIds), ...Array.from(dsCreditorIds)]));
    let userMap = new Map<string, { full_name: string | null; profile_image_url: string | null }>();
    if (ids.length > 0) {
      const { data: users } = await supabase
        .from('user')
        .select('user_id, full_name, profile_image_url')
        .in('user_id', ids);
      userMap = new Map((users || []).map((u: any) => [String(u.user_id), { full_name: u.full_name ?? null, profile_image_url: u.profile_image_url ?? null }]));
    }

    // 6) แปลงเป็นรายการการ์ด (Waiting for pay)
    const items: DebtItem[] = Array.from(byCreditor.entries()).map(([cid, acc]) => ({
      creditor_id: cid,
      creditor_name: userMap.get(cid)?.full_name || 'Unknown',
      creditor_profile_image: userMap.get(cid)?.profile_image_url || null,
      total_amount: acc.total,
      trip_count: acc.tripIds.size,
      last_created_ts: acc.lastCreated,
    }));

    // 7) เรียงตามยอดรวมมากไปน้อย หรือเวลาล่าสุด
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

  const fetchPaymentProofs = async (uid: string) => {
    setRefreshing(true);
    try {
      // Fetch payment proofs from all trips where user is creditor (exactly like ConfirmPayments)
      let base = supabase
        .from('payment_proof')
        .select('id, bill_id, creditor_id, debtor_user_id, amount, image_uri_local, slip_qr, status, created_at')
        .eq('creditor_id', uid)
        .eq('status', 'pending');
      const { data } = await base.order('created_at', { ascending: false });

      const proofRows: PaymentProof[] = (data || []).map((p: any) => ({
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
      let combined: PaymentProof[] = [...proofRows];

      // Also fetch from payment table (exactly like ConfirmPayments)
      try {
        let payQuery = supabase
          .from('payment')
          .select('payment_id, bill_share_id, amount, status, created_at, slip_qr')
          .eq('status', 'pending');
        const { data: pay } = await payQuery.order('created_at', { ascending: false });

        const payments = (pay || []) as any[];
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

          const billIds = Array.from(new Set(
            Array.from(billShareMap.values()).map((v) => v.bill_id)
          ));
          let billIdToCreditor = new Map<string, string | null>();
          if (billIds.length > 0) {
            const { data: billRows } = await supabase
              .from('bill')
              .select('bill_id, paid_by_user_id')
              .in('bill_id', billIds);
            (billRows || []).forEach((b: any) => {
              billIdToCreditor.set(String(b.bill_id), (b.paid_by_user_id ? String(b.paid_by_user_id) : null));
            });
          }

          const fromPayments: PaymentProof[] = payments
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
                image_uri_local: null,
                slip_qr: pmt.slip_qr ?? null,
                status: pmt.status ?? 'pending',
                created_at: pmt.created_at,
                source: 'payment',
              } as PaymentProof;
            })
            .filter(Boolean) as PaymentProof[];

          const proofKeys = new Set(proofRows.map((r) => `${r.bill_id}|${r.debtor_user_id}|${r.amount ?? ''}`));
          const uniquePayments = fromPayments.filter((r) => !proofKeys.has(`${r.bill_id}|${r.debtor_user_id}|${r.amount ?? ''}`));
          combined = [...proofRows, ...uniquePayments];
        }
      } catch {}

      setPaymentProofs(combined);

      const uids = Array.from(new Set(combined.map((r) => r.debtor_user_id)));
      if (uids.length > 0) {
        const { data: users } = await supabase
          .from('user')
          .select('user_id, full_name, profile_image_url')
          .in('user_id', uids);
        const map = new Map<string, { full_name: string | null; profile_image_url: string | null }>();
        (users || []).forEach((u: any) => map.set(String(u.user_id), {
          full_name: u.full_name ?? null,
          profile_image_url: u.profile_image_url ?? null,
        }));
        setUserMap(map);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const getImageUrl = (imageUri: string | null | undefined): string | null => {
    if (!imageUri) return null;
    if (imageUri.startsWith('http')) return imageUri;
    if (imageUri.startsWith('payment-proofs/')) {
      const { data } = supabase.storage.from('payment-proofs').getPublicUrl(imageUri.replace('payment-proofs/', ''));
      return data.publicUrl;
    }
    try {
      const { data } = supabase.storage.from('payment-proofs').getPublicUrl(imageUri);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const onApprovePayment = async (p: PaymentProof) => {
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

          try {
            await supabase.from('notification').insert({
              user_id: p.debtor_user_id,
              title: 'Payment Confirmed',
              message: 'Your payment has been confirmed',
              is_read: false,
              trip_id: (bill as any)?.trip_id ?? null,
            });
          } catch {}
        } catch {}
      }

      setPaymentProofs((prev) => prev.filter((x) => x.id !== p.id));
      Alert.alert('Success', 'Payment confirmed successfully');
    } catch (e) {
      Alert.alert('Error', 'Unable to confirm payment');
    }
  };

  const onRejectPayment = async (p: PaymentProof) => {
    try {
      if (p.source === 'payment' && p.payment_id) {
        await supabase.from('payment').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('payment_id', p.payment_id);
      } else {
        await supabase.from('payment_proof').update({ status: 'rejected' }).eq('id', p.id);
      }
      
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
      
      setPaymentProofs((prev) => prev.filter((x) => x.id !== p.id));
      Alert.alert('Success', 'Payment rejected');
    } catch (e) {
      Alert.alert('Error', 'Unable to reject payment');
    }
  };

  // subscribe realtime: เมื่อสถานะ bill_share เปลี่ยน หรือมีการอัปเดต payment_proof ของผู้ใช้นี้ ให้รีเฟรช
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`debts-realtime-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bill_share', filter: `user_id=eq.${currentUserId}` },
        () => {
          fetchDebts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payment_proof', filter: `debtor_user_id=eq.${currentUserId}` },
        () => {
          fetchDebts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payment_proof', filter: `debtor_user_id=eq.${currentUserId}` },
        () => {
          fetchDebts();
        }
      )
      // Add real-time subscription for payment proofs where user is creditor (like ConfirmPayments)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payment_proof', filter: `creditor_id=eq.${currentUserId}` },
        async (payload: any) => {
          const row = payload.new as any;
          const newProof: PaymentProof = {
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
          setPaymentProofs(prev => [newProof, ...prev]);
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
        { event: 'UPDATE', schema: 'public', table: 'payment_proof', filter: `creditor_id=eq.${currentUserId}` },
        (payload: any) => {
          const row = payload.new as any;
          const updatedStatus = row.status as string | null;
          // remove if no longer pending
          if (updatedStatus && updatedStatus !== 'pending') {
            setPaymentProofs(prev => prev.filter(x => x.id !== String(row.id)));
          } else {
            setPaymentProofs(prev => prev.map(x => x.id === String(row.id) ? {
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

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [currentUserId, userMap]);

  const renderDebtCard = (debt: DebtItem) => (
    <View key={debt.creditor_id} style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.amount}>
          {Number(debt.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, activeTab === 'debt' && styles.toggleButtonActive]}
            onPress={() => setActiveTab('debt')}
          >
            <Ionicons name="card" size={20} color={activeTab === 'debt' ? '#fff' : '#666'} />
            <Text style={[styles.toggleText, activeTab === 'debt' && styles.toggleTextActive]}>Debt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, activeTab === 'payment' && styles.toggleButtonActive]}
            onPress={() => setActiveTab('payment')}
          >
            <Ionicons name="wallet" size={20} color={activeTab === 'payment' ? '#fff' : '#666'} />
            <Text style={[styles.toggleText, activeTab === 'payment' && styles.toggleTextActive]}>Payment</Text>
          </TouchableOpacity>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {activeTab === 'debt' ? (
        <>
          <Text style={styles.subHeader}>{t('debt.waiting_for_pay')}</Text>
          <ScrollView style={styles.scrollContainer}>
            {debts.length === 0 ? (
              <Text style={{ color: '#888', textAlign: 'center', marginTop: 30 }}>{t('debt.no_debts')}</Text>
            ) : (
              debts.map(renderDebtCard)
            )}

            {(pendingConfirms.length > 0 || confirmedPays.length > 0) && (
              <>
                <Text style={[styles.subHeader, { marginTop: 12 }]}>{t('debt.already_paid')}</Text>
                {pendingConfirms.map((p) => (
                  <View key={`p-${p.creditor_id}`} style={[styles.card, { borderColor: '#FFE7A2' }]}> 
                    <View style={styles.rowBetween}>
                      <Text style={[styles.amount, { color: '#F4B400' }]}>{Number(p.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}</Text>
                      {p.creditor_profile_image ? (
                        <Image source={{ uri: p.creditor_profile_image }} style={styles.avatar} />
                      ) : (
                        <Ionicons name="person-circle" size={36} color="#F4B400" />
                      )}
                    </View>
                    <View style={styles.rowBetween}>
                      <View style={styles.row}>
                        <FontAwesome5 name="clock" size={18} color="#F4B400" style={{ marginRight: 6 }} />
                        <Text style={styles.totalList}>{t('debt.waiting_for_confirm')}</Text>
                      </View>
                    </View>
                  </View>
                ))}
                {confirmedPays.map((c) => (
                  <View key={`c-${c.creditor_id}`} style={[styles.card, { borderColor: '#B7EAC8' }]}> 
                    <View style={styles.rowBetween}>
                      <Text style={[styles.amount, { color: '#2FBF71' }]}>{Number(c.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}</Text>
                      {c.creditor_profile_image ? (
                        <Image source={{ uri: c.creditor_profile_image }} style={styles.avatar} />
                      ) : (
                        <Ionicons name="person-circle" size={36} color="#2FBF71" />
                      )}
                    </View>
                    <View style={styles.rowBetween}>
                      <View style={styles.row}>
                        <FontAwesome5 name="check-circle" size={18} color="#2FBF71" style={{ marginRight: 6 }} />
                        <Text style={styles.totalList}>{t('debt.confirmed')}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </>
      ) : (
        <>
          <Text style={styles.subHeader}>Payment Confirmations</Text>
          <ScrollView 
            style={styles.scrollContainer}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={() => {
                  if (currentUserId) {
                    fetchPaymentProofs(currentUserId);
                  }
                }} 
              />
            }
          >
            {paymentProofs.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="document-text-outline" size={48} color="#ccc" />
                <Text style={{ marginTop: 12, color: '#666' }}>No pending payments</Text>
                <TouchableOpacity style={[styles.circle, { backgroundColor: '#234080', marginTop: 14 }]} onPress={() => currentUserId && fetchPaymentProofs(currentUserId)}>
                  <Ionicons name="refresh" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              paymentProofs.map((p) => {
                const debtor = userMap.get(p.debtor_user_id);
                const imageUri = p.slip_qr || p.image_uri_local;
                return (
                  <View key={p.id} style={styles.paymentCard}>
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
                        }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.amountText}>{(p.amount ?? 0).toLocaleString()} {currencySymbol}</Text>
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
                      onPress={() => router.push({ pathname: '/ConfirmSlip', params: p.source === 'payment' ? { imageUri: getImageUrl(imageUri || '') } : { proofId: p.id } })}
                    >
                      <Ionicons name="eye" size={20} color="#213a5b" />
                    </TouchableOpacity>
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.circle, { backgroundColor: '#ff3b30' }]} onPress={() => onRejectPayment(p)}>
                        <Ionicons name="close" size={18} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.circle, { backgroundColor: '#2fbf71' }]} onPress={() => onApprovePayment(p)}>
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 },
  backButton: { padding: 8 },
  toggleContainer: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: '#f0f0f0', 
    borderRadius: 25, 
    padding: 5,
    marginHorizontal: -40
  },
  toggleButton: { 
    flex: 1,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 22 
  },
  toggleButtonActive: { backgroundColor: '#1A3C6B' },
  toggleText: { marginLeft: 6, fontSize: 16, color: '#666', fontWeight: '600' },
  toggleTextActive: { color: '#fff' },
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
  paymentCard: {
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
  eyeBtn: { paddingHorizontal: 10 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  circle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});
