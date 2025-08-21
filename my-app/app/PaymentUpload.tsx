import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';

type RouteParams = {
  billId: string;
  creditorId: string;
  amount?: string;
};

export default function PaymentUploadScreen() {
  const route = useRoute();
  const { billId, creditorId, amount } = route.params as unknown as RouteParams;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const pickImage = async () => {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onConfirm = async () => {
    if (!imageUri || submitting) return;
    try {
      setSubmitting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id ?? null;
      if (!uid) {
        Alert.alert('Error', 'กรุณาเข้าสู่ระบบก่อน');
        return;
      }
      // ค้นหา bill_share_id ของผู้ใช้คนนี้ในบิลนี้เพื่อใช้บันทึกลงตาราง payment
      let billShareId: string | null = null;
      try {
        const { data: bs } = await supabase
          .from('bill_share')
          .select('bill_share_id')
          .eq('bill_id', billId)
          .eq('user_id', uid)
          .single();
        billShareId = (bs as any)?.bill_share_id ?? null;
      } catch {}
      // อัปโหลดสลิปไปยัง Supabase Storage เพื่อให้เจ้าหนี้สามารถเห็นรูปได้
      let publicImageUrl: string | null = null;
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const extension = 'jpg';
        const filePath = `proofs/${uid}/${billId}-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('payment_proofs')
          .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
        if (!uploadError) {
          const { data: pub } = await supabase.storage
            .from('payment_proofs')
            .getPublicUrl(filePath);
          publicImageUrl = (pub as any)?.publicUrl ?? null;
        }
      } catch {}
      await supabase.from('payment_proof').insert({
        bill_id: billId,
        creditor_id: creditorId,
        debtor_user_id: uid,
        amount: amount ? Number(amount) : null,
        image_uri_local: publicImageUrl ?? imageUri,
        status: 'pending',
      });
      // บันทึก payment ตามสคีมาที่กำหนด
      await supabase.from('payment').insert({
        bill_share_id: billShareId,
        amount: amount ? Number(amount) : null,
        method: 'qr',
        status: 'pending',
        transaction_id: null,
      });
      Alert.alert('Success', 'Payment submitted for review.');
      if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
      if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
    } catch (e) {
      Alert.alert('Error', 'Unable to submit payment.');
    } finally {
      setSubmitting(false);
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
        <Text style={styles.headerTitle}>Payment</Text>
      </View>

      <Text style={styles.sectionTitle}>Upload Photo</Text>

      <TouchableOpacity
        style={styles.uploadBox}
        activeOpacity={0.8}
        onPress={pickImage}
        onLongPress={takePhoto}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="images-outline" size={42} color="#999" />
            <Text style={{ color: '#777', marginTop: 8 }}>Photo Library / Take Photo</Text>
          </View>
        )}
      </TouchableOpacity>


      <TouchableOpacity
        disabled={!imageUri || submitting}
        style={[styles.primaryButton, { opacity: imageUri ? 1 : 0.5, marginTop: 10 }]}
        onPress={onConfirm}
      >
        <Text style={styles.primaryButtonText}>{imageUri ? 'Confirm Payment' : 'Next'}</Text>
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
  sectionTitle: { fontSize: 14, color: '#666', marginVertical: 10 },
  uploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    paddingVertical: 18,
    height: 220,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  preview: { width: '90%', height: '100%', borderRadius: 10 },
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
    marginTop: 6,
  },
  secondaryButtonText: { color: '#fff', fontWeight: 'bold' },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});


