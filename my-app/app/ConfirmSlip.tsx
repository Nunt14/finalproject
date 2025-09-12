import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useLanguage } from './contexts/LanguageContext';

// Helper function to get proper image URL from Supabase storage
const getImageUrl = (imageUri: string | null | undefined): string | null => {
  if (!imageUri) return null;
  
  // If it's already a full URL, return as is
  if (imageUri.startsWith('http')) return imageUri;
  
  // If it's a Supabase storage path, construct the full URL
  if (imageUri.startsWith('payment-proofs/') || imageUri.startsWith('slips/')) {
    const path = imageUri.replace('payment-proofs/', '').replace('slips/', '');
    const { data } = supabase.storage.from('payment-proofs').getPublicUrl(path);
    return data.publicUrl;
  }
  
  // For other storage paths, try to construct URL
  try {
    const { data } = supabase.storage.from('payment-proofs').getPublicUrl(imageUri);
    return data.publicUrl;
  } catch {
    return null;
  }
};

export default function ConfirmSlipScreen() {
  const { proofId, imageUri: imageUriParam } = useLocalSearchParams<{ proofId?: string; imageUri?: string }>();
  const [imageUri, setImageUri] = useState<string | null>(imageUriParam ?? null);
  const { t } = useLanguage();

  useEffect(() => {
    const run = async () => {
      if (imageUriParam) return; // already have from navigation
      if (!proofId) return;
      const { data } = await supabase
        .from('payment_proof')
        .select('image_uri_local, slip_qr')
        .eq('id', proofId)
        .single();
      // ใช้ slip_qr เป็นหลัก แล้วค่อย fallback ไป image_uri_local
      const imgUri = (data as any)?.slip_qr || (data as any)?.image_uri_local || null;
      setImageUri(imgUri);
    };
    run();
  }, [proofId, imageUriParam]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('confirmslip.title')}</Text>
      </View>

      <View style={styles.previewBox}>
        {!imageUri ? (
          <View style={styles.noImageContainer}>
            <Ionicons name="image-outline" size={48} color="#ccc" />
            <Text style={styles.noImageText}>{t('confirmslip.no_image')}</Text>
          </View>
        ) : (
          <Image 
            source={{ uri: getImageUrl(imageUri) || '' }} 
            style={styles.preview} 
            resizeMode="contain"
            onError={() => {
              console.error('Failed to load image:', imageUri);
              setImageUri(null);
            }}
          />
        )}
      </View>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10, textAlign: 'left' },
  previewBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 18,
    height: 260,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  preview: { width: '92%', height: '100%', borderRadius: 8 },
  noImageContainer: { alignItems: 'center', justifyContent: 'center' },
  noImageText: { marginTop: 8, color: '#666', fontSize: 14 },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});
