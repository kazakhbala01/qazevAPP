import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { fetchAPI } from "@/lib/fetch";
import { startCharging } from "@/lib/fetch";
import { useUser } from "@/contexts/UserContext";

export default function ReservationDetail() {
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const [reservation, setReservation] = useState<any>(null);
  const [newDate, setNewDate] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [loading, setLoading] = useState(true);
  const [canStartCharging, setCanStartCharging] = useState(false);
  const [charging, setCharging] = useState(false);
  const { user } = useUser();

  // Helper function to format date as dd/mm/yy
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, "0")}/${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${date.getFullYear().toString().slice(-2)}`;
  };

  // Helper function to format time as HH:MM
  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(":").slice(0, 2);
    return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  };

  // Helper function to calculate cost
  const calculateCost = async (
    connectorId: number,
    duration: number,
  ): Promise<number> => {
    try {
      const connector = await fetchAPI(`/connectors/${connectorId}`);

      if (connector && typeof connector.power === "number") {
        const power = connector.power; // kW
        const hours = duration / 60;
        const energyUsed = power * hours; // kWh
        const cost = energyUsed * 100;

        return Math.round(cost * 100) / 100;
      } else {
        console.warn("Invalid or missing connector data");
        return 0;
      }
    } catch (error) {
      console.error("Error calculating cost:", error);
      return 0;
    }
  };

  useEffect(() => {
    const loadReservation = async () => {
      setLoading(true);
      try {
        const response = await fetchAPI(`/reservations/${reservationId}`);
        if (response.success && response.data) {
          setReservation(response.data);
          setNewDate(response.data.arrival_time);
          setNewDuration(response.data.duration.toString());

          // Calculate cost when reservation is loaded
          const cost = await calculateCost(
            response.data.connector_id,
            response.data.duration,
          );
          setReservation((prev) => ({ ...prev, cost }));
        } else {
          Alert.alert("Error", "Reservation not found");
          router.back();
        }
      } catch (error) {
        console.error("Error loading reservation:", error);
        Alert.alert("Error", "Failed to load reservation details");
      } finally {
        setLoading(false);
      }
    };

    if (reservationId) {
      loadReservation();
    }
  }, [reservationId]);

  const deleteReservation = async () => {
    try {
      setLoading(true);
      await fetchAPI(`/reservations/${reservationId}`, {
        method: "DELETE",
      });
      Alert.alert("Success", "Reservation deleted successfully");
      router.back();
    } catch (error) {
      console.error("Error deleting reservation:", error);
      Alert.alert("Error", "Failed to delete reservation");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReservation = async () => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this reservation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: deleteReservation,
        },
      ],
    );
  };

  const handleStartCharging = async () => {
    if (!reservation) return;

    try {
      setCharging(true);

      const now = new Date();
      const reservationDate = new Date(
        `${reservation.reservation_date}T${reservation.arrival_time}`,
      );
      const diffMinutes = Math.abs(now - reservationDate) / (1000 * 60);

      if (diffMinutes > 5) {
        Alert.alert(
          "Too Late",
          "You can only start charging within 5 minutes of your reservation time.",
        );
        return;
      }

      const result = await startCharging(reservation.connector_id, user.id);

      if (result.success) {
        // Delete the reservation
        await deleteReservation();
        // Navigate to the charge page
        router.push("/(root)/(tabs)/charge");
      } else {
        throw new Error("Failed to start charging session");
      }
    } catch (error) {
      console.error("Error starting charging:", error);
      Alert.alert("Error", "Failed to start charging. Please try again.");
    } finally {
      setCharging(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!reservation) {
    return (
      <View style={styles.container}>
        <Text>No reservation found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reservation Details</Text>
      </View>

      <View style={styles.reservationCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>RESERVATION DETAIL</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>LOCATION</Text>
            <Text style={styles.cardValue}>{reservation.location_name}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>DATE</Text>
            <Text style={styles.cardValue}>{formatDate(new Date())}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>TIME / DURATION</Text>
            <Text style={styles.cardValue}>
              {formatTime(reservation.arrival_time)} - {reservation.duration}{" "}
              minutes
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>COST SUMMARY</Text>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Energy Usage</Text>
          <Text style={styles.summaryValue}>
            {reservation.cost / 100 || "N/A"} kW
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryValue}>
            {reservation.cost || "N/A"} tenge
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleStartCharging}
        >
          <Text style={styles.buttonText}>
            {charging ? "Starting..." : "Start Charging"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDeleteReservation}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Deleting..." : "Delete Reservation"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    fontSize: 24,
    fontWeight: "bold",
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  reservationCard: {
    backgroundColor: "#4c86af",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 15,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  cardContent: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
  },
  cardItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardLabel: {
    color: "#555",
    fontSize: 14,
  },
  cardValue: {
    color: "#333",
    fontSize: 14,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  sectionSubtitle: {
    color: "#777",
    marginBottom: 15,
  },
  summarySection: {
    marginBottom: 20,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  summaryLabel: {
    color: "#555",
  },
  summaryValue: {
    color: "#333",
    fontWeight: "bold",
  },
  buttonContainer: {
    marginTop: 20,
  },
  actionButton: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#e74c3c", // Red color for delete
    marginTop: 10,
  },
});
