import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { supabase } from '../constants/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { ImageCache } from '../utils/imageCache';
import { runOcrOnImage } from '../utils/ocr';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [allowCropping, setAllowCropping] = useState<boolean>(false);
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
    console.log('[OCR] Starting OCR process for URI:', uri);
    setOcrLoading(true);
    setOcrText(null);
    setOcrAmount(null);
    
    try {
      console.log('[OCR] Calling runOcrOnImage...');
      const result = await runOcrOnImage({ localUri: uri });
      console.log('[OCR] OCR result received:', {
        hasText: !!result.text,
        textLength: result.text?.length || 0,
        amount: result.amount,
        dateString: result.dateString
      });
      
      setOcrText(result.text ?? null);
      setOcrAmount(result.amount ?? null);
      
      if (result.text) {
        console.log('[OCR] Extracted text preview:', result.text.substring(0, 100) + '...');
      }
      
      if (expectedAmount != null && result.amount != null && !amountsClose(expectedAmount, result.amount)) {
        console.log('[OCR] Amount mismatch detected');
        Alert.alert(
          'ยอดเงินไม่ตรง',
          `ยอดในสลิป: ${result.amount.toLocaleString()} ฿\nยอดที่ต้องจ่าย: ${expectedAmount.toLocaleString()} ฿`,
          [{ text: 'ตกลง' }]
        );
      } else if (result.amount) {
        console.log('[OCR] Amount matches or no expected amount');
      }
    } catch (error) {
      console.error('[OCR] Error during OCR processing:', error);
      Alert.alert('OCR Error', 'เกิดข้อผิดพลาดในการอ่านข้อความจากรูปภาพ');
    } finally {
      console.log('[OCR] OCR process completed');
      setOcrLoading(false);
    }
  };

  const pickImage = async () => {
    console.log('[OCR] pickImage called, allowCropping:', allowCropping);
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: allowCropping,
      quality: 0.8,
    });
    
    console.log('[OCR] Image picker result:', {
      canceled: result.canceled,
      assetsCount: result.assets?.length || 0
    });
    
    if (!result.canceled && result.assets?.length) {
      const imageUri = result.assets[0].uri;
      console.log('[OCR] Image selected:', imageUri);
      setImageUri(imageUri);
      console.log('[OCR] Starting OCR for selected image...');
      runOcr(imageUri);
    } else {
      console.log('[OCR] Image selection canceled or no assets');
    }
  };

  const takePhoto = async () => {
    console.log('[OCR] takePhoto called');
    await ImagePicker.requestCameraPermissionsAsync();
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    
    console.log('[OCR] Camera result:', {
      canceled: result.canceled,
      assetsCount: result.assets?.length || 0
    });
    
    if (!result.canceled && result.assets?.length) {
      const imageUri = result.assets[0].uri;
      console.log('[OCR] Photo taken:', imageUri);
      setImageUri(imageUri);
      console.log('[OCR] Starting OCR for taken photo...');
      runOcr(imageUri);
    } else {
      console.log('[OCR] Photo taking canceled or no assets');
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
          .maybeSingle();
        billShareId = (bs as any)?.bill_share_id ?? null;
      } catch {}
      
      // Upload slip using optimized image service
      let publicImageUrl: string | null = null;
      try {
        if (!imageUri) {
          throw new Error('No image URI provided');
        }

        // Extract file extension from URI
        const match = imageUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        const ext = (match?.[1] || 'jpg').toLowerCase();
        const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        
        // Read and convert image to base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, { 
          encoding: 'base64'
        });
        
        if (!base64) {
          throw new Error('Failed to read image data');
        }
        
        const arrayBuffer = decodeBase64(base64);
        const fileName = `slips/${uid}/${billId}-${Date.now()}.${ext}`;
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, arrayBuffer, { contentType, upsert: true });
        
        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }
        
        // Get public URL
        const { data } = await supabase.storage
          .from('payment-proofs')
          .getPublicUrl(fileName);
        
        publicImageUrl = data?.publicUrl;
        
        if (!publicImageUrl) {
          throw new Error('Failed to upload image');
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        throw error; // Re-throw to be caught by the outer try-catch
      }
      
      // บันทึก payment พร้อมกับ slip_qr
      if (!publicImageUrl) {
        throw new Error('No image URL available for payment');
      }
      
      const paymentData = {
        bill_share_id: billShareId,
        amount: amount ? Number(amount) : (ocrAmount ?? null),
        method: 'qr',
        status: 'pending',
        transaction_id: null,
        slip_qr: publicImageUrl,
        created_at: new Date().toISOString()
      };
      
      const { error: paymentError } = await supabase
        .from('payment')
        .insert(paymentData);
        
      if (paymentError) {
        console.error('Error saving payment:', paymentError);
        throw paymentError;
      }
      
      // ไม่ต้องบันทึก payment_proof เพราะใช้ payment.slip_qr แทน
      // รูปภาพสลิปถูกเก็บใน payment.slip_qr แล้ว
      
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
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 24 }} />
          <Text style={styles.headerTitle}>{t('paymentupload.title')}</Text>
        </View>
      </LinearGradient>

      <View style={styles.uploadContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('paymentupload.section.title')}</Text>
          <TouchableOpacity
            style={[styles.toggleButton, allowCropping && styles.toggleButtonActive]}
            onPress={() => setAllowCropping(!allowCropping)}
          >
            <Text style={[styles.toggleButtonText, allowCropping && styles.toggleButtonTextActive]}>
              {allowCropping ? 'Crop ON' : 'Crop OFF'}
            </Text>
          </TouchableOpacity>
        </View>
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
                <Ionicons name="cloud-upload" size={42} color="#1A3C6B" />
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
                <Ionicons name="document-text" size={20} color="#1A3C6B" />
                <Text style={styles.ocrTitle}>{t('paymentupload.payment_details')}</Text>
              </View>
              {ocrLoading && <ActivityIndicator size="small" color="#1A3C6B" />}
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
                <Ionicons name="refresh" size={16} color="#1A3C6B" style={{ marginRight: 6 }} />
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'right',
  },
  uploadContainer: {
    flex: 1,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#1A3C6B',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleButtonActive: {
    backgroundColor: '#1A3C6B',
    borderColor: '#1A3C6B',
  },
  toggleButtonText: {
    fontSize: 12,
    fontFamily: 'Prompt-Medium',
    color: '#666',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Prompt-Medium',
    color: '#666',
    marginBottom: 20,
  },
  uploadBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  uploadContent: {
    alignItems: 'center',
    padding: 20,
  },
  uploadIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(26, 60, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 18,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#1A3C6B',
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 14,
    fontFamily: 'Prompt-Medium',
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
    fontFamily: 'Prompt-Medium',
    fontWeight: '500',
  },
  ocrCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
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
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#1A3C6B',
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
    fontFamily: 'Prompt-Medium',
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Prompt-Medium',
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
    color: '#1A3C6B',
    fontSize: 13,
    fontFamily: 'Prompt-Medium',
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
    fontFamily: 'Prompt-Medium',
  },
  confirmButton: {
    backgroundColor: '#1A3C6B',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
  },
});
