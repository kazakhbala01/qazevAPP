// Charge.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { fetchAPI } from "@/lib/fetch";
import { useUser } from "@/contexts/UserContext";
const Charge = () => {
  const { connectorId, transactionId } = useLocalSearchParams<{
    connectorId: string;
    transactionId: string;
  }>();
  const parsedConnectorId = parseInt(connectorId);
  const [currentPage, setCurrentPage] = useState(0);
  const [soc, setSoc] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [energyConsumed, setEnergyConsumed] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [hasActiveSession, setHasActiveSession] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const scrollViewRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get("window").width;
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch real-time updates via WebSocket
  useEffect(() => {
    if (!transactionId) return;

    // Connect to WebSocket
    const ws = new WebSocket("ws://192.168.1.71:5000/");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to real-time updates");
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
      // Handle error (e.g., show error message to user)
    };

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);

      if (
        update.type === "meter_update" &&
        update.transactionId === transactionId
      ) {
        const newMeterValue = parseFloat(update.meterValue);
        setEnergyConsumed(newMeterValue);
        setSoc(Math.min(100, Math.floor((newMeterValue / 100) * 100))); // Convert kWh to SOC
        setCost(newMeterValue * 100); // Assuming 100〒/kWh// Log received meter value
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [transactionId]);

  const loadChargingData = async () => {
    if (!user) {
      router.back();
      return;
    }
    try {
      setLoading(true);
      // Fetch initial session data from the API
      const session = await fetchAPI(`/active-session/${parsedConnectorId}`);
      if (session) {
        setSoc(session.soc || 0);
        setEnergyConsumed(session.energy_consumed || 0);
        setCost(session.total_cost || 0);
        setHasActiveSession(true);
      } else {
        setHasActiveSession(false);
      }

      // Fetch user reservations
      const userReservations = await fetchAPI(
        `/user-reservations?userId=${user.id}`,
      );
      setReservations(userReservations);
    } catch (error) {
      console.error("Error loading data:", error);
      setHasActiveSession(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChargingData();
  }, [parsedConnectorId, user]);

  // Update calculations from WebSocket (no need for interval)
  const formatTime = (minutes) => {
    return `${minutes} mins`;
  };

  const handleTabChange = (index) => {
    setCurrentPage(index);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: index * screenWidth });
    }
  };

  const renderActiveCharging = () => {
    if (loading && !refreshing) return <Text>Loading...</Text>;
    if (!hasActiveSession) {
      return (
        <View style={styles.page}>
          <Text style={styles.title}>Charging</Text>
          <Text style={styles.noActiveSession}>No active charging session</Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadChargingData}
          />
        }
      >
        <Text style={styles.title}>Charging</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressCircleContainer}>
            <View style={styles.progressCircle}>
              <Text style={styles.percentageText}>{soc.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Elapsed Time:</Text>
            <Text style={styles.infoValue}>{formatTime(elapsedTime / 60)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time Remaining:</Text>
            <Text style={styles.infoValue}>{formatTime(timeRemaining)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Energy Consumed:</Text>
            <Text style={styles.infoValue}>
              {energyConsumed.toFixed(2)} kWh
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cost:</Text>
            <Text style={styles.infoValue}>{cost.toFixed(2)} 〒</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStopCharging}
        >
          <Text style={styles.buttonText}>STOP CHARGING</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };
  const renderReservations = () => {
    const sortedReservations = [...reservations].sort((a, b) => {
      const dateA = new Date(a.arrival_time).getTime();
      const dateB = new Date(b.arrival_time).getTime();
      return dateA - dateB;
    });

    return (
      <ScrollView
        style={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadChargingData}
          />
        }
      >
        <Text style={styles.title}>Your Reservations</Text>
        {sortedReservations.length > 0 ? (
          sortedReservations.map((reservation, index) => (
            <TouchableOpacity
              key={reservation.id}
              style={styles.reservationItem}
              onPress={() =>
                router.push(`/reservation/details/${reservation.id}`)
              }
            >
              <Text style={styles.reservationNumber}>{index + 1}.</Text>
              <View style={styles.reservationDetails}>
                <Text style={styles.reservationConnector}>
                  Connector: {reservation.connector_id}
                </Text>
                <Text style={styles.reservationTime}>
                  Arrival Time:{" "}
                  {new Date(reservation.arrival_time).toLocaleString()}
                </Text>
                <Text style={styles.reservationDuration}>
                  Duration: {reservation.duration} minutes
                </Text>
                <Text style={styles.reservationStation}>
                  Station: {reservation.station_name}
                </Text>
                <Text style={styles.reservationLocation}>
                  Location: {reservation.location_name}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noReservationsText}>No reservations found</Text>
        )}
      </ScrollView>
    );
  };

  const handleStopCharging = async () => {
    try {
      if (!transactionId) {
        Alert.alert("Error", "No active transaction");
        return;
      }

      // Call the backend to stop the charging session
      await fetchAPI(`/stop-charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectorId: parsedConnectorId,
          transactionId: transactionId,
        }),
      });

      // Update the UI to reflect that the session has ended
      setHasActiveSession(false);
      Alert.alert("Charging Stopped", "Charging session has been stopped.");

      // Navigate back or to another screen
      router.back();
    } catch (error) {
      console.error("Error stopping charging:", error);
      Alert.alert("Error", "Failed to stop charging");
    }
  };

  const handleScroll = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    const newPage = Math.round(x / screenWidth);
    if (newPage !== currentPage) setCurrentPage(newPage);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, currentPage === 0 && styles.activeTab]}
          onPress={() => handleTabChange(0)}
        >
          <Text
            style={[styles.tabText, currentPage === 0 && styles.activeTabText]}
          >
            Active Charge
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, currentPage === 1 && styles.activeTab]}
          onPress={() => handleTabChange(1)}
        >
          <Text
            style={[styles.tabText, currentPage === 1 && styles.activeTabText]}
          >
            Reservations
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.slide}>{renderActiveCharging()}</View>
        <View style={styles.slide}>{renderReservations()}</View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
    paddingVertical: 5,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#757575",
  },
  activeTabText: { color: "#2563eb" },
  page: {
    padding: 20,
    backgroundColor: "#fff",
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
  },
  noActiveSession: {
    fontSize: 18,
    color: "#757575",
    textAlign: "center",
    marginTop: 20,
  },
  progressContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  progressCircleContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#e6f0ff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  progressCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#e6f0ff",
    borderColor: "#4C86AF",
    borderWidth: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  percentageText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
  },
  infoContainer: { marginTop: 40 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  infoLabel: { fontSize: 16, color: "#666" },
  infoValue: { fontSize: 16, fontWeight: "bold", color: "#333" },
  stopButton: {
    backgroundColor: "#e74c3c",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 30,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  scrollView: { flex: 1 },
  contentContainer: { flexGrow: 1 },
  slide: { width: Dimensions.get("window").width },
  reservationItem: {
    padding: 15,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 2,
  },
  reservationNumber: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  reservationDetails: {
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  reservationConnector: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 5,
  },
  reservationTime: {
    fontSize: 15,
    color: "#555",
    marginBottom: 5,
  },
  reservationDuration: {
    fontSize: 15,
    color: "#555",
    marginBottom: 5,
  },
  reservationStation: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 5,
    marginBottom: 2,
  },
  reservationLocation: { fontSize: 15, color: "#555" },
  noReservationsText: {
    color: "#757575",
    textAlign: "center",
    padding: 15,
    fontSize: 16,
  },
});

export default Charge;
