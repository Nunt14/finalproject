import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native'; // ✅ เพิ่มบรรทัดนี้
import { supabase } from '../constants/supabase'; // เปลี่ยนตาม path ของคุณ

// ✅ ถ้ามี type ของ Stack Navigator
type RootStackParamList = {
  Debt: undefined;
  // เพิ่มหน้าต่าง ๆ ที่คุณใช้
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Debt'>;

type Debt = {
  id: number;
  person_name: string;
  amount: number;
  list_count: number;
  avatar_color: string;
  icon?: string;
};

export default function DebtScreen() {
  const navigation = useNavigation<NavigationProp>(); // ✅ ใช้ hook นี้แทน prop

  const [debts, setDebts] = useState<Debt[]>([]);

  useEffect(() => {
    fetchDebts();
  }, []);

  const fetchDebts = async () => {
    const { data, error } = await supabase.from('debts').select('*');
    if (!error && data) {
      setDebts(data);
    } else {
      console.error('Error fetching debts:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debt</Text>
      </View>

      <Text style={styles.subHeader}>Waiting for pay</Text>

      <ScrollView style={styles.scrollContainer}>
        {debts.map((debt) => (
          <View key={debt.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.amount}>{debt.amount.toFixed(2)} ฿</Text>
              <Ionicons name="person-circle" size={30} color={debt.avatar_color || 'gray'} />
            </View>
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <FontAwesome5
                  name={debt.icon || 'car'}
                  size={16}
                  color="#45647C"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.totalList}>Total : {debt.list_count} list</Text>
              </View>
              <TouchableOpacity>
                <Ionicons name="eye" size={24} color="#45647C" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} />
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
  },
  subHeader: {
    fontSize: 16,
    color: '#666',
    marginVertical: 10,
  },
  scrollContainer: {
    // เพิ่มสไตล์ตามต้องการ เช่น
    paddingVertical: 10,
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'red',
  },
  totalList: {
    color: '#45647C',
  },
  bgImage: {
    width: '111%',
    height: 235,
    position: 'absolute',
    bottom: -4,
    left: 0,
  },
});
