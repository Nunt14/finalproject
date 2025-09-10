import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../constants/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from './contexts/LanguageContext';

type Friend = {
  id: string;
  name: string;
  selected: boolean;
  extraAmount: string | null;
  expanded: boolean;
  profileImageUrl?: string | null;
};

// fallback mock (unused after Supabase fetch)
const friendsMock: Friend[] = [];

export default function AddBillScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [total, setTotal] = useState(0);
  const [friends, setFriends] = useState<Friend[]>(friendsMock);
  const [selectAll, setSelectAll] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("฿");
  const categories = useMemo(
    () => [
      { key: "stay", icon: "bed-outline" as const },
      { key: "food", icon: "fast-food-outline" as const },
      { key: "flight", icon: "airplane-outline" as const },
      { key: "transport", icon: "car-outline" as const },
      { key: "shopping", icon: "cart-outline" as const },
      { key: "entertainment", icon: "film-outline" as const },
      { key: "drinks", icon: "beer-outline" as const },
      { key: "health", icon: "medkit-outline" as const },
      { key: "gift", icon: "gift-outline" as const },
    ],
    []
  );
  const CATEGORY_NAMES: Record<string, string> = {
    stay: 'ที่พัก',
    food: 'อาหาร',
    flight: 'ตั๋วเครื่องบิน',
    transport: 'การเดินทาง',
    shopping: 'ช้อปปิ้ง',
    entertainment: 'บันเทิง',
    drinks: 'เครื่องดื่ม',
    health: 'สุขภาพ',
    gift: 'ของขวัญ',
  };
  const CATEGORY_IDS: Record<string, number> = {
    stay: 1,
    food: 2,
    flight: 3,
    transport: 4,
    shopping: 5,
    entertainment: 6,
    drinks: 7,
    health: 8,
    gift: 9,
  };

  const getOrCreateCategoryId = async (key: string, name: string): Promise<number | null> => {
    try {
      const id = CATEGORY_IDS[key];
      if (!id) return null;

      const { data: found, error: findErr } = await supabase
        .from('category')
        .select('category_id')
        .or(`category_id.eq.${id},category_name.eq.${name}`)
        .limit(1);
      if (!findErr && found && found.length > 0) {
        return Number((found[0] as any).category_id);
      }
      const { error: upsertErr } = await supabase
        .from('category')
        .upsert({ category_id: id, category_name: name, is_active: true }, { onConflict: 'category_id' });
      if (upsertErr) {
        console.warn('Category upsert failed:', upsertErr);
      }
      return id;
    } catch (e) {
      console.warn('Category ensure error:', e);
      return null;
    }
  };
  const [selectedCategory, setSelectedCategory] = useState("stay");
  const [basePerPerson, setBasePerPerson] = useState<number>(0);
  const [note, setNote] = useState("");
  const [totalLocked, setTotalLocked] = useState(false);
  const categoryScrollRef = useRef<ScrollView | null>(null);
  const [catScrollX, setCatScrollX] = useState(0);

  const avatarColors = ["#5DADE2", "#F39C12", "#F5B7B1", "#E74C3C"]; // blue, orange, pink, red

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

  // Fetch trip members from Supabase
  useEffect(() => {
    const fetchMembers = async () => {
      if (!tripId) return;
      setLoadingMembers(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        setCurrentUserId(sessionData?.session?.user?.id ?? null);
        const { data: memberRows, error: memberErr } = await supabase
          .from("trip_member")
          .select("user_id")
          .eq("trip_id", tripId)
          .eq("is_active", true);
        if (memberErr) throw memberErr;

        const userIds = (memberRows || []).map((m: any) => String(m.user_id));
        if (userIds.length === 0) {
          setFriends([]);
          return;
        }

        const { data: users, error: usersErr } = await supabase
          .from("user")
          .select("user_id, full_name, profile_image_url")
          .in("user_id", userIds);
        if (usersErr) throw usersErr;

        const loaded: Friend[] = (users || []).map((u: any) => ({
          id: String(u.user_id),
          name: u.full_name || `User ${u.user_id}`,
          selected: true,
          extraAmount: null,
          expanded: false,
          profileImageUrl: u.profile_image_url || null,
        }));
        
        // จัดเรียงให้เจ้าของบิลอยู่เป็นชื่อแรก
        const currentUserId = sessionData?.session?.user?.id;
        if (currentUserId) {
          loaded.sort((a, b) => {
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            return 0;
          });
        }
        setFriends(loaded);
        setSelectAll(true);
      } catch (e) {
        console.error("Load trip members error", e);
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchMembers();
  }, [tripId]);

  // ฟังก์ชันคำนวณใหม่: คำนวณตามลอจิกใหม่
  const splitAmount = () => {
    const selected = friends.filter((f) => f.selected);
    const count = selected.length;
    
    if (count === 0) {
      return friends.map((f) => ({
        ...f,
        baseAmount: "0.00",
        extraAmountView: "0.00",
        amount: "0.00",
      } as any));
    }

    // ถ้าไม่มี basePerPerson (ยังไม่ได้ใส่ Split per person) 
    if (!basePerPerson || basePerPerson === 0) {
      // คำนวณยอดรวมของคนที่ใส่ Extra
      const friendsWithExtras = selected.filter((f) => f.extraAmount && parseFloat(f.extraAmount) > 0);
      const friendsWithoutExtras = selected.filter((f) => !f.extraAmount || parseFloat(f.extraAmount) === 0);
      
      let totalExtras = 0;
      friendsWithExtras.forEach((f) => {
        totalExtras += parseFloat(f.extraAmount || "0");
      });
      
      // คำนวณยอดที่เหลือสำหรับคนที่ไม่ได้ใส่ Extra
      const remainingAmount = total - totalExtras;
      const remainingCount = friendsWithoutExtras.length;
      const remainingPerPerson = remainingCount > 0 ? remainingAmount / remainingCount : 0;
      
      return friends.map((f) => {
        if (!f.selected) {
          return {
            ...f,
            baseAmount: "0.00",
            extraAmountView: "0.00",
            amount: "0.00",
          } as any;
        }
        
        const extra = f.extraAmount ? parseFloat(f.extraAmount) : 0;
        
        if (extra > 0) {
          // คนที่ใส่ Extra ใช้ค่า Extra เป็นจำนวนสุดท้าย
          return {
            ...f,
            baseAmount: "0.00",
            extraAmountView: extra.toFixed(2),
            amount: extra.toFixed(2),
          } as any;
        } else {
          // คนที่ไม่ได้ใส่ Extra ได้ส่วนแบ่งจากยอดที่เหลือ
          return {
            ...f,
            baseAmount: remainingPerPerson.toFixed(2),
            extraAmountView: "0.00",
            amount: remainingPerPerson.toFixed(2),
          } as any;
        }
      });
    }

    // ถ้ามี basePerPerson (ใส่ Split per person แล้ว) ให้คำนวณตามลอจิกเดิม
    const friendsWithExtras = selected.filter((f) => f.extraAmount && parseFloat(f.extraAmount) > 0);
    const friendsWithoutExtras = selected.filter((f) => !f.extraAmount || parseFloat(f.extraAmount) === 0);
    
    // คำนวณยอดรวมของคนที่มี Extra
    let totalWithExtras = 0;
    friendsWithExtras.forEach((f) => {
      const extra = parseFloat(f.extraAmount || "0");
      totalWithExtras += basePerPerson + extra;
    });

    // คำนวณยอดที่เหลือสำหรับคนที่ไม่มี Extra
    const remainingAmount = total - totalWithExtras;
    const remainingCount = friendsWithoutExtras.length;
    const remainingPerPerson = remainingCount > 0 ? remainingAmount / remainingCount : 0;

    return friends.map((f) => {
      const extra = f.extraAmount ? parseFloat(f.extraAmount) : 0;
      let base = 0;
      
      if (f.selected) {
        if (extra > 0) {
          // คนที่มี Extra ใช้ basePerPerson
          base = basePerPerson;
        } else {
          // คนที่ไม่มี Extra ใช้ยอดที่เหลือ
          base = remainingPerPerson;
        }
      }
      
      const totalForFriend = f.selected ? base + extra : 0;
      return {
        ...f,
        baseAmount: base.toFixed(2),
        extraAmountView: extra.toFixed(2),
        amount: totalForFriend.toFixed(2),
      } as any;
    });
  };

  const handleToggleSelect = (id: string) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, selected: !f.selected } : f
      )
    );
  };

  const handleToggleExpand = (id: string) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, expanded: !f.expanded } : f
      )
    );
  };

  const handleCustomChange = (id: string, value: string) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, extraAmount: value } : f
      )
    );
  };

  const getSelectedCount = () => friends.filter((f) => f.selected).length;
  const getSumExtras = () => friends
    .filter((f) => f.selected)
    .reduce((sum, f) => sum + (f.extraAmount ? parseFloat(f.extraAmount) : 0), 0);

  const handleTotalChange = (text: string) => {
    const val = parseFloat(text);
    const nextTotal = isNaN(val) ? 0 : val;
    setTotal(nextTotal);
    
    // ล็อคค่า total เมื่อผู้ใช้ป้อนค่า
    if (nextTotal > 0) {
      setTotalLocked(true);
    }
    
    // เมื่อใส่ค่า How much ให้หารเท่าก่อนเป็นอันดับแรก และปล่อยให้ Split per person เป็นค่าว่าง
    const count = getSelectedCount();
    if (count > 0) {
      const equalSplit = nextTotal / count;
      // ไม่ต้องเซ็ต basePerPerson ให้เป็นค่าว่างก่อน
    }
  };

  const handleBaseChange = (text: string) => {
    const val = parseFloat(text);
    const next = isNaN(val) ? 0 : val;
    setBasePerPerson(next);
    
    // ไม่คำนวณ total ใหม่ เพราะ total ถูกกำหนดจาก How much แล้ว
  };

  // เมื่อรายชื่อ/การเลือกเพื่อน หรือค่า extras เปลี่ยน ไม่ต้องคำนวณ basePerPerson ใหม่
  // เพราะ basePerPerson จะถูกกำหนดจาก Split per person เท่านั้น
  useEffect(() => {
    // ไม่ต้องทำอะไร เพราะ basePerPerson จะถูกกำหนดจาก Split per person เท่านั้น
  }, [friends, total, totalLocked]);

  const calculatedFriends = splitAmount();

  const handleConfirm = async () => {
    if (!tripId) {
      Alert.alert("Error", "Missing tripId");
      return;
    }
    if (!total || total <= 0) {
      Alert.alert("Error", "Please enter total amount");
      return;
    }
    const selected = calculatedFriends.filter((f: any) => f.selected);
    if (selected.length === 0) {
      Alert.alert("Error", "Please select at least one member");
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.user) {
        throw new Error("Not authenticated");
      }
      const currentUserId = sessionData.session.user.id;

      // Resolve category_id from selected category (create if missing)
      const selectedCategoryName = CATEGORY_NAMES[selectedCategory] || selectedCategory;
      const categoryId = await getOrCreateCategoryId(selectedCategory, selectedCategoryName);

      // Insert bill
      const { data: billRows, error: billErr } = await supabase
        .from("bill")
        .insert({
          trip_id: tripId,
          category_id: categoryId,
          total_amount: Number(total.toFixed(2)),
          paid_by_user_id: currentUserId,
          is_settled: false,
          note: note.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (billErr) throw billErr;
      const billId = billRows?.bill_id;
      if (!billId) throw new Error("Cannot get bill_id");

      // Build shares
      const shares = selected.map((f: any) => ({
        bill_id: billId,
        user_id: f.id,
        amount_share: Number(parseFloat(f.amount || "0").toFixed(2)),
        amount_paid: 0,
        status: "unpaid",
        is_confirmed: false,
        updated_at: new Date().toISOString(),
      }));

      if (shares.length > 0) {
        const { error: shareErr } = await supabase.from("bill_share").insert(shares);
        if (shareErr) throw shareErr;
      }

      // Notify only users included in this bill (except payer)
      try {
        const recipients = shares
          .map((s) => String(s.user_id))
          .filter((uid) => uid !== currentUserId);
        if (recipients.length > 0) {
          const notifications = recipients.map((uid) => ({
            user_id: uid,
            title: "บิลใหม่ในทริป",
            message: `มีบิลใหม่จำนวน ${Number(total).toLocaleString()} ${currencySymbol}`,
            trip_id: String(tripId),
            is_read: false,
          }));
          await supabase.from("notification").insert(notifications);
        }
      } catch (notifyErr) {
        console.warn("Notify users failed", notifyErr);
      }

      Alert.alert("สำเร็จ", "บันทึกบิลเรียบร้อย");
      // กลับไปหน้า Trip พร้อมรีโหลด
      try {
        // @ts-ignore
        router.replace(`/Trip?tripId=${tripId}`);
      } catch {}
    } catch (e: any) {
      console.error("Save bill error", e);
      Alert.alert("Error", e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.header}>{t('addbill.header')}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t('addbill.how_much')}</Text>
        <View style={styles.card}>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              keyboardType="numeric"
              placeholder={t('addbill.placeholder_amount')}
              value={total ? total.toString() : ""}
              onChangeText={handleTotalChange}
            />
            <Text style={styles.currency}>{currencySymbol}</Text>
          </View>
          <View style={styles.noteContainer}>
            <Text style={styles.noteLabel}>{t('addbill.note_label')}</Text>
            <TextInput
              style={styles.noteInput}
              placeholder={t('addbill.note_placeholder')}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.splitRow}>
          <Text style={styles.splitText}>{t('addbill.split_per_person')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={styles.splitAmountInput}
              keyboardType="numeric"
              placeholder={t('addbill.placeholder_amount')}
              value={basePerPerson ? basePerPerson.toString() : ""}
              onChangeText={handleBaseChange}
            />
            <Text style={{ marginLeft: 6, color: '#2ecc71', fontSize: 20, fontWeight: 'bold' }}>{currencySymbol}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>{t('addbill.who_divide')}</Text>
        <FlatList
          data={calculatedFriends}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <View>
              <View
                style={[
                  styles.friendRow,
                  { opacity: item.selected ? 1 : 0.4 },
                ]}
              >
                <TouchableOpacity onPress={() => handleToggleSelect(item.id)}>
                  <View style={[styles.avatar, { backgroundColor: item.selected ? avatarColors[index % avatarColors.length] : "#eee" }]}>
                    {item.profileImageUrl ? (
                      <Image source={{ uri: item.profileImageUrl }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person" size={18} color={item.selected ? "#fff" : "#aaa"} />
                    )}
                    {currentUserId && item.id === currentUserId && (
                      <View style={styles.crown}>
                        <Ionicons name="star" size={12} color="#f1c40f" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <Text style={styles.friendName}>{item.name}</Text>

                <View style={styles.amountPill}>
                  <Text style={styles.amountText}>{item.amount} {currencySymbol}</Text>
                  <TouchableOpacity onPress={() => handleToggleExpand(item.id)}>
                    <Ionicons
                      name={item.expanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#7f8c8d"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {item.expanded && item.selected && (
                <View style={styles.dropdown}>
                  <View style={styles.breakdownRow}>
                    <Ionicons name="people" size={16} color="#888" style={{ marginRight: 8 }} />
                    <Text style={{ flex: 1, color: '#666', fontSize: 16 }}>{t('addbill.per_person')}</Text>
                    <Text style={[styles.green, { fontSize: 16 }]}>{basePerPerson.toFixed(2)} {currencySymbol}</Text>
                  </View>
                  <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: '#eee', marginTop: 6, paddingTop: 6 }]}>
                    <Ionicons name="person" size={16} color="#888" style={{ marginRight: 8 }} />
                    <Text style={{ flex: 1, color: '#666', fontSize: 16 }}>{t('addbill.extra')}</Text>
                    <TextInput
                      style={[styles.customInput, { minWidth: 90, textAlign: 'right' }]}
                      placeholder={t('addbill.placeholder_amount')}
                      keyboardType="numeric"
                      value={item.extraAmount ?? ''}
                      onChangeText={(val) => handleCustomChange(item.id, val)}
                    />
                    <Text style={{ marginLeft: 6, color: '#2ecc71', fontSize: 16 }}>{currencySymbol}</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        />

        <View style={styles.everyoneRow}>
          <TouchableOpacity
            style={[styles.checkbox, selectAll && styles.checkboxChecked]}
            onPress={() => {
              const next = !selectAll;
              setSelectAll(next);
              setFriends((prev) => prev.map((f) => ({ ...f, selected: next })));
            }}
          >
            {selectAll && <Ionicons name="checkmark" size={14} color="#fff" />}
          </TouchableOpacity>
          <Text style={styles.everyoneText}>{t('addbill.everyone')}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>{t('addbill.category')}</Text>
        <View style={styles.categoryBar}>
          <TouchableOpacity onPress={() => categoryScrollRef.current?.scrollTo({ x: Math.max(0, catScrollX - 150), animated: true })}>
            <Ionicons name="chevron-back" size={18} color="#7f8c8d" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            ref={categoryScrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.categoryRow}
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setCatScrollX(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
         >
            {categories.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.categoryIcon,
                  selectedCategory === c.key && styles.categoryIconActive,
                ]}
                onPress={() => setSelectedCategory(c.key)}
              >
                <Ionicons
                  name={c.icon}
                  size={22}
                  color={selectedCategory === c.key ? "#2e86de" : "#7f8c8d"}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => categoryScrollRef.current?.scrollTo({ x: catScrollX + 150, animated: true })}>
            <Ionicons name="chevron-forward" size={18} color="#7f8c8d" />
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={saving}>
            <Text style={styles.confirmText}>{saving ? t('addbill.saving') : t('addbill.confirm')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>{t('addbill.back')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      <Image source={require("../assets/images/bg.png")} style={styles.bgImage} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 50 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingTop: 8, paddingBottom: 120 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  header: { fontSize: 18, fontWeight: "600", color: "#222" },
  sectionTitle: { fontSize: 16, color: "#333", marginBottom: 8, fontWeight: "600" },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  amountInput: { 
    fontSize: 32, 
    color: "#2ecc71", 
    fontWeight: "bold",
    textAlign: "center",
    minWidth: 150,
  },
  splitAmountInput: { 
    fontSize: 20, 
    color: "#2ecc71", 
    fontWeight: "bold",
    textAlign: "right",
    minWidth: 50,
  },
  currency: { fontSize: 20, fontWeight: "bold", color: "#2ecc71" },
  noteContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  noteLabel: { fontSize: 16, color: "#666", marginBottom: 4, fontWeight: "500" },
  noteInput: {
    fontSize: 16,
    color: "#333",
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
    minHeight: 50,
    textAlignVertical: "top",
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  splitText: { fontSize: 16, color: "#333", fontWeight: "500" },
  green: { color: "#2ecc71", fontWeight: "600" },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: "#eee",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    position: "relative",
  },
  avatarImage: { width: 32, height: 32, borderRadius: 16 },
  crown: {
    position: "absolute",
    top: -6,
    left: -6,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 1,
  },
  friendName: { flex: 1, fontSize: 16, marginLeft: 8, fontWeight: "500" },
  amountPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e6edf5",
  },
  amountText: { fontSize: 16, color: "#2ecc71", fontWeight: "600" },
  dropdown: { paddingLeft: 50, paddingVertical: 6 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  customInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
  },
  everyoneRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#2e86de",
    borderColor: "#2e86de",
  },
  everyoneText: { color: "#333", fontSize: 16, fontWeight: "500" },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 8,
  },
  categoryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e1e4e8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  categoryIconActive: {
    backgroundColor: "#e8f1ff",
    borderColor: "#cfe3ff",
  },
  buttonContainer: {
    marginTop: 20,
    gap: 10,
  },
  confirmBtn: {
    backgroundColor: "#1A3C6B",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontSize: 16 },
  backBtn: {
    backgroundColor: "#555",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  backText: { color: "#fff", fontSize: 16 },
  bgImage: { width: "111%", height: 235, position: "absolute", bottom: -4, alignSelf: "center", zIndex: -1 },
});
