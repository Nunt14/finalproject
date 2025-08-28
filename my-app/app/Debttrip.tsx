import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
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
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchDebts = async (userId: string) => {
    setLoading(true);
    try {
      // Only show debts where current user owes money (is the debtor)
      let query = supabase
        .from('debt_summary')
        .select('*')
        .eq('debtor_user', userId)
        .neq('status', 'settled');

      if (tripId) {
        query = query.eq('trip_id', tripId);
      }

      const { data: debtData, error } = await query;
      if (error) throw error;

      if (!debtData || debtData.length === 0) {
        setDebts([]);
        return;
      }

      // Get creditor user info
      const creditorIds = Array.from(new Set(debtData.map(d => d.creditor_user)));

      const { data: userData, error: userError } = await supabase
        .from('user')
        .select('user_id, full_name, profile_image_url')
        .in('user_id', creditorIds);

      if (userError) throw userError;

      const userMap = new Map(userData?.map(u => [u.user_id, u]) || []);

      const enrichedDebts: DebtItem[] = debtData.map(debt => ({
        ...debt,
        creditor_info: userMap.get(debt.creditor_user),
        bill_type: 'Travel expenses', // Default bill type, can be enhanced later
      }));

      setDebts(enrichedDebts);
    } catch (err) {
      console.error('Error fetching debts:', err);
      Alert.alert('Error', 'ไม่สามารถโหลดข้อมูลหนี้ได้');
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

  const renderDebtItem = ({ item }: { item: DebtItem }) => {
    const remainingAmount = item.amount_owed - item.amount_paid;
    const creditor = item.creditor_info;

    return (
      <View style={styles.debtCard}>
        <View style={styles.amountSection}>
          <Text style={styles.amount}>{remainingAmount.toLocaleString()}.00 ฿</Text>
          <View style={styles.statusContainer}>
            {creditor?.profile_image_url ? (
              <Image source={{ uri: creditor.profile_image_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={20} color="#666" />
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.debtInfo}>
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="airplane" size={16} color="#666" />
            </View>
            <Text style={styles.billType}>{item.bill_type}</Text>
            <TouchableOpacity style={styles.payButton} onPress={() => handlePay(item)}>
              <Ionicons name="card" size={16} color="#fff" />
              <Text style={styles.payButtonText}>Pay</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.waitingText}>Waiting for pay</Text>
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
        data={debts}
        keyExtractor={(item) => item.debt_id}
        renderItem={renderDebtItem}
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
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff3b30',
  },
  statusContainer: {
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
  debtInfo: {
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flex: 1,
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
  waitingText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
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
});
