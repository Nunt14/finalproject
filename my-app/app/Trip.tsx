import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';

type BillItem = {
  bill_id: string;
  trip_id: string;
  total_amount: number;
  payer_user_id?: string | null;
  shares?: Array<{ user_id: string; amount_share: number; full_name?: string | null; profile_image_url?: string | null }>; 
  created_at?: string;
  payer_full_name?: string | null;
  payer_profile_image_url?: string | null;
};

export default function TripScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [trip, setTrip] = useState<any | null>(null);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!tripId) return;

        const { data: sessionData } = await supabase.auth.getSession();
        setCurrentUserId(sessionData?.session?.user?.id ?? null);

        // ดึงข้อมูลทริป
        const { data: tripRows } = await supabase
          .from('trip')
          .select('*')
          .eq('trip_id', tripId)
          .limit(1);
        setTrip(tripRows?.[0] || null);

        // โหลดบิลของทริป
        const { data: billRows } = await supabase
          .from('bill')
          .select('bill_id, trip_id, total_amount, paid_by_user_id, created_at')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: false });

        const billsBasic: BillItem[] = (billRows || []).map((b: any) => ({
          bill_id: String(b.bill_id),
          trip_id: String(b.trip_id),
          total_amount: Number(b.total_amount || 0),
          payer_user_id: b.paid_by_user_id,
          created_at: b.created_at,
        }));

        const billIds = billsBasic.map((b) => b.bill_id);
        if (billIds.length === 0) {
          setBills([]);
          return;
        }

        const { data: shareRows } = await supabase
          .from('bill_share')
          .select('bill_id, user_id, amount_share, amount_paid, status, is_confirmed')
          .in('bill_id', billIds);

        const userIds = Array.from(new Set([
          ...(shareRows || []).map((s: any) => String(s.user_id)),
          ...billsBasic.map((b) => String(b.payer_user_id || '')),
        ].filter(Boolean)));
        let userMap = new Map<string, { full_name: string | null; profile_image_url: string | null }>();
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('user')
            .select('user_id, full_name, profile_image_url')
            .in('user_id', userIds);
          userMap = new Map((users || []).map((u: any) => [String(u.user_id), { full_name: u.full_name ?? null, profile_image_url: u.profile_image_url ?? null }]));
        }

        const withShares = billsBasic.map((b) => ({
          ...b,
          shares: (shareRows || [])
            .filter((s: any) => String(s.bill_id) === b.bill_id)
            .map((s: any) => ({
              user_id: String(s.user_id),
              amount_share: Number(s.amount_share || 0),
              full_name: userMap.get(String(s.user_id))?.full_name ?? null,
              profile_image_url: userMap.get(String(s.user_id))?.profile_image_url ?? null,
            })),
          payer_full_name: b.payer_user_id ? (userMap.get(String(b.payer_user_id))?.full_name ?? null) : null,
          payer_profile_image_url: b.payer_user_id ? (userMap.get(String(b.payer_user_id))?.profile_image_url ?? null) : null,
        }));

        setBills(withShares);
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

        {bills.map((bill) => {
              const debtors = (bill.shares || []).filter((s) => s.user_id !== bill.payer_user_id);
              const isPayer = currentUserId && bill.payer_user_id === currentUserId;
              return (
                <View key={bill.bill_id} style={[styles.bubbleRow, isPayer ? styles.alignRight : styles.alignLeft]}>
                  {!isPayer && (
                    bill.payer_profile_image_url ? (
                      <Image source={{ uri: bill.payer_profile_image_url }} style={styles.senderAvatar} />
                    ) : (
                      <Ionicons name="person-circle" size={26} color="#4C6EF5" style={{ marginRight: 8 }} />
                    )
                  )}
                  <View style={[styles.billCard, styles.bubbleCard]}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.amount}>{bill.total_amount.toLocaleString()} ฿</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {bill.payer_profile_image_url ? (
                          <Image source={{ uri: bill.payer_profile_image_url }} style={{ width: 20, height: 20, borderRadius: 10 }} />
                        ) : (
                          <Ionicons name="person-circle" size={20} color="#4C6EF5" />
                        )}
                        <Text style={{ marginLeft: 6, color: '#4C6EF5', fontWeight: '600' }}>{bill.payer_full_name || 'Payer'}</Text>
                      </View>
                    </View>

                    <View style={styles.shareList}>
                      {debtors.map((s, idx) => (
                        <View key={s.user_id + idx} style={styles.shareRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {s.profile_image_url ? (
                              <Image source={{ uri: s.profile_image_url }} style={{ width: 20, height: 20, borderRadius: 10 }} />
                            ) : (
                              <Ionicons name="person" size={14} color="#95A5A6" />
                            )}
                            <Text style={styles.shareName}>{s.full_name || 'User'}</Text>
                          </View>
                          <Text style={styles.shareAmount}>{s.amount_share.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ฿</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity style={styles.payButton} disabled={!!isPayer}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{isPayer ? 'Who paid!' : 'Pay'}</Text>
                    </TouchableOpacity>

                  </View>
                  {isPayer && (
                    bill.payer_profile_image_url ? (
                      <Image source={{ uri: bill.payer_profile_image_url }} style={[styles.senderAvatar, { marginLeft: 8, marginRight: 0 }]} />
                    ) : (
                      <Ionicons name="person-circle" size={26} color="#4C6EF5" style={{ marginLeft: 8 }} />
                    )
                  )}
                </View>
          );
        })}
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
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  centeredRow: { justifyContent: 'center' },
  alignRight: { justifyContent: 'flex-end' },
  alignLeft: { justifyContent: 'flex-start' },
  bubbleCard: { maxWidth: '92%', minWidth: '78%' },
  bubbleRight: { borderTopRightRadius: 6 },
  bubbleLeft: { borderTopLeftRadius: 6 },
  bubbleIndicator: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 6, marginBottom: 6 },
  tailRight: {
    position: 'absolute',
    right: -8,
    bottom: 12,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
    borderTopWidth: 8,
    borderTopColor: '#f7f7fb',
  },
  senderAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8 },
  tailLeft: {
    position: 'absolute',
    left: -8,
    bottom: 12,
    width: 0,
    height: 0,
    borderRightWidth: 8,
    borderRightColor: 'transparent',
    borderTopWidth: 8,
    borderTopColor: '#f7f7fb',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  amount: { fontSize: 18, fontWeight: 'bold', color: 'red' },
  noteText: { color: '#888' },
  payButton: { backgroundColor: '#1A3C6B', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  shareList: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, marginTop: 4, marginBottom: 6 },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  shareName: { marginLeft: 6, color: '#34495E' },
  shareAmount: { color: '#2FBF71', fontWeight: '600' },
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


