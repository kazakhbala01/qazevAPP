import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from "react-native";
import { fetchAPI } from "@/lib/fetch";

const ReservationDetail = () => {
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const [reservation, setReservation] = useState<any>(null);
  const [newDate, setNewDate] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReservation = async () => {
      setLoading(true);
      try {
        const response = await fetchAPI(`/reservations/${reservationId}`);
        if (response.success && response.data) {
          setReservation(response.data);
          setNewDate(response.data.arrival_time);
          setNewDuration(response.data.duration.toString());
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

  const handleDeleteReservation = async () => {
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

  const handleUpdateReservation = async () => {
    try {
      setLoading(true);
      await fetchAPI(`/reservations/${reservationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrival_time: newDate,
          duration: parseInt(newDuration),
        }),
      });
      Alert.alert("Success", "Reservation updated successfully");
      router.back();
    } catch (error) {
      console.error("Error updating reservation:", error);
      Alert.alert("Error", "Failed to update reservation");
    } finally {
      setLoading(false);
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

      <View style={styles.detailContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Connector:</Text>
          <Text style={styles.detailValue}>{reservation.connector_id}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Current Arrival Time:</Text>
          <Text style={styles.detailValue}>{reservation.arrival_time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Current Duration:</Text>
          <Text style={styles.detailValue}>{reservation.duration} minutes</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Station:</Text>
          <Text style={styles.detailValue}>{reservation.station_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Location:</Text>
          <Text style={styles.detailValue}>{reservation.location_name}</Text>
        </View>
      </View>

      <View style={styles.editContainer}>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>New Arrival Time:</Text>
          <TextInput
            style={styles.input}
            value={newDate}
            onChangeText={setNewDate}
            placeholder="YYYY-MM-DDTHH:MM:SS"
          />
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>New Duration (minutes):</Text>
          <TextInput
            style={styles.input}
            value={newDuration}
            onChangeText={setNewDuration}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdateReservation}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Update Reservation</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteReservation}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Delete Reservation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
  detailContainer: {
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: "bold",
    width: "40%",
  },
  detailValue: {
    fontSize: 16,
    color: "#333",
    width: "60%",
  },
  editContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  inputRow: {
    flexDirection: "row",
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "bold",
    width: "40%",
    paddingTop: 5,
  },
  input: {
    width: "60%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  updateButton: {
    backgroundColor: "#2196f3",
    padding: 12,
    borderRadius: 8,
    width: "48%",
  },
  deleteButton: {
    backgroundColor: "#ff4d4d",
    padding: 12,
    borderRadius: 8,
    width: "48%",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
});

export default ReservationDetail;
