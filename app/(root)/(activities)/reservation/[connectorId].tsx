import React, { useState, useEffect, useCallback } from "react";
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  ActivityIndicator,
  TextInput,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import {
  fetchReservations,
  createReservation,
  fetchConnectorDetails,
} from "@/lib/fetch";
import { useUser } from "@/contexts/UserContext";

interface Reservation {
  id: number;
  connector_id: number;
  arrival_time: string; // HH:MM:SS
  duration: number;
  reservation_date: string; // YYYY-MM-DD
}

const ReservationScreen = () => {
  const { connectorId } = useLocalSearchParams<{ connectorId: string }>();
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedDuration, setSelectedDuration] = useState("30");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePickerOpacity] = useState(new Animated.Value(0));
  const [connectorDetails, setConnectorDetails] = useState<null | {
    stationNumber: string;
    connector_type: string;
    power: number;
    location_name: string;
  }>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { user } = useUser();
  const formattedTime = selectedTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  useEffect(() => {
    const loadConnectorDetails = async () => {
      try {
        const details = await fetchConnectorDetails(parseInt(connectorId));
        setConnectorDetails(details);
      } catch (error) {
        console.error("Error loading connector details:", error);
      }
    };
    loadConnectorDetails();
  }, [connectorId]);

  useEffect(() => {
    const loadReservations = async () => {
      try {
        const dateStr = selectedDate.toISOString().split("T")[0];
        const fetchedReservations = await fetchReservations(
          parseInt(connectorId),
          dateStr,
        );
        setReservations(fetchedReservations);
      } catch (error) {
        console.error("Error loading reservations:", error);
        setError("Failed to load reservations");
      }
    };
    if (connectorId) loadReservations();
  }, [selectedDate, connectorId]);

  const showTimePicker = useCallback(() => {
    Animated.timing(timePickerOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setIsTimePickerVisible(true);
  }, [timePickerOpacity]);

  const hideTimePicker = useCallback(() => {
    Animated.timing(timePickerOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setIsTimePickerVisible(false));
  }, [timePickerOpacity]);

  const handleTimeChange = useCallback(
    (_, time: Date | undefined) => {
      if (time) {
        setSelectedTime(time);
        hideTimePicker();
      }
    },
    [hideTimePicker],
  );

  const handleSubmit = async () => {
    if (!user) {
      setError("User not logged in");
      return;
    }

    if (!selectedDuration || isNaN(parseInt(selectedDuration))) {
      setError("Please enter a valid duration in minutes");
      return;
    }

    const duration = parseInt(selectedDuration);
    if (duration <= 0) {
      setError("Duration must be a positive number");
      return;
    }

    const reservationDateStr = selectedDate.toISOString().split("T")[0];
    const arrivalTimeStr = selectedTime.toTimeString().substring(0, 8);

    try {
      setLoading(true);
      const reservationData = {
        connector_id: parseInt(connectorId),
        arrival_time: arrivalTimeStr,
        duration,
        user_id: user.id,
        reservation_date: reservationDateStr,
      };

      const response = await createReservation(reservationData);
      await fetchReservations(parseInt(connectorId), reservationDateStr);
      Alert.alert("Success", "Reservation confirmed!");
      router.back();
    } catch (error) {
      if (error.response && error.response.status === 409) {
        setError("Selected time conflicts with existing reservation");
      } else {
        console.error("Error creating reservation:", error);
        setError("Failed to create reservation");
      }
    } finally {
      setLoading(false);
    }
  };

  const getReservationBlocks = () => {
    return reservations.map((res) => {
      const arrival = new Date(`${res.reservation_date}T${res.arrival_time}`);
      const end = new Date(arrival);
      end.setMinutes(end.getMinutes() + res.duration);
      return { arrival, end, ...res };
    });
  };

  const renderCalendarView = () => {
    const reservationBlocks = getReservationBlocks();
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <ScrollView
        style={styles.calendarView}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={true}
      >
        {hours.map((hour) => {
          const hourStart = new Date(selectedDate);
          hourStart.setHours(hour, 0, 0, 0);
          const hourEnd = new Date(hourStart);
          hourEnd.setHours(hourEnd.getHours() + 1);

          const overlappingBlocks = reservationBlocks.filter((block) => {
            return block.arrival < hourEnd && block.end > hourStart;
          });

          return (
            <View key={hour} style={styles.hourContainer}>
              <View style={styles.hourLabelContainer}>
                <Text style={styles.hourLabel}>{`${hour}:00`}</Text>
              </View>
              <View style={styles.reservationContainer}>
                {overlappingBlocks.map((block, index) => (
                  <View
                    key={index}
                    style={[
                      styles.reservationBlock,
                      {
                        backgroundColor: "#FFA500",
                      },
                    ]}
                  >
                    <Text style={styles.reservationText}>
                      "Technical reservation"
                    </Text>
                    <Text style={styles.reservationTime}>
                      {block.arrival.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}{" "}
                      -{" "}
                      {block.end.toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        {connectorDetails ? (
          <Text style={styles.headerTitle}>
            {connectorDetails.location_name} | {connectorDetails.connector_type}{" "}
            | Power: {connectorDetails.power} kW
          </Text>
        ) : (
          <Text style={styles.headerTitle}>Loading Details...</Text>
        )}
      </View>

      <View style={styles.calendarContainer}>
        {Array.from({ length: 7 }, (_, i) => {
          const day = new Date();
          day.setDate(day.getDate() + i);
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.dayButton,
                selectedDate.toDateString() === day.toDateString()
                  ? styles.selectedDay
                  : null,
              ]}
              onPress={() => setSelectedDate(day)}
            >
              <Text style={styles.dayText}>
                {day.toLocaleDateString("en-GB", { weekday: "short" })}
              </Text>
              <Text style={styles.dateText}>{day.getDate()}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {renderCalendarView()}

      <TouchableOpacity style={styles.timeSelector} onPress={showTimePicker}>
        <Text style={styles.timeSelectorText}>Select Time</Text>
      </TouchableOpacity>
      <Text style={styles.selectedTimeText}>
        Selected Time: {formattedTime}
      </Text>

      <View style={styles.durationInputContainer}>
        <Text style={styles.durationInputLabel}>Enter Duration (minutes):</Text>
        <TextInput
          style={styles.durationInput}
          keyboardType="numeric"
          value={selectedDuration}
          onChangeText={(text) => setSelectedDuration(text)}
        />
      </View>

      <Animated.View
        style={[styles.pickerContainer, { opacity: timePickerOpacity }]}
      >
        {isTimePickerVisible && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display="spinner"
            onChange={handleTimeChange}
            is24Hour={true}
            minuteInterval={5}
          />
        )}
      </Animated.View>

      <TouchableOpacity
        style={styles.submitButton}
        disabled={loading}
        onPress={handleSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>Confirm Reservation</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#333333",
    borderRadius: 8,
    marginBottom: 16,
  },
  backButton: {
    marginRight: 10,
  },
  backButtonText: {
    color: "white",
    fontSize: 30,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  calendarContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dayButton: {
    width: "14%",
    padding: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "white",
  },
  selectedDay: {
    backgroundColor: "#4c86af",
  },
  dayText: {
    color: "#333",
    fontWeight: "500",
    fontSize: 12,
  },
  dateText: {
    color: "#333",
    fontWeight: "bold",
    fontSize: 14,
  },
  errorText: {
    color: "red",
    marginBottom: 16,
  },
  calendarView: {
    marginTop: 16,
    maxHeight: 400,
    backgroundColor: "white",
  },
  hourContainer: {
    flexDirection: "row",
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  hourLabelContainer: {
    width: 80,
    justifyContent: "center",
    paddingLeft: 8,
    borderRightWidth: 0.5,
    borderColor: "#ddd",
  },
  hourLabel: {
    fontSize: 14,
    color: "#333",
  },
  reservationContainer: {
    flex: 1,
    paddingLeft: 16,
  },
  reservationBlock: {
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  reservationText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  reservationTime: {
    color: "white",
    fontSize: 12,
  },
  timeSelector: {
    padding: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    marginBottom: 16,
  },
  timeSelectorText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  selectedTimeText: {
    fontSize: 16,
    marginBottom: 24,
    color: "#333",
  },
  durationInputContainer: {
    marginBottom: 24,
  },
  durationInputLabel: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
  },
  durationInput: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "white",
  },
  pickerContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: "#4c86af",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default ReservationScreen;
