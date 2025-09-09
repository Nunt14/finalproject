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
import { useLanguage } from './contexts/LanguageContext';

type RouteParams = {
  billId: string;
  creditorId: string;
  amount?: string;
};

export default function PaymentUploadScreen() {
  const route = useRoute();
  const { billId, creditorId, amount } = route.params as unknown as RouteParams;
  const { t } = useLanguage();

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
    try { console.log('[OCR] runOcr called with uri:', uri); } catch {}
    setOcrLoading(true);
    setOcrText(null);
    setOcrAmount(null);
    try {
      const result = await runOcrOnImage({ localUri: uri });
      try { console.log('[OCR] result received. amount=', result.amount, 'text.len=', result.text?.length || 0); } catch {}
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
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      try { console.log('[OCR] picked image from library:', result.assets[0].uri); } catch {}
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
      try { console.log('[OCR] captured photo:', result.assets[0].uri); } catch {}
      setImageUri(result.assets[0].uri);
      runOcr(result.assets[0].uri);
    }
  };

  const onConfirm = async () => {
    if (!imageUri || submitting) return;
    if (expectedAmount != null && ocrAmount == null) {
      Alert.alert(t('paymentupload.require_ocr'), t('paymentupload.require_ocr_msg'), [{ text: t('paymentupload.ok') }]);
      return;
    }
    if (matchOk !== true) {
      Alert.alert(t('paymentupload.mismatch_title'), t('paymentupload.warning_box'), [{ text: t('paymentupload.ok') }]);
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
      
      Alert.alert(t('paymentupload.success'), t('paymentupload.success_msg'));
      if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
      if ((router as any).canGoBack && (router as any).canGoBack()) router.back();
    } catch (e) {
      Alert.alert(t('paymentupload.error'), t('paymentupload.error_msg'));
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
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#0F3176" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t('paymentupload.title')}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.uploadContainer}>
        <Text style={styles.sectionTitle}>{t('paymentupload.section.title')}</Text>
        <Text style={styles.sectionSubtitle}>{t('paymentupload.section.subtitle')}</Text>
        
        <TouchableOpacity
          style={styles.uploadBox}
          activeOpacity={0.9}
          onPress={pickImage}
          onLongPress={takePhoto}
        >
          {imageUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
              <View style={styles.overlay}>
                <Ionicons name="camera" size={32} color="#fff" />
                <Text style={styles.overlayText}>{t('paymentupload.tap_to_change')}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadContent}>
              <View style={styles.uploadIcon}>
                <Ionicons name="cloud-upload" size={42} color="#0F3176" />
              </View>
              <Text style={styles.uploadTitle}>{t('paymentupload.upload_slip')}</Text>
              <Text style={styles.uploadSubtitle}>{t('paymentupload.tap_or_longpress')}</Text>
            </View>
          )}
        </TouchableOpacity>

        {imageUri && (
          <View style={styles.ocrCard}>
            <View style={styles.ocrHeader}>
              <View style={styles.ocrTitleContainer}>
                <Ionicons name="document-text" size={20} color="#0F3176" />
                <Text style={styles.ocrTitle}>{t('paymentupload.payment_details')}</Text>
              </View>
              {ocrLoading && <ActivityIndicator size="small" color="#0F3176" />}
            </View>
            
            <View style={styles.ocrDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('paymentupload.amount_in_slip')}</Text>
                <Text style={[styles.detailValue, { color: ocrAmount ? '#2e7d32' : '#666' }]}>
                  {ocrAmount != null ? `${ocrAmount.toLocaleString()} ฿` : t('paymentupload.scanning')}
                </Text>
              </View>
              
              {expectedAmount != null && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('paymentupload.expected_amount')}</Text>
                  <Text style={[styles.detailValue, { color: matchOk === false ? '#e74c3c' : '#2e7d32' }]}>
                    {expectedAmount.toLocaleString()} ฿
                    {matchOk === true && ' ✓'}
                    {matchOk === false && ' ✗'}
                  </Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={styles.scanAgainButton} 
                onPress={() => imageUri && runOcr(imageUri)}
                disabled={ocrLoading}
              >
                <Ionicons name="refresh" size={16} color="#0F3176" style={{ marginRight: 6 }} />
                <Text style={styles.scanAgainText}>{t('paymentupload.scan_again')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {imageUri && expectedAmount != null && matchOk === false && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={18} color="#e74c3c" />
            <Text style={styles.warningText}>{t('paymentupload.warning_box')}</Text>
          </View>
        )}
        
        <TouchableOpacity
          disabled={!isConfirmEnabled}
          style={[styles.confirmButton, { opacity: isConfirmEnabled ? 1 : 0.6 }]}
          onPress={onConfirm}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>
              {imageUri ? t('paymentupload.confirm_payment') : t('paymentupload.upload_cta')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 55, // Added padding to move content down from the status bar
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: -30,  // Move content more to the right
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: 20,  // Add right margin to the title
  },
  uploadContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  uploadBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadContent: {
    alignItems: 'center',
    padding: 20,
  },
  uploadIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(15, 49, 118, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
  overlayText: {
    color: '#fff',
    marginTop: 8,
    fontWeight: '500',
  },
  ocrCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ocrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ocrTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ocrTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 8,
  },
  ocrDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
  },
  scanAgainText: {
    color: '#0F3176',
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  warningText: {
    color: '#e74c3c',
    marginLeft: 8,
    fontSize: 14,
  },
  confirmButton: {
    backgroundColor: '#0F3176',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F3176',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
