import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { CacheManager } from '../utils/cacheManager';
import { AggressiveCache } from '../utils/aggressiveCache';

interface CacheStats {
  imageCacheCount: number;
  dataCacheCount: number;
  aggressiveCacheCount: number;
  totalSize: number;
  hitRate: number;
}

export default function CacheDebugger() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const cacheStats = await CacheManager.getCacheStats();
      const aggressiveStats = await AggressiveCache.getStats();
      
      setStats({
        ...cacheStats,
        hitRate: aggressiveStats.hitRate,
      });
    } catch (error) {
      console.error('Error loading cache stats:', error);
      Alert.alert('Error', 'Failed to load cache statistics');
    } finally {
      setLoading(false);
    }
  };

  const clearAllCaches = async () => {
    Alert.alert(
      'Clear All Caches',
      'Are you sure you want to clear all caches? This will remove all cached data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await CacheManager.clearAllCaches();
              await loadStats();
              Alert.alert('Success', 'All caches cleared successfully');
            } catch (error) {
              console.error('Error clearing caches:', error);
              Alert.alert('Error', 'Failed to clear caches');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const logCacheUsage = async () => {
    await CacheManager.logCacheUsage();
    Alert.alert('Cache Log', 'Cache usage logged to console');
  };

  const logCachePerformance = async () => {
    await CacheManager.logCachePerformance();
    Alert.alert('Performance Log', 'Cache performance logged to console');
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading && !stats) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading Cache Stats...</Text>
      </View>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024) * 100) / 100} MB`;
  };

  const getEfficiencyColor = (hitRate: number) => {
    if (hitRate > 0.7) return '#4CAF50'; // Green
    if (hitRate > 0.4) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📊 Cache Debugger</Text>
      
      {stats && (
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Cache Statistics</Text>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>🖼️ Image Cache:</Text>
            <Text style={styles.statValue}>{stats.imageCacheCount} entries</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>📊 Data Cache:</Text>
            <Text style={styles.statValue}>{stats.dataCacheCount} entries</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>⚡ Aggressive Cache:</Text>
            <Text style={styles.statValue}>{stats.aggressiveCacheCount} entries</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>📦 Total Entries:</Text>
            <Text style={styles.statValue}>
              {stats.imageCacheCount + stats.dataCacheCount + stats.aggressiveCacheCount}
            </Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>💾 Total Size:</Text>
            <Text style={styles.statValue}>{formatSize(stats.totalSize)}</Text>
          </View>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>🎯 Hit Rate:</Text>
            <Text style={[styles.statValue, { color: getEfficiencyColor(stats.hitRate) }]}>
              {Math.round(stats.hitRate * 100)}%
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.button} onPress={loadStats}>
          <Text style={styles.buttonText}>🔄 Refresh Stats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={logCacheUsage}>
          <Text style={styles.buttonText}>📊 Log Usage</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={logCachePerformance}>
          <Text style={styles.buttonText}>🚀 Log Performance</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearAllCaches}>
          <Text style={styles.buttonText}>🧹 Clear All Caches</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  actionsContainer: {
    gap: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
