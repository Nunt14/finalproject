import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QRCodeDisplayProps {
  qrImageUri?: string | null;
  onEdit?: () => void;
  title?: string;
  placeholder?: string;
}

export default function QRCodeDisplay({ 
  qrImageUri, 
  onEdit, 
  title = "Payment QR Code",
  placeholder = "No QR Code"
}: QRCodeDisplayProps) {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoadStart = () => {
    setImageLoading(true);
    setImageError(false);
  };

  const handleImageLoadEnd = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Ionicons name="create-outline" size={16} color="#1A3C6B" />
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.qrContainer}>
        {qrImageUri && !imageError ? (
          <Image
            source={{ uri: qrImageUri }}
            style={styles.qrImage}
            onLoadStart={handleImageLoadStart}
            onLoadEnd={handleImageLoadEnd}
            onError={handleImageError}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="qr-code-outline" size={48} color="#ccc" />
            <Text style={styles.placeholderText}>{placeholder}</Text>
          </View>
        )}

        {imageLoading && (
          <View style={styles.loadingOverlay}>
            <Ionicons name="hourglass-outline" size={24} color="#1A3C6B" />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#1A3C6B',
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#1A3C6B',
    borderStyle: 'dashed',
    position: 'relative',
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  placeholder: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    fontFamily: 'Prompt-Medium',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
});

