import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, SafeAreaView } from 'react-native';
import { Text } from '@/components';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

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
  const { t } = useLanguage();
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
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#1A3C6B', '#45647C', '#6B8E9C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('tripdebt.header')}</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <View style={styles.creditorSection}>
        {creditor?.profile_image ? (
          <Image source={{ uri: creditor.profile_image }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={50} color="#1A3C6B" />
        )}
        <View style={{ marginLeft: 15, flex: 1 }}>
          <Text style={styles.creditorName}>{creditor?.full_name || '-'}</Text>
          <Text style={styles.unpaidText}>{t('tripdebt.unpaid')}</Text>
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
            <Text style={styles.payMethod}>{t('tripdebt.pay_method')}</Text>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.tableText, { flex: 1 }]}>{t('tripdebt.detail')}</Text>
            <Text style={[styles.tableText, { width: 84, textAlign: 'right' }]}>{t('tripdebt.price')}</Text>
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
            <Text style={styles.totalLabel}>{t('tripdebt.total')}</Text>
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
            <Text style={styles.payScanText}>{t('tripdebt.pay_scan')}</Text>
          </TouchableOpacity>
        </View>
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
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
  },
  headerText: {
    fontSize: 20,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#1A3C6B',
    marginBottom: 10,
  },
  creditorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
  creditorName: { fontSize: 18, fontWeight: 'bold', color: '#1A3C6B', fontFamily: 'Prompt-Medium' },
  unpaidText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 15, fontFamily: 'Prompt-Medium' },
  totalAmount: { 
    marginLeft: 'auto', 
    color: '#FF3B30', 
    fontWeight: 'bold', 
    fontSize: 20,
    textAlign: 'right',
    fontFamily: 'Prompt-Medium'
  },
  thbEquivalent: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'Prompt-Medium'
  },
  thbTotal: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Prompt-Medium'
  },
  allListTitle: { 
    fontSize: 16, 
    color: '#666', 
    marginVertical: 10, 
    fontFamily: 'Prompt-Medium' 
  },
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
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginHorizontal: 20,
    marginTop: 8,
  },
  cardHeader: { backgroundColor: '#f8f9fa', paddingHorizontal: 20, paddingVertical: 15 },
  tripTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A3C6B' },
  payMethod: { fontSize: 11, color: '#7a7a7a', marginTop: 4 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE', paddingHorizontal: 20, paddingVertical: 12 },
  tableText: { fontSize: 12, color: '#8a8a8a' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  itemLabel: { color: '#333', fontSize: 14 },
  itemPrice: { color: '#1A3C6B', fontSize: 14, width: 84, textAlign: 'right', fontWeight: '600' },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#EEE', backgroundColor: '#f8f9fa' },
  totalLabel: { color: '#333', fontWeight: '600' },
  totalValue: { color: '#1A3C6B', fontWeight: '700' },
  payScanBtn: { backgroundColor: '#1A3C6B', margin: 20, paddingVertical: 15, borderRadius: 20, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  payScanText: { color: '#fff', fontWeight: 'bold' },
});


