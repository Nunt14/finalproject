import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { supabase } from '../constants/supabase';

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
};

export default function DebttripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
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
        fetchDebts(currentUserId);
      }
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
        // Track if payment is confirmed (assuming there's a confirmed field)
        paymentStatusMap.set(payment.bill_share_id, payment.status === 'confirmed');
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
          debt_id: billShare.bill_share_id,
          trip_id: bill.trip_id,
          amount_owed: amountOwed,
          amount_paid: amountPaid,
          bill_type: bill.note || 'Travel expenses',
          is_confirmed: isConfirmed
        };

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

  const handlePay = (debt: DebtItem) => {
    // Navigate to payment screen with debt information
    router.push(`/Payment?debtId=${debt.debt_id}&creditorId=${debt.creditor_user}&amount=${debt.amount_owed - debt.amount_paid}`);
  };

  const renderHeader = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.waitingText}>Waiting for pay</Text>
      <Text style={styles.totalAmount}>{totalUnpaidDebt.toLocaleString()}.00 ฿</Text>
    </View>
  );

  const renderPaidHeader = () => (
    <View style={styles.paidHeaderContainer}>
      <Text style={styles.paidHeaderText}>Already Paid</Text>
    </View>
  );

  const renderDebtItem = ({ item }: { item: DebtItem }) => {
    // For grouped debts, amount_owed already contains the total remaining debt
    const remainingAmount = item.amount_owed;
    const creditor = item.creditor_info;
    const isPaid = item.status === 'settled' || item.status === 'partial';

    return (
      <View style={styles.debtCard}>
        <View style={styles.debtHeader}>
          <Text style={styles.debtAmount}>{remainingAmount.toLocaleString()}.00 ฿</Text>
          <View style={styles.creditorInfo}>
            {creditor?.profile_image_url ? (
              <Image source={{ uri: creditor.profile_image_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {creditor?.full_name?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <Text style={styles.creditorName}>{creditor?.full_name || 'Unknown'}</Text>
          </View>
        </View>
        
        <View style={styles.debtFooter}>
          <View style={styles.billTypeContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="receipt" size={16} color="#666" />
            </View>
            <Text style={styles.billType}>{item.bill_type}</Text>
          </View>
          
          {isPaid ? (
            <View style={styles.statusContainer}>
              {item.status === 'settled' ? (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.confirmedText}>Confirmed</Text>
                </>
              ) : (
                <>
                  <View style={styles.waitingIndicator} />
                  <Text style={styles.waitingConfirmText}>Waiting for confirm</Text>
                </>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.payButton} onPress={() => handlePay(item)}>
              <Ionicons name="card" size={16} color="#fff" />
              <Text style={styles.payButtonText}>Pay</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debt</Text>
      </View>

      <FlatList
        data={[...unpaidDebts, ...(paidDebts.length > 0 ? [{ type: 'paid_header' } as any, ...paidDebts] : [])]}
        keyExtractor={(item, index) => item.type === 'paid_header' ? 'paid_header' : item.debt_id}
        renderItem={({ item }) => {
          if (item.type === 'paid_header') {
            return renderPaidHeader();
          }
          return renderDebtItem({ item });
        }}
        ListHeaderComponent={unpaidDebts.length > 0 ? renderHeader : null}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No debts found</Text>
            <Text style={styles.emptySubtext}>
              You have no outstanding debts in this trip
            </Text>
          </View>
        )}
      />

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff3b30',
  },
  debtCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  debtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  debtAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff3b30',
  },
  creditorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  creditorName: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  debtFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  billType: {
    fontSize: 14,
    color: '#666',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  bgImage: {
    width: '111%',
    height: 235,
    position: 'absolute',
    bottom: -4,
    left: 0,
  },
  paidHeaderContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f7f7f7',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  paidHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waitingIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff9800',
    marginRight: 8,
  },
  waitingConfirmText: {
    fontSize: 14,
    color: '#666',
  },
  confirmedText: {
    fontSize: 14,
    color: '#4CAF50',
  },
});
