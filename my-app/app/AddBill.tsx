import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const friendsMock = [
  { id: 1, name: "A", selected: true, customAmount: null, expanded: false },
  { id: 2, name: "B", selected: true, customAmount: null, expanded: false },
  { id: 3, name: "C", selected: true, customAmount: null, expanded: false },
  { id: 4, name: "D", selected: true, customAmount: null, expanded: false },
];

export default function AddBillScreen() {
  const [total, setTotal] = useState(0);
  const [friends, setFriends] = useState(friendsMock);

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

  const handleToggleSelect = (id: number) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, selected: !f.selected } : f
      )
    );
  };

  const handleToggleExpand = (id: number) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, expanded: !f.expanded } : f
      )
    );
  };

  const handleCustomChange = (id: number, value: string) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, customAmount: value } : f
      )
    );
  };

  const calculatedFriends = splitAmount();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Add new Bill</Text>

      {/* Input จำนวนเงิน */}
      <View style={styles.card}>
        <TextInput
          style={styles.amountInput}
          keyboardType="numeric"
          placeholder="0.00"
          value={total ? total.toString() : ""}
          onChangeText={(text) => setTotal(parseFloat(text) || 0)}
        />
        <Text style={styles.currency}>฿</Text>
      </View>

      {/* Split per person */}
      <Text style={styles.splitText}>
        Split per person (avg):{" "}
        <Text style={styles.green}>
          {friends.filter((f) => f.selected).length > 0
            ? (
                total /
                friends.filter((f) => f.selected).length
              ).toFixed(2)
            : "0.00"}{" "}
          ฿
        </Text>
      </Text>

      {/* รายชื่อเพื่อน */}
      <FlatList
        data={calculatedFriends}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View>
            {/* row หลัก */}
            <TouchableOpacity
              style={[
                styles.friendRow,
                { opacity: item.selected ? 1 : 0.4 },
              ]}
              onPress={() => handleToggleSelect(item.id)}
            >
              <Ionicons
                name="person-circle"
                size={36}
                color={item.selected ? "#3498db" : "#ccc"}
              />
              <Text style={styles.friendName}>{item.name}</Text>
              <Text style={styles.amount}>{item.amount} ฿</Text>

              {/* ปุ่มขยาย */}
              <TouchableOpacity
                onPress={() => handleToggleExpand(item.id)}
              >
                <Ionicons
                  name={item.expanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#555"
                />
              </TouchableOpacity>
            </TouchableOpacity>

            {/* dropdown input */}
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

      {/* ปุ่ม */}
      <TouchableOpacity style={styles.confirmBtn}>
        <Text style={styles.confirmText}>Confirm</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  header: { fontSize: 20, fontWeight: "bold", marginBottom: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  amountInput: { flex: 1, fontSize: 22, color: "green" },
  currency: { fontSize: 20, fontWeight: "bold", color: "green" },
  splitText: { fontSize: 16, marginBottom: 10 },
  green: { color: "green", fontWeight: "bold" },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: "#eee",
  },
  friendName: { flex: 1, fontSize: 16, marginLeft: 8 },
  amount: { fontSize: 16, fontWeight: "bold", color: "green", marginRight: 8 },
  dropdown: { paddingLeft: 50, paddingVertical: 6 },
  customInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
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
});
