import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

type RouteParams = {
  billId: string;
  creditorId: string;
  amount?: string;
};

export default function PaymentScreen() {
  const route = useRoute();
  const { billId, creditorId, amount } = route.params as unknown as RouteParams;
  const [creditor, setCreditor] = useState<{ full_name: string; profile_image_url?: string | null; qr_code_img?: string | null } | null>(null);
  const [debtor, setDebtor] = useState<{ full_name: string; profile_image_url?: string | null } | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchCreditor = async () => {
      const { data } = await supabase
        .from('user')
        .select('full_name, profile_image_url, qr_code_img')
        .eq('user_id', creditorId)
        .maybeSingle();
      setCreditor(data as any);
    };
    const fetchDebtor = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('user')
        .select('full_name, profile_image_url')
        .eq('user_id', uid)
        .maybeSingle();
      const fallbackName = (sessionData?.session?.user as any)?.user_metadata?.full_name || (sessionData?.session?.user?.email ?? null);
      setDebtor({
        full_name: (data as any)?.full_name ?? fallbackName ?? '-',
        profile_image_url: (data as any)?.profile_image_url ?? null,
      });
    };

    if (creditorId) fetchCreditor();
    fetchDebtor();
  }, [creditorId]);

  // บันทึกข้อมูลลงตาราง debt_summary เมื่อเข้าหน้านี้ (สร้างครั้งเดียวถ้ายังไม่มี)
  useEffect(() => {
    const ensureDebtSummary = async () => {
      try {
        if (!billId || !creditorId) return;

        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        if (!uid) return;

        // หา trip_id จากตาราง bill
        const { data: bill } = await supabase
          .from('bill')
          .select('trip_id')
          .eq('bill_id', billId)
          .maybeSingle();

        const tripId = (bill as any)?.trip_id ?? null;

        // ตรวจว่ามี record เดิมอยู่หรือไม่ (ตาม debtor, creditor, trip)
        const { data: existing } = await supabase
          .from('debt_summary')
          .select('debt_id')
          .eq('debtor_user', uid)
          .eq('creditor_user', creditorId)
          .eq('trip_id', tripId)
          .limit(1);

        if (existing && existing.length > 0) return;

        // สร้าง record ใหม่
        await supabase.from('debt_summary').insert({
          trip_id: tripId,
          debtor_user: uid,
          creditor_user: creditorId,
          amount_owed: amount ? Number(amount) : 0,
          amount_paid: 0,
          status: 'pending',
        });
      } catch {
        // ไม่ขัดจังหวะ UX หากบันทึกล้มเหลว
      }
    };

    ensureDebtSummary();
  }, [billId, creditorId, amount]);

  const creditorImageUrl = useMemo(() => {
    const url = (creditor?.profile_image_url) as string | undefined;
    if (!url) return null;
    // ใช้เฉพาะ URL ที่โหลดได้จริง (http/https หรือ data URI) เพื่อเลี่ยง file:// และ path ภายในเครื่อง
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return null;
  }, [creditor]);

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
          <Text style={styles.headerTitle}>{t('payment.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <View style={styles.creditorSection}>
        {creditorImageUrl ? (
          <Image source={{ uri: creditorImageUrl }} style={styles.avatar} onError={() => { /* swallow */ }} />
        ) : (
          <Ionicons name="person-circle" size={50} color="#1A3C6B" />
        )}
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.creditorName}>{creditor?.full_name || '-'}</Text>
          <Text style={styles.unpaidText}>{t('payment.unpaid')}</Text>
        </View>
        {!!amount && (
          <Text style={styles.totalAmount}>{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0 })} ฿</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>{t('payment.method')}</Text>
      <View style={styles.qrCard}>
        <Image
          source={
            creditor?.qr_code_img
              ? { uri: creditor.qr_code_img }
              : require('../assets/images/qr.png')
          }
          resizeMode="contain"
          style={{ width: 240, height: 240 }}
        />
        <Text style={styles.qrNote}>{t('payment.scan_to_pay')}</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push({ pathname: '/PaymentUpload', params: { billId, creditorId, amount } })}
      >
        <Text style={styles.primaryButtonText}>{t('payment.upload_photo')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {
          if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
          else router.replace('/');
        }}
      >
        <Text style={styles.secondaryButtonText}>{t('payment.back')}</Text>
      </TouchableOpacity>

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
    textAlign: 'center' 
  },
  creditorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
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
  creditorName: { 
    fontSize: 18, 
    fontFamily: 'Prompt-Medium',
    fontWeight: '600', 
    color: '#1A3C6B' 
  },
  unpaidText: { 
    fontSize: 15, 
    fontFamily: 'Prompt-Medium',
    color: '#FF3B30', 
    fontWeight: '600' 
  },
  totalAmount: { 
    fontSize: 20, 
    fontFamily: 'Prompt-Medium',
    marginLeft: 'auto', 
    color: '#FF3B30', 
    fontWeight: '600' 
  },
  sectionTitle: { 
    fontSize: 14, 
    fontFamily: 'Prompt-Medium',
    color: '#1A3C6B', 
    marginVertical: 10, 
    marginHorizontal: 20, 
    fontWeight: '600' 
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  qrNote: { 
    fontSize: 12, 
    fontFamily: 'Prompt-Medium',
    marginTop: 8, 
    color: '#666' 
  },
  primaryButton: {
    backgroundColor: '#1A3C6B',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: { 
    fontSize: 16, 
    fontFamily: 'Prompt-Medium',
    color: '#fff', 
    fontWeight: '600' 
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    padding: 14,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 20,
    shadowColor: '#6c757d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: { color: '#fff', fontWeight: 'bold' },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});
