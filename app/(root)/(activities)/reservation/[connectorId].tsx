import React, { useState, useEffect, useCallback } from "react";
import {
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
  arrival_time: string;
  duration: number;
}

const ReservationScreen = () => {
  const { connectorId } = useLocalSearchParams<{ connectorId: string }>();
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedDuration, setSelectedDuration] = useState("30"); // Default duration in minutes as string
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePickerOpacity] = useState(new Animated.Value(0));
  const [connectorDetails, setConnectorDetails] = useState<{
    stationNumber: string;
    connectorType: string;
    power: number;
    locationName: string;
  } | null>(null);
  const { user } = useUser();

  // Format the selected time to HH:MM:SS
  const formatTimeForDatabase = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}:00`;
  };

  // Fetch reservations when the component mounts
  useEffect(() => {
    const loadReservations = async () => {
      if (connectorId) {
        try {
          const data = await fetchReservations(parseInt(connectorId));
          setReservations(data);
        } catch (err) {
          setError("Failed to load reservations");
        }
      }
    };
    loadReservations();
  }, [connectorId]);

  useEffect(() => {
    const loadReservations = async () => {
      if (connectorId) {
        try {
          const [data, connectorDetails] = await Promise.all([
            fetchReservations(parseInt(connectorId)),
            fetchConnectorDetails(parseInt(connectorId)),
          ]);
          setReservations(data);
          setConnectorDetails({
            stationNumber: connectorDetails.station_number,
            connectorType: connectorDetails.connector_type,
            power: connectorDetails.power,
            locationName: connectorDetails.location_name,
          });
        } catch (err) {
          setError("Failed to load data");
        }
      }
    };
    loadReservations();
  }, [connectorId]);
  // Format the selected time
  const formattedTime = selectedTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Handle time picker animation
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

  // Handle time change
  const handleTimeChange = useCallback(
    (_, time: Date | undefined) => {
      if (time) {
        setSelectedTime(time);
        hideTimePicker();
      }
    },
    [hideTimePicker],
  );

  // Handle reservation submission
  const handleSubmit = useCallback(async () => {
    if (!connectorId || !user) return;

    const duration = parseInt(selectedDuration);
    if (isNaN(duration) || duration <= 0) {
      setError("Please enter a valid duration.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check for time conflicts using normalized times
      if (isTimeConflicted()) {
        setError(
          "Selected time conflicts with an existing reservation. Please choose another time.",
        );
        setLoading(false);
        return;
      }

      const dbFormattedTime = formatTimeForDatabase(selectedTime);
      await createReservation({
        connector_id: parseInt(connectorId),
        arrival_time: dbFormattedTime,
        duration: duration,
        user_id: user.id,
      });

      const updated = await fetchReservations(parseInt(connectorId));
      setReservations(updated);
      router.back();
    } catch (err) {
      setError("Reservation failed. Please try again.");
      console.error("Error creating reservation:", err);
    } finally {
      setLoading(false);
    }
  }, [connectorId, selectedTime, selectedDuration, router, user, reservations]);

  // Generate hourly time slots for the day
  const generateHourlySlots = () => {
    const slots = [];
    const startHour = 0; // 12 AM
    const endHour = 23; // 11 PM

    for (let hour = startHour; hour <= endHour; hour++) {
      const time = new Date();
      time.setHours(hour);
      time.setMinutes(0);
      time.setSeconds(0);

      slots.push(time);
    }

    return slots;
  };

  // Helper function to convert minutes to pixels (assuming 60 minutes = 60 pixels)
  const minutesToPixels = (minutes: number) => {
    return minutes;
  };

  // Get reservation blocks with their start and end times
  const getReservationBlocks = () => {
    return reservations.map((reservation) => {
      const arrival = new Date(`1970-01-01T${reservation.arrival_time}`);
      const end = new Date(arrival.getTime() + reservation.duration * 60000); // Convert minutes to milliseconds

      return {
        arrival,
        end,
        durationInMinutes: reservation.duration,
      };
    });
  };

  // Format time for display in 24-hour format
  const formatTimeForDisplay = (time: Date) => {
    return time.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const isTimeConflicted = () => {
    // Normalize selected time to base date (1970-01-01)
    const normalizedSelectedStartTime = new Date(
      `1970-01-01T${formatTimeForDatabase(selectedTime)}`,
    );
    const durationInMinutes = parseInt(selectedDuration);
    const normalizedSelectedEndTime = new Date(
      normalizedSelectedStartTime.getTime() + durationInMinutes * 60000,
    );

    return reservations.some((reservation) => {
      const resStartTime = new Date(`1970-01-01T${reservation.arrival_time}`);
      const resEndTime = new Date(
        resStartTime.getTime() + reservation.duration * 60000,
      );

      // Standard interval overlap check
      return (
        normalizedSelectedStartTime < resEndTime &&
        resStartTime < normalizedSelectedEndTime
      );
    });
  };

  return (
    <ScrollView style={styles.container}>
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
            {connectorDetails.locationName} - {connectorDetails.stationNumber}
            {"\n"}
            Connector: {connectorDetails.connectorType} | Power:{" "}
            {connectorDetails.power} kW
          </Text>
        ) : (
          <Text style={styles.headerTitle}>Loading Details...</Text>
        )}
      </View>

      {/* Error Message */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Calendar View */}
      <ScrollView
        style={styles.calendarContainer}
        vertical
        showsVerticalScrollIndicator
        alwaysBounceVertical={true}
      >
        {/* Hourly Slots */}
        {generateHourlySlots().map((hourTime, hourIndex) => (
          <View key={hourIndex} style={styles.hourContainer}>
            <View style={styles.hourLabelContainer}>
              <Text style={styles.hourLabel}>
                {formatTimeForDisplay(hourTime).split(":")[0] +
                  ":" +
                  formatTimeForDisplay(hourTime).split(":")[1]}
              </Text>
            </View>
            <View style={styles.hourBlock}>
              {/* Reserved Blocks within the hour */}
              {getReservationBlocks().map((block, blockIndex) => {
                const blockStartHour = block.arrival.getHours();
                const blockStartMinute = block.arrival.getMinutes();
                const blockEndHour = block.end.getHours();
                const blockEndMinute = block.end.getMinutes();

                if (
                  blockStartHour === hourTime.getHours() ||
                  blockEndHour === hourTime.getHours()
                ) {
                  // Calculate the top position and height of the block within the hour
                  const topPosition =
                    blockStartHour === hourTime.getHours()
                      ? minutesToPixels(blockStartMinute)
                      : 0;

                  const blockHeight = minutesToPixels(
                    blockEndHour === blockStartHour
                      ? blockEndMinute - blockStartMinute
                      : (blockEndHour - blockStartHour) * 60 + blockEndMinute,
                  );

                  return (
                    <View
                      key={blockIndex}
                      style={[
                        styles.reservationBlock,
                        {
                          top: topPosition,
                          height: blockHeight,
                        },
                      ]}
                    >
                      <Text style={styles.reservationText}>
                        Reserved
                        {"\n"}
                        {formatTimeForDisplay(block.arrival)} -{" "}
                        {formatTimeForDisplay(block.end)}
                      </Text>
                    </View>
                  );
                }

                return null;
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Time Selection */}
      <TouchableOpacity style={styles.timeSelector} onPress={showTimePicker}>
        <Text style={styles.timeSelectorText}>Select Time</Text>
      </TouchableOpacity>
      <Text style={styles.selectedTimeText}>
        Selected Time: {formattedTime}
      </Text>

      {/* Duration Input */}
      <View style={styles.durationInputContainer}>
        <Text style={styles.durationInputLabel}>Enter Duration (minutes):</Text>
        <TextInput
          style={styles.durationInput}
          keyboardType="numeric"
          value={selectedDuration}
          onChangeText={(text) => setSelectedDuration(text)}
        />
      </View>

      {/* Animated Time Picker */}
      <Animated.View
        style={[styles.pickerContainer, { opacity: timePickerOpacity }]}
      >
        {isTimePickerVisible && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display="spinner"
            onChange={handleTimeChange}
            locale="en-GB-u-hc-h23"
            is24Hour={true}
            minuteInterval={5}
          />
        )}
      </Animated.View>

      {/* Submit Button */}
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
    </ScrollView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#222222",
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
  errorText: {
    color: "red",
    marginBottom: 16,
  },
  calendarContainer: {
    marginTop: 16,
    maxHeight: 400,
  },
  hourContainer: {
    flexDirection: "row",
    height: 60,
  },
  hourLabelContainer: {
    width: 60,
    justifyContent: "center",
    paddingLeft: 8,
    borderRightWidth: 0.5,
    borderColor: "#ccc",
  },
  hourLabel: {
    fontSize: 14,
  },
  hourBlock: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#eee",
    position: "relative",
  },
  reservationBlock: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#4285F4",
    borderRadius: 4,
    justifyContent: "center",
    paddingLeft: 8,
  },
  reservationText: {
    color: "white",
    fontWeight: "bold",
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
  },
  selectedTimeText: {
    fontSize: 16,
    marginBottom: 24,
  },
  durationInputContainer: {
    marginBottom: 24,
  },
  durationInputLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  durationInput: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  pickerContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: "#4CAF50",
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
