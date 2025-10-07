import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, SafeAreaView } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useLanguage } from './contexts/LanguageContext';
import { useCurrency } from './contexts/CurrencyContext';
import { LinearGradient } from 'expo-linear-gradient';

type DebtItem = {
  debt_id: string;
  trip_id: string;
  debtor_user: string;
  creditor_user: string;
  amount_owed: number;
  amount_paid: number;
  status: 'pending' | 'partial' | 'settled';
  creditor_info?: {
    full_name: string;
    profile_image_url?: string;
  };
  bill_type?: string;
  bill_id?: string; // bill id ที่จะใช้ไปหน้า Payment
  bill_share_id?: string; // อ้างอิงเดิม ถ้าจำเป็น
};

export default function DebttripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { t } = useLanguage();
  const { currencySymbol } = useCurrency();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unpaidDebts, setUnpaidDebts] = useState<DebtItem[]>([]);
  const [paidDebts, setPaidDebts] = useState<DebtItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnpaidDebt, setTotalUnpaidDebt] = useState(0);

  useEffect(() => {
    const initializeUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        await fetchDebts(uid);
      }
    };
    initializeUser();
  }, [tripId]);

  useFocusEffect(
    React.useCallback(() => {
      if (currentUserId) {
        setRefreshing(true);
        fetchDebts(currentUserId).finally(() => setRefreshing(false));
      }
      
      // Cleanup function
      return () => {
        setRefreshing(false);
      };
    }, [currentUserId])
  );

  const fetchDebts = async (userId: string) => {
    setLoading(true);
    try {
      // Get all bill shares where current user is involved (both paid and unpaid)
      let billShareQuery = supabase
        .from('bill_share')
        .select(`
          *,
          bill:bill_id (
            bill_id,
            trip_id,
            total_amount,
            paid_by_user_id,
            note,
            category_id
          )
        `)
        .eq('user_id', userId);

      if (tripId) {
        // If tripId is provided, filter by trip
        const { data: billIds, error: billError } = await supabase
          .from('bill')
          .select('bill_id')
          .eq('trip_id', tripId);
        
        if (billError) throw billError;
        
        if (billIds && billIds.length > 0) {
          billShareQuery = billShareQuery.in('bill_id', billIds.map(b => b.bill_id));
        } else {
          setUnpaidDebts([]);
          setPaidDebts([]);
          setTotalUnpaidDebt(0);
          return;
        }
      }

      const { data: billShareData, error: shareError } = await billShareQuery;
      if (shareError) throw shareError;

      if (!billShareData || billShareData.length === 0) {
        setUnpaidDebts([]);
        setPaidDebts([]);
        setTotalUnpaidDebt(0);
        return;
      }

      // Get payments for these bill shares to calculate remaining debt
      const billShareIds = billShareData.map(bs => bs.bill_share_id);
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment')
        .select('*')
        .in('bill_share_id', billShareIds);

      if (paymentError) throw paymentError;

      // Create payment map for quick lookup
      const paymentMap = new Map();
      const paymentStatusMap = new Map(); // Track payment confirmation status
      paymentData?.forEach(payment => {
        const existing = paymentMap.get(payment.bill_share_id) || 0;
        paymentMap.set(payment.bill_share_id, existing + payment.amount);
        // Track if payment is confirmed (use 'approved' per current schema)
        paymentStatusMap.set(payment.bill_share_id, payment.status === 'approved');
      });

      // Get unique bill payers (creditors)
      const creditorIds = Array.from(new Set(
        billShareData
          .map(bs => bs.bill?.paid_by_user_id)
          .filter(id => id && id !== userId) // Exclude current user and null values
      ));

      const { data: userData, error: userError } = await supabase
        .from('user')
        .select('user_id, full_name, profile_image_url')
        .in('user_id', creditorIds);

      if (userError) throw userError;

      const userMap = new Map(userData?.map(u => [u.user_id, u]) || []);

      // Process debts and separate into paid/unpaid groups
      const unpaidCreditorDebtMap = new Map();
      const paidCreditorDebtMap = new Map();
      let totalUnpaid = 0;

      billShareData.forEach(billShare => {
        const bill = billShare.bill;
        if (!bill || bill.paid_by_user_id === userId) return; // Skip bills paid by current user

        const amountOwed = billShare.amount_share || 0;
        const amountPaid = paymentMap.get(billShare.bill_share_id) || 0;
        const remainingDebt = amountOwed - amountPaid;
        const isFullyPaid = remainingDebt <= 0;
        const isConfirmed = paymentStatusMap.get(billShare.bill_share_id) || false;

        const creditorId = bill.paid_by_user_id;
        const creditorInfo = userMap.get(creditorId);

        const debtInfo = {
          debt_id: bill.bill_id, // ใช้ bill_id เป็นหลักสำหรับ flow ชำระเงิน
          trip_id: bill.trip_id,
          amount_owed: amountOwed,
          amount_paid: amountPaid,
          bill_type: bill.note || 'Travel expenses',
          is_confirmed: isConfirmed,
          bill_id: bill.bill_id,
          bill_share_id: billShare.bill_share_id,
        } as any;

        if (isFullyPaid || amountPaid > 0) {
          // Add to paid debts
          if (!paidCreditorDebtMap.has(creditorId)) {
            paidCreditorDebtMap.set(creditorId, {
              creditor_user: creditorId,
              creditor_info: creditorInfo,
              total_debt: 0,
              bill_count: 0,
              bills: [],
              payment_status: isFullyPaid && isConfirmed ? 'confirmed' : 'waiting_confirm'
            });
          }
          const paidCreditorDebt = paidCreditorDebtMap.get(creditorId)!;
          paidCreditorDebt.total_debt += amountPaid;
          paidCreditorDebt.bill_count += 1;
          paidCreditorDebt.bills.push(debtInfo);
        }

        if (remainingDebt > 0) {
          // Add to unpaid debts
          if (!unpaidCreditorDebtMap.has(creditorId)) {
            unpaidCreditorDebtMap.set(creditorId, {
              creditor_user: creditorId,
              creditor_info: creditorInfo,
              total_debt: 0,
              bill_count: 0,
              bills: []
            });
          }
          const unpaidCreditorDebt = unpaidCreditorDebtMap.get(creditorId)!;
          unpaidCreditorDebt.total_debt += remainingDebt;
          unpaidCreditorDebt.bill_count += 1;
          unpaidCreditorDebt.bills.push(debtInfo);
          totalUnpaid += remainingDebt;
        }
      });

      // Convert grouped debts to display format
      const unpaidProcessedDebts: DebtItem[] = Array.from(unpaidCreditorDebtMap.values()).map(creditorDebt => ({
        debt_id: `grouped_unpaid_${creditorDebt.creditor_user}`,
        trip_id: tripId || '',
        debtor_user: userId,
        creditor_user: creditorDebt.creditor_user,
        amount_owed: creditorDebt.total_debt,
        amount_paid: 0,
        status: 'pending' as const,
        creditor_info: creditorDebt.creditor_info,
        bill_type: creditorDebt.bill_count > 1 
          ? `${creditorDebt.bill_count} bills` 
          : creditorDebt.bills[0]?.bill_type || 'Travel expenses',
        bill_id: creditorDebt.bills[0]?.bill_id,
        bill_share_id: creditorDebt.bills[0]?.bill_share_id,
      }));

      const paidProcessedDebts: DebtItem[] = Array.from(paidCreditorDebtMap.values()).map(creditorDebt => ({
        debt_id: `grouped_paid_${creditorDebt.creditor_user}`,
        trip_id: tripId || '',
        debtor_user: userId,
        creditor_user: creditorDebt.creditor_user,
        amount_owed: creditorDebt.total_debt,
        amount_paid: creditorDebt.total_debt,
        status: (creditorDebt as any).payment_status === 'confirmed' ? 'settled' : 'partial' as const,
        creditor_info: creditorDebt.creditor_info,
        bill_type: creditorDebt.bill_count > 1 
          ? `${creditorDebt.bill_count} bills` 
          : creditorDebt.bills[0]?.bill_type || 'Travel expenses',
      }));

      setUnpaidDebts(unpaidProcessedDebts);
      setPaidDebts(paidProcessedDebts);
      setTotalUnpaidDebt(totalUnpaid);

    } catch (err) {
      console.error('Error fetching debts:', err);
      Alert.alert('Error', 'Unable to load debt data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    if (currentUserId) {
      setRefreshing(true);
      fetchDebts(currentUserId);
    }
  };

  const handlePay = async (debt: DebtItem) => {
    if (!currentUserId) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    // Update the total unpaid debt immediately for better UX
    setTotalUnpaidDebt(prev => Math.max(0, prev - debt.amount_owed));

    // Navigate to payment upload screen with debt details
    const targetBillId = debt.bill_id || debt.debt_id; // ต้องเป็น bill_id
    if (!targetBillId) {
      Alert.alert('Error', 'Cannot find bill id to pay');
      return;
    }
    router.push({
      pathname: '/PaymentUpload',
      params: {
        billId: String(targetBillId),
        creditorId: debt.creditor_user,
        amount: debt.amount_owed.toString(),
        timestamp: Date.now().toString()
      }
    });
  };

  const refreshDebts = async () => {
    if (currentUserId) {
      await fetchDebts(currentUserId);
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
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('debttrip.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      {/* Add Total Amount Section */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>{t('debttrip.total_to_pay')}</Text>
        <Text style={styles.totalAmount}>
          -{Math.abs(totalUnpaidDebt).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
        </Text>
      </View>

      <Text style={styles.subHeader}>{t('debttrip.waiting_for_pay')}</Text>
      <ScrollView style={styles.scrollContainer}>
        {unpaidDebts.length === 0 ? (
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 30 }}>{t('debttrip.no_debts')}</Text>
        ) : (
          unpaidDebts.map((debt) => (
            <View key={debt.debt_id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.amount}>
                  {debt.amount_owed.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                </Text>
                {debt.creditor_info?.profile_image_url ? (
                  <Image 
                    source={{ uri: debt.creditor_info.profile_image_url }} 
                    style={styles.avatar} 
                  />
                ) : (
                  <Ionicons name="person-circle" size={36} color="#1A3C6B" />
                )}
              </View>

              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <FontAwesome5 name="globe" size={18} color="#1A3C6B" style={{ marginRight: 6 }} />
                  <Text style={styles.totalList}>{debt.bill_type || t('debttrip.travel_expenses')}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.payButton}
                  onPress={() => handlePay(debt)}
                >
                  <Text style={styles.payButtonText}>{t('debttrip.pay')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {(paidDebts.length > 0) && (
          <>
            <Text style={[styles.subHeader, { marginTop: 12 }]}>{t('debttrip.already_paid')}</Text>
            {paidDebts.map((debt) => (
              <View key={debt.debt_id} style={[styles.card, { 
                borderColor: debt.status === 'settled' ? '#B7EAC8' : '#FFE7A2' 
              }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.amount, { 
                    color: debt.status === 'settled' ? '#2FBF71' : '#F4B400' 
                  }]}>
                    {debt.amount_owed.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}
                  </Text>
                  {debt.creditor_info?.profile_image_url ? (
                    <Image 
                      source={{ uri: debt.creditor_info.profile_image_url }} 
                      style={styles.avatar} 
                    />
                  ) : (
                    <Ionicons 
                      name="person-circle" 
                      size={36} 
                      color={debt.status === 'settled' ? '#2FBF71' : '#F4B400'} 
                    />
                  )}
                </View>
                <View style={styles.rowBetween}>
                  <View style={styles.row}>
                    <FontAwesome5 
                      name={debt.status === 'settled' ? 'check-circle' : 'clock'} 
                      size={18} 
                      color={debt.status === 'settled' ? '#2FBF71' : '#F4B400'} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text style={styles.totalList}>{debt.status === 'settled' ? t('debttrip.confirmed') : t('debttrip.waiting_confirm')}</Text>
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
  totalContainer: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  totalLabel: {
    fontSize: 16,
    color: '#1A3C6B',
    marginBottom: 4,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#fff',
    marginLeft: 10, 
    flex: 1, 
    textAlign: 'right' 
  },
  subHeader: { 
    fontSize: 16, 
    color: '#1A3C6B', 
    marginVertical: 10,
    marginHorizontal: 20,
    fontWeight: '600',
  },
  scrollContainer: { 
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  rowBetween: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  amount: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#FF3B30' 
  },
  totalList: { 
    color: '#1A3C6B', 
    fontWeight: '600' 
  },
  avatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#eee' 
  },
  payButton: {
    backgroundColor: '#1A3C6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
