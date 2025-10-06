import React, { useState } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileImageProps {
  imageUri?: string | null;
  onPress?: () => void;
  size?: number;
  showEditButton?: boolean;
  loading?: boolean;
}

export default function ProfileImage({ 
  imageUri, 
  onPress, 
  size = 120, 
  showEditButton = true,
  loading = false 
}: ProfileImageProps) {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Check if URL is valid
  const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    try {
      new URL(url);
      return url.startsWith('http') && (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp'));
    } catch {
      return false;
    }
  };

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
    <View style={[styles.container, { 
      width: size * 1.2, 
      height: size * 1.2,
      justifyContent: 'center',
      alignItems: 'center'
    }]}>
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.8}
        style={[styles.imageContainer, { 
          width: size, 
          height: size, 
          borderRadius: size / 2 
        }]}
      >
        {imageUri && !imageError && isValidUrl(imageUri) ? (
          <Image
            source={{ 
              uri: imageUri,
              cache: 'reload' // Force reload to avoid cache issues
            }}
            style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
            onLoadStart={handleImageLoadStart}
            onLoadEnd={handleImageLoadEnd}
            onError={handleImageError}
            defaultSource={require('../assets/images/icon.png')}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
            <Image
              source={require('../assets/images/icon.png')}
              style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
              resizeMode="cover"
            />
            {imageUri && (
              <Text style={{ fontSize: 10, color: '#999', marginTop: 5, textAlign: 'center' }}>
                {!isValidUrl(imageUri) ? 'Invalid image URL' : 'Error loading image'}
              </Text>
            )}
          </View>
        )}

        {(imageLoading || loading) && (
          <View style={[styles.loadingOverlay, { width: size, height: size, borderRadius: size / 2 }]}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}

        {showEditButton && (
          <TouchableOpacity 
            style={[styles.editButton, { 
              bottom: size * 0.05, 
              right: size * 0.05,
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: size * 0.125
            }]}
            onPress={onPress}
          >
            <Ionicons name="camera" size={size * 0.12} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderWidth: 5,
    borderColor: '#1A3C6B',
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  image: {
    backgroundColor: '#f8f9fa',
  },
  placeholder: {
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    position: 'absolute',
    backgroundColor: '#1A3C6B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
});
