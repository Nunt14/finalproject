import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';

type RouteParams = {
  billId: string;
  creditorId: string;
  amount?: string;
};

export default function PaymentScreen() {
  const route = useRoute();
  const { billId, creditorId, amount } = route.params as unknown as RouteParams;
  const [creditor, setCreditor] = useState<{ full_name: string; profile_image?: string | null; qr_code_img?: string | null } | null>(null);

  useEffect(() => {
    const fetchCreditor = async () => {
      const { data } = await supabase
        .from('user')
        .select('full_name, profile_image, qr_code_img')
        .eq('user_id', creditorId)
        .single();
      setCreditor(data as any);
    };
    if (creditorId) fetchCreditor();
  }, [creditorId]);

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
        <Text style={styles.headerTitle}>Payment</Text>
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
        {!!amount && (
          <Text style={styles.totalAmount}>{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0 })} ฿</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Payment Method</Text>
      <View style={styles.qrCard}>
        <Image
          source={
            creditor?.qr_code_img
              ? { uri: creditor.qr_code_img }
              : require('../assets/images/qr.png')
          }
          resizeMode="contain"
          style={{ width: 170, height: 170 }}
        />
        <Text style={styles.qrNote}>สแกนเพื่อชำระเงิน</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push({ pathname: 'PaymentUpload', params: { billId, creditorId, amount } })}
      >
        <Text style={styles.primaryButtonText}>Upload Photo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {
          if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
          else router.replace('/');
        }}
      >
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
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
  totalAmount: { marginLeft: 'auto', color: 'red', fontWeight: 'bold', fontSize: 20 },
  sectionTitle: { fontSize: 14, color: '#666', marginVertical: 10 },
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  qrNote: { marginTop: 8, color: '#666' },
  primaryButton: {
    backgroundColor: '#234080',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  secondaryButton: {
    backgroundColor: '#3a3a3a',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#fff', fontWeight: 'bold' },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});


