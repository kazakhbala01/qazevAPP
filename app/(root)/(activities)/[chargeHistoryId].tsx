// app/(root)/activities/[chargeHistoryId].tsx
import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchAPI } from "@/lib/fetch";

const ChargeHistoryDetail = () => {
  const params = useLocalSearchParams();
  const historyId = params.chargeHistoryId as string;
  const [loading, setLoading] = useState(true);
  const [historyEntry, setHistoryEntry] = useState<any>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await fetchAPI(`/charge-history-detail/${historyId}`);
        setHistoryEntry(response);
      } catch (error) {
        console.error("Error fetching history detail:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [historyId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!historyEntry) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>History not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Charging Session Details</Text>
      </View>
      <View style={styles.infoSection}>
        <Text style={styles.subtitle}>Basic Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Transaction ID:</Text>
          <Text style={styles.value}>{historyEntry.transaction_id}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Start Time:</Text>
          <Text style={styles.value}>
            {new Date(historyEntry.start_time).toLocaleString()}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>End Time:</Text>
          <Text style={styles.value}>
            {historyEntry.end_time
              ? new Date(historyEntry.end_time).toLocaleString()
              : "Ongoing"}
          </Text>
        </View>
      </View>
      <View style={styles.infoSection}>
        <Text style={styles.subtitle}>Usage Metrics</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Energy Consumed:</Text>
          <Text style={styles.value}>
            {historyEntry.energy_consumed.toFixed(2)} kWh
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Total Cost:</Text>
          <Text style={styles.value}>
            {historyEntry.total_cost.toFixed(2)} ₸
          </Text>
        </View>
      </View>
      <View style={styles.infoSection}>
        <Text style={styles.subtitle}>Location</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Location:</Text>
          <Text style={styles.value}>{historyEntry.location_name}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default ChargeHistoryDetail;

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
