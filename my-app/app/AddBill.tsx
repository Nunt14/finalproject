import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../constants/supabase";

type Friend = {
  id: string;
  name: string;
  selected: boolean;
  customAmount: string | null;
  expanded: boolean;
  profileImageUrl?: string | null;
};

// fallback mock (unused after Supabase fetch)
const friendsMock: Friend[] = [];

export default function AddBillScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [total, setTotal] = useState(0);
  const [friends, setFriends] = useState<Friend[]>(friendsMock);
  const [selectAll, setSelectAll] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const categories = useMemo(
    () => [
      { key: "stay", icon: "bed-outline" as const },
      { key: "food", icon: "fast-food-outline" as const },
      { key: "car", icon: "car-outline" as const },
      { key: "more", icon: "ellipsis-horizontal" as const },
    ],
    []
  );
  const [selectedCategory, setSelectedCategory] = useState("stay");

  const avatarColors = ["#5DADE2", "#F39C12", "#F5B7B1", "#E74C3C"]; // blue, orange, pink, red

  // Fetch trip members from Supabase
  useEffect(() => {
    const fetchMembers = async () => {
      if (!tripId) return;
      setLoadingMembers(true);
      try {
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
          name: u.full_name || "Unnamed",
          selected: true,
          customAmount: null,
          expanded: false,
          profileImageUrl: u.profile_image_url || null,
        }));
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

  // ฟังก์ชันคำนวณ
  const splitAmount = () => {
    const selected = friends.filter((f) => f.selected);
    const customSum = selected.reduce(
      (sum, f) => sum + (f.customAmount ? parseFloat(f.customAmount) : 0),
      0
    );
    const remain = total - customSum;
    const noCustom = selected.filter((f) => !f.customAmount);

    const perPerson =
      noCustom.length > 0 ? remain / noCustom.length : 0;

    return friends.map((f) => ({
      ...f,
      amount: f.selected
        ? f.customAmount
          ? parseFloat(f.customAmount).toFixed(2)
          : perPerson.toFixed(2)
        : "0.00",
    }));
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
        f.id === id ? { ...f, customAmount: value } : f
      )
    );
  };

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

      // Insert bill
      const { data: billRows, error: billErr } = await supabase
        .from("bill")
        .insert({
          trip_id: tripId,
          category_id: null,
          total_amount: Number(total.toFixed(2)),
          paid_by_user_id: currentUserId,
          is_settled: false,
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
            message: `มีบิลใหม่จำนวน ${Number(total).toLocaleString()} ฿`,
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.header}>Add new Bill</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={styles.sectionTitle}>How much?</Text>
      <View style={styles.card}>
        <View style={styles.amountRow}>
          <TextInput
            style={styles.amountInput}
            keyboardType="numeric"
            placeholder="0.00"
            value={total ? total.toString() : ""}
            onChangeText={(text) => setTotal(parseFloat(text) || 0)}
          />
          <Text style={styles.currency}>฿</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.splitRow}>
        <Text style={styles.splitText}>Split per person :</Text>
        <Text style={styles.green}>
          {friends.filter((f) => f.selected).length > 0
            ? (
                total /
                friends.filter((f) => f.selected).length
              ).toFixed(2)
            : "0.00"}{" "}
          ฿
        </Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Who has to divide?</Text>
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
                  {index === 0 && (
                    <View style={styles.crown}>
                      <Ionicons name="star" size={12} color="#f1c40f" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <Text style={styles.friendName}>{item.name}</Text>

              <View style={styles.amountPill}>
                <Text style={styles.amountText}>{item.amount} ฿</Text>
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
                <TextInput
                  style={styles.customInput}
                  placeholder="Custom amount"
                  keyboardType="numeric"
                  value={item.customAmount ?? ""}
                  onChangeText={(val) => handleCustomChange(item.id, val)}
                />
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
        <Text style={styles.everyoneText}>everyone</Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>category</Text>
      <View style={styles.categoryBar}>
        <Ionicons name="chevron-back" size={18} color="#7f8c8d" />
        <View style={styles.categoryRow}>
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
        </View>
        <Ionicons name="chevron-forward" size={18} color="#7f8c8d" />
      </View>

      <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={saving}>
        <Text style={styles.confirmText}>{saving ? "Saving..." : "Confirm"}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      </ScrollView>
      <Image source={require("../assets/images/bg.png")} style={styles.bgImage} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  header: { fontSize: 18, fontWeight: "600", color: "#222" },
  sectionTitle: { fontSize: 14, color: "#333", marginBottom: 8 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
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
    width: "100%",
  },
  amountInput: { flex: 1, fontSize: 22, color: "#2ecc71" },
  currency: { fontSize: 20, fontWeight: "bold", color: "#2ecc71" },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  splitText: { fontSize: 14, color: "#333" },
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
  friendName: { flex: 1, fontSize: 16, marginLeft: 8 },
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
  amountText: { fontSize: 14, color: "#2ecc71", fontWeight: "600" },
  dropdown: { paddingLeft: 50, paddingVertical: 6 },
  customInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
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
  everyoneText: { color: "#333" },
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
  confirmBtn: {
    marginTop: 20,
    backgroundColor: "#2e86de",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmText: { color: "#fff", fontSize: 16 },
  backBtn: {
    marginTop: 10,
    backgroundColor: "#555",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  backText: { color: "#fff", fontSize: 16 },
  bgImage: { width: "111%", height: 235, position: "absolute", bottom: -4, alignSelf: "center", zIndex: -1 },
});
