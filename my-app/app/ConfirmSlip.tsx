import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../constants/supabase';

export default function ConfirmSlipScreen() {
  const { proofId } = useLocalSearchParams<{ proofId: string }>();
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!proofId) return;
      const { data } = await supabase
        .from('payment_proof')
        .select('image_uri_local')
        .eq('id', proofId)
        .single();
      setImageUri((data as any)?.image_uri_local ?? null);
    };
    run();
  }, [proofId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Payment</Text>
      </View>

      <View style={styles.previewBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        ) : (
          <Text>No image</Text>
        )}
      </View>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
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
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, left: 0 },
});


