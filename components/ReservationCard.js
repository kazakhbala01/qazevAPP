import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ReservationCard = ({ reservation, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.dateContainer}>
        <Text style={styles.monthText}>
          {new Date(reservation.arrivalDateTime).toLocaleString("default", {
            month: "short",
          })}
        </Text>
        <Text style={styles.dayText}>
          {new Date(reservation.arrivalDateTime).getDate()}
        </Text>
      </View>
      <View style={styles.infoContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>{reservation.location_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#555" />
          <Text style={styles.detailText}>
            {reservation.formatted_arrival_time}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color="#555" />
          <Text style={styles.detailText}>{reservation.station_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="power-outline" size={16} color="#555" />
          <Text style={styles.detailText}>
            Connector {reservation.connector_id}, {reservation.connector_type}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 1,
    overflow: "hidden",
  },
  dateContainer: {
    width: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingVertical: 10,
  },
  monthText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  dayText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  infoContainer: {
    flex: 1,
    padding: 10,
  },
  titleContainer: {
    marginBottom: 10,
  },
  titleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#555",
    marginLeft: 8,
  },
});

export default ReservationCard;
