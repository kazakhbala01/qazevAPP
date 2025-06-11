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
import ReservationCard from "@/components/ReservationCard";

const Charge = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [soc, setSoc] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [energyConsumed, setEnergyConsumed] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [refreshingReservations, setRefreshingReservations] = useState(false);
  const { user } = useUser();
  const scrollViewRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get("window").width;
  const wsRef = useRef<WebSocket | null>(null);
  const [ignoreWebSocketUpdate, setIgnoreWebSocketUpdate] = useState(false);
  const InfoRow = ({ label, value }: { label: string; value: string }) => {
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}:</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  };

  useEffect(() => {
    if (!user?.id) return;

    const ws = new WebSocket("ws://192.168.1.71:5000/");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection established");
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
      // Optional: Alert the user about the WebSocket error
      // Alert.alert("Error", "WebSocket connection failed.");
    };

    ws.onmessage = (event) => {
      console.log("Received WebSocket message:", event.data);
      const update = JSON.parse(event.data);
      if (update.type === "meter_update") {
        console.log("Meter update received:", update);
        const meterValue = Number(update.meterValue) || 0;

        // Update energy consumed and cost from WebSocket
        setEnergyConsumed(meterValue);
        setCost(meterValue * 100); // Assuming 100〒/kWh

        // SOC should be calculated on the server side
        // setSoc(Math.min(100, Math.floor((meterValue / 100) * 100)));
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        console.log("WebSocket connection closed");
      }
    };
  }, [user?.id]);

  const loadActiveSession = async () => {
    if (!user?.id) return;

    try {
      setRefreshingSession(true);
      console.log("Loading active session for user:", user.id);

      const response = await fetchAPI(`/active-charge/${user.id}`, {
        timeout: 10000,
      });

      console.log("API Response:", response);

      if (response?.success && response.data) {
        console.log("Session data received:", response.data);

        // Ensure all values are numbers
        const soc = Number(response.data.soc) || 0;
        const energyConsumed = Number(response.data.energy_consumed) || 0;
        const cost = Number(response.data.total_cost) || 0;
        const elapsedTime = Number(response.data.elapsed_time) || 0;
        const timeRemaining = Number(response.data.time_remaining) || 0;

        setSoc(soc);
        setEnergyConsumed(energyConsumed);
        setCost(cost);
        setElapsedTime(elapsedTime);
        setTimeRemaining(timeRemaining);
        setHasActiveSession(true);
        console.log("Active session data set successfully");
      } else {
        console.error("No active session found or API request failed");
        setHasActiveSession(false);
      }
    } catch (error) {
      console.error("Error fetching active session:", error);
      setHasActiveSession(false);
    } finally {
      setLoadingSession(false);
      setRefreshingSession(false);
    }
  };

  const loadReservations = async () => {
    if (!user) {
      Alert.alert("Error", "User not logged in");
      router.back();
      return;
    }

    try {
      setRefreshingReservations(true);
      const userReservations = await fetchAPI(
        `/user-reservations?userId=${user.id}`,
        { timeout: 10000 },
      );

      const processedReservations = userReservations
        .map((reservation) => {
          if (!reservation.reservation_date || !reservation.arrival_time) {
            console.warn("Reservation missing date or time:", reservation);
            return null;
          }

          const reservationDate = new Date(reservation.reservation_date);
          const year = reservationDate.getUTCFullYear();
          const month = reservationDate.getUTCMonth();
          const day = reservationDate.getUTCDate();

          const arrivalDate = new Date(Date.UTC(year, month, day));
          const arrivalDateTime = new Date(
            `${arrivalDate.toISOString().split("T")[0]}T${reservation.arrival_time}`,
          );

          if (isNaN(arrivalDateTime.getTime())) {
            console.warn("Invalid date for reservation:", reservation);
            return null;
          }

          const formattedDay = arrivalDateTime.getDate();
          const formattedMonth = arrivalDateTime.toLocaleString("default", {
            month: "long",
          });
          const formattedArrivalDate = `${formattedDay} of ${formattedMonth}`;

          return {
            ...reservation,
            arrivalDateTime: arrivalDateTime,
            formatted_arrival_date: formattedArrivalDate,
            formatted_arrival_time: reservation.arrival_time,
          };
        })
        .filter((reservation) => reservation !== null);

      setReservations(processedReservations || []);
    } catch (error) {
      console.error("Error loading reservations:", error);
      Alert.alert("Error", `Failed to load reservations: ${error.message}`);
    } finally {
      setLoadingReservations(false);
      setRefreshingReservations(false);
    }
  };

  useEffect(() => {
    if (currentPage === 0) {
      loadActiveSession();
    } else {
      loadReservations();
    }
  }, [currentPage, user?.id]);

  const handleTabChange = (index: number) => {
    setCurrentPage(index);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * screenWidth,
        animated: true,
      });
    }
    if (index === 0) {
      loadActiveSession();
    } else {
      loadReservations();
    }
  };

  const renderActiveCharging = () => {
    if (loadingSession && !refreshingSession)
      return <Text style={styles.loadingText}>Loading...</Text>;

    if (!hasActiveSession)
      return (
        <View style={styles.centered}>
          <Text>No active charging session</Text>
        </View>
      );

    return (
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshingSession}
            onRefresh={loadActiveSession}
          />
        }
      >
        <View style={styles.progressContainer}>
          <View style={styles.progressCircle}>
            <Text style={styles.percentage}>{soc.toFixed(0)}%</Text>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <InfoRow label="Time Remaining" value={`${timeRemaining} mins`} />
          <InfoRow
            label="Energy Consumed"
            value={`${energyConsumed.toFixed(2)} kWh`}
          />
          <InfoRow label="Cost" value={`${cost.toFixed(2)} ₸`} />
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
    if (loadingReservations && !refreshingReservations) {
      return <Text style={styles.loadingText}>Loading...</Text>;
    }

    return (
      <ScrollView
        style={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshingReservations}
            onRefresh={loadReservations}
            colors={["#2563eb"]}
            tintColor="#2563eb"
          />
        }
      >
        <Text style={styles.title}>Your Reservations</Text>
        {reservations.length > 0 ? (
          reservations.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              onPress={() =>
                router.push(`/reservation/details/${reservation.id}`)
              }
            />
          ))
        ) : (
          <Text style={styles.noReservationsText}>No reservations found</Text>
        )}
      </ScrollView>
    );
  };

  // Charge.tsx
  const handleStopCharging = async () => {
    try {
      // Fetch the active session to get connectorId and transactionId
      const activeSession = await fetchAPI(`/active-charge/${user.id}`, {
        timeout: 10000,
      });

      if (activeSession?.success && activeSession.data) {
        const { connector_id, transaction_id } = activeSession.data;

        if (!connector_id || !transaction_id) {
          console.error(
            "Active session missing connector_id or transaction_id",
          );
          Alert.alert("Error", "Active session data is incomplete.");
          return;
        }

        // Stop the charging session
        await fetchAPI(`/stop-charge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            connectorId: connector_id,
            transactionId: transaction_id,
          }),
        });

        // Fetch the newly created history entry
        const historyResponse = await fetchAPI(`/charge-history/${user.id}`, {
          method: "GET",
        });

        if (Array.isArray(historyResponse) && historyResponse.length > 0) {
          const latestHistoryId = historyResponse[0].id;

          // Navigate to the detail screen
          router.push(
            `(root)/(activities)/charge-history-details/${latestHistoryId}`,
          );
        } else {
          Alert.alert("Success", "Charging stopped successfully.");
          router.back();
        }
      } else {
        console.error("No active session found");
        Alert.alert("Error", "No active charging session to stop.");
      }
    } catch (error) {
      console.error("Error stopping charging:", error);
      Alert.alert("Error", "Failed to stop charging.");
    }
  };

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    const newPage = Math.round(x / screenWidth);
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
      if (newPage === 0) {
        loadActiveSession();
      } else {
        loadReservations();
      }
    }
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
  loadingText: {
    fontSize: 18,
    color: "#757575",
    textAlign: "center",
    marginTop: 20,
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
  percentage: {
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
  bold: {
    fontWeight: "bold",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});

export default Charge;
