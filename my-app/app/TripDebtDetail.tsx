import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded exchange rates (as of the knowledge cutoff date)
// In a real app, you should fetch these from a reliable exchange rate API
const EXCHANGE_RATES: Record<string, number> = {
  USD: 36.5,  // 1 USD = 36.5 THB
  EUR: 39.5,  // 1 EUR = 39.5 THB
  JPY: 0.25,  // 1 JPY = 0.25 THB
  GBP: 46.0,  // 1 GBP = 46.0 THB
  THB: 1.0,   // 1 THB = 1 THB
};

type BillDetail = {
  bill_id: string;
  trip_name?: string;
  category_id?: string | null;
  note?: string | null;
  amount_share: number;
  status: string;
  bill_created_at?: string;
};

export default function TripDebtDetailScreen() {
  const { creditorId, tripId } = useLocalSearchParams<{ creditorId: string; tripId: string }>();
  const [bills, setBills] = useState<BillDetail[]>([]);
  const [creditor, setCreditor] = useState<{ full_name: string; profile_image?: string | null } | null>(null);
  const [total, setTotal] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState("฿");
  const [currencyCode, setCurrencyCode] = useState("THB");

  useEffect(() => {
    const getCurrency = async () => {
      const code = await AsyncStorage.getItem("user_currency") || "THB";
      setCurrencyCode(code);
      
      // Set the currency symbol based on the currency code
      switch (code) {
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
    fetchPayDetail();
  }, [creditorId, tripId]);

  const fetchPayDetail = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      // Bills this user owes in the selected trip to this creditor
      const { data, error } = await supabase
        .from('bill_share')
        .select(`
          bill_id,
          amount_share,
          status,
          bill:bill_id (
            created_at,
            trip_id,
            category_id,
            note,
            trip:trip_id (
              trip_name
            ),
            paid_by_user_id
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'unpaid');

      if (error) throw error;

      const filtered = (data || []).filter((row: any) => {
        const isCreditor = String(row.bill?.paid_by_user_id) === String(creditorId);
        const isInTrip = String(row.bill?.trip_id) === String(tripId);
        return isCreditor && isInTrip;
      });

      // creditor info
      if (filtered.length > 0) {
        const { data: userRows } = await supabase
          .from('user')
          .select('full_name, profile_image_url')
          .eq('user_id', creditorId)
          .single();
        if (userRows) {
          setCreditor({ full_name: (userRows as any).full_name, profile_image: (userRows as any).profile_image_url || null });
        }
      }

      let sum = 0;
      const billList: BillDetail[] = [];
      filtered.forEach((row: any) => {
        sum += Number(row.amount_share || 0);
        billList.push({
          bill_id: row.bill_id,
          trip_name: row.bill?.trip?.trip_name || '-',
          category_id: row.bill?.category_id == null ? null : String(row.bill.category_id),
          note: row.bill?.note ?? null,
          amount_share: row.amount_share,
          status: row.status,
          bill_created_at: row.bill?.created_at,
        });
      });

      setBills(billList);
      setTotal(sum);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load bill details');
    }
  };

  const CATEGORY_ICON: Record<string, { icon: any; color: string; label: string }> = {
    '1': { icon: 'bed', color: '#4A90E2', label: 'ค่าที่พัก' },
    '2': { icon: 'utensils', color: '#F44336', label: 'ค่าอาหาร' },
    '3': { icon: 'car', color: '#45647C', label: 'ค่าเดินทาง' },
  } as any;

  // Function to convert amount to THB
  const convertToTHB = (amount: number): number => {
    const rate = EXCHANGE_RATES[currencyCode] || 1;
    return amount * rate;
  };

  const tripName = useMemo(() => bills[0]?.trip_name || '-', [bills]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill</Text>
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
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.totalAmount}>
            {Number(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
          </Text>
          {currencyCode !== 'THB' && (
            <Text style={styles.thbEquivalent}>
              = {convertToTHB(Number(total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿
              {' '}({currencyCode} 1 = ฿{EXCHANGE_RATES[currencyCode]?.toFixed(2) || 'N/A'})
            </Text>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.cardContainer}>
          <View style={styles.cardHeader}>
            <Text style={styles.tripTitle}>{tripName}</Text>
            <Text style={styles.payMethod}>ชำระแบบการ ชำระเงินออนไลน์ :</Text>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.tableText, { flex: 1 }]}>รายละเอียด</Text>
            <Text style={[styles.tableText, { width: 84, textAlign: 'right' }]}>ราคา</Text>
          </View>

          {bills.map((bill) => {
            const category = bill.category_id ? CATEGORY_ICON[bill.category_id] : undefined;
            const label = (bill.note && String(bill.note).trim().length > 0)
              ? String(bill.note)
              : (category?.label || '-');
            return (
              <View key={bill.bill_id} style={styles.rowItem}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  {category ? (
                    <FontAwesome5 name={category.icon as any} size={14} color={category.color} style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="ellipse" size={10} color="#BFC9D9" style={{ marginRight: 10 }} />
                  )}
                  <Text style={styles.itemLabel}>{label}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemPrice}>
                    {Number(bill.amount_share || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </Text>
                  {currencyCode !== 'THB' && (
                    <Text style={styles.thbEquivalent}>
                      = {convertToTHB(Number(bill.amount_share || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿
                      {' '}({currencyCode} 1 = ฿{EXCHANGE_RATES[currencyCode]?.toFixed(2) || 'N/A'})
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          <View style={styles.totalBar}>
            <Text style={styles.totalLabel}>รวม</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.totalValue}>
                {Number(total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
              </Text>
              {currencyCode !== 'THB' && (
                <Text style={styles.thbTotal}>
                  = {convertToTHB(Number(total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿
                  {' '}({currencyCode} 1 = ฿{EXCHANGE_RATES[currencyCode]?.toFixed(2) || 'N/A'})
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.payScanBtn}
            onPress={() => {
              const firstBill = bills[0];
              if (firstBill) {
                router.push({ pathname: '/Payment', params: { billId: firstBill.bill_id, creditorId: String(creditorId), amount: String(total) } });
              }
            }}
          >
            <Text style={styles.payScanText}>Pay Scan</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  totalAmount: { 
    marginLeft: 'auto', 
    color: 'red', 
    fontWeight: 'bold', 
    fontSize: 20,
    textAlign: 'right'
  },
  thbEquivalent: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  thbTotal: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
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
  // New card styles
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ECECEC',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginTop: 8,
  },
  cardHeader: { backgroundColor: '#f6f7fb', paddingHorizontal: 16, paddingVertical: 12 },
  tripTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A3C6B' },
  payMethod: { fontSize: 11, color: '#7a7a7a', marginTop: 4 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE', paddingHorizontal: 16, paddingVertical: 10 },
  tableText: { fontSize: 12, color: '#8a8a8a' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  itemLabel: { color: '#333', fontSize: 14 },
  itemPrice: { color: '#1A3C6B', fontSize: 14, width: 84, textAlign: 'right', fontWeight: '600' },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#fafbff' },
  totalLabel: { color: '#333', fontWeight: '600' },
  totalValue: { color: '#1A3C6B', fontWeight: '700' },
  payScanBtn: { backgroundColor: '#234080', margin: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  payScanText: { color: '#fff', fontWeight: 'bold' },
});


