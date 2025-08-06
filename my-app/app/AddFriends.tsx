import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function AddFriendsScreen() {
  const [selectedTab, setSelectedTab] = useState<'friends' | 'group'>('friends');
  const navigation = useNavigation();

  const friends = [
    { name: 'Jam', color: '#F48FB1' },
    { name: 'Tung', color: '#FFA726' },
    { name: 'Few', color: '#4CAF50' },
  ];

  const groups = [
    {
      name: 'Nakhon NaYok Trip',
      image: 'https://source.unsplash.com/100x100/?car,road',
      expense: false,
    },
    {
      name: 'Chiang Mai',
      image: 'https://source.unsplash.com/100x100/?chiangmai',
      expense: true,
    },
    {
      name: 'เกาะล้าน',
      image: 'https://source.unsplash.com/100x100/?beach,thailand',
      expense: true,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Friends</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'friends' && styles.activeTab,
          ]}
          onPress={() => setSelectedTab('friends')}
        >
          <Text style={selectedTab === 'friends' ? styles.activeTabText : styles.tabText}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 'group' && styles.activeTab,
          ]}
          onPress={() => setSelectedTab('group')}
        >
          <Text style={selectedTab === 'group' ? styles.activeTabText : styles.tabText}>
            Group
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {selectedTab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ paddingVertical: 10 }}
          renderItem={({ item }) => (
            <View style={styles.friendItem}>
              <View style={[styles.friendIcon, { backgroundColor: item.color }]} />
              <Text style={styles.friendName}>{item.name}</Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ paddingVertical: 10 }}
          renderItem={({ item }) => (
            <View style={styles.groupItem}>
              <Image source={{ uri: item.image }} style={styles.groupImage} />
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={{ color: item.expense ? 'red' : 'gray', fontSize: 12 }}>
                  {item.expense ? 'with expenses' : 'no expenses'}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Button */}
      <TouchableOpacity style={styles.addButton}>
        <Text style={styles.buttonText}>
          {selectedTab === 'friends' ? 'Add Friends' : 'New Group'}
        </Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#45647C',
  },
  tabText: {
    color: '#555',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  friendIcon: {
    width: 35,
    height: 35,
    borderRadius: 20,
    marginRight: 15,
  },
  friendName: {
    fontSize: 16,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  groupImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  groupName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#45647C',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 150, // 👈 ถ้าต้องการดันขึ้นจากด้านล่าง

  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },

});
