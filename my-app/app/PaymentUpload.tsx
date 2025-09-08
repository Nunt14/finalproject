import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { runOcrOnImage } from '../utils/ocr';

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
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrAmount, setOcrAmount] = useState<number | null>(null);
  const expectedAmount = useMemo(() => (amount ? Number(amount) : null), [amount]);

  const amountsClose = (a: number, b: number): boolean => {
    // tolerate small rounding or OCR errors
    const tol = 1; // THB
    return Math.abs(a - b) <= tol;
  };

  const matchOk = useMemo(() => {
    if (expectedAmount == null || ocrAmount == null) return null;
    return amountsClose(expectedAmount, ocrAmount);
  }, [expectedAmount, ocrAmount]);

  const isConfirmEnabled = useMemo(() => {
    if (!imageUri || submitting || ocrLoading) return false;
    if (expectedAmount == null) return true; // ไม่มีค่าอ้างอิง อนุโลม
    if (ocrAmount == null) return false; // ต้องอ่านยอดได้ก่อน
    return matchOk === true;
  }, [imageUri, submitting, ocrLoading, expectedAmount, ocrAmount, matchOk]);

  const runOcr = async (uri: string) => {
    setOcrLoading(true);
    setOcrText(null);
    setOcrAmount(null);
    try {
      const result = await runOcrOnImage({ localUri: uri });
      setOcrText(result.text ?? null);
      setOcrAmount(result.amount ?? null);
      if (expectedAmount != null && result.amount != null && !amountsClose(expectedAmount, result.amount)) {
        Alert.alert(
          'ยอดเงินไม่ตรง',
          `ยอดในสลิป: ${result.amount.toLocaleString()} ฿\nยอดที่ต้องจ่าย: ${expectedAmount.toLocaleString()} ฿`,
          [{ text: 'ตกลง' }]
        );
      }
    } catch {
      // swallow; UI will just show unknown
    } finally {
      setOcrLoading(false);
    }
  };

  const pickImage = async () => {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setImageUri(result.assets[0].uri);
      runOcr(result.assets[0].uri);
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
      runOcr(result.assets[0].uri);
    }
  };

  const onConfirm = async () => {
    if (!imageUri || submitting) return;
    if (expectedAmount != null && ocrAmount == null) {
      Alert.alert('ต้องการยอดจากสลิป', 'กรุณาให้ระบบอ่านยอดจากสลิปให้สำเร็จก่อน', [{ text: 'ตกลง' }]);
      return;
    }
    if (matchOk !== true) {
      Alert.alert('ยอดไม่ตรง', 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องจ่าย', [{ text: 'ตกลง' }]);
      return;
    }
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
      
      // อัปโหลดสลิปไปยัง Supabase Storage (RN-safe via Base64 -> ArrayBuffer)
      let publicImageUrl: string | null = null;
      try {
        const match = imageUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        const ext = (match?.[1] || 'jpg').toLowerCase();
        const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
        const arrayBuffer = decodeBase64(base64);
        const filePath = `slips/${uid}/${billId}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, arrayBuffer, { contentType, upsert: true });
        if (!uploadError) {
          const { data: pub } = await supabase.storage
            .from('payment-proofs')
            .getPublicUrl(filePath);
          publicImageUrl = (pub as any)?.publicUrl ?? null;
        }
      } catch {}
      
      // บันทึก payment พร้อมกับ slip_qr
      await supabase.from('payment').insert({
        bill_share_id: billShareId,
        amount: amount ? Number(amount) : (ocrAmount ?? null),
        method: 'qr',
        status: 'pending',
        transaction_id: null,
        slip_qr: publicImageUrl ?? imageUri, // บันทึกรูปสลิปใน slip_qr field
      });
      
      // บันทึก payment_proof สำหรับ backup (optional)
      await supabase.from('payment_proof').insert({
        bill_id: billId,
        creditor_id: creditorId,
        debtor_user_id: uid,
        amount: amount ? Number(amount) : null,
        image_uri_local: publicImageUrl ?? imageUri,
        status: 'pending',
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

      {imageUri ? (
        <View style={styles.ocrCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="document-text" size={18} color="#234080" />
            <Text style={{ marginLeft: 6, fontWeight: 'bold' }}>OCR</Text>
            {ocrLoading ? <ActivityIndicator size="small" color="#234080" style={{ marginLeft: 8 }} /> : null}
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={{ color: '#555' }}>ยอดในสลิป: {ocrAmount != null ? `${ocrAmount.toLocaleString()} ฿` : '-'}</Text>
            {expectedAmount != null ? (
              <Text style={{ color: matchOk === false ? '#c0392b' : '#2e7d32', marginTop: 4 }}>
                เทียบยอดที่ต้องจ่าย: {expectedAmount.toLocaleString()} ฿ {matchOk == null ? '' : matchOk ? '(ตรงกัน)' : '(ไม่ตรง)'}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={[styles.secondaryButton, { marginTop: 10 }]} onPress={() => imageUri && runOcr(imageUri)}>
            <Text style={styles.secondaryButtonText}>สแกนใหม่</Text>
          </TouchableOpacity>
        </View>
      ) : null}


      <TouchableOpacity
        disabled={!isConfirmEnabled}
        style={[styles.primaryButton, { opacity: isConfirmEnabled ? 1 : 0.5, marginTop: 10 }]}
        onPress={onConfirm}
      >
        <Text style={styles.primaryButtonText}>{imageUri ? 'Confirm Payment' : 'Next'}</Text>
      </TouchableOpacity>

      {imageUri && expectedAmount != null ? (
        matchOk === false ? (
          <Text style={{ color: '#c0392b', marginTop: 6 }}>ยอดไม่ตรงกับที่ต้องจ่าย จึงยังยืนยันไม่ได้</Text>
        ) : ocrAmount == null ? (
          <Text style={{ color: '#8a6d3b', marginTop: 6 }}>กำลังอ่านยอดจากสลิป หรืออ่านไม่สำเร็จ</Text>
        ) : null
      ) : null}

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {
          if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
          else router.replace('/');
        }}
      >
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>

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
  ocrCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});
