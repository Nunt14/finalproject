// นำเข้า React และฮุคพื้นฐานที่ใช้ในคอมโพเนนต์นี้
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Pressable, Alert } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
// นำเข้าฟังก์ชันสำหรับอ่านพารามิเตอร์จาก URL และการนำทาง
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from './contexts/LanguageContext';

// ชนิดข้อมูลของส่วนแบ่งบิลของผู้ใช้แต่ละคน
type BillShare = {
  user_id: string;
  amount_share: number;
  status: 'paid' | 'unpaid';
  full_name?: string | null;
  profile_image_url?: string | null;
  is_owner?: boolean;
};

// ชนิดข้อมูลของบิลในระบบ
type BillItem = {
  bill_id: string;
  trip_id: string;
  total_amount: number;
  payer_user_id?: string | null;
  shares?: BillShare[];
  created_at?: string;
  payer_full_name?: string | null;
  payer_profile_image_url?: string | null;
  note?: string | null;
};

// คอมโพเนนต์หลักของหน้าทริป
export default function TripScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t } = useLanguage();

  // สเตตหลักสำหรับเก็บข้อมูลทริปและบิล
  const [trip, setTrip] = useState<any | null>(null);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<BillItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [currencySymbol, setCurrencySymbol] = useState("฿");

  useEffect(() => {
    const getCurrency = async () => {
      const currencyCode = await AsyncStorage.getItem("user_currency");
      switch (currencyCode) {
        case "USD":
          setCurrencySymbol("$");
          break;
        case "EUR":
          setCurrencySymbol("€");
          break;
        case "JPY":
          setCurrencySymbol("¥");
          break;
        case "GBP":
          setCurrencySymbol("£");
          break;
        case "THB":
        default:
          setCurrencySymbol("฿");
          break;
      }
    };
    getCurrency();
  }, []);

  // ฟังก์ชันสุ่มสีแบบคงที่จาก userId เพื่อใช้แสดงสีของ Avatar ให้คงเดิม
  const getRandomColor = (userId: string) => {
    const colors = ['#4A90E2', '#F5A623', '#FF6B6B', '#4CD964', '#9B59B6', '#E74C3C', '#1ABC9C', '#F39C12'];
    const index = Math.abs(hashCode(userId)) % colors.length;
    return colors[index];
  };

  // ฟังก์ชันช่วยสร้างค่าแฮชจากสตริง
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  };

  // โหลดข้อมูลทริปและบิลเมื่อเปิดหน้าหรือเมื่อ tripId เปลี่ยน
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!tripId) return;

        const { data: sessionData } = await supabase.auth.getSession();
        setCurrentUserId(sessionData?.session?.user?.id ?? null);

        // ดึงข้อมูลทริปจากตาราง trip
        const { data: tripRows } = await supabase
          .from('trip')
          .select('*')
          .eq('trip_id', tripId)
          .limit(1);
        setTrip(tripRows?.[0] || null);

        // โหลดบิลของทริปจากตาราง bill (เฉพาะข้อมูลพื้นฐาน)
        const { data: billRows } = await supabase
          .from('bill')
          .select('bill_id, trip_id, total_amount, paid_by_user_id, created_at, note')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: false });

        const billsBasic: BillItem[] = (billRows || []).map((b: any) => ({
          bill_id: String(b.bill_id),
          trip_id: String(b.trip_id),
          total_amount: Number(b.total_amount || 0),
          payer_user_id: b.paid_by_user_id,
          created_at: b.created_at,
          note: b.note,
        }));

        const billIds = billsBasic.map((b) => b.bill_id);
        if (billIds.length === 0) {
          setBills([]);
          return;
        }

        // โหลดข้อมูลส่วนแบ่งของแต่ละบิลจากตาราง bill_share
        const { data: shareRows } = await supabase
          .from('bill_share')
          .select('bill_id, user_id, amount_share, amount_paid, status, is_confirmed')
          .in('bill_id', billIds) as { data: Array<{
            bill_id: string;
            user_id: string;
            amount_share: number;
            amount_paid?: number;
            status?: 'paid' | 'unpaid';
            is_confirmed?: boolean;
          }> | null };

        const userIds = Array.from(new Set([
          ...(shareRows || []).map((s: any) => String(s.user_id)),
          ...billsBasic.map((b) => String(b.payer_user_id || '')),
        ].filter(Boolean)));
        let userMap = new Map<string, { full_name: string | null; profile_image_url: string | null }>();
        if (userIds.length > 0) {
          // ดึงข้อมูลผู้ใช้ที่เกี่ยวข้องทั้งหมด เพื่อมาแมปชื่อและรูปโปรไฟล์
          const { data: users } = await supabase
            .from('user')
            .select('user_id, full_name, profile_image_url')
            .in('user_id', userIds);
          userMap = new Map((users || []).map((u: any) => [String(u.user_id), { full_name: u.full_name ?? null, profile_image_url: u.profile_image_url ?? null }]));
        }

        const withShares = billsBasic.map((b) => {
          const shares = (shareRows || [])
            .filter((s) => String(s.bill_id) === b.bill_id)
            .map((s) => {
              // คำนวณสถานะจากจำนวนที่จ่ายจริงก่อน (amount_paid) เพื่อความถูกต้องเสมอ
              let status: 'paid' | 'unpaid' = 'unpaid';
              if (typeof s.amount_paid === 'number') {
                status = s.amount_paid >= s.amount_share ? 'paid' : 'unpaid';
              } else if (s.status) {
                status = s.status;
              }
              
              return {
                user_id: String(s.user_id),
                amount_share: Number(s.amount_share || 0),
                status,
                full_name: userMap.get(String(s.user_id))?.full_name ?? null,
                profile_image_url: userMap.get(String(s.user_id))?.profile_image_url ?? null,
                is_owner: String(s.user_id) === String(b.payer_user_id)
              } as BillShare; // ส่งกลับเป็นชนิด BillShare
            });
            
          return {
            ...b,
            shares,
            payer_full_name: b.payer_user_id ? (userMap.get(String(b.payer_user_id))?.full_name ?? null) : null,
            payer_profile_image_url: b.payer_user_id ? (userMap.get(String(b.payer_user_id))?.profile_image_url ?? null) : null,
          } as BillItem;
        });

        // เซ็ตบิลทั้งหมดที่ประกอบด้วยข้อมูลส่วนแบ่งและข้อมูลผู้จ่าย
        setBills(withShares);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tripId]);

  // คำนวณยอดรวมทั้งหมดของบิลในทริป (คำนวณใหม่เมื่อรายการบิลเปลี่ยน)
  const totalAmount = useMemo(() => bills.reduce((sum, b) => sum + (b.total_amount || 0), 0), [bills]);

  // ฟังก์ชันลบบิล
  const deleteBill = async (billId: string) => {
    try {
      // ลบ bill_share ก่อน
      await supabase
        .from('bill_share')
        .delete()
        .eq('bill_id', billId);

      // ลบ bill
      const { error } = await supabase
        .from('bill')
        .delete()
        .eq('bill_id', billId);

      if (error) throw error;

      // อัปเดต state
      setBills(prev => prev.filter(bill => bill.bill_id !== billId));
      setSelectedBill(null);
      setShowDeleteConfirm(false);
      
      Alert.alert('สำเร็จ', 'ลบบิลเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error deleting bill:', error);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบบิลได้');
    }
  };

  // ฟังก์ชันแสดง confirmation dialog สำหรับการลบ
  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };

  // ฟังก์ชันไปหน้าแก้ไขบิล
  const editBill = () => {
    if (selectedBill) {
      setSelectedBill(null);
      router.push({
        pathname: '/AddBill',
        params: {
          tripId: tripId,
          billId: selectedBill.bill_id,
          editMode: 'true'
        }
      });
    }
  };

  return (
    
    <View style={styles.container}>
      {/* ส่วนหัวของหน้า */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('trip.header')}</Text>
      </View>

      {/* สรุปข้อมูลทริป */}
      <View style={{ paddingHorizontal: 4 }}>
        <Text style={styles.tripName}>{trip?.trip_name || t('trip.trip_fallback')}</Text>
        <Text style={styles.totalText}>{t('trip.total')} {totalAmount.toLocaleString()} {currencySymbol}</Text>
      </View>

      {/* รายการบิลทั้งหมด */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {bills.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={{ color: '#666' }}>{t('trip.empty')}</Text>
          </View>
        )}

        {bills.map((bill) => {
              const debtors = (bill.shares || []).filter((s) => s.user_id !== bill.payer_user_id);
              const isPayer = currentUserId && bill.payer_user_id === currentUserId;
              const myShare = (bill.shares || []).find((s) => String(s.user_id) === String(currentUserId));
              return (
                <View key={bill.bill_id} style={[styles.bubbleRow, isPayer ? styles.alignRight : styles.alignLeft]}>
                  {!isPayer && (
                    bill.payer_profile_image_url ? (
                      <Image source={{ uri: bill.payer_profile_image_url }} style={styles.senderAvatar} />
                    ) : (
                      <Ionicons name="person-circle" size={26} color="#4C6EF5" style={{ marginRight: 8 }} />
                    )
                  )}
                  <View style={[styles.billCard, styles.bubbleCard]}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.amount}>{bill.total_amount.toLocaleString()} {currencySymbol}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {bill.payer_profile_image_url ? (
                          <Image source={{ uri: bill.payer_profile_image_url }} style={{ width: 20, height: 20, borderRadius: 10 }} />
                        ) : (
                          <Ionicons name="person-circle" size={20} color="#4C6EF5" />
                        )}
                        <Text style={{ marginLeft: 6, color: '#4C6EF5', fontWeight: '600' }}>{bill.payer_full_name || t('trip.payer')}</Text>
                      </View>
                    </View>
                    
                    {/* แสดงโน๊ต */}
                    {bill.note && (
                      <Text style={styles.noteText}>{t('trip.note_label')} {bill.note}</Text>
                    )}

                    <View style={styles.shareList}>
                      {debtors.map((s, idx) => (
                        <View key={s.user_id + idx} style={styles.shareRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {s.profile_image_url ? (
                              <Image source={{ uri: s.profile_image_url }} style={{ width: 20, height: 20, borderRadius: 10 }} />
                            ) : (
                              <Ionicons name="person" size={14} color="#95A5A6" />
                            )}
                            <Text style={styles.shareName}>{s.full_name || t('trip.user')}</Text>
                          </View>
                          <Text style={styles.shareAmount}>{s.amount_share.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity 
                      style={styles.payButton}
                      onPress={() => {
                        if (isPayer) {
                          setSelectedBill(bill);
                        } else {
                          router.push({
                            pathname: '/Payment',
                            params: {
                              billId: String(bill.bill_id),
                              creditorId: String(bill.payer_user_id || ''),
                              amount: String(myShare?.amount_share ?? 0),
                            },
                          });
                        }
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{isPayer ? t('trip.who_paid_button') : t('trip.pay')}</Text>
                    </TouchableOpacity>

                  </View>
                  {isPayer && (
                    bill.payer_profile_image_url ? (
                      <Image source={{ uri: bill.payer_profile_image_url }} style={[styles.senderAvatar, { marginLeft: 8, marginRight: 0 }]} />
                    ) : (
                      <Ionicons name="person-circle" size={26} color="#4C6EF5" style={{ marginLeft: 8 }} />
                    )
                  )}
                </View>
          );
        })}
      </ScrollView>

      {/* ปุ่มการทำงานด้านล่าง (ตัวอย่าง) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.push(`/Debttrip?tripId=${tripId}`)}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bag" size={26} color="#fff" />
            <Text style={styles.bagText}>{t('trip.debt_button')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.circleBtn} onPress={() => router.push(`/AddBill?tripId=${tripId}`)}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.circleBtn} onPress={() => router.push(`/ConfirmPayments?tripId=${tripId}`)}>
          <FontAwesome5 name="dollar-sign" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <Image source={require('../assets/images/bg.png')} style={styles.bgImage} resizeMode="contain" />
      <Image source={require('../assets/images/bg2.png')} style={styles.bg2Image} resizeMode="cover" />
      
      {/* โมดอลรายละเอียดการชำระเงิน */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!selectedBill}
        onRequestClose={() => setSelectedBill(null)}
      >
        <View style={styles.modalContainer}>
          {/* ส่วนหัวของโมดอล */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setSelectedBill(null)}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{t('trip.modal.title_who_paid')}</Text>
            <View style={{ width: 24 }} />
          </View>
          
          {/* หมวดหมู่/โน้ตของบิล: แสดงโน้ตของบิลแทนข้อความคงที่ */}
          <View style={styles.expenseCategory}>
            <Ionicons name="document-text" size={20} color="#000" />
            <Text style={styles.expenseCategoryText}>{selectedBill?.note || '-'}</Text>
          </View>
          
          {/* การ์ดยอดรวมทั้งหมด */}
          <View style={styles.amountCard}>
            <Text style={styles.totalAmountText}>
              {selectedBill?.total_amount?.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })} {currencySymbol}
            </Text>
            {selectedBill?.note ? (
              <Text style={styles.noteText}>{t('trip.note_label')} {selectedBill.note}</Text>
            ) : null}
          </View>
          
          {/* ส่วนที่ชำระแล้ว (Paid) */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{t('trip.section.paid')}</Text>
            <View style={styles.divider} />
            
            {/* ข้อมูลผู้ชำระเงิน (ผู้จ่ายบิล) */}
            {selectedBill?.payer_user_id && selectedBill?.shares?.some(s => s.user_id === selectedBill.payer_user_id) && (
              <View style={[styles.userRow, { marginBottom: 12 }]}>
                <View style={[styles.avatar, { backgroundColor: getRandomColor(selectedBill.payer_user_id) }]}>
                  <Text style={styles.avatarText}>
                    {selectedBill.payer_full_name?.charAt(0) || 'P'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.nameContainer}>
                    <Text style={styles.userName}>{selectedBill.payer_full_name || t('trip.payer')}</Text>
                    <FontAwesome5 name="crown" size={14} color="#F4C542" style={{ marginRight: 6 }} />
                    <Text style={styles.ownerInline}>{t('trip.owner')}</Text>
                  </View>
                  <Text style={[styles.amount, { color: '#1A3C6B' }]}>
                    {Number(selectedBill?.total_amount ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} {currencySymbol}
                  </Text>
                </View>
              </View>
            )}
            
            {/* ผู้ที่ชำระแล้วคนอื่น ๆ */}
            {selectedBill?.shares?.filter(share => share.status === 'paid' && share.user_id !== selectedBill?.payer_user_id).map((share, index) => (
            <View key={`paid-${index}`} style={styles.userRow}>
              <View style={[styles.avatar, { backgroundColor: getRandomColor(share.user_id) }]}>
                <Text style={styles.avatarText}>{share.full_name?.charAt(0) || 'U'}</Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.nameContainer}>
                  <Text style={styles.userName}>{share.full_name || t('trip.user')}</Text>
                  {share.is_owner && (
                    <View style={styles.ownerBadge}>
                      <Text style={styles.ownerText}>{t('trip.owner')}</Text>
                      <Text style={{ fontSize: 14 }}>👑</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.amount, { color: '#1A3C6B' }]}>
                  {Number(share.amount_share ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })} {currencySymbol}
                </Text>
              </View>
            </View>
          ))}
          </View>
          
          {/* ส่วนที่ยังไม่ชำระ (Unpaid) */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{t('trip.section.unpaid')}</Text>
            <View style={styles.divider} />
            
            {selectedBill?.shares?.filter(share => share.status === 'unpaid' && String(share.user_id) !== String(selectedBill?.payer_user_id || '') && !share.is_owner).map((share, index) => (
              <View key={`unpaid-${index}`} style={styles.userRow}>
                {share.profile_image_url ? (
                  <Image source={{ uri: share.profile_image_url }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: getRandomColor(share.user_id) }]}>
                    <Text style={styles.avatarText}>{share.full_name?.charAt(0) || 'U'}</Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: '#FF3B30' }]}>{share.full_name || t('trip.user')}</Text>
                  <Text style={[styles.amount, { color: '#FF3B30' }]}>
                    {Number(share.amount_share ?? 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} {currencySymbol}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          
          {/* ปุ่มคำสั่งด้านล่างของโมดอล */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={editBill}
            >
              <Ionicons name="pencil" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.editButtonText}>{t('trip.edit_bill')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={confirmDelete}
            >
              <Ionicons name="trash" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.deleteButtonText}>{t('trip.delete_bill')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.backButtonBottom}
              onPress={() => setSelectedBill(null)}
            >
              <Text style={styles.backButtonText}>{t('trip.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal ยืนยันการลบ */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContainer}>
            <View style={styles.confirmModalHeader}>
              <Ionicons name="warning" size={48} color="#FF3B30" />
              <Text style={styles.confirmModalTitle}>{t('trip.confirm_delete_title')}</Text>
              <Text style={styles.confirmModalMessage}>
                {t('trip.confirm_delete_message')}
              </Text>
            </View>
            
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity 
                style={styles.confirmCancelButton}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>{t('trip.confirm_delete_cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmDeleteButton}
                onPress={() => selectedBill && deleteBill(selectedBill.bill_id)}
              >
                <Text style={styles.confirmDeleteText}>{t('trip.confirm_delete_ok')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  tripName: { fontWeight: 'bold', color: '#1A3C6B', marginBottom: 4 },
  totalText: { color: '#2FBF71', fontWeight: 'bold' },
  billCard: {
    backgroundColor: '#f7f7fb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  centeredRow: { justifyContent: 'center' },
  alignRight: { justifyContent: 'flex-end' },
  alignLeft: { justifyContent: 'flex-start' },
  bubbleCard: { maxWidth: '92%', minWidth: '78%' },
  bubbleRight: { borderTopRightRadius: 6 },
  bubbleLeft: { borderTopLeftRadius: 6 },
  bubbleIndicator: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 6, marginBottom: 6 },
  tailRight: {
    position: 'absolute',
    right: -8,
    bottom: 12,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderLeftColor: 'transparent',
    borderTopWidth: 8,
    borderTopColor: '#f7f7fb',
  },
  senderAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8 },
  tailLeft: {
    position: 'absolute',
    left: -8,
    bottom: 12,
    width: 0,
    height: 0,
    borderRightWidth: 8,
    borderRightColor: 'transparent',
    borderTopWidth: 8,
    borderTopColor: '#f7f7fb',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  amount: { fontSize: 18, fontWeight: 'bold', color: 'red' },
  noteText: { color: '#888', fontSize: 14, marginBottom: 8 },
  payButton: { backgroundColor: '#1A3C6B', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 6 },
  shareList: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, marginTop: 4, marginBottom: 6 },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  shareName: { marginLeft: 6, color: '#34495E' },
  shareAmount: { color: '#2FBF71', fontWeight: '600' },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    height: 72,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 10,
  },
  circleBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A3C6B', alignItems: 'center', justifyContent: 'center' },
  bagText: { position: 'absolute', bottom: 8, color: '#fff', fontSize: 10, fontWeight: 'bold' },
  bgImage: { width: '111%', height: 235, position: 'absolute', bottom: -4, alignSelf: 'center', zIndex: -1 },
  bg2Image: { 
    width: '100%', 
    height: '100%', 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    zIndex: -2 
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  expenseCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expenseCategoryText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#000',
  },
  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  totalAmountText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2FBF71',
    marginBottom: 4,
  },
  // Note text style is already defined above
  // Removing duplicate style
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarText: {
    color: '#fff',
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
    marginRight: 8,
  },
  ownerInline: {
    fontSize: 14,
    color: '#9AA3AF',
    marginLeft: 2,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ownerText: {
    fontSize: 12,
    color: '#1A73E8',
    marginRight: 4,
  },
  // Amount text style is already defined above
  // Removing duplicate style
  actionButtons: {
    marginTop: 'auto',
    marginBottom: 24,
  },
  editButton: {
    backgroundColor: '#1A3C6B',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButtonBottom: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
  },
  confirmModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  confirmModalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmCancelButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  confirmCancelText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  confirmDeleteButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    flex: 1,
  },
  confirmDeleteText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
