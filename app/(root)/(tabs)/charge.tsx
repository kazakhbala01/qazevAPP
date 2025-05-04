import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { fetchAPI } from "@/lib/fetch";
import { useUser } from "@/contexts/UserContext";

const Charge = () => {
  const { connectorId } = useLocalSearchParams<{ connectorId: string }>();
  const parsedConnectorId = isNaN(parseInt(connectorId || ""))
    ? null
    : parseInt(connectorId || "");
  const [currentPage, setCurrentPage] = useState(0); // 0 for Active Charge, 1 for Reservations
  const [status, setStatus] = useState("No active charging session");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const scrollViewRef = useRef(null);
  const screenWidth = Dimensions.get("window").width;
  const [refreshing, setRefreshing] = useState(false);

  const loadChargingData = async () => {
    if (!user) {
      router.back();
      return;
    }

    try {
      setLoading(true);
      setRefreshing(true);

      // Check for active charging session
      try {
        const activeSessionResponse = await fetchAPI(
          `/active-charge/${user.id}`,
        );
        if (activeSessionResponse.success && activeSessionResponse.data) {
          setStatus("Charging in progress...");
          setTransactionId(activeSessionResponse.data.transaction_id);
        } else {
          setStatus("No active charging session");
        }
      } catch (chargeError) {
        setStatus("No active charging session");
      }

      // Load user reservations
      try {
        const userReservations = await fetchAPI(
          `/user-reservations?userId=${user.id}`,
        );
        setReservations(userReservations);
      } catch (reservationError) {
        setReservations([]);
      }
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadChargingData();
  }, [user]);

  const handleTabChange = (index) => {
    setCurrentPage(index);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * screenWidth,
        animated: true,
      });
    }
  };

  const onScroll = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    const newPage = Math.round(x / screenWidth);
    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  };

  const handleRefresh = () => {
    loadChargingData();
  };

  const renderActiveCharging = () => (
    <View style={styles.page}>
      <Text style={styles.title}>Charging Status</Text>
      <Text style={styles.status}>{status}</Text>
      {transactionId && (
        <Text style={styles.transactionInfo}>
          Transaction ID: {transactionId}
        </Text>
      )}
    </View>
  );

  const renderReservations = () => (
    <View style={styles.page}>
      <Text style={styles.title}>Your Reservations</Text>
      {reservations.length > 0 ? (
        reservations.map((reservation) => (
          <TouchableOpacity
            key={reservation.id}
            style={styles.reservationItem}
            onPress={() =>
              router.push(`/reservation/details/${reservation.id}`)
            }
          >
            <Text style={styles.reservationDay}>
              {new Date(reservation.arrival_time).getDate()}th
            </Text>
            <View style={styles.reservationDetails}>
              <Text style={styles.reservationConnector}>
                Connector: {reservation.connector_id}
              </Text>
              <Text style={styles.reservationTime}>
                Arrival Time: {reservation.arrival_time}
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
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

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
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.slide}>{renderActiveCharging()}</View>
        <View style={styles.slide}>{renderReservations()}</View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
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
  activeTabText: {
    color: "#2563eb",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  slide: {
    width: Dimensions.get("window").width,
  },
  page: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    marginBottom: 20,
  },
  transactionInfo: {
    fontSize: 16,
    marginBottom: 20,
  },
  reservationItem: {
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 5,
  },
  noReservationsText: {
    color: "#757575",
    textAlign: "center",
    padding: 15,
  },
});

export default Charge;
