import React, { useState, useEffect } from 'react';
import { Image, ImageProps, ActivityIndicator, View, StyleSheet } from 'react-native';
import { ImageCache } from '../utils/imageCache';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  filePath: string;
  fallbackSource?: ImageProps['source'];
  showLoadingIndicator?: boolean;
}

/**
 * Optimized Image component that caches Supabase storage URLs
 * to reduce Cached Egress usage
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  filePath,
  fallbackSource,
  showLoadingIndicator = true,
  style,
  ...props
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        
        const url = await ImageCache.getImageUrl(filePath);
        if (url) {
          setImageUrl(url);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error loading optimized image:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (filePath) {
      loadImage();
    }
  }, [filePath]);

  if (loading && showLoadingIndicator) {
    return (
      <View style={[styles.loadingContainer, style]}>
        <ActivityIndicator size="small" color="#666" />
      </View>
    );
  }

  if (error || !imageUrl) {
    if (fallbackSource) {
      return <Image source={fallbackSource} style={style} {...props} />;
    }
    return null;
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={style}
      onError={() => setError(true)}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
});
