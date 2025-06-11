// app/(root)/activities/chargeHistory.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useUser } from "@/contexts/UserContext";
import { fetchAPI } from "@/lib/fetch";
import { router } from "expo-router";

export default function ChargeHistory() {
  const { user } = useUser();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await fetchAPI(`/charge-history/${user.id}`);
        setHistory(data || []);
      } catch (error) {
        console.error("Error fetching charge history:", error);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => router.push(`/ChargeHistoryId/${item.id}`)}
    >
      <View style={{ padding: 15, borderBottomWidth: 1, borderColor: "#eee" }}>
        <Text>Session ID: {item.transaction_id}</Text>
        <Text>
          {new Date(item.start_time).toLocaleDateString()} •{" "}
          {new Date(item.start_time).toLocaleTimeString()}
        </Text>
        <Text>
          {item.energy_consumed.toFixed(2)} kWh • {item.total_cost.toFixed(2)} ₸
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <Text style={{ textAlign: "center", margin: 20 }}>
            No charge history found.
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#333" },
  infoSection: { marginBottom: 20 },
  subtitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#555",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: { color: "#777" },
  value: { fontWeight: "bold" },
  historyItem: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
  },
  historyTitle: { fontSize: 16, fontWeight: "500", marginBottom: 8 },
  historyDetails: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { color: "#757575" },
  detailValue: { fontWeight: "bold" },
  historyLocation: { marginTop: 8 },
  locationText: { color: "#555", fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#757575", fontSize: 16 },
});
