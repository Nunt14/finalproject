import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';

type Proof = {
  id: string;
  bill_id: string;
  creditor_id: string;
  debtor_user_id: string;
  amount: number | null;
  image_uri_local?: string | null;
  status?: string | null;
  created_at?: string;
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

  const fetchProofs = async (uid: string) => {
    setRefreshing(true);
    try {
      const { data } = await supabase
        .from('payment_proof')
        .select('id, bill_id, creditor_id, debtor_user_id, amount, image_uri_local, status, created_at')
        .eq('creditor_id', uid)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const rows: Proof[] = (data || []).map((p: any) => ({
        id: String(p.id),
        bill_id: String(p.bill_id),
        creditor_id: String(p.creditor_id),
        debtor_user_id: String(p.debtor_user_id),
        amount: p.amount != null ? Number(p.amount) : null,
        image_uri_local: p.image_uri_local ?? null,
        status: p.status ?? null,
        created_at: p.created_at,
      }));
      setProofs(rows);

      const uids = Array.from(new Set(rows.map((r) => r.debtor_user_id)));
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

  const onApprove = async (p: Proof) => {
    try {
      await supabase.from('payment_proof').update({ status: 'approved' }).eq('id', p.id);

      if (p.bill_id && p.debtor_user_id) {
        await supabase
          .from('bill_share')
          .update({ status: 'paid', amount_paid: p.amount ?? null, is_confirmed: true })
          .eq('bill_id', p.bill_id)
          .eq('user_id', p.debtor_user_id);
      }

      setProofs((prev) => prev.filter((x) => x.id !== p.id));
      Alert.alert('Confirmed', 'ยืนยันการชำระเงินเรียบร้อย');
    } catch (e) {
      Alert.alert('Error', 'ไม่สามารถยืนยันได้');
    }
  };

  const onReject = async (p: Proof) => {
    try {
      await supabase.from('payment_proof').update({ status: 'rejected' }).eq('id', p.id);
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {proofs.map((p) => {
          const debtor = userMap.get(p.debtor_user_id);
          return (
            <View key={p.id} style={styles.card}>
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
                onPress={() => router.push({ pathname: 'ConfirmSlip', params: { proofId: p.id } })}
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
  amountText: { fontSize: 18, fontWeight: 'bold', color: '#e53935' },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  eyeBtn: { paddingHorizontal: 10 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  circle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});


