import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

type TripAggregate = {
  trip_id: string | null;
  trip_name: string;
  total_amount: number;
  rep_bill_id?: string; // representative bill to pass to Payment if needed
};

export default function PayDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { creditorId, tripId } = route.params as { creditorId: string; tripId?: string };
  const { t } = useLanguage();
  const [trips, setTrips] = useState<TripAggregate[]>([]);
  const [creditor, setCreditor] = useState<{ full_name: string; profile_image?: string | null } | null>(null);
  const [total, setTotal] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState("฿");

  useEffect(() => {
    fetchPayDetail();
    getCurrency();
  }, []);

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

  const fetchPayDetail = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return;

    // 1. ดึง bill_share ที่ต้องจ่ายให้ creditor นี้ (และกรองตามทริปถ้ามี)
    const { data, error } = await supabase
      .from('bill_share')
      .select(`
        bill_id,
        amount_share,
        status,
        bill:bill_id (
          created_at,
          trip_id,
          trip:trip_id (
            trip_name
          ),
          paid_by_user_id
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'unpaid');

    if (error) {
      console.error(error);
      return;
    }

    // 2. filter เฉพาะ bill ที่ paid_by_user_id === creditorId และ (ถ้ามี) อยู่ในทริปที่เลือก
    const filtered = (data || []).filter((row: any) => {
      const isCreditor = row.bill?.paid_by_user_id === creditorId;
      const isInTrip = tripId ? String(row.bill?.trip_id) === String(tripId) : true;
      return isCreditor && isInTrip;
    });

    // 3. ดึงข้อมูล creditor (user) พร้อม fallback รูป
    let creditorInfo = null;
    if (filtered.length > 0) {
      const { data: userRows } = await supabase
        .from('user')
        .select('full_name, profile_image_url')
        .eq('user_id', creditorId)
        .maybeSingle();
      if (userRows) {
        creditorInfo = {
          full_name: userRows.full_name,
          profile_image: userRows.profile_image_url || null,
        };
      }
    }

    // 4. รวมยอดเป็นรายทริป และยอดรวมทั้งหมด
    const byTrip = new Map<string, TripAggregate>();
    let sum = 0;
    for (const row of filtered as any[]) {
      const tripIdVal = row.bill?.trip_id ? String(row.bill.trip_id) : 'unknown';
      const tripName = row.bill?.trip?.trip_name || '-';
      const amt = Number(row.amount_share || 0);
      sum += amt;
      const current = byTrip.get(tripIdVal) || { trip_id: row.bill?.trip_id ?? null, trip_name: tripName, total_amount: 0, rep_bill_id: row.bill_id };
      current.total_amount += amt;
      if (!current.rep_bill_id) current.rep_bill_id = row.bill_id;
      byTrip.set(tripIdVal, current);
    }

    const tripList = Array.from(byTrip.values()).sort((a, b) => b.total_amount - a.total_amount);
    setTrips(tripList);
    setTotal(sum);
    setCreditor(creditorInfo);
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
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>{t('paydetail.header')}</Text>
        </View>
      </LinearGradient>

      <View style={styles.creditorSection}>
        {creditor?.profile_image ? (
          <Image source={{ uri: creditor.profile_image }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={50} color="#1A3C6B" />
        )}
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.creditorName}>{creditor?.full_name || '-'}</Text>
          <Text style={styles.unpaidText}>{t('paydetail.unpaid')}</Text>
        </View>
        <Text style={styles.totalAmount}>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}</Text>
      </View>

      <Text style={styles.allListTitle}>{t('paydetail.all_list')}</Text>
      <ScrollView style={{ flex: 1 }}>
        {trips.map((tripItem, idx) => (
          <View key={(tripItem.trip_id ?? 'unknown') + '-' + idx} style={styles.billCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripName}>{tripItem.trip_name}</Text>
              <Text style={styles.billAmount}>{Number(tripItem.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currencySymbol}</Text>
            </View>
            {tripItem.rep_bill_id ? (
              <TouchableOpacity
                style={styles.payButton}
                onPress={() =>
                  router.push({
                    pathname: '/Payment',
                    params: {
                      billId: tripItem.rep_bill_id,
                      creditorId,
                      amount: String(tripItem.total_amount),
                    },
                  })
                }
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('paydetail.pay')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => router.push(`/TripDebtDetail?creditorId=${creditorId}&tripId=${tripItem.trip_id}`)}>
              <Ionicons name="eye" size={22} color="#1A3C6B" style={{ marginLeft: 10 }} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.payAllButton}>
        <Text style={styles.payAllButtonText}>{t('paydetail.pay_all')}</Text>
      </TouchableOpacity>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
    fontFamily: 'Prompt-Medium',
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
    fontFamily: 'Prompt-Medium',
    fontWeight: '600', 
    color: '#fff',
    flex: 1, 
    textAlign: 'right' 
  },
  creditorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    justifyContent: 'space-between',
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
  creditorName: { fontSize: 18, fontFamily: 'Prompt-Medium', fontWeight: '600', color: '#1A3C6B' },
  unpaidText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 15, fontFamily: 'Prompt-Medium' },
  totalAmount: { marginLeft: 'auto', color: '#FF3B30', fontWeight: 'bold', fontSize: 20, fontFamily: 'Prompt-Medium' },
  allListTitle: { fontSize: 16, fontFamily: 'Prompt-Medium', color: '#1A3C6B', marginVertical: 10, marginHorizontal: 20, fontWeight: '600' },
  billCard: {
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
  tripName: { fontSize: 15, fontFamily: 'Prompt-Medium', fontWeight: '600', color: '#1A3C6B' },
  billAmount: { color: '#FF3B30', fontWeight: 'bold', fontSize: 14, fontFamily: 'Prompt-Medium' },
  payButton: {
    backgroundColor: '#1A3C6B',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 12,
    marginLeft: 10,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  payAllButton: {
    backgroundColor: '#1A3C6B',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  payAllButtonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: 'Prompt-Medium' },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});