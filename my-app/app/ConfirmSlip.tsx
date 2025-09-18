import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from './utils/fonts';
import { supabase } from '../constants/supabase';
import { useLanguage } from './contexts/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

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
  const router = useRouter();
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
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#1A3C6B', '#45647C', '#6B8E9C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('confirmslip.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <View style={styles.previewBox}>
        {!imageUri ? (
          <View style={styles.noImageContainer}>
            <Ionicons name="image-outline" size={48} color="#1A3C6B" />
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
  container: { 
    flex: 1, 
    backgroundColor: '#fff',
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
    fontFamily: Fonts.medium,
    fontWeight: 'bold', 
    color: '#fff',
    marginLeft: 10, 
    flex: 1, 
    textAlign: 'center' 
  },
  previewBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 20,
    height: 280,
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
  preview: { width: '92%', height: '100%', borderRadius: 8 },
  noImageContainer: { alignItems: 'center', justifyContent: 'center' },
  noImageText: { 
    marginTop: 8, 
    color: '#1A3C6B', 
    fontSize: 14, 
    fontFamily: Fonts.medium,
    fontWeight: '500' 
  },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});
